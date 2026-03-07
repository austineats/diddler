/**
 * Unified LLM client — routes all API calls through Kimi/Moonshot (OpenAI-compatible)
 * since Anthropic credits are unavailable. Provides an Anthropic-style interface
 * so the rest of the codebase doesn't need to change.
 */
import OpenAI from "openai";
import { EventEmitter } from "events";

let _client: OpenAI | null = null;

function getKimiClient(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error("KIMI_API_KEY is not set");
  _client = new OpenAI({
    apiKey,
    baseURL: process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1",
  });
  return _client;
}

/**
 * Remap any Claude/Anthropic model name to a Kimi-compatible model.
 * kimi-k2.5 is the thinking model (high quality).
 * moonshot-v1-128k is the fast model.
 */
function remapModel(model: string): string {
  const m = model.toLowerCase();
  // Already a Kimi model — pass through
  if (m.startsWith("kimi-") || m.startsWith("moonshot-")) return model;
  // Map Claude tiers to Kimi equivalents
  if (m.includes("haiku")) return "moonshot-v1-128k";
  if (m.includes("sonnet")) return "kimi-k2.5";
  if (m.includes("opus")) return "kimi-k2.5";
  // Unknown — default to kimi-k2.5
  return "kimi-k2.5";
}

/**
 * kimi-k2.5 (thinking model) only allows temperature=1.
 * moonshot-v1-128k allows any temperature.
 */
function sanitizeTemperature(model: string, temperature?: number): number | undefined {
  if (model === "kimi-k2.5") return undefined; // omit temperature entirely — API default is 1
  return temperature;
}

interface MessageParam {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
}

interface CreateParams {
  model: string;
  max_tokens: number;
  system?: string | Array<{ type: string; text: string; [key: string]: unknown }>;
  messages: MessageParam[];
  tools?: unknown[];
  tool_choice?: unknown;
  temperature?: number;
  [key: string]: unknown;
}

interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface UnifiedResponse {
  content: Array<TextBlock | ToolUseBlock>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string | null;
  model: string;
  id: string;
}

/** Build OpenAI messages array from Anthropic-style params */
function buildMessages(params: CreateParams): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  if (params.system) {
    const systemText = typeof params.system === "string"
      ? params.system
      : params.system.map((b) => b.text).join("\n");
    messages.push({ role: "system", content: systemText });
  }

  for (const msg of params.messages) {
    const content = typeof msg.content === "string"
      ? msg.content
      : msg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n");
    messages.push({ role: msg.role, content });
  }

  return messages;
}

/** Inject tool schemas into system prompt for JSON-mode emulation */
function injectToolSchemas(
  messages: Array<{ role: string; content: string }>,
  tools: unknown[],
): void {
  const toolDescriptions = (tools as Array<{ name: string; description?: string; input_schema?: unknown }>)
    .map((t) => {
      const schema = t.input_schema ? `\nJSON Schema: ${JSON.stringify(t.input_schema)}` : "";
      return `Tool "${t.name}": ${t.description ?? ""}${schema}`;
    })
    .join("\n\n");

  const instruction = `\n\nYou MUST respond with a valid JSON object matching one of these schemas:\n${toolDescriptions}\n\nRespond ONLY with the JSON object, no other text.`;

  const systemIdx = messages.findIndex((m) => m.role === "system");
  if (systemIdx >= 0) {
    messages[systemIdx].content += instruction;
  } else {
    messages.unshift({ role: "system", content: instruction.trim() });
  }
}

/** Strip <think>...</think> blocks that kimi-k2.5 prepends to responses */
function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
}

/** Parse response text into Anthropic-style content blocks */
function parseResponseContent(
  text: string,
  wantsJSON: boolean,
  tools?: unknown[],
): Array<TextBlock | ToolUseBlock> {
  const content: Array<TextBlock | ToolUseBlock> = [];
  const cleaned = stripThinking(text);

  if (wantsJSON && tools && tools.length > 0) {
    try {
      // Try to extract JSON from the cleaned text (may have markdown fences)
      let jsonStr = cleaned;
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) jsonStr = fenceMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      const toolName = (tools[0] as { name: string }).name;
      content.push({
        type: "tool_use",
        id: `toolu_${Date.now()}`,
        name: toolName,
        input: parsed,
      });
    } catch {
      content.push({ type: "text", text: cleaned });
    }
  } else {
    content.push({ type: "text", text: cleaned });
  }

  return content;
}

/**
 * Get a unified client that mimics the Anthropic SDK interface
 * but routes through Kimi/Moonshot OpenAI-compatible API.
 */
export function getUnifiedClient() {
  const openai = getKimiClient();

  const createImpl = async (
    params: CreateParams,
    options?: { signal?: AbortSignal },
  ): Promise<UnifiedResponse> => {
    const model = remapModel(params.model);
    const messages = buildMessages(params);
    const wantsJSON = params.tools && params.tools.length > 0;

    if (wantsJSON) {
      injectToolSchemas(messages, params.tools!);
    }

    const response = await openai.chat.completions.create({
      model,
      max_tokens: params.max_tokens,
      temperature: sanitizeTemperature(model, params.temperature),
      messages: messages as Array<OpenAI.ChatCompletionMessageParam>,
      ...(wantsJSON ? { response_format: { type: "json_object" as const } } : {}),
    }, options?.signal ? { signal: options.signal } : undefined);

    const text = response.choices[0]?.message?.content ?? "";
    const content = parseResponseContent(text, !!wantsJSON, params.tools);

    return {
      content,
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      },
      stop_reason: response.choices[0]?.finish_reason ?? null,
      model,
      id: response.id ?? `msg_${Date.now()}`,
    };
  };

  return {
    messages: {
      create: async (
        params: CreateParams,
        options?: { signal?: AbortSignal },
      ): Promise<UnifiedResponse> => {
        return createImpl(params, options);
      },

      /**
       * Streaming adapter — mimics Anthropic SDK's MessageStream.
       * Since Kimi's streaming format differs, we fake it by:
       * 1. Calling the non-streaming create endpoint
       * 2. Emitting events on the returned EventEmitter
       * 3. Resolving finalMessage() with the result
       *
       * This means progress milestones won't fire in real-time,
       * but generation will complete successfully.
       */
      stream: (params: CreateParams, options?: { signal?: AbortSignal }) => {
        const emitter = new EventEmitter();
        let _response: UnifiedResponse | null = null;
        let _error: Error | null = null;
        let _aborted = false;

        const promise = createImpl(params, options)
          .then((resp) => {
            _response = resp;
            // Emit inputJson for tool_use responses so progress callbacks fire
            const toolUse = resp.content.find((b) => b.type === "tool_use");
            if (toolUse && toolUse.type === "tool_use") {
              emitter.emit("inputJson", "", toolUse.input);
            }
            return resp;
          })
          .catch((err) => {
            _error = err instanceof Error ? err : new Error(String(err));
            emitter.emit("error", _error);
            throw _error;
          });

        return {
          on: (event: string, handler: (...args: unknown[]) => void) => {
            emitter.on(event, handler);
            return undefined; // match Anthropic SDK chainability
          },
          abort: () => {
            _aborted = true;
          },
          finalMessage: async () => {
            if (_aborted) throw new Error("Stream aborted");
            await promise;
            if (_error) throw _error;
            return _response!;
          },
        };
      },
    },
  };
}

/** Type alias so callers can type their client variable */
export type UnifiedClient = ReturnType<typeof getUnifiedClient>;
