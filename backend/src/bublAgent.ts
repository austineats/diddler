import { IMessageSDK } from "@photon-ai/imessage-kit";
import OpenAI from "openai";
import { prisma } from "./lib/db.js";
import { sendContactCard } from "./lib/imessage/contactCard.js";

const sdk = new IMessageSDK();
const TYPING_URL = process.env.TYPING_URL ?? "http://localhost:5055";

// Per-user conversation history (kept in memory, last 20 messages)
const conversations = new Map<string, { role: "user" | "assistant"; content: string }[]>();
const sentCard = new Set<string>();

// ─── LLM client ───

function getLLM(): OpenAI {
  // Prefer Anthropic if available, fall back to Gemini
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return new OpenAI({
      apiKey: anthropicKey,
      baseURL: "https://api.anthropic.com/v1/",
    });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return new OpenAI({
      apiKey: geminiKey,
      baseURL: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  throw new Error("No LLM API key set (ANTHROPIC_API_KEY or GEMINI_API_KEY)");
}

function getModel(): string {
  if (process.env.ANTHROPIC_API_KEY) return "claude-haiku-4-5-20251001";
  return "gemini-flash-lite-latest";
}

// ─── Helpers ───

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function sendReadReceipt(phone: string) {
  try { await fetch(`${TYPING_URL}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat: phone }) }); } catch {}
}
async function startTyping(phone: string) {
  try { await fetch(`${TYPING_URL}/typing/start`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat: phone }) }); } catch {}
}
async function stopTyping(phone: string) {
  try { await fetch(`${TYPING_URL}/typing/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat: phone }) }); } catch {}
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

// ─── DB lookups ───

async function lookupUser(phone: string) {
  const normalized = normalizePhone(phone);
  try {
    return await prisma.blindDateSignup.findFirst({
      where: { OR: [{ phone: normalized }, { phone }, { phone: normalized.replace("+1", "") }] },
    });
  } catch { return null; }
}

async function lookupTeam(phone: string) {
  const normalized = normalizePhone(phone);
  try {
    return await prisma.blindDateTeam.findFirst({
      where: { OR: [{ player1_phone: normalized }, { player2_phone: normalized }] },
      orderBy: { created_at: "desc" },
    });
  } catch { return null; }
}

async function markReady(phone: string) {
  const normalized = normalizePhone(phone);
  try {
    const team = await lookupTeam(phone);
    if (!team) return null;
    const isP1 = team.player1_phone === normalized;
    return await prisma.blindDateTeam.update({
      where: { id: team.id },
      data: isP1 ? { player1_ready: true } : { player2_ready: true },
    });
  } catch { return null; }
}

async function logActivity(action: string, name?: string, phone?: string, details?: string) {
  try {
    await prisma.adminActivityLog.create({
      data: { action, actor_name: name || undefined, actor_phone: phone || undefined, details: details || undefined },
    });
  } catch {}
}

// ─── System prompt builder ───

function buildSystemPrompt(user: { name: string; gender?: string | null } | null, team: { code: string; status: string; player1_name: string; player2_name: string | null; player1_ready: boolean; player2_ready: boolean } | null): string {
  const firstName = user?.name?.split(" ")[0] || "there";

  let context = "";
  if (user) {
    context += `\nThe user's name is ${user.name} (call them ${firstName}). Gender: ${user.gender || "unknown"}.`;
  }
  if (team) {
    const isP1 = team.player1_name === user?.name;
    const teammateName = isP1 ? team.player2_name : team.player1_name;
    context += `\nTeam code: ${team.code}. Status: ${team.status}.`;
    if (teammateName) {
      context += ` Teammate: ${teammateName}.`;
    } else {
      context += ` No teammate yet — they need to invite a friend.`;
    }
    const ready = isP1 ? team.player1_ready : team.player2_ready;
    context += ` This user is ${ready ? "READY" : "NOT READY yet"}.`;
  }
  if (!user) {
    context += `\nThis person is NOT signed up yet. Encourage them to sign up at bubl.buzz.`;
  }

  return `You are bubl — a friendly, Gen-Z matchmaker bot that sets up double dates every Thursday via iMessage.

PERSONALITY:
- You text like a close friend: casual, warm, hyped, supportive
- Use lowercase, abbreviations, emojis (💜 👀 🔥 😭 🫶), slang naturally
- Keep messages SHORT — 1-2 sentences max per message. This is iMessage, not email
- Be playful, teasing, and fun. Never robotic or corporate
- Match their energy — if they're hyped, be hyped. If they're chill, be chill
- Use their first name often

HOW BUBL WORKS:
- Users sign up with a friend (teammate) for a double date
- Every Thursday, bubl matches two teams together
- It all happens over iMessage — no app needed
- Users need to "ready up" by texting bubl after signing up
- Both teammates need to join before matching can begin

CURRENT USER CONTEXT:${context}

RULES:
- If they say they "signed up" or are "ready", hype them up and acknowledge it
- If they ask about their match, build excitement but don't reveal details you don't have
- If they haven't signed up, warmly encourage them to go to bubl.buzz
- If their teammate hasn't joined yet, remind them to share the invite link
- Never break character. You ARE bubl
- Never say "I'm an AI" or "I'm a bot" — you're bubl, a matchmaker
- Keep it real and personal. Reference their name and situation
- If you don't know something, be honest but keep the vibe fun
- Reply with 1-2 short messages. Never write paragraphs`;
}

