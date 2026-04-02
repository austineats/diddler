/**
 * Blind Date Engine — matchmaking via iMessage.
 *
 * Flow:
 * 1. Users sign up on the website (name, phone, school ID photo)
 * 2. Scheduler calls runMatchingCycle() every tick to pair waitlisted users
 * 3. Both matched users get a hype text: "your blind date match is ready..."
 * 4. When both reply "yes", we reveal names + numbers and send an icebreaker
 */
import { prisma } from "../db.js";
import { sendIMessage } from "./imessageClient.js";
import { getRawLLMClient } from "../unifiedClient.js";

// ---------------------------------------------------------------------------
// Matching Cycle — called from scheduler
// ---------------------------------------------------------------------------

export async function runMatchingCycle(): Promise<void> {
  // Find all waiting signups, oldest first
  const waiting = await prisma.blindDateSignup.findMany({
    where: { status: "waiting" },
    orderBy: { created_at: "asc" },
  });

  if (waiting.length < 2) return;

  // Shuffle for randomness, then pair sequentially
  const shuffled = waiting.sort(() => Math.random() - 0.5);
  const pairs = Math.floor(shuffled.length / 2);

  for (let i = 0; i < pairs; i++) {
    const a = shuffled[i * 2];
    const b = shuffled[i * 2 + 1];

    await prisma.$transaction(async (tx) => {
      // Create the match
      const match = await tx.blindDateMatch.create({
        data: {
          person_a_phone: a.phone,
          person_b_phone: b.phone,
          person_a_name: a.name,
          person_b_name: b.name,
        },
      });

      // Update both signups
      await tx.blindDateSignup.update({
        where: { id: a.id },
        data: { status: "matched", match_id: match.id },
      });
      await tx.blindDateSignup.update({
        where: { id: b.id },
        data: { status: "matched", match_id: match.id },
      });
    });

    // Send hype messages (outside transaction so DB is committed)
    const hypeA = `hey ${a.name.split(" ")[0].toLowerCase()}... your blind date match is ready 👀\n\nare you ready to find out who you got?\n\nreply "yes" when you're ready`;
    const hypeB = `hey ${b.name.split(" ")[0].toLowerCase()}... your blind date match is ready 👀\n\nare you ready to find out who you got?\n\nreply "yes" when you're ready`;

    await sendIMessage(a.phone, hypeA).catch((e) =>
      console.error(`[BlindDate] Failed to message ${a.phone}:`, e),
    );
    await sendIMessage(b.phone, hypeB).catch((e) =>
      console.error(`[BlindDate] Failed to message ${b.phone}:`, e),
    );

    console.log(`[BlindDate] Matched ${a.name} <-> ${b.name}`);
  }
}

// ---------------------------------------------------------------------------
// Reply Handler — intercepts messages from users in active matches
// ---------------------------------------------------------------------------

const YES_PATTERNS = /^(yes|yeah|yea|yep|yup|ya|ye|ready|let'?s go|lets go|ok|okay|sure|do it|go|send it|reveal|im ready|i'm ready)$/i;

/**
 * Handle an incoming message from a user who might be in a blind date match.
 * Returns true if handled (caller should skip normal agent flow).
 */
export async function handleBlindDateReply(
  userPhone: string,
  text: string,
): Promise<boolean> {
  // Find active match for this user
  const match = await prisma.blindDateMatch.findFirst({
    where: {
      status: "pending",
      OR: [{ person_a_phone: userPhone }, { person_b_phone: userPhone }],
    },
  });

  if (!match) return false;

  const isA = match.person_a_phone === userPhone;
  const trimmed = text.trim();

  // Check if they're saying yes
  if (YES_PATTERNS.test(trimmed)) {
    // Update their ready status
    await prisma.blindDateMatch.update({
      where: { id: match.id },
      data: isA ? { person_a_ready: true } : { person_b_ready: true },
    });

    // Check if both are now ready
    const otherReady = isA ? match.person_b_ready : match.person_a_ready;

    if (otherReady) {
      // Both ready — reveal!
      await revealMatch(match.id);
    } else {
      // Only this person is ready
      await sendIMessage(userPhone, "you're locked in 🔒 waiting on your match to say yes...");
    }

    return true;
  }

  // Check for cancel/no
  if (/^(no|nah|cancel|nevermind|nvm|pass|skip)$/i.test(trimmed)) {
    await cancelMatch(match.id);
    await sendIMessage(userPhone, "no worries, we'll put you back in the pool for next time");
    return true;
  }

  // They're in a match but said something else — nudge them
  await sendIMessage(userPhone, "your match is waiting... reply \"yes\" to reveal or \"no\" to skip");
  return true;
}

