/**
 * Agent CRUD routes — create, read, update, delete agents.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { generateAgentConfig } from "../lib/agentConfig.js";
import { provisionNumber, releaseNumber } from "../lib/twilio.js";

export const agentsRouter = Router();

// ─── POST /api/agents — Create a new agent from a prompt ────────────

const createSchema = z.object({
  prompt: z.string().min(10).max(2000),
  area_code: z.string().length(3).optional(),
});

agentsRouter.post("/", async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten().fieldErrors });
  }

  const { prompt, area_code } = parse.data;

  try {
    // 1. Generate agent config from the user's prompt
    const config = await generateAgentConfig(prompt);

    // 2. Provision a Twilio phone number
    const number = await provisionNumber(area_code);

    // 3. Persist agent + phone number
    const agent = await prisma.agent.create({
      data: {
        name: config.name,
        description: config.description,
        system_prompt: config.systemPrompt,
        capabilities: config.capabilities,
        personality: config.personality,
        original_prompt: prompt,
        model: config.suggestedModel,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        phone_number: {
          create: {
            phone_number: number.phoneNumber,
            twilio_sid: number.sid,
            friendly_name: number.friendlyName,
          },
        },
      },
      include: { phone_number: true },
    });

    return res.status(201).json({
      id: agent.id,
      short_id: agent.short_id,
      name: agent.name,
      description: agent.description,
      capabilities: agent.capabilities,
      personality: agent.personality,
      phone_number: agent.phone_number!.phone_number,
      friendly_name: agent.phone_number!.friendly_name,
      status: agent.status,
      created_at: agent.created_at,
    });
  } catch (err) {
    console.error("Agent creation error:", err);
    const message = err instanceof Error ? err.message : "Agent creation failed";
    return res.status(500).json({ error: message });
  }
});

// ─── GET /api/agents — List all agents ──────────────────────────────

agentsRouter.get("/", async (_req, res) => {
  const agents = await prisma.agent.findMany({
    where: { status: { not: "archived" } },
    include: {
      phone_number: true,
      _count: { select: { conversations: true, messages: true } },
    },
    orderBy: { created_at: "desc" },
  });

  return res.json(
    agents.map((a) => ({
      id: a.id,
      short_id: a.short_id,
      name: a.name,
      description: a.description,
      capabilities: a.capabilities,
      phone_number: a.phone_number?.phone_number,
      friendly_name: a.phone_number?.friendly_name,
      status: a.status,
      conversations: a._count.conversations,
      messages: a._count.messages,
      created_at: a.created_at,
    })),
  );
});

// ─── GET /api/agents/:id — Get agent details ────────────────────────

agentsRouter.get("/:id", async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
    include: {
      phone_number: true,
      _count: { select: { conversations: true, messages: true } },
    },
  });

  if (!agent) return res.status(404).json({ error: "Agent not found" });

  return res.json({
    id: agent.id,
    short_id: agent.short_id,
    name: agent.name,
    description: agent.description,
    system_prompt: agent.system_prompt,
    capabilities: agent.capabilities,
    personality: agent.personality,
    model: agent.model,
    temperature: agent.temperature,
    max_tokens: agent.max_tokens,
    phone_number: agent.phone_number?.phone_number,
    friendly_name: agent.phone_number?.friendly_name,
    status: agent.status,
    conversations: agent._count.conversations,
    messages: agent._count.messages,
    original_prompt: agent.original_prompt,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
  });
});

// ─── PATCH /api/agents/:id — Update agent config ────────────────────

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  system_prompt: z.string().min(10).optional(),
  capabilities: z.array(z.string()).optional(),
  personality: z.object({
    tone: z.string(),
    style: z.string(),
    emoji_usage: z.enum(["none", "minimal", "frequent"]),
  }).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  max_tokens: z.number().min(64).max(4096).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

agentsRouter.patch("/:id", async (req, res) => {
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten().fieldErrors });
  }

  const agent = await prisma.agent.findUnique({ where: { id: req.params.id } });
  if (!agent) return res.status(404).json({ error: "Agent not found" });

  const updated = await prisma.agent.update({
    where: { id: req.params.id },
    data: parse.data,
  });

  return res.json({ id: updated.id, ...parse.data, updated_at: updated.updated_at });
});

// ─── DELETE /api/agents/:id — Archive agent and release number ──────

agentsRouter.delete("/:id", async (req, res) => {
  const agent = await prisma.agent.findUnique({
    where: { id: req.params.id },
    include: { phone_number: true },
  });

  if (!agent) return res.status(404).json({ error: "Agent not found" });

  // Release the Twilio number
  if (agent.phone_number) {
    try {
      await releaseNumber(agent.phone_number.twilio_sid);
      await prisma.phoneNumber.update({
        where: { id: agent.phone_number.id },
        data: { status: "released", released_at: new Date() },
      });
    } catch (err) {
      console.error("Failed to release number:", err);
    }
  }

  // Archive the agent (soft delete)
  await prisma.agent.update({
    where: { id: req.params.id },
    data: { status: "archived" },
  });

  return res.json({ ok: true, message: "Agent archived and number released" });
});

// ─── GET /api/agents/:id/conversations — List conversations ─────────

agentsRouter.get("/:id/conversations", async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { agent_id: req.params.id },
    orderBy: { last_message_at: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
  });

  return res.json(
    conversations.map((c) => ({
      id: c.id,
      from_number: c.from_number,
      message_count: c._count.messages,
      started_at: c.started_at,
      last_message_at: c.last_message_at,
    })),
  );
});

// ─── GET /api/agents/:id/conversations/:convId/messages — Get messages

agentsRouter.get("/:id/conversations/:convId/messages", async (req, res) => {
  const messages = await prisma.message.findMany({
    where: {
      conversation_id: req.params.convId,
      agent_id: req.params.id,
    },
    orderBy: { created_at: "asc" },
  });

  return res.json(
    messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      media_urls: m.media_urls,
      tokens_used: m.tokens_used,
      created_at: m.created_at,
    })),
  );
});
