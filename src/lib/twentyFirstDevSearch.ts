/**
 * Search 21st.dev for UI components via DuckDuckGo.
 * Scrapes component pages for names, descriptions, and implementation hints.
 * Results enhance the code gen system prompt with real-world component patterns.
 */

// ─── Types ──────────────────────────────────────────────────────

export interface UIComponentResult {
  name: string;
  category: string;
  description: string;
  codeHint: string;
  sourceUrl: string;
}

// ─── In-memory cache ────────────────────────────────────────────

const componentCache = new Map<string, { results: UIComponentResult[]; timestamp: number }>();
const CACHE_TTL = 3_600_000; // 1 hour

// ─── Fetch helpers ──────────────────────────────────────────────

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

// ─── DuckDuckGo search for 21st.dev ────────────────────────────

interface SearchHit {
  url: string;
  title: string;
  snippet: string;
}

function parseDDGResults(html: string): SearchHit[] {
  const results: SearchHit[] = [];
  const linkPattern = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    if (url && title && url.includes("21st.dev")) {
      links.push({ url, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(
      match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .trim(),
    );
  }

  for (let i = 0; i < links.length && i < 6; i++) {
    results.push({
      url: links[i].url,
      title: links[i].title,
      snippet: snippets[i] ?? "",
    });
  }

  // Fallback: simpler anchor matching
  if (results.length === 0) {
    const simplePattern = /<a[^>]*href="(https?:\/\/[^"]*21st\.dev[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set<string>();
    while ((match = simplePattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (url && title && title.length > 3 && !seen.has(url)) {
        seen.add(url);
        results.push({ url, title, snippet: "" });
        if (results.length >= 5) break;
      }
    }
  }

  return results;
}

// ─── Scrape a 21st.dev component page ──────────────────────────

function extractComponentInfo(html: string, url: string): UIComponentResult | null {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
  // Clean title: remove "- 21st.dev" suffix, etc.
  const name = rawTitle.replace(/\s*[-|]\s*21st\.dev.*/i, "").trim();
  if (!name || name.length < 3) return null;

  // Extract meta description
  const descMatch =
    html.match(/<meta\s+(?:name|property)="(?:description|og:description)"\s+content="([^"]+)"/i) ??
    html.match(/content="([^"]+)"\s+(?:name|property)="(?:description|og:description)"/i);
  const description = descMatch?.[1]?.slice(0, 300) ?? "";

  // Try to extract code snippets (look for <code> or <pre> blocks)
  const codeBlocks: string[] = [];
  const codePattern = /<(?:code|pre)[^>]*>([\s\S]*?)<\/(?:code|pre)>/gi;
  let codeMatch;
  while ((codeMatch = codePattern.exec(html)) !== null) {
    const code = codeMatch[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (code.length > 20 && code.length < 2000) {
      codeBlocks.push(code);
    }
  }

  // Determine category from URL or title
  const lower = (name + " " + description + " " + url).toLowerCase();
  let category = "component";
  if (lower.includes("hero") || lower.includes("landing")) category = "hero";
  else if (lower.includes("card")) category = "card";
  else if (lower.includes("button") || lower.includes("cta")) category = "interaction";
  else if (lower.includes("nav") || lower.includes("sidebar") || lower.includes("header")) category = "navigation";
  else if (lower.includes("background") || lower.includes("gradient") || lower.includes("pattern")) category = "background";
  else if (lower.includes("text") || lower.includes("typography") || lower.includes("heading")) category = "text";
  else if (lower.includes("form") || lower.includes("input")) category = "form";
  else if (lower.includes("chart") || lower.includes("graph") || lower.includes("stat")) category = "data-display";
  else if (lower.includes("modal") || lower.includes("dialog") || lower.includes("drawer")) category = "overlay";
  else if (lower.includes("tab") || lower.includes("accordion")) category = "layout";

  // Build implementation hint from code or description
  const codeHint = codeBlocks.length > 0
    ? `Implementation reference:\n${codeBlocks[0].slice(0, 500)}`
    : description
      ? `${description}. Use React + Tailwind CSS. No external dependencies.`
      : `${name} component. Implement with React + Tailwind CSS. No external dependencies.`;

  return {
    name,
    category,
    description: description || `${name} UI component from 21st.dev`,
    codeHint,
    sourceUrl: url,
  };
}

// ─── Main: search + scrape ──────────────────────────────────────

/**
 * Search 21st.dev for UI components matching the query.
 * Returns structured component data for code generation context.
 */
export async function search21stDev(query: string): Promise<UIComponentResult[]> {
  // Check cache
  const cached = componentCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[21st.dev] Cache hit for "${query}": ${cached.results.length} components`);
    return cached.results;
  }

  const searchQuery = encodeURIComponent(`site:21st.dev ${query} component react`);
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${searchQuery}`;

  console.log(`[21st.dev] Searching for: ${query}`);

  try {
    const res = await fetchWithTimeout(searchUrl, 8000);
    if (!res.ok) {
      console.warn(`[21st.dev] DuckDuckGo returned ${res.status}`);
      componentCache.set(query, { results: [], timestamp: Date.now() });
      return [];
    }

    const html = await res.text();
    const hits = parseDDGResults(html);

    if (hits.length === 0) {
      console.log(`[21st.dev] No results found for "${query}"`);
      componentCache.set(query, { results: [], timestamp: Date.now() });
      return [];
    }

    console.log(`[21st.dev] Found ${hits.length} results, scraping top 3...`);

    // Scrape top 3 component pages in parallel
    const scrapePromises = hits.slice(0, 3).map(async (hit) => {
      try {
        const pageRes = await fetchWithTimeout(hit.url, 6000);
        if (!pageRes.ok) return null;
        const pageHtml = (await pageRes.text()).slice(0, 100_000);
        return extractComponentInfo(pageHtml, hit.url);
      } catch {
        // Use search result data as fallback
        return {
          name: hit.title.replace(/\s*[-|]\s*21st\.dev.*/i, "").trim(),
          category: "component",
          description: hit.snippet || hit.title,
          codeHint: `${hit.title}. Implement with React + Tailwind CSS. No external dependencies.`,
          sourceUrl: hit.url,
        } satisfies UIComponentResult;
      }
    });

    // Filter out junk: generic 21st.dev navigation pages, not actual components
    const JUNK_PATTERNS = [
      /discover/i, /community\s*components/i, /community-made/i,
      /browse/i, /all\s*components/i, /21st\.dev$/i,
      /sign\s*in/i, /log\s*in/i, /pricing/i,
    ];
    const results = (await Promise.all(scrapePromises)).filter(
      (r): r is UIComponentResult =>
        r !== null &&
        r.name.length > 2 &&
        r.name.length < 50 &&
        !JUNK_PATTERNS.some((p) => p.test(r.name)),
    );

    console.log(`[21st.dev] Scraped ${results.length} components: ${results.map((r) => r.name).join(", ")}`);
    componentCache.set(query, { results, timestamp: Date.now() });
    return results;
  } catch (e) {
    console.warn(`[21st.dev] Search failed:`, e instanceof Error ? e.message : e);
    componentCache.set(query, { results: [], timestamp: Date.now() });
    return [];
  }
}

// ─── Domain → UI component type map for 21st.dev ────────────────
// Unlike Figma (which needs app categories), 21st.dev needs COMPONENT TYPES

const COMPONENT_DOMAIN_MAP: Array<{ keywords: string[]; componentQuery: string }> = [
  { keywords: ["dating", "match", "swipe", "tinder", "bumble", "hinge", "ditto"], componentQuery: "profile card swipe" },
  { keywords: ["social", "feed", "post", "follow", "timeline", "community"], componentQuery: "social feed card" },
  { keywords: ["chat", "message", "messaging", "conversation"], componentQuery: "chat message bubble" },
  { keywords: ["shop", "store", "ecommerce", "product", "cart", "marketplace"], componentQuery: "product card pricing" },
  { keywords: ["fitness", "workout", "gym", "exercise", "health", "tracker"], componentQuery: "progress chart stats" },
  { keywords: ["food", "recipe", "restaurant", "delivery", "menu"], componentQuery: "food card menu" },
  { keywords: ["finance", "money", "bank", "invest", "budget", "wallet"], componentQuery: "chart stats card" },
  { keywords: ["task", "todo", "project", "productivity", "kanban"], componentQuery: "kanban task card" },
  { keywords: ["education", "learn", "course", "study", "quiz"], componentQuery: "course card progress" },
  { keywords: ["travel", "booking", "hotel", "flight", "trip"], componentQuery: "booking card hero" },
  { keywords: ["music", "spotify", "playlist", "audio", "podcast"], componentQuery: "player card audio" },
  { keywords: ["dashboard", "analytics", "admin", "metrics"], componentQuery: "dashboard chart stats" },
  { keywords: ["portfolio", "resume", "personal", "landing"], componentQuery: "hero section landing" },
  { keywords: ["news", "blog", "article", "magazine"], componentQuery: "article card grid" },
];

/**
 * Build a search query from the user's prompt.
 * Extracts UI COMPONENT TYPES relevant to the app domain (not product names).
 */
export function build21stDevSearchQuery(prompt: string): string {
  const lower = prompt.toLowerCase();

  // Check domain map — map app type to relevant component types
  for (const entry of COMPONENT_DOMAIN_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.componentQuery;
    }
  }

  // Fallback: extract meaningful words
  const stopWords = new Set([
    "make", "me", "a", "an", "the", "build", "create", "generate",
    "app", "application", "web", "website", "please", "i", "want",
    "need", "like", "with", "and", "for", "that", "this", "my",
    "can", "you", "just", "simple", "good", "best", "new",
  ]);
  const stripped = lower.replace(/like\s+[a-z0-9]+(?:\s+[a-z0-9]+)?(?:\s+ai)?/gi, "");
  const words = stripped
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (words.length > 0) {
    return words.slice(0, 3).join(" ");
  }

  return "hero card button";
}

/**
 * Format 21st.dev component results into a string for the code gen system prompt.
 */
export function format21stDevComponents(components: UIComponentResult[]): string {
  if (components.length === 0) return "";

  const lines = [
    "=== LIVE 21st.dev COMPONENT REFERENCES ===",
    "Use these real-world component patterns as inspiration. Implement with React + Tailwind CSS only (no imports).\n",
  ];

  for (const comp of components) {
    lines.push(`### ${comp.name} [${comp.category}]`);
    if (comp.description) lines.push(comp.description);
    lines.push(comp.codeHint);
    lines.push("");
  }

  return lines.join("\n");
}
