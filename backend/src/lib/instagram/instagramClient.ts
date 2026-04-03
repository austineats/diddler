/**
 * Instagram Graph API client for Bubl chatbot.
 *
 * Handles sending messages, fetching user data via the IG Business API,
 * and looking up public profiles by username.
 */

const GRAPH_API = "https://graph.facebook.com/v21.0";

function getToken(): string {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("INSTAGRAM_ACCESS_TOKEN not set");
  return token;
}

/* ── Resolve Page ID + IG Business Account ID (cached) ───────── */
let cachedPageId: string | null = null;
let cachedIGBusinessId: string | null = null;

async function resolveIds(): Promise<{ pageId: string; igId: string | null }> {
  if (cachedPageId) return { pageId: cachedPageId, igId: cachedIGBusinessId };

  const res = await fetch(
    `${GRAPH_API}/me?fields=id,name,instagram_business_account{id,username}&access_token=${getToken()}`
  );

  if (res.ok) {
    const data = await res.json() as { id: string; instagram_business_account?: { id: string } };
    cachedPageId = data.id;
    cachedIGBusinessId = data.instagram_business_account?.id || null;
    console.log(`[Instagram] Page ID: ${cachedPageId}, IG Business: ${cachedIGBusinessId}`);
    return { pageId: cachedPageId, igId: cachedIGBusinessId };
  }

  const err = await res.text();
  console.error("[Instagram] Failed to resolve IDs:", err);
  throw new Error("Could not resolve Page ID");
}

async function getPageId(): Promise<string> {
  const { pageId } = await resolveIds();
  return pageId;
}

/* ── Send a text reply to a user ─────────────────────────────── */
export async function sendMessage(recipientId: string, text: string): Promise<void> {
  const pageId = await getPageId();

  const res = await fetch(`${GRAPH_API}/${pageId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Instagram] Failed to send message:", err);
    throw new Error(`Instagram send failed: ${res.status}`);
  }

  console.log(`[Instagram] Message sent to ${recipientId}`);
}

/* ── Sender actions (read receipts + typing indicators) ──────── */
async function sendAction(recipientId: string, action: "mark_seen" | "typing_on" | "typing_off"): Promise<void> {
  const pageId = await getPageId();

  try {
    await fetch(`${GRAPH_API}/${pageId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action,
      }),
    });
  } catch (e) {
    console.warn(`[Instagram] ${action} failed:`, e);
  }
}

export async function markSeen(recipientId: string): Promise<void> {
  await sendAction(recipientId, "mark_seen");
}

export async function startTyping(recipientId: string): Promise<void> {
  await sendAction(recipientId, "typing_on");
}

export async function stopTyping(recipientId: string): Promise<void> {
  await sendAction(recipientId, "typing_off");
}

/* ── User profile types ──────────────────────────────────────── */
export interface IGUserProfile {
  id: string;
  name?: string;
  username?: string;
  biography?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  website?: string;
}

/* ── Fetch basic messaging profile (name/username from DM sender) */
export async function getUserProfile(userId: string): Promise<IGUserProfile> {
  const basicFields = "id,name,username";
  const res = await fetch(
    `${GRAPH_API}/${userId}?fields=${basicFields}&access_token=${getToken()}`
  );

  if (!res.ok) {
    console.error("[Instagram] Failed to fetch user profile:", await res.text());
    return { id: userId };
  }

  return (await res.json()) as IGUserProfile;
}

/* ── Look up full public IG profile by username (via Business API) */
export async function lookupPublicProfile(username: string): Promise<IGUserProfile | null> {
  const { igId } = await resolveIds();
  if (!igId) return null;

  // Step 1: find the IG user ID by username
  const searchRes = await fetch(
    `${GRAPH_API}/${igId}?fields=business_discovery.fields(id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website).username(${username})&access_token=${getToken()}`
  );

  if (!searchRes.ok) {
    const err = await searchRes.text();
    console.warn(`[Instagram] business_discovery failed for @${username}:`, err);
    return null;
  }

  const data = await searchRes.json() as { business_discovery?: IGUserProfile };
  if (data.business_discovery) {
    console.log(`[Instagram] Public profile for @${username}: ${data.business_discovery.followers_count} followers`);
    return data.business_discovery;
  }

  return null;
}
