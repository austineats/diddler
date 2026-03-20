/**
 * SMS Agent — handles incoming messages and generates AI responses.
 * This is the core loop: text comes in → build context → LLM → respond.
 *
 * Returns the response text so the webhook can include it in TwiML
 * (avoids Twilio trial account outbound restrictions).
 */
import { prisma } from "./db.js";
import { getUnifiedClient } from "./unifiedClient.js";

const MAX_CONTEXT_MESSAGES = 20;
const SMS_CHAR_LIMIT = 1600;

interface IncomingSMS {
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  twilioSid: string;
}

export async function handleIncomingSMS(sms: IncomingSMS): Promise<string> {
  const startTime = Date.now();

  // 1. Find the agent by the phone number that received the text
  console.log(`[smsAgent] Looking up phone_number: "${sms.to}"`);
  const phoneRecord = await prisma.phoneNumber.findUnique({
    where: { phone_number: sms.to },
    include: { agent: true },
  });
  console.log(`[smsAgent] phoneRecord:`, phoneRecord ? `found (status: ${phoneRecord.status})` : "null");

  if (!phoneRecord || phoneRecord.status !== "active") {
    console.warn(`No active agent for number ${sms.to}`);
    return "This number is not active.";
  }

  const agent = phoneRecord.agent;
  if (agent.status !== "active") {
    console.warn(`Agent ${agent.id} is ${agent.status}, ignoring message`);
    return "This agent is currently paused.";
  }

  // 2. Find or create conversation
  const conversation = await prisma.conversation.upsert({
    where: {
      agent_id_from_number: {
        agent_id: agent.id,
        from_number: sms.from,
      },
    },
    update: {
      last_message_at: new Date(),
      message_count: { increment: 1 },
    },
    create: {
      agent_id: agent.id,
      from_number: sms.from,
      message_count: 1,
    },
  });

  // 3. Save the inbound message
  await prisma.message.create({
    data: {
      conversation_id: conversation.id,
      agent_id: agent.id,
      direction: "inbound",
      body: sms.body,
      media_urls: sms.mediaUrls,
      twilio_sid: sms.twilioSid,
    },
  });

  // 4. Load recent conversation history for context
  const recentMessages = await prisma.message.findMany({
    where: { conversation_id: conversation.id },
    orderBy: { created_at: "asc" },
    take: MAX_CONTEXT_MESSAGES,
  });

  // 5. Build LLM messages from conversation history
  const llmMessages = recentMessages.map((msg) => {
    const role = msg.direction === "inbound" ? "user" as const : "assistant" as const;
    let content = msg.body;

    // If there are images, note them in the content
    const mediaList = msg.media_urls as string[];
    if (mediaList.length > 0) {
      content = `[User sent ${mediaList.length} image(s): ${mediaList.join(", ")}]\n${content}`;
    }

    return { role, content };
  });

  // 6. Call the LLM
  const client = getUnifiedClient();
  const capabilities = agent.capabilities as string[];
  const personality = agent.personality as Record<string, string> | null;

  let systemPrompt = agent.system_prompt;

  // Append capability hints
  if (capabilities.includes("image_analysis") && sms.mediaUrls.length > 0) {
    systemPrompt += "\n\nThe user has sent an image. Analyze it based on the URLs provided in the message.";
  }

  // Append personality context
  if (personality) {
    systemPrompt += `\n\nTone: ${personality.tone}. Style: ${personality.style}.`;
    if (personality.emoji_usage === "none") {
      systemPrompt += " Do not use emojis.";
    } else if (personality.emoji_usage === "frequent") {
      systemPrompt += " Use emojis liberally.";
    }
  }

  systemPrompt += `\n\nIMPORTANT: You are responding via SMS. Keep responses under ${SMS_CHAR_LIMIT} characters. No markdown. Plain text only.`;

  console.log(`[smsAgent] Calling LLM for agent "${agent.name}" (model: ${agent.model})`);

  const response = await client.messages.create({
    model: agent.model,
    max_tokens: agent.max_tokens,
    temperature: agent.temperature,
    system: systemPrompt,
    messages: llmMessages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const responseText = textBlock?.type === "text" ? textBlock.text : "Sorry, I couldn't process that.";

  // Truncate if over SMS limit
  const finalResponse = responseText.length > SMS_CHAR_LIMIT
    ? responseText.slice(0, SMS_CHAR_LIMIT - 3) + "..."
    : responseText;

  const durationMs = Date.now() - startTime;
  console.log(`[smsAgent] LLM responded in ${durationMs}ms (${finalResponse.length} chars)`);

  // 7. Save the outbound message
  await prisma.message.create({
    data: {
      conversation_id: conversation.id,
      agent_id: agent.id,
      direction: "outbound",
      body: finalResponse,
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
      duration_ms: durationMs,
    },
  });

  // 8. Update conversation
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      last_message_at: new Date(),
      message_count: { increment: 1 },
    },
  });

  return finalResponse;
}