// ---------------------------------------------------------------------------
// Redirect Handler — intercepts messages from signed-up users who haven't
// finished onboarding (no team or not ready). Like Ditto, always acknowledge
// what they said but steer them back to completing signup.
// ---------------------------------------------------------------------------

export async function handleBlindDateRedirect(
  userPhone: string,
  text: string,
): Promise<boolean> {
  const baseUrl = process.env.BASE_URL || "https://ara-malarial-poisedly.ngrok-free.dev";
  const trimmed = text.trim();

  // Check if user has a signup
  let signup: { name: string; status: string; phone: string } | null = null;
  try {
    signup = await prisma.blindDateSignup.findUnique({
      where: { phone: userPhone },
      select: { name: true, status: true, phone: true },
    });
  } catch (e) {
    console.warn("[BlindDate] Signup lookup failed:", e);
  }

  // If they're already matched — let them through
  if (signup?.status === "matched") return false;

  // Check team status if signed up
  let team: { code: string; status: string; player1_phone: string; player1_ready: boolean; player2_phone: string | null; player2_ready: boolean } | null = null;
  if (signup) {
    try {
      team = await prisma.blindDateTeam.findFirst({
        where: { OR: [{ player1_phone: userPhone }, { player2_phone: userPhone }] },
        select: { code: true, status: true, player1_phone: true, player1_ready: true, player2_phone: true, player2_ready: true },
      });
    } catch (e) {
      console.warn("[BlindDate] Team lookup failed:", e);
    }
  }

  // If they have a full team and are ready — waiting for match, let through
  if (signup && team?.status === "full") {
    const isReady = (team.player1_phone === userPhone && team.player1_ready) ||
      (team.player2_phone === userPhone && team.player2_ready);
    if (isReady) return false;
  }

  // Everyone else gets redirected — figure out what they need
  let firstName = "bestie";
  let action: string;
  let link: string;

  if (!signup) {
    // Not signed up at all
    action = "sign up for ditto first";
    link = `${baseUrl}/signup`;
  } else if (!team) {
    firstName = signup.name.split(" ")[0].toLowerCase();
    action = "create or join a team";
    link = `${baseUrl}/signup`;
  } else if (team.status === "waiting") {
    firstName = signup.name.split(" ")[0].toLowerCase();
    action = "get your teammate to join";
    link = `${baseUrl}/invite/${team.code}`;
  } else {
    firstName = signup.name.split(" ")[0].toLowerCase();
    action = "mark yourself as ready";
    link = `${baseUrl}/signup`;
  }

  // Generate witty redirect via LLM
  try {
    const client = getRawLLMClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `You are ditto's AI matchmaker for blind dates. You plan dates, not just matches.

Someone texted you but they haven't finished setting up. ${signup ? `Their name is ${firstName}.` : "They haven't even signed up yet."} They need to: ${action}.

Write a reply that:
1. Acknowledges what they said in a funny/witty way (reference their actual words)
2. Ties it back to the blind date — like "before we talk about X you gotta finish signing up"
3. Is playful and teasing, like roasting a friend

Style: all lowercase, no periods, casual texting, max 2 sentences. No emojis unless it really fits. Don't say "onboarding" or "setup process". Be creative — don't repeat the same redirect phrasing.`,
        },
        { role: "user", content: trimmed || "hi" },
      ],
    });

    const wittyPart = response.choices[0]?.message?.content?.trim() || "";
    const reply = wittyPart
      ? `${wittyPart}\n\nlock in here real quick: ${link}`
      : `hey ${firstName} you gotta ${action} before i can do anything for you\n\nlock in here: ${link}`;

    await sendIMessage(userPhone, reply);
    console.log(`[BlindDate] Redirect to ${userPhone}: ${action}`);
  } catch (e) {
    // Fallback — no LLM needed
    console.warn("[BlindDate] Redirect LLM failed:", e);
    await sendIMessage(
      userPhone,
      `hey ${firstName} you gotta ${action} before we can chat\n\nlock in here: ${link}`,
    );
  }

  return true;
}

