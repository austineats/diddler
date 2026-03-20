// ─── bit7 types ─────────────────────────────────────────────────────

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

export interface AgentPersonality {
  tone: string;
  style: string;
  emoji_usage: "none" | "minimal" | "frequent";
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

export interface CreateAgentRequest {
  prompt: string;
  area_code?: string;
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
