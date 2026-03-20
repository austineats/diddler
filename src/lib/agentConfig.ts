/**
 * Agent configuration — generates system prompts and capabilities
 * from a user's natural language description.
 */
import { getUnifiedClient } from "./unifiedClient.js";

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  personality: {
    tone: string;
    style: string;
    emoji_usage: "none" | "minimal" | "frequent";
  };
  suggestedModel: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Given a user's description of what they want their SMS agent to do,
 * generate a full agent configuration including system prompt.
 */
export async function generateAgentConfig(
  userPrompt: string,
  signal?: AbortSignal,
): Promise<AgentConfig> {
  const client = getUnifiedClient();

  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: AGENT_CONFIG_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          name: "create_agent_config",
          description: "Create a complete SMS agent configuration",
          input_schema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Short catchy name for the agent (1-3 words)",
              },
              description: {
                type: "string",
                description: "One-sentence description of what this agent does",
              },
              system_prompt: {
                type: "string",
                description:
                  "The full system prompt that defines this agent's behavior. Should be detailed, specific, and optimized for SMS conversations (short responses, no markdown).",
              },
              capabilities: {
                type: "array",
                items: { type: "string" },
                description:
                  "List of capability tags, e.g. image_analysis, calorie_tracking, scheduling, language_translation",
              },
              personality: {
                type: "object",
                properties: {
                  tone: {
                    type: "string",
                    description:
                      "e.g. friendly, professional, casual, motivational",
                  },
                  style: {
                    type: "string",
                    description:
                      "e.g. concise, detailed, conversational, clinical",
                  },
                  emoji_usage: {
                    type: "string",
                    enum: ["none", "minimal", "frequent"],
                  },
                },
                required: ["tone", "style", "emoji_usage"],
              },
              temperature: {
                type: "number",
                description: "Recommended temperature (0.0-1.0)",
              },
              max_tokens: {
                type: "number",
                description:
                  "Max response tokens. SMS should be concise — usually 256-512",
              },
            },
            required: [
              "name",
              "description",
              "system_prompt",
              "capabilities",
              "personality",
              "temperature",
              "max_tokens",
            ],
          },
        },
      ],
      tool_choice: { type: "tool", name: "create_agent_config" },
    },
    { signal },
  );

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Agent config generation failed — no tool response");
  }

  const input = toolBlock.input as Record<string, unknown>;

  return {
    name: input.name as string,
    description: input.description as string,
    systemPrompt: input.system_prompt as string,
    capabilities: input.capabilities as string[],
    personality: input.personality as AgentConfig["personality"],
    suggestedModel: "claude-sonnet-4-20250514",
    temperature: (input.temperature as number) ?? 0.7,
    maxTokens: (input.max_tokens as number) ?? 512,
  };
}

const AGENT_CONFIG_SYSTEM_PROMPT = `You are an expert at designing AI SMS agents. Given a user's description of what they want, create a complete agent configuration.

Key principles for SMS agents:
- Responses must be SHORT. SMS has a 1600 character limit, aim for under 500 chars.
- No markdown formatting (no **, no ##, no bullets with -). Use plain text.
- Use line breaks sparingly. Keep it conversational.
- If the agent handles images (MMS), include clear instructions for image analysis.
- Be specific about the agent's domain — a calorie tracker should know nutrition, a language tutor should know pedagogy.
- The system prompt should tell the agent exactly how to behave over SMS, including edge cases (what to do when confused, how to handle off-topic messages).

The system prompt you generate will be used directly as the LLM system prompt when responding to incoming texts.`;
