/**
 * Twilio client — handles phone number provisioning and SMS sending.
 */
import twilio from "twilio";

let _client: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio {
  if (_client) return _client;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set");
  }
  _client = twilio(accountSid, authToken);
  return _client;
}

/**
 * Provision a new phone number from Twilio and configure
 * its SMS webhook to point at our /api/sms/webhook endpoint.
 */
export async function provisionNumber(areaCode?: string): Promise<{
  phoneNumber: string;
  sid: string;
  friendlyName: string;
}> {
  const client = getTwilioClient();
  const webhookUrl = getWebhookUrl();

  // Search for an available local number
  const available = await client.availablePhoneNumbers("US").local.list({
    areaCode: areaCode ? Number(areaCode) : undefined,
    smsEnabled: true,
    mmsEnabled: true,
    limit: 1,
  });

  if (available.length === 0) {
    throw new Error(
      areaCode
        ? `No SMS-enabled numbers available in area code ${areaCode}`
        : "No SMS-enabled numbers available",
    );
  }

  // Purchase the number and set the webhook
  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    smsUrl: `${webhookUrl}/api/sms/webhook`,
    smsMethod: "POST",
  });

  return {
    phoneNumber: purchased.phoneNumber,
    sid: purchased.sid,
    friendlyName: purchased.friendlyName ?? formatPhoneNumber(purchased.phoneNumber),
  };
}

/**
 * Provision a toll-free number (bypasses A2P 10DLC registration).
 */
export async function provisionTollFreeNumber(): Promise<{
  phoneNumber: string;
  sid: string;
  friendlyName: string;
}> {
  const client = getTwilioClient();
  const webhookUrl = getWebhookUrl();

  const available = await client.availablePhoneNumbers("US").tollFree.list({
    smsEnabled: true,
    limit: 1,
  });

  if (available.length === 0) {
    throw new Error("No toll-free numbers available");
  }

  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    smsUrl: `${webhookUrl}/api/sms/webhook`,
    smsMethod: "POST",
  });

  return {
    phoneNumber: purchased.phoneNumber,
    sid: purchased.sid,
    friendlyName: purchased.friendlyName ?? formatPhoneNumber(purchased.phoneNumber),
  };
}

/**
 * Release a phone number back to Twilio.
 */
export async function releaseNumber(sid: string): Promise<void> {
  const client = getTwilioClient();
  await client.incomingPhoneNumbers(sid).remove();
}

/**
 * Send an SMS/MMS message.
 */
export async function sendSMS(opts: {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string[];
}): Promise<string> {
  const client = getTwilioClient();
  const message = await client.messages.create({
    to: opts.to,
    from: opts.from,
    body: opts.body,
    mediaUrl: opts.mediaUrl,
  });
  return message.sid;
}

/**
 * Validate that an incoming request is actually from Twilio.
 */
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}

function getWebhookUrl(): string {
  const url = process.env.BASE_URL;
  if (!url) {
    throw new Error("BASE_URL must be set for Twilio webhook configuration");
  }
  return url.replace(/\/$/, "");
}

function formatPhoneNumber(e164: string): string {
  // +15551234567 → (555) 123-4567
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}
