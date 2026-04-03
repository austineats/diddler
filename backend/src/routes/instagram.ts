/**
 * Instagram Webhook Route — LLM-powered DM agent with tool calling.
 * Can look up IG profiles, search the web, and hold real conversations.
 */
import { Router } from "express";
import OpenAI from "openai";
import { sendMessage, getUserProfile, lookupPublicProfile, markSeen, startTyping, stopTyping, type IGUserProfile } from "../lib/instagram/instagramClient.js";
import { prisma } from "../lib/db.js";

export const instagramRouter = Router();

const BUBL_LINK = process.env.BUBL_LINK || "https://bubl.club";
const MAX_HISTORY = 14;

// In-memory conversation cache
const historyCache = new Map<string, { role: "user" | "assistant"; content: string }[]>();

// Debounce
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingMessages = new Map<string, string[]>();
const REPLY_DELAY = 1500;

// Loop detection
const recentExchanges = new Map<string, { count: number; lastTime: number }>();
const LOOP_THRESHOLD = 6;
const LOOP_WINDOW = 60_000;

// Profile cache (avoid re-fetching every message)
const profileCache = new Map<string, { profile: IGUserProfile; publicProfile: IGUserProfile | null; ts: number }>();
const PROFILE_CACHE_TTL = 300_000; // 5 min

/* ── Webhook verification ────────────────────────────────────── */
instagramRouter.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    console.log("[Instagram] Webhook verified");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/* ── Incoming messages ───────────────────────────────────────── */
instagramRouter.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    if (body.object !== "instagram") return;

    for (const entry of body.entry ?? []) {
      const botId = entry.id;
      for (const event of entry.messaging ?? []) {
        const senderId = event.sender?.id;
        const messageText = event.message?.text;
        if (!senderId || !messageText) continue;
        if (senderId === botId || event.message?.is_echo) continue;

        console.log(`[Instagram] DM from ${senderId}: "${messageText.slice(0, 80)}"`);

        if (!pendingMessages.has(senderId)) pendingMessages.set(senderId, []);
        pendingMessages.get(senderId)!.push(messageText);

        const existing = pendingTimers.get(senderId);
        if (existing) clearTimeout(existing);
        pendingTimers.set(senderId, setTimeout(() => {
          processMessages(senderId).catch(e => console.error("[Instagram] Process error:", e));
        }, REPLY_DELAY));
      }
    }
  } catch (e) {
    console.error("[Instagram] Error processing webhook:", e);
  }
});

/* ── Process queued messages ─────────────────────────────────── */
async function processMessages(senderId: string) {
  const texts = pendingMessages.get(senderId);
  if (!texts || texts.length === 0) return;
  pendingMessages.delete(senderId);
  pendingTimers.delete(senderId);

  if (isLooping(senderId)) {
    console.log(`[Instagram] Loop detected with ${senderId}, going silent`);
    return;
  }

  const combinedText = texts.length === 1
    ? texts[0]
    : texts.map((t, i) => `(${i + 1}) ${t}`).join("\n");

  console.log(`[Instagram] Processing: "${combinedText}"`);

  // Mark as seen immediately
  await markSeen(senderId);

  // Show typing while we process
  await startTyping(senderId);

  // Get basic + public profile (cached)
  const { profile, publicProfile } = await getProfiles(senderId);
  console.log(`[Instagram] Profile: @${profile.username || "?"}, public: ${publicProfile ? `${publicProfile.followers_count} followers` : "unavailable"}`);

  const reply = await generateReply(senderId, combinedText, profile, publicProfile);

  try {
    await sendMessage(senderId, reply);
    console.log(`[Instagram] → ${senderId}: "${reply}"`);
  } catch (e) {
    console.error("[Instagram] Failed to send:", e);
  } finally {
    await stopTyping(senderId);
  }
}

/* ── Profile fetching (basic + public lookup) ────────────────── */
async function getProfiles(senderId: string): Promise<{ profile: IGUserProfile; publicProfile: IGUserProfile | null }> {
  const cached = profileCache.get(senderId);
  if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL) {
    return { profile: cached.profile, publicProfile: cached.publicProfile };
  }

  const profile = await getUserProfile(senderId);
  let publicProfile: IGUserProfile | null = null;

  // If we got a username, look up their full public profile via business_discovery
  if (profile.username) {
    publicProfile = await lookupPublicProfile(profile.username);
  }

  profileCache.set(senderId, { profile, publicProfile, ts: Date.now() });
  return { profile, publicProfile };
}