// ---------------------------------------------------------------------------
// Reveal — sends both parties each other's info + icebreaker
// ---------------------------------------------------------------------------

async function revealMatch(matchId: string): Promise<void> {
  const match = await prisma.blindDateMatch.update({
    where: { id: matchId },
    data: { status: "revealed", revealed_at: new Date() },
  });

  const firstNameA = match.person_a_name.split(" ")[0];
  const firstNameB = match.person_b_name.split(" ")[0];

  // Reveal to person A
  await sendIMessage(
    match.person_a_phone,
    `your blind date is... ${firstNameB}! 🎉\n\ntheir number: ${match.person_b_phone}\n\nsay hi 👋`,
  );

  // Reveal to person B
  await sendIMessage(
    match.person_b_phone,
    `your blind date is... ${firstNameA}! 🎉\n\ntheir number: ${match.person_a_phone}\n\nsay hi 👋`,
  );

  console.log(`[BlindDate] Revealed: ${firstNameA} <-> ${firstNameB}`);

  // Send icebreaker after a short delay
  setTimeout(() => sendIcebreaker(match.person_a_phone, match.person_b_phone), 30_000);
}

// ---------------------------------------------------------------------------
// Icebreaker — AI-generated conversation starter
// ---------------------------------------------------------------------------

async function sendIcebreaker(phoneA: string, phoneB: string): Promise<void> {
  try {
    const client = getRawLLMClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 100,
      temperature: 1.0,
      messages: [
        {
          role: "system",
          content:
            "You are a fun matchmaker AI. Generate ONE creative icebreaker question for two college students who just got matched on a blind date app. Keep it playful, casual, lowercase texting style. One sentence only. No quotes around it.",
        },
        { role: "user", content: "give me an icebreaker" },
      ],
    });

    const icebreaker = response.choices[0]?.message?.content?.trim();
    if (!icebreaker) return;

    const msg = `here's an icebreaker for you two:\n\n${icebreaker}`;
    await sendIMessage(phoneA, msg);
    await sendIMessage(phoneB, msg);

    console.log(`[BlindDate] Icebreaker sent to both parties`);
  } catch (e) {
    console.warn("[BlindDate] Failed to generate icebreaker:", e);
  }
}

// ---------------------------------------------------------------------------
// Cancel — puts both users back in the pool
// ---------------------------------------------------------------------------

async function cancelMatch(matchId: string): Promise<void> {
  const match = await prisma.blindDateMatch.update({
    where: { id: matchId },
    data: { status: "expired" },
  });

  // Put both signups back to waiting
  await prisma.blindDateSignup.updateMany({
    where: { match_id: matchId },
    data: { status: "waiting", match_id: null },
  });

  // Notify the other person
  const otherPhone =
    match.person_a_ready ? match.person_b_phone : match.person_a_phone;
  await sendIMessage(otherPhone, "your match passed this time — we'll find you someone new soon 💫").catch(() => {});

  console.log(`[BlindDate] Match ${matchId} cancelled`);
}

// ---------------------------------------------------------------------------
// Expiration — called from scheduler to expire stale matches (24h)
// ---------------------------------------------------------------------------

export async function expireStaleMatches(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const stale = await prisma.blindDateMatch.findMany({
    where: {
      status: "pending",
      created_at: { lt: cutoff },
    },
  });

  for (const match of stale) {
    await cancelMatch(match.id);
    console.log(`[BlindDate] Expired stale match ${match.id}`);
  }
}
