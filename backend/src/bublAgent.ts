import { IMessageSDK } from "@photon-ai/imessage-kit";
import { prisma } from "./lib/db.js";
import { sendContactCard } from "./lib/imessage/contactCard.js";

const sdk = new IMessageSDK();
const TYPING_URL = process.env.TYPING_URL ?? "http://localhost:5055";

// Track who we've already greeted + sent contact card this session
const greeted = new Set<string>();
const sentCard = new Set<string>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendReadReceipt(phone: string) {
  try {
    await fetch(`${TYPING_URL}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat: phone }),
    });
  } catch {}
}

async function startTyping(phone: string) {
  try {
    await fetch(`${TYPING_URL}/typing/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat: phone }),
    });
  } catch {}
}

async function stopTyping(phone: string) {
  try {
    await fetch(`${TYPING_URL}/typing/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat: phone }),
    });
  } catch {}
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
      where: {
        OR: [
          { phone: normalized },
          { phone },
          { phone: normalized.replace("+1", "") },
        ],
      },
    });
  } catch {
    return null;
  }
}

async function lookupTeam(phone: string) {
  const normalized = normalizePhone(phone);
  try {
    return await prisma.blindDateTeam.findFirst({
      where: {
        OR: [{ player1_phone: normalized }, { player2_phone: normalized }],
      },
      orderBy: { created_at: "desc" },
    });
  } catch {
    return null;
  }
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
  } catch {
    return null;
  }
}

async function logActivity(action: string, name?: string, phone?: string, details?: string) {
  try {
    await prisma.adminActivityLog.create({
      data: { action, actor_name: name || undefined, actor_phone: phone || undefined, details: details || undefined },
    });
  } catch {}
}

// ─── Reply generators ───

function welcomeReplies(name: string): string[] {
  const sets = [
    [`hey ${name}! 👋 welcome to bubl.`, `we're curating your perfect match rn.. sit tight 💜`],
    [`${name}! you're officially in 🔒`, `your match is brewing.. we'll text you when it's ready`],
    [`hey ${name} 👀`, `get excited! we're finding someone perfect for you and your teammate`],
    [`${name}!! welcome to bubl. 💜`, `your double date is curating as we speak.. stay tuned`],
  ];
  return sets[Math.floor(Math.random() * sets.length)];
}

function readyUpReply(name: string, teamFull: boolean, teammateName?: string): string[] {
  if (teamFull && teammateName) {
    return [
      `${name}!! you and ${teammateName} are locked in 🔥`,
      `im finding your match rn.. sit tight, match drop coming soon 👀`,
    ];
  }
  const waiting = [
    `lets gooo ${name}! 🔥 im curating your match but i need your teammate to join first. share that invite link!`,
    `${name}! you're ready 💜 but i can only start matching once your friend joins too. send them the invite!`,
    `ayy ${name} 🫶 signed up and locked in! waiting on your teammate to join so i can start the matchmaking ✨`,
    `${name}! 🎯 you're on the list. get your friend to join through your invite link and i'll find your perfect match!`,
  ];
  return [waiting[Math.floor(Math.random() * waiting.length)]];
}

function friendJoinedNotification(friendName: string): string[] {
  const msgs = [
    `${friendName} just joined your team! 🔥 you're both on the list now`,
    `yo ${friendName} is in! 🎮 your team is ready, sit tight while i find your match`,
    `${friendName} joined!! 💜 match drop coming soon 👀`,
  ];
  return [msgs[Math.floor(Math.random() * msgs.length)]];
}

function contextReply(text: string, name: string): string | null {
  const t = text.toLowerCase();

  // Signed up / ready up detection
  if (t.includes("signed up") || t.includes("i've signed up") || t.includes("ive signed up") || t.includes("ready"))
    return null; // handled by readyUp flow

  if (t.includes("huzz") || t.includes("baddie") || t.includes("hot") || t.includes("cute"))
    return `oh we got plenty ${name} 👀 your perfect match is curating rn..`;
  if (t.includes("when") || t.includes("how long") || t.includes("thursday"))
    return `soon ${name}! match drops happen every thursday 💜`;
  if (t.includes("who") || t.includes("match") || t.includes("date"))
    return `can't spoil it yet ${name} 🤫 but trust.. you're gonna love them`;
  if (t.includes("excited") || t.includes("can't wait") || t.includes("hyped") || t.includes("lets go"))
    return `WE'RE hyped for you too ${name} 💜 it's gonna be worth the wait`;
  if (t.includes("cancel") || t.includes("nvm") || t.includes("nevermind") || t.includes("stop"))
    return `nooo ${name} don't leave 😭 your match is almost ready!`;
  if (t.includes("thank") || t.includes("thx") || t.includes("appreciate"))
    return `ofc ${name} 💜 we gotchu`;
  if (t.includes("friend") || t.includes("teammate") || t.includes("invite"))
    return `share your invite link with your friend! once they join i'll start finding your match 🎯`;
  if (t.includes("how") && (t.includes("work") || t.includes("this")))
    return `it's simple ${name}! you + a friend sign up, we find you a double date match every thursday. no app needed, just imsg 💜`;
  if (t.includes("lol") || t.includes("haha") || t.includes("😂") || t.includes("💀"))
    return "😭💜";
  if (t.includes("hello") || t.includes("hi") || t.includes("hey") || t.includes("sup") || t.includes("yo") || t.includes("what's up"))
    return `heyy ${name} 👋 we're still working on your match.. stay tuned!`;

  return null;
}

function genericFollowUp(name: string): string {
  const replies = [
    `we're still working on it ${name}! you'll be the first to know 💜`,
    `patience ${name} 👀 good things take time`,
    `your match is almost ready ${name}.. hang tight!`,
    `still curating ${name}! we want it to be perfect 💜`,
    `soon ${name} 🔒 making sure it's a great fit`,
    `working on it rn ${name}! we'll text you the moment it's ready`,
    `trust the process ${name} 👀💜`,
    `we gotchu ${name}.. your match is coming soon`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

// ─── Main agent ───

export async function startBublAgent() {
  await sdk.startWatching({
    onDirectMessage: async (msg) => {
      if (msg.isFromMe) return;

      const sender = msg.sender;
      const text = (msg.text || "").trim();
      const textLower = text.toLowerCase();
      console.log(`[bubl] From ${sender}: "${text}"`);

      // Read receipt
      await sendReadReceipt(sender);
      await sleep(300);

      // Typing indicator
      await startTyping(sender);
      await sleep(800 + Math.random() * 400);

      // Look up user in DB
      const user = await lookupUser(sender);
      const firstName = user?.name?.split(" ")[0] || null;
      const team = user ? await lookupTeam(sender) : null;

      let replies: string[];

      if (!user) {
        // Unknown user — nudge to sign up
        replies = [
          "hey! 👋 sign up at bubl.buzz to get matched",
          "we set up double dates every thursday over imsg — no app needed! 💜",
        ];
        logActivity("unknown_message", undefined, sender, `"${text}"`);

      } else if (
        textLower.includes("signed up") ||
        textLower.includes("ive signed up") ||
        textLower.includes("i've signed up") ||
        textLower.includes("ready")
      ) {
        // Ready up flow — mark them ready in DB
        await markReady(sender);
        const updatedTeam = await lookupTeam(sender);
        const isP1 = updatedTeam?.player1_phone === normalizePhone(sender);
        const teammateName = isP1 ? updatedTeam?.player2_name : updatedTeam?.player1_name;
        replies = readyUpReply(firstName!, updatedTeam?.status === "full", teammateName || undefined);
        logActivity("ready_up", firstName!, normalizePhone(sender), `Team: ${team?.code || "none"}`);

      } else if (firstName && !greeted.has(sender)) {
        // First message from signed-up user — personalized welcome
        greeted.add(sender);
        replies = welcomeReplies(firstName);
        logActivity("first_message", firstName, normalizePhone(sender), `Team: ${team?.code || "none"}`);

      } else if (firstName) {
        // Returning user — contextual reply or generic
        const ctx = contextReply(text, firstName);
        replies = [ctx || genericFollowUp(firstName)];

      } else {
        replies = ["hey! 👋 sign up at bubl.buzz to get matched"];
      }

      // Send replies with realistic typing gaps
      for (let i = 0; i < replies.length; i++) {
        if (i > 0) {
          await startTyping(sender);
          await sleep(400 + Math.random() * 300);
        }
        await sdk.send(sender, replies[i]);
        console.log(`[bubl] Replied to ${sender}: "${replies[i]}"`);
      }

      await stopTyping(sender);

      // Send contact card on first interaction (once per session)
      if (!sentCard.has(sender)) {
        sentCard.add(sender);
        await sleep(500);
        try {
          await sendContactCard(sender);
          console.log(`[bubl] Sent contact card to ${sender}`);
        } catch (e) {
          console.warn(`[bubl] Failed to send contact card:`, e);
        }
      }
    },
  });

  console.log("[bubl] Agent active — listening for iMessages");
}
