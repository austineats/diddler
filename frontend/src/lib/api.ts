const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error ?? "Request failed"), {
      status: res.status,
    });
  return data as T;
}

// ── Types ──────────────────────────────────────────────────

export interface AgentPersonality {
  tone: string;
  style: string;
  emoji_usage: "none" | "minimal" | "frequent";
}

export interface AgentSummary {
  id: string;
  short_id: string;
  name: string;
  description: string;
  capabilities: string[];
  phone_number: string | null;
  friendly_name: string | null;
  status: "active" | "paused" | "archived";
  conversations: number;
  messages: number;
  created_at: string;
}

export interface AgentDetail extends AgentSummary {
  system_prompt: string;
  personality: AgentPersonality | null;
  model: string;
  temperature: number;
  max_tokens: number;
  original_prompt: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  from_number: string;
  message_count: number;
  started_at: string;
  last_message_at: string;
}

export interface MessageItem {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  media_urls: string[];
  tokens_used: number;
  created_at: string;
}

export interface CreateAgentResponse {
  id: string;
  short_id: string;
  name: string;
  description: string;
  capabilities: string[];
  personality: AgentPersonality;
  phone_number: string;
  friendly_name: string;
  status: string;
  created_at: string;
}

// ── API ────────────────────────────────────────────────────

export const api = {
  createAgent: (prompt: string, areaCode?: string) =>
    fetch("/api/agents", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ prompt, area_code: areaCode }),
    }).then((r) => parseResponse<CreateAgentResponse>(r)),

  listAgents: () =>
    fetch("/api/agents").then((r) => parseResponse<AgentSummary[]>(r)),

  getAgent: (id: string) =>
    fetch(`/api/agents/${id}`).then((r) => parseResponse<AgentDetail>(r)),

  updateAgent: (id: string, data: Record<string, unknown>) =>
    fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    }).then((r) => parseResponse<Record<string, unknown>>(r)),

  deleteAgent: (id: string) =>
    fetch(`/api/agents/${id}`, { method: "DELETE" }).then((r) =>
      parseResponse<{ ok: boolean }>(r),
    ),

  getConversations: (agentId: string) =>
    fetch(`/api/agents/${agentId}/conversations`).then((r) =>
      parseResponse<ConversationSummary[]>(r),
    ),

  getMessages: (agentId: string, convId: string) =>
    fetch(`/api/agents/${agentId}/conversations/${convId}/messages`).then((r) =>
      parseResponse<MessageItem[]>(r),
    ),
};
