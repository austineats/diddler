/**
 * Contact Card — generates and sends a vCard (.vcf) for bubl
 * so users can save the contact with name + profile picture.
 */
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getIMessageSDK } from "./imessageClient.js";

const ASSETS_DIR = path.resolve(
  new URL(".", import.meta.url).pathname,
  "../../../assets",
);

/**
 * Build a vCard string, optionally embedding a profile photo.
 */
function buildVCard(name: string, org: string, note: string): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    `N:;${name};;;`,
    `ORG:${org}`,
    "TITLE:Your Matchmaker",
    `NOTE:${note}`,
    "EMAIL;type=INTERNET;type=pref:textbubl@icloud.com",
    "IMPP;X-SERVICE-TYPE=iMessage;type=pref:imessage:textbubl@icloud.com",
  ];

  // Embed profile photo if it exists
  const avatarPath = path.join(ASSETS_DIR, "bubl-avatar.jpg");
  // Fallback to old avatar name
  const fallbackPath = path.join(ASSETS_DIR, "bit7-avatar.jpg");
  const photoPath = fs.existsSync(avatarPath) ? avatarPath : fs.existsSync(fallbackPath) ? fallbackPath : null;

  if (photoPath) {
    const imageData = fs.readFileSync(photoPath).toString("base64");
    lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${imageData}`);
  }

  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

/**
 * Send the bubl contact card to a user via iMessage.
 * Creates a temp .vcf file and sends it as an attachment.
 */
export async function sendContactCard(to: string): Promise<void> {
  const vcf = buildVCard(
    "bubl.",
    "bubl",
    "Your matchmaker — curated double dates every Thursday via iMessage",
  );

  const tmpPath = path.join(os.tmpdir(), `bubl-contact-${Date.now()}.vcf`);
  fs.writeFileSync(tmpPath, vcf, "utf-8");

  try {
    const sdk = getIMessageSDK();
    await sdk.sendFile(to, tmpPath, "save my contact so you never miss a match drop! 💜");
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }
}
