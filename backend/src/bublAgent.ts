import { IMessageSDK, type Message } from "@photon-ai/imessage-kit";
import OpenAI from "openai";
import { prisma } from "./lib/db.js";
import { sendContactCard } from "./lib/imessage/contactCard.js";

const sdk = new IMessageSDK();
const TYPING_URL = process.env.TYPING_URL ?? "http://localhost:5055";

// Per-user conversation history with message tracking
type ChatMessage = { role: "user" | "assistant"; content: string; timestamp: number };
const conversations = new Map<string, ChatMessage[]>();
const sentCard = new Set<string>();

// Debounce — wait for user to stop typing before replying (catches multi-text bursts)
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingMessages = new Map<string, { texts: string[]; lastMsg: Message }>();

const REPLY_DELAY = 1200; // ms to wait after last message before replying
const MAX_HISTORY = 30;

// ─── LLM client ───

function getLLM(): OpenAI {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return new OpenAI({ apiKey: anthropicKey, baseURL: "https://api.anthropic.com/v1/" });
  }
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return new OpenAI({
      apiKey: geminiKey,
      baseURL: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }
  throw new Error("No LLM API key (ANTHROPIC_API_KEY or GEMINI_API_KEY)");
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

// ─── System prompt ───

function buildSystemPrompt(
  user: { name: string; gender?: string | null } | null,
  team: { code: string; status: string; player1_name: string; player2_name: string | null; player1_ready: boolean; player2_ready: boolean } | null,
): string {
  const firstName = user?.name?.split(" ")[0] || "there";

  let context = "";
  if (user) {
    context += `\nUser: ${user.name} (call them "${firstName}"). Gender: ${user.gender || "unknown"}.`;
    context += ` They are signed up on the waitlist.`;
  }
  if (team) {
    const isP1 = team.player1_name === user?.name;
    const teammateName = isP1 ? team.player2_name : team.player1_name;
    const ready = isP1 ? team.player1_ready : team.player2_ready;
    context += `\nTeam code: ${team.code}. Status: ${team.status}.`;
    context += teammateName ? ` Teammate: ${teammateName}.` : ` No teammate yet — they need to invite a friend.`;
    context += ` ${firstName} is ${ready ? "READY" : "NOT READY (hasn't confirmed yet)"}.`;
    if (team.status === "full") context += ` Both slots filled — match can happen!`;
  }
  if (!user) {
    context += `\nThis person is NOT signed up. They need to go to bubl.buzz to join.`;
  }

  return `You are bubl — a friendly Gen-Z matchmaker that sets up double dates every Thursday via iMessage.

HOW YOU TEXT:
- Like a close friend: casual, warm, hyped, supportive
- Lowercase, abbreviations, emojis (💜 👀 🔥 😭 🫶 ✨), slang
- SHORT — 1-2 sentences max. This is iMessage not email
- Playful, teasing, fun. Never robotic or corporate
- Use their name naturally (not every message)
- Match their energy and vibe
- If they sent multiple texts in a row, address all of them in one cohesive reply

HOW BUBL WORKS:
- Sign up with a friend (teammate) for double dates
- Every Thursday bubl matches two teams together
- All via iMessage — no app needed
- Users "ready up" by texting bubl after signing up
- Both teammates must join before matching begins
- Invite link: bubl.buzz

CONTEXT:${context}

RULES:
- If they mention signing up or being ready, hype them up
- If asking about their match, build excitement without making up details
- If not signed up, warmly push them to bubl.buzz
- If teammate hasn't joined, remind them to share the invite
- Never say "I'm an AI/bot" — you ARE bubl, a matchmaker
- NEVER repeat the same response you already sent
- Keep replies to 1-2 short texts. Separate with \\n\\n for separate iMessages
- Be genuine, not performative. Read the room`;
}

// ─── Generate reply via LLM ───

async function generateReply(
  sender: string,
  combinedText: string,
  user: Awaited<ReturnType<typeof lookupUser>>,
  team: Awaited<ReturnType<typeof lookupTeam>>,
): Promise<string[]> {
  if (!conversations.has(sender)) conversations.set(sender, []);
  const history = conversations.get(sender)!;

  history.push({ role: "user", content: combinedText, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const systemPrompt = buildSystemPrompt(user, team);

  try {
    const llm = getLLM();
    const response = await llm.chat.completions.create({
      model: getModel(),
      max_tokens: 250,
      temperature: 0.85,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim() || "hey 💜 one sec, something glitched on my end";

    // Split on double newlines for separate iMessages
    const parts = reply.split(/\n\n+/).map(s => s.trim()).filter(Boolean);
    const messages = parts.length > 0 ? parts.slice(0, 3) : [reply];

    history.push({ role: "assistant", content: messages.join("\n\n"), timestamp: Date.now() });

    return messages;
  } catch (e) {
    console.error("[bubl] LLM error:", e);
    const firstName = user?.name?.split(" ")[0] || "";
    return [firstName ? `hey ${firstName}! 💜 give me one sec` : "hey! 💜 give me one sec"];
  }
}

// ─── Process queued messages (fires after debounce) ───

async function processMessages(sender: string) {
  const pending = pendingMessages.get(sender);
  if (!pending || pending.texts.length === 0) return;

  const { texts, lastMsg } = pending;
  pendingMessages.delete(sender);
  pendingTimers.delete(sender);

  // Combine all texts from burst into one context so LLM sees the full picture
  const combinedText = texts.length === 1
    ? texts[0]
    : texts.map((t, i) => `(${i + 1}) ${t}`).join("\n");

  console.log(`[bubl] Processing ${texts.length} msg(s) from ${sender}: "${combinedText}"`);

  await startTyping(sender);

  // Look up user context
  const user = await lookupUser(sender);
  const team = user ? await lookupTeam(sender) : null;
  const firstName = user?.name?.split(" ")[0] || null;

  // Check for ready-up trigger
  const lower = combinedText.toLowerCase();
  if (user && (lower.includes("signed up") || lower.includes("ive signed up") || lower.includes("i've signed up") || lower.includes("i signed up"))) {
    await markReady(sender);
    logActivity("ready_up", firstName || undefined, normalizePhone(sender), `Team: ${team?.code || "none"}`);
  }

  // Generate LLM reply
  const replies = await generateReply(sender, combinedText, user, team);

  logActivity("message", firstName || undefined, normalizePhone(sender), `"${combinedText}" → "${replies.join(" | ")}"`);

  // Send replies using the message chain for proper routing
  for (let i = 0; i < replies.length; i++) {
    if (i > 0) {
      await startTyping(sender);
      await sleep(300 + Math.random() * 300);
    }
    await sdk.message(lastMsg)
      .ifFromOthers()
      .replyText(replies[i])
      .execute();
    console.log(`[bubl] → ${sender}: "${replies[i]}"`);
  }

  await stopTyping(sender);

  // Contact card on first interaction
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
}

// ─── Main agent ───

export async function startBublAgent() {
  await sdk.startWatching({
    onDirectMessage: async (msg: Message) => {
      if (msg.isFromMe) return;
      if (msg.isReaction) return; // skip tapbacks

      const sender = msg.sender;
      const text = (msg.text || "").trim();
      if (!text) return;

      console.log(`[bubl] ← ${sender} [${msg.guid}]: "${text}"`);

      // Read receipt immediately
      await sendReadReceipt(sender);

      // Queue this message — debounce catches multi-text bursts
      if (!pendingMessages.has(sender)) {
        pendingMessages.set(sender, { texts: [], lastMsg: msg });
      }
      const pending = pendingMessages.get(sender)!;
      pending.texts.push(text);
      pending.lastMsg = msg; // always use latest for reply routing

      // Reset debounce timer — wait for them to finish typing
      const existing = pendingTimers.get(sender);
      if (existing) clearTimeout(existing);

      pendingTimers.set(sender, setTimeout(() => {
        processMessages(sender).catch(e => console.error("[bubl] Process error:", e));
      }, REPLY_DELAY));
    },
  });

  console.log("[bubl] Agent active — listening for iMessages");
}
