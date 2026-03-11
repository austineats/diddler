/**
 * Figma template cache — stores extracted design tokens in DB.
 * Figma API is only called on import/sync, never at generation time.
 */

import { prisma } from "./db.js";
import {
  fetchFigmaTemplate,
  parseFigmaUrl,
  templateToContextBrief,
  type FigmaDesignTokens,
  type FigmaTemplateData,
} from "./figmaClient.js";
import type { AppContextBrief } from "./contextResearch.js";

// ─── Cache TTL (default 24h, configurable) ──────────────────────

const CACHE_TTL_MS = Number(process.env.FIGMA_CACHE_TTL_MS ?? 86_400_000);

// ─── DB row type ─────────────────────────────────────────────────

interface CachedTemplate {
  id: string;
  file_key: string;
  file_name: string;
  thumbnail_url: string | null;
  design_tokens: FigmaDesignTokens;
  page_names: string[];
  component_count: number;
  updated_at: Date;
}

// ─── Import a Figma file (fetches from API + caches) ─────────────

export async function importFigmaTemplate(
  fileKeyOrUrl: string,
): Promise<CachedTemplate> {
  const fileKey = parseFigmaUrl(fileKeyOrUrl) ?? fileKeyOrUrl;

  console.log(`[Figma] Importing template: ${fileKey}`);
  const template = await fetchFigmaTemplate(fileKey);

  const row = await prisma.figmaTemplate.upsert({
    where: { file_key: fileKey },
    update: {
      file_name: template.file_name,
      thumbnail_url: template.thumbnail_url,
      design_tokens: template.design_tokens as any,
      page_names: template.page_names,
      component_count: template.component_count,
      raw_metadata: template.raw_metadata as any,
    },
    create: {
      file_key: fileKey,
      file_name: template.file_name,
      thumbnail_url: template.thumbnail_url,
      design_tokens: template.design_tokens as any,
      page_names: template.page_names,
      component_count: template.component_count,
      raw_metadata: template.raw_metadata as any,
    },
  });

  console.log(`[Figma] Cached template "${row.file_name}" (${row.component_count} components)`);

  return {
    id: row.id,
    file_key: row.file_key,
    file_name: row.file_name,
    thumbnail_url: row.thumbnail_url,
    design_tokens: row.design_tokens as unknown as FigmaDesignTokens,
    page_names: row.page_names as unknown as string[],
    component_count: row.component_count,
    updated_at: row.updated_at,
  };
}

// ─── Get cached template (returns null if not imported) ──────────

export async function getCachedTemplate(
  fileKey: string,
): Promise<CachedTemplate | null> {
  const row = await prisma.figmaTemplate.findUnique({
    where: { file_key: fileKey },
  });
  if (!row) return null;
  return {
    id: row.id,
    file_key: row.file_key,
    file_name: row.file_name,
    thumbnail_url: row.thumbnail_url,
    design_tokens: row.design_tokens as unknown as FigmaDesignTokens,
    page_names: row.page_names as unknown as string[],
    component_count: row.component_count,
    updated_at: row.updated_at,
  };
}

// ─── Get or refresh (auto-sync if stale) ─────────────────────────

export async function getOrRefreshTemplate(
  fileKey: string,
): Promise<CachedTemplate | null> {
  const cached = await getCachedTemplate(fileKey);
  if (!cached) return null;

  const age = Date.now() - cached.updated_at.getTime();
  if (age > CACHE_TTL_MS) {
    console.log(`[Figma] Cache stale for ${fileKey}, refreshing...`);
    try {
      return await importFigmaTemplate(fileKey);
    } catch (e) {
      console.warn(`[Figma] Refresh failed, using stale cache:`, e);
      return cached;
    }
  }

  return cached;
}

// ─── List all cached templates ───────────────────────────────────

export async function listTemplates(): Promise<CachedTemplate[]> {
  const rows = await prisma.figmaTemplate.findMany({
    orderBy: { updated_at: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    file_key: row.file_key,
    file_name: row.file_name,
    thumbnail_url: row.thumbnail_url,
    design_tokens: row.design_tokens as unknown as FigmaDesignTokens,
    page_names: row.page_names as unknown as string[],
    component_count: row.component_count,
    updated_at: row.updated_at,
  }));
}

// ─── Delete a cached template ────────────────────────────────────

export async function deleteTemplate(fileKey: string): Promise<boolean> {
  try {
    await prisma.figmaTemplate.delete({ where: { file_key: fileKey } });
    return true;
  } catch {
    return false;
  }
}

// ─── Get template as AppContextBrief (for code gen) ──────────────

export async function getTemplateAsContext(
  fileKey: string,
): Promise<Partial<AppContextBrief> | null> {
  const cached = await getOrRefreshTemplate(fileKey);
  if (!cached) return null;

  const templateData: FigmaTemplateData = {
    file_key: cached.file_key,
    file_name: cached.file_name,
    last_modified: cached.updated_at.toISOString(),
    thumbnail_url: cached.thumbnail_url,
    design_tokens: cached.design_tokens,
    page_names: cached.page_names,
    component_count: cached.component_count,
    raw_metadata: {},
  };

  return templateToContextBrief(templateData);
}
