/**
 * Search Figma Community for free templates via DuckDuckGo.
 * Fetches the best match via Figma API and extracts design tokens.
 * Results are cached in the figma_templates DB table.
 */

import { fetchFigmaTemplate, parseFigmaUrl, templateToContextBrief, type FigmaTemplateData } from "./figmaClient.js";
import { importFigmaTemplate, getCachedTemplate } from "./figmaTemplateCache.js";
import type { AppContextBrief } from "./contextResearch.js";

// ─── In-memory search result cache (avoids re-searching DuckDuckGo) ──

const searchCache = new Map<string, { fileKey: string | null; timestamp: number }>();
const SEARCH_CACHE_TTL = 3_600_000; // 1 hour

// ─── DuckDuckGo search ──────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract Figma community file URLs from DuckDuckGo HTML results.
 */
function extractFigmaUrls(html: string): string[] {
  const urls: string[] = [];
  // Match any Figma community file URL in href attributes or plain text
  const pattern = /https?:\/\/(?:www\.)?figma\.com\/community\/file\/(\d+)[^"'\s]*/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    urls.push(match[0]);
  }
  // Deduplicate by file key
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = parseFigmaUrl(url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Search Figma Community for a template matching the query.
 * Returns the file key of the best match, or null if nothing found.
 */
async function searchDuckDuckGoForFigma(query: string): Promise<string | null> {
  // Check in-memory cache first
  const cached = searchCache.get(query);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    console.log(`[Figma Search] Cache hit for "${query}"`);
    return cached.fileKey;
  }

  const searchQuery = encodeURIComponent(`site:figma.com/community/file ${query} app template free`);
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${searchQuery}`;

  console.log(`[Figma Search] Searching DuckDuckGo for: ${query}`);

  try {
    const res = await fetchWithTimeout(searchUrl, 8000);
    if (!res.ok) {
      console.warn(`[Figma Search] DuckDuckGo returned ${res.status}`);
      searchCache.set(query, { fileKey: null, timestamp: Date.now() });
      return null;
    }

    const html = await res.text();
    const figmaUrls = extractFigmaUrls(html);

    if (figmaUrls.length === 0) {
      console.log(`[Figma Search] No Figma community files found for "${query}"`);
      searchCache.set(query, { fileKey: null, timestamp: Date.now() });
      return null;
    }

    const fileKey = parseFigmaUrl(figmaUrls[0]);
    console.log(`[Figma Search] Found ${figmaUrls.length} results, best: ${figmaUrls[0]} (key: ${fileKey})`);
    searchCache.set(query, { fileKey, timestamp: Date.now() });
    return fileKey;
  } catch (e) {
    console.warn(`[Figma Search] Failed:`, e instanceof Error ? e.message : e);
    searchCache.set(query, { fileKey: null, timestamp: Date.now() });
    return null;
  }
}

// ─── Main: search + fetch + extract ─────────────────────────────

/**
 * Search Figma Community for the best template matching the user's app type.
 * Fetches design tokens and caches the result.
 * Returns null if no template found or Figma API key not set.
 */
export async function searchFigmaCommunity(
  appType: string,
): Promise<{ template: FigmaTemplateData; contextOverlay: Partial<AppContextBrief> } | null> {
  // Require API key
  if (!process.env.FIGMA_API_KEY) {
    console.log("[Figma Search] FIGMA_API_KEY not set, skipping community search");
    return null;
  }

  // Search DuckDuckGo for the best Figma template
  const fileKey = await searchDuckDuckGoForFigma(appType);
  if (!fileKey) return null;

  // Check if we already have this template cached in DB
  const cached = await getCachedTemplate(fileKey);
  if (cached) {
    console.log(`[Figma Search] Using cached template "${cached.file_name}" for "${appType}"`);
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
    return {
      template: templateData,
      contextOverlay: templateToContextBrief(templateData),
    };
  }

  // Fetch from Figma API and cache
  try {
    console.log(`[Figma Search] Fetching template ${fileKey} from Figma API...`);
    const template = await fetchFigmaTemplate(fileKey);

    // Cache in DB for future use
    try {
      await importFigmaTemplate(fileKey);
    } catch (e) {
      console.warn("[Figma Search] DB cache failed (non-fatal):", e);
    }

    console.log(`[Figma Search] Got template "${template.file_name}" — ${template.component_count} components, ${template.design_tokens.colors.all.length} colors`);

    return {
      template,
      contextOverlay: templateToContextBrief(template),
    };
  } catch (e) {
    console.warn(`[Figma Search] Failed to fetch template ${fileKey}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ─── Domain keyword map ─────────────────────────────────────────
// Maps prompt keywords → Figma-friendly app category search terms

const DOMAIN_MAP: Array<{ keywords: string[]; figmaQuery: string }> = [
  { keywords: ["dating", "match", "swipe", "tinder", "bumble", "hinge", "ditto"], figmaQuery: "dating app" },
  { keywords: ["social", "feed", "post", "follow", "timeline", "community", "network"], figmaQuery: "social media app" },
  { keywords: ["chat", "message", "messaging", "dm", "conversation", "whatsapp", "telegram"], figmaQuery: "messaging chat app" },
  { keywords: ["shop", "store", "ecommerce", "product", "cart", "buy", "sell", "marketplace"], figmaQuery: "ecommerce shop" },
  { keywords: ["fitness", "workout", "gym", "exercise", "health", "tracker", "training"], figmaQuery: "fitness tracker app" },
  { keywords: ["food", "recipe", "restaurant", "delivery", "menu", "cooking", "meal"], figmaQuery: "food delivery app" },
  { keywords: ["finance", "money", "bank", "invest", "budget", "payment", "wallet", "crypto"], figmaQuery: "finance banking app" },
  { keywords: ["task", "todo", "project", "productivity", "kanban", "planner", "notes"], figmaQuery: "productivity task app" },
  { keywords: ["education", "learn", "course", "study", "quiz", "tutorial", "school"], figmaQuery: "education learning app" },
  { keywords: ["travel", "booking", "hotel", "flight", "trip", "vacation", "airbnb"], figmaQuery: "travel booking app" },
  { keywords: ["music", "spotify", "playlist", "audio", "podcast", "streaming", "player"], figmaQuery: "music streaming app" },
  { keywords: ["dashboard", "analytics", "admin", "metrics", "reporting", "monitor"], figmaQuery: "dashboard analytics" },
  { keywords: ["real estate", "property", "house", "rent", "listing", "apartment"], figmaQuery: "real estate app" },
  { keywords: ["crm", "sales", "pipeline", "leads", "contacts", "deals"], figmaQuery: "crm dashboard" },
  { keywords: ["portfolio", "resume", "personal", "landing"], figmaQuery: "portfolio landing page" },
  { keywords: ["weather", "forecast", "climate"], figmaQuery: "weather app" },
  { keywords: ["news", "blog", "article", "magazine", "media"], figmaQuery: "news magazine app" },
];

/**
 * Build a search query from the user's prompt.
 * Extracts the APP CATEGORY (not product name) for a targeted Figma search.
 */
export function buildFigmaSearchQuery(prompt: string): string {
  const lower = prompt.toLowerCase();

  // Strip "like [product name]" references — we want the category, not the brand
  const stripped = lower.replace(/like\s+[a-z0-9]+(?:\s+[a-z0-9]+)?(?:\s+ai)?/gi, "").trim();

  // Check domain map first — most reliable
  for (const entry of DOMAIN_MAP) {
    const matched = entry.keywords.filter((kw) => lower.includes(kw));
    if (matched.length > 0) {
      console.log(`[Figma Search] Domain match: "${matched.join(", ")}" → "${entry.figmaQuery}"`);
      return entry.figmaQuery;
    }
  }

  // Fallback: extract meaningful words from the stripped prompt
  const stopWords = new Set([
    "make", "me", "a", "an", "the", "build", "create", "generate",
    "app", "application", "web", "website", "please", "i", "want",
    "need", "like", "with", "and", "for", "that", "this", "my",
    "can", "you", "just", "simple", "good", "best", "new",
  ]);
  const words = stripped
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (words.length > 0) {
    return words.slice(0, 3).join(" ") + " app";
  }

  return "mobile app UI";
}
