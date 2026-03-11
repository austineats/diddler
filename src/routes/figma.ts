import { Router } from "express";
import { z } from "zod";
import {
  importFigmaTemplate,
  listTemplates,
  getCachedTemplate,
  deleteTemplate,
} from "../lib/figmaTemplateCache.js";
import { parseFigmaUrl } from "../lib/figmaClient.js";

export const figmaRouter = Router();

// POST /api/figma/templates — import a Figma file as a template
const importSchema = z.object({
  figma_url: z.string().min(1).max(500),
});

figmaRouter.post("/templates", async (req, res) => {
  try {
    const { figma_url } = importSchema.parse(req.body);
    const fileKey = parseFigmaUrl(figma_url) ?? figma_url;

    if (!fileKey || fileKey.length < 5) {
      return res.status(400).json({ message: "Invalid Figma URL or file key" });
    }

    const template = await importFigmaTemplate(fileKey);
    return res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid request", issues: error.issues });
    }
    const msg = error instanceof Error ? error.message : "Import failed";
    console.error("[Figma] Import error:", msg);
    return res.status(502).json({ message: msg });
  }
});

// GET /api/figma/templates — list all cached templates
figmaRouter.get("/templates", async (_req, res) => {
  try {
    const templates = await listTemplates();
    return res.json({ templates });
  } catch (error) {
    console.error("[Figma] List error:", error);
    return res.status(500).json({ message: "Failed to list templates" });
  }
});

// GET /api/figma/templates/:fileKey — get a single template
figmaRouter.get("/templates/:fileKey", async (req, res) => {
  try {
    const template = await getCachedTemplate(req.params.fileKey);
    if (!template) {
      return res.status(404).json({ message: "Template not found. Import it first via POST /api/figma/templates." });
    }
    return res.json(template);
  } catch (error) {
    console.error("[Figma] Get error:", error);
    return res.status(500).json({ message: "Failed to get template" });
  }
});

// DELETE /api/figma/templates/:fileKey — remove a cached template
figmaRouter.delete("/templates/:fileKey", async (req, res) => {
  const deleted = await deleteTemplate(req.params.fileKey);
  if (!deleted) {
    return res.status(404).json({ message: "Template not found" });
  }
  return res.json({ deleted: true });
});

// POST /api/figma/templates/:fileKey/sync — re-fetch from Figma API
figmaRouter.post("/templates/:fileKey/sync", async (req, res) => {
  try {
    const template = await importFigmaTemplate(req.params.fileKey);
    return res.json(template);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Sync failed";
    return res.status(502).json({ message: msg });
  }
});
