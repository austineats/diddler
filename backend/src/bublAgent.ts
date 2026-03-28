import { IMessageSDK } from "@photon-ai/imessage-kit";
import { prisma } from "./lib/db.js";

const sdk = new IMessageSDK();
const TYPING_URL = process.env.TYPING_URL ?? "http://localhost:5055";

// Track who we've already greeted this session
const greeted = new Set<string>();

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

async function lookupUser(phone: string) {
  const normalized = normalizePhone(phone);
  try {
    const signup = await prisma.blindDateSignup.findFirst({
      where: {
        OR: [
          { phone: normalized },
          { phone: phone },
          { phone: normalized.replace("+1", "") },
        ],
      },
    });
    return signup;
  } catch {
    return null;
  }
}

function pickWelcome(name: string): string[] {
  const greetings = [
    [`hey ${name}! 👋 welcome to bubl`, `we're busy curating your perfect match.. sit tight 💭`],
    [`${name}! you're in 🔒`, `your match is brewing.. we'll text you when it's ready`],
    [`hey ${name} 👀`, `get excited! we're finding someone perfect for you`],
    [`${name}!! welcome to bubl 💗`, `your match is curating as we speak.. stay tuned`],
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function pickContextReply(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("huzz") || t.includes("baddie") || t.includes("hot"))
    return "oh we got plenty 👀 your perfect match is curating rn..";
  if (t.includes("when") || t.includes("how long") || t.includes("ready"))
    return "soon! we're making sure it's a perfect fit for you 💭";
  if (t.includes("who") || t.includes("match") || t.includes("date"))
    return "can't spoil it yet 🤫 but trust.. you're gonna love them";
  if (t.includes("excited") || t.includes("can't wait") || t.includes("hyped"))
    return "WE'RE hyped for you too 💗 it's gonna be worth the wait";
  if (t.includes("cancel") || t.includes("nvm") || t.includes("nevermind"))
    return "nooo don't leave 😭 your match is almost ready!";
  if (t.includes("thank") || t.includes("thx") || t.includes("appreciate"))
    return "ofc 💗 we gotchu";
  if (t.includes("lol") || t.includes("haha") || t.includes("😂"))
    return "😭💗";
  if (t.includes("hello") || t.includes("hi") || t.includes("hey") || t.includes("sup") || t.includes("yo"))
    return "heyy 👋 we're still working on your match.. stay tuned!";
  return null;
}

function pickFollowUp(): string {
  const replies = [
    "we're still working on it! you'll be the first to know 💭",
    "patience 👀 good things take time",
    "your match is almost ready.. hang tight!",
    "still curating! we want it to be perfect for you 💗",
    "soon 🔒 we're making sure it's a great fit",
    "working on it rn! we'll text you the moment it's ready",
    "trust the process 👀💭",
    "we gotchu.. your match is coming soon",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

export async function startBublAgent() {
  await sdk.startWatching({
    onDirectMessage: async (msg) => {
      if (msg.isFromMe) return;

      const sender = msg.sender;
      const text = (msg.text || "").toLowerCase().trim();
      console.log(`[Bubl] From ${sender}: "${msg.text}"`);

      // Read receipt
      await sendReadReceipt(sender);
      await sleep(300);

      // Typing indicator
      await startTyping(sender);
      await sleep(1000);

      // Look up user in waitlist
      const user = await lookupUser(sender);
      const firstName = user?.name?.split(" ")[0] || null;

      let replies: string[];

      if (firstName && !greeted.has(sender)) {
        // First message from a signed-up user — personalized welcome
        greeted.add(sender);
        replies = pickWelcome(firstName);
      } else if (firstName) {
        // Returning user — respond to what they said, or generic follow up
        const contextual = pickContextReply(text);
        replies = [contextual || pickFollowUp()];
      } else {
        // Unknown user — nudge to sign up
        replies = [
          "hey! 👋 sign up on bubl.buzz to get matched",
          "we match you with someone every thursday over imsg!"
        ];
      }

      // Send replies with small gap between multiple messages
      for (let i = 0; i < replies.length; i++) {
        if (i > 0) {
          await startTyping(sender);
          await sleep(600);
        }
        await sdk.send(sender, replies[i]);
        console.log(`[Bubl] Replied to ${sender}: "${replies[i]}"`);
      }

      await stopTyping(sender);
    },
  });

  console.log("[Bubl] Agent active — listening for iMessages");
}