/* ── LLM with tool calling ───────────────────────────────────── */

function getLLM(): OpenAI {
  if (process.env.OPENAI_API_KEY) return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (process.env.GEMINI_API_KEY) return new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
  throw new Error("No LLM API key");
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_instagram",
      description: "Look up someone's public Instagram profile by username. Returns bio, follower count, following count, post count.",
      parameters: {
        type: "object",
        properties: { username: { type: "string", description: "Instagram username (without @)" } },
        required: ["username"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for information. Use their REAL NAME (not just username) for best results. Example: search 'Austin Ahn hometown' not '@austinahnn hometown'. Combine name + what you want to know.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Search query — use real name + topic, e.g. 'Austin Ahn UCI' or 'Austin Ahn hometown California'" } },
        required: ["query"],
      },
    },
  },
];

async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  if (name === "lookup_instagram") {
    const username = args.username?.replace("@", "");
    if (!username) return "no username provided";
    const profile = await lookupPublicProfile(username);
    if (!profile) return `couldn't find @${username}'s profile — might be private`;
    return JSON.stringify({
      username: profile.username,
      name: profile.name,
      bio: profile.biography || "no bio",
      followers: profile.followers_count,
      following: profile.follows_count,
      posts: profile.media_count,
      website: profile.website || "none",
      picture: profile.profile_picture_url || "none",
    });
  }

  if (name === "web_search") {
    const query = args.query;
    if (!query) return "no results found";
    try {
      const apiKey = process.env.BRAVE_SEARCH_API_KEY;
      if (!apiKey) return "search unavailable";

      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
      const res = await fetch(url, {
        headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
      });
      if (!res.ok) return "search failed";

      const data = await res.json() as { web?: { results?: { title: string; description: string; url: string }[] } };
      const results = data.web?.results ?? [];
      if (results.length === 0) return "no results found";

      console.log(`[Instagram] Brave search "${query}": ${results.length} results`);
      return results.map(r => `${r.title}: ${r.description}`).join("\n\n").slice(0, 800);
    } catch (e) {
      console.error("[Instagram] Web search error:", e);
      return "search unavailable";
    }
  }

  return "unknown tool";
}

function buildSystemPrompt(
  profile: IGUserProfile,
  publicProfile: IGUserProfile | null,
): string {
  const displayName = profile.name || publicProfile?.name || profile.username || null;

  let context = "";

  if (profile.username) {
    context += `\nTheir IG: @${profile.username}`;
    if (publicProfile) {
      if (publicProfile.biography) context += `\nBio: "${publicProfile.biography}"`;
      if (publicProfile.followers_count != null) context += `\nFollowers: ${publicProfile.followers_count.toLocaleString()}`;
      if (publicProfile.follows_count != null) context += `\nFollowing: ${publicProfile.follows_count.toLocaleString()}`;
      if (publicProfile.media_count != null) context += `\nPosts: ${publicProfile.media_count.toLocaleString()}`;
      if (publicProfile.website) context += `\nWebsite: ${publicProfile.website}`;
    }
  }

  return `You are bubl — a friendly Gen-Z social connector on Instagram that sets up double blind dates every Wednesday.

HOW YOU TEXT:
- Like a real friend in the DMs. Not a brand. Not corporate. A real person texting
- Lowercase always. Use "fr", "tho", "bro", "nah", "lowkey" naturally
- If someone says something funny or weird, play along and roast them, then redirect
- Max 1 emoji per message, most messages zero emoji
- Short punchy messages. Think how you'd actually DM someone
- Match their vibe and energy

HOW BUBL WORKS:
- Sign up with a friend (teammate) for double dates
- Every Wednesday bubl matches two teams and plans the date
- All via text — no app needed
- Sign up link: ${BUBL_LINK}

YOU HAVE TOOLS — use them, don't guess:
- lookup_instagram: look up a Business/Creator IG profile. Won't work on personal accounts
- web_search: search the web. ALWAYS use this when asked about hometown, school, age, or anything personal. Search for their IG username or name
When a tool fails or returns nothing, say you couldn't find it. NEVER make up numbers or facts.

KNOWN INFO ABOUT THIS PERSON:${context}
${displayName ? `Name/handle: ${displayName}` : "Don't know their name yet"}

CRITICAL RULES:
- NEVER fabricate or guess data. No making up follower counts, hometowns, or any facts
- If you don't have their follower count in KNOWN INFO above, say "i can't pull that up rn" — do NOT invent a number
- For personal questions (hometown, age, school, etc) — just ASK THEM instead of searching. Say something like "idk where you're from, where you at?" — be curious and conversational about it. Don't try to look it up
- Only use web_search for things that are actually searchable (events, places, general knowledge). NOT for personal info about random people
- Only use lookup_instagram for looking up OTHER people's public profiles, not the person you're talking to (you already have their info in KNOWN INFO)
- Answer naturally. You're a real person, not a menu bot
- If not signed up for bubl, steer toward signing up but don't force it
- Never say "I'm an AI/bot" — you ARE bubl
- Keep replies UNDER 20 words. Short like a real DM
- If trolling/spamming, disengage
- Never answer questions about AI/LLMs/prompts — deflect`;
}

