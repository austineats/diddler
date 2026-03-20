/**
 * One-off script: Purchase a toll-free number and swap it onto the existing agent.
 * Releases the old local number that's getting 30034 errors.
 *
 * Usage: npx tsx scripts/swap-to-tollfree.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { provisionTollFreeNumber, releaseNumber } from "../src/lib/twilio.js";

const prisma = new PrismaClient();

async function main() {
  // Find the active agent's phone number
  const phoneRecord = await prisma.phoneNumber.findFirst({
    where: { status: "active" },
    include: { agent: true },
  });

  if (!phoneRecord) {
    console.log("No active phone number found.");
    return;
  }

  console.log(`Current number: ${phoneRecord.phone_number} (SID: ${phoneRecord.twilio_sid})`);
  console.log(`Agent: ${phoneRecord.agent.name}`);

  // Release the old local number FIRST (trial accounts only allow 1 number)
  console.log("\nReleasing old local number...");
  await releaseNumber(phoneRecord.twilio_sid);
  console.log("Released.");

  // Purchase toll-free number
  console.log("\nPurchasing toll-free number...");
  const tollFree = await provisionTollFreeNumber();
  console.log(`Purchased: ${tollFree.phoneNumber} (SID: ${tollFree.sid})`);

  // Update the database record
  await prisma.phoneNumber.update({
    where: { id: phoneRecord.id },
    data: {
      phone_number: tollFree.phoneNumber,
      twilio_sid: tollFree.sid,
      friendly_name: tollFree.friendlyName,
    },
  });

  console.log(`\n✅ Done! Agent "${phoneRecord.agent.name}" now uses ${tollFree.phoneNumber}`);
  console.log(`Text ${tollFree.friendlyName} to try it out.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
