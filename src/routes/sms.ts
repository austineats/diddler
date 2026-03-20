/**
 * SMS webhook route — receives incoming texts from Twilio.
 *
 * Uses TwiML <Message> response so Twilio sends the reply directly.
 * This avoids Twilio trial account restrictions on outbound SMS
 * and removes the need for a separate sendSMS call.
 */
import { Router } from "express";
import { handleIncomingSMS } from "../lib/smsAgent.js";
import { validateTwilioSignature } from "../lib/twilio.js";

export const smsRouter = Router();

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

smsRouter.post("/webhook", async (req, res) => {
  // Validate the request is from Twilio (skip in dev)
  if (process.env.NODE_ENV === "production") {
    const signature = req.headers["x-twilio-signature"] as string;
    const url = `${process.env.BASE_URL}/api/sms/webhook`;
    if (!signature || !validateTwilioSignature(url, req.body, signature)) {
      return res.status(403).send("Invalid signature");
    }
  }

  const { Body, MessageSid, NumMedia } = req.body;

  // Normalize phone numbers — URL-encoded `+` decodes as space
  const From = "+" + (req.body.From ?? "").trim().replace(/^\+/, "");
  const To = "+" + (req.body.To ?? "").trim().replace(/^\+/, "");

  // Collect MMS media URLs
  const mediaUrls: string[] = [];
  const numMedia = parseInt(NumMedia ?? "0", 10);
  for (let i = 0; i < numMedia; i++) {
    const url = req.body[`MediaUrl${i}`];
    if (url) mediaUrls.push(url);
  }

  console.log(`[webhook] Incoming SMS from ${From} to ${To}: "${Body}" (NumMedia: ${NumMedia})`);
  console.log(`[webhook] Full body:`, JSON.stringify(req.body));

  try {
    const responseText = await handleIncomingSMS({
      from: From,
      to: To,
      body: Body ?? "",
      mediaUrls,
      twilioSid: MessageSid,
    });

    // Respond with TwiML — Twilio sends this as the SMS reply
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(responseText)}</Message></Response>`,
    );
  } catch (err) {
    console.error("[webhook] SMS processing error:", err);
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Sorry, something went wrong. Please try again.</Message></Response>`,
    );
  }
});