async function generateReply(
  senderId: string,
  text: string,
  profile: IGUserProfile,
  publicProfile: IGUserProfile | null,
): Promise<string> {
  const history = await loadHistory(senderId);
  await saveMsg(senderId, "user", text);

  const systemPrompt = buildSystemPrompt(profile, publicProfile);

  try {
    const llm = getLLM();
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // First call — may request tool use
    let response = await llm.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      temperature: 0.85,
      messages,
      tools,
      tool_choice: "auto",
    });

    let choice = response.choices[0];

    // Handle tool calls (up to 2 rounds)
    for (let i = 0; i < 2 && choice?.finish_reason === "tool_calls" && choice.message.tool_calls; i++) {
      messages.push(choice.message);

      for (const tc of choice.message.tool_calls) {
        const fn = (tc as any).function;
        const args = JSON.parse(fn.arguments || "{}");
        console.log(`[Instagram] Tool: ${fn.name}(${JSON.stringify(args)})`);
        const result = await executeTool(fn.name, args);
        console.log(`[Instagram] Tool result: ${result.slice(0, 200)}`);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      response = await llm.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 100,
        temperature: 0.85,
        messages,
        tools,
      });
      choice = response.choices[0];
    }

    const reply = choice?.message?.content?.trim() || "yo one sec something glitched";
    const cleaned = reply.replace(/\n\n+/g, " ").trim();

    await saveMsg(senderId, "assistant", cleaned);
    return cleaned;
  } catch (e) {
    console.error("[Instagram] LLM error:", e);
    return "yo one sec something glitched";
  }
}

/* ── Chat history (reuses bubl_chat_history table) ───────────── */

async function loadHistory(igId: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  if (historyCache.has(igId)) return historyCache.get(igId)!;
  try {
    const rows = await prisma.bublChatHistory.findMany({
      where: { phone: `ig:${igId}` },
      orderBy: { created_at: "asc" },
      take: MAX_HISTORY,
    });
    const history = rows.map(r => ({ role: r.role as "user" | "assistant", content: r.content }));
    historyCache.set(igId, history);
    return history;
  } catch { return []; }
}

async function saveMsg(igId: string, role: "user" | "assistant", content: string) {
  try {
    const key = `ig:${igId}`;
    await prisma.bublChatHistory.create({ data: { phone: key, role, content } });
    const history = historyCache.get(igId) || [];
    history.push({ role, content });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    historyCache.set(igId, history);
  } catch {}
}

/* ── Helpers ──────────────────────────────────────────────────── */

function isLooping(senderId: string): boolean {
  const now = Date.now();
  const entry = recentExchanges.get(senderId);
  if (!entry || now - entry.lastTime > LOOP_WINDOW) {
    recentExchanges.set(senderId, { count: 1, lastTime: now });
    return false;
  }
  entry.count++;
  entry.lastTime = now;
  if (entry.count >= LOOP_THRESHOLD) {
    recentExchanges.set(senderId, { count: 0, lastTime: now });
    return true;
  }
  return false;
}