// ─── Generate reply via LLM ───

async function generateReply(sender: string, text: string, user: Awaited<ReturnType<typeof lookupUser>>, team: Awaited<ReturnType<typeof lookupTeam>>): Promise<string[]> {
  // Get or create conversation history
  if (!conversations.has(sender)) conversations.set(sender, []);
  const history = conversations.get(sender)!;

  // Add user message
  history.push({ role: "user", content: text });

  // Keep only last 20 messages
  if (history.length > 20) history.splice(0, history.length - 20);

  const systemPrompt = buildSystemPrompt(user, team);

  try {
    const llm = getLLM();
    const response = await llm.chat.completions.create({
      model: getModel(),
      max_tokens: 200,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim() || "hey 💜 give me a sec, something glitched";

    // Split on double newlines to send as separate iMessages
    const parts = reply.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    const messages = parts.length > 0 ? parts : [reply];

    // Add to history
    history.push({ role: "assistant", content: reply });

    return messages;
  } catch (e) {
    console.error("[bubl] LLM error:", e);
    // Fallback — at least reply something
    const firstName = user?.name?.split(" ")[0] || "";
    return [firstName ? `hey ${firstName}! 💜 give me one sec` : "hey! 💜 give me one sec"];
  }
}

// ─── Main agent ───

export async function startBublAgent() {
  await sdk.startWatching({
    onDirectMessage: async (msg) => {
      if (msg.isFromMe) return;

      const sender = msg.sender;
      const text = (msg.text || "").trim();
      if (!text) return;

      console.log(`[bubl] From ${sender}: "${text}"`);

      // Read receipt
      await sendReadReceipt(sender);
      await sleep(300);

      // Start typing
      await startTyping(sender);

      // Look up user context
      const user = await lookupUser(sender);
      const team = user ? await lookupTeam(sender) : null;
      const firstName = user?.name?.split(" ")[0] || null;

      // Check if this is a ready-up message — mark in DB
      const textLower = text.toLowerCase();
      if (user && (textLower.includes("signed up") || textLower.includes("ive signed up") || textLower.includes("i've signed up"))) {
        await markReady(sender);
        logActivity("ready_up", firstName || undefined, normalizePhone(sender), `Team: ${team?.code || "none"}`);
      }

      // Generate LLM reply
      const replies = await generateReply(sender, text, user, team);

      logActivity("message", firstName || undefined, normalizePhone(sender), `"${text}" → "${replies.join(" | ")}"`);

      // Send replies with realistic typing gaps
      for (let i = 0; i < replies.length; i++) {
        if (i > 0) {
          await startTyping(sender);
          await sleep(300 + Math.random() * 400);
        }
        await sdk.send(sender, replies[i]);
        console.log(`[bubl] → ${sender}: "${replies[i]}"`);
      }

      await stopTyping(sender);

      // Send contact card on first interaction
      if (!sentCard.has(sender)) {
        sentCard.add(sender);
        await sleep(500);
        try {
          await sendContactCard(sender);
          console.log(`[bubl] Sent contact card to ${sender}`);
        } catch (e) {
          console.warn(`[bubl] Contact card failed:`, e);
        }
      }
    },
  });

  console.log("[bubl] Agent active — listening for iMessages");
}
