/**
 * Search 21st.dev for UI components via Brave Search.
 * Scrapes component pages for names, descriptions, and implementation hints.
 * Results enhance the code gen system prompt with real-world component patterns.
 */

import { braveSearch } from "./braveSearch.js";

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

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": randomUA(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Brave Search for 21st.dev ──────────────────────────────────

interface SearchHit {
  url: string;
  title: string;
  snippet: string;
}

function parseBraveResults(html: string): SearchHit[] {
  const results: SearchHit[] = [];
  const snippetPattern = /<div class="snippet\s+svelte-[^"]*"\s+data-pos="\d+"\s+data-type="web"[^>]*>([\s\S]*?)(?=<div class="snippet\s|<\/main>|$)/gi;
  let snippetMatch;

  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    const block = snippetMatch[1];
    const urlMatch = block.match(/<a href="(https?:\/\/[^"]+)"[^>]*class="[^"]*l1"/);
    if (!urlMatch) continue;
    const url = urlMatch[1];
    if (!url.includes("21st.dev")) continue;

    const titleMatch = block.match(/class="title[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim()
      : "";

    const descMatch = block.match(/class="content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const snippet = descMatch
      ? descMatch[1].replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim()
      : "";

    if (url && title) results.push({ url, title, snippet });
    if (results.length >= 6) break;
  }

  if (results.length === 0) {
    const urlPattern = /href="(https?:\/\/(?:www\.)?21st\.dev\/[^"]*(?:component|community)[^"]*)"/gi;
    const seen = new Set<string>();
    let match;
    while ((match = urlPattern.exec(html)) !== null) {
      const url = match[1];
      if (!seen.has(url) && !url.includes("opengraph-image")) {
        seen.add(url);
        results.push({ url, title: "", snippet: "" });
        if (results.length >= 5) break;
      }
    }
  }

  return results;
}

// ─── Extract component code from CDN ───────────────────────────

function extractCdnCodeUrl(html: string): string | null {
  const pattern = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
    const cdnMatch = raw.match(/"code":"(https:\/\/cdn\.21st\.dev\/[^"]+\.tsx)"/);
    if (cdnMatch) return cdnMatch[1];
  }
  return null;
}

async function fetchCdnCode(cdnUrl: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(cdnUrl, 5000);
    if (!res.ok) return null;
    const code = await res.text();
    if (code.length < 50) return null;
    return code.slice(0, 3000);
  } catch {
    return null;
  }
}

async function fetchShadcnComponent(name: string): Promise<string | null> {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .pop() ?? name.toLowerCase();
  try {
    const res = await fetchWithTimeout(
      `https://ui.shadcn.com/r/styles/new-york/${slug}.json`, 5000
    );
    if (!res.ok) return null;
    const data = await res.json() as { files?: { content?: string }[] };
    const content = data.files?.[0]?.content;
    if (!content || content.length < 50) return null;
    console.log(`[shadcn] Got source code for "${slug}" (${content.length} chars)`);
    return content.slice(0, 3000);
  } catch {
    return null;
  }
}

// ─── Scrape a 21st.dev component page ──────────────────────────

async function extractComponentInfo(html: string, url: string): Promise<UIComponentResult | null> {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
  const name = rawTitle.split(/\s*\|\s*/)[0]?.trim() ?? rawTitle.trim();
  if (!name || name.length < 3) return null;

  const descMatch =
    html.match(/<meta\s+(?:name|property)="(?:description|og:description)"\s+content="([^"]+)"/i) ??
    html.match(/content="([^"]+)"\s+(?:name|property)="(?:description|og:description)"/i);
  const description = descMatch?.[1]?.slice(0, 300) ?? "";

  // Fetch source code from CDN
  const cdnUrl = extractCdnCodeUrl(html);
  let extractedCode: string | null = null;
  if (cdnUrl) {
    extractedCode = await fetchCdnCode(cdnUrl);
    if (extractedCode) {
      console.log(`[21st.dev] CDN code for "${name}": ${cdnUrl} (${extractedCode.length} chars)`);
    } else {
      console.log(`[21st.dev] CDN fetch failed for "${name}": ${cdnUrl}`);
    }
  } else {
    console.log(`[21st.dev] No CDN URL found in RSC for "${name}"`);
  }

  // Determine category
  const lower = (name + " " + description + " " + url).toLowerCase();
  let category = "component";
  if (lower.includes("hero") || lower.includes("landing")) category = "hero";
  else if (lower.includes("card")) category = "card";
  else if (lower.includes("button") || lower.includes("cta")) category = "interaction";
  else if (lower.includes("nav") || lower.includes("sidebar") || lower.includes("header")) category = "navigation";
  else if (lower.includes("background") || lower.includes("gradient") || lower.includes("pattern")) category = "background";
  else if (lower.includes("text") || lower.includes("typography") || lower.includes("heading")) category = "text";
  else if (lower.includes("form") || lower.includes("input")) category = "form";

  let codeHint: string;
  if (extractedCode) {
    codeHint = `Source code:\n\`\`\`tsx\n${extractedCode}\n\`\`\``;
  } else {
    const shadcnCode = await fetchShadcnComponent(name).catch(() => null);
    if (shadcnCode) {
      codeHint = `Source code (shadcn/ui):\n\`\`\`tsx\n${shadcnCode}\n\`\`\``;
    } else {
      codeHint = `${name} component. Implement with React + Tailwind CSS.`;
    }
  }

  return {
    name,
    category,
    description: description || `${name} UI component from 21st.dev`,
    codeHint,
    sourceUrl: url,
  };
}

// ─── Extract component links from listing pages ────────────────

function extractComponentLinksFromListing(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const pattern = /href="(\/community\/components\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)"/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const path = match[1];
    if (!seen.has(path)) {
      seen.add(path);
      links.push(`https://21st.dev${path}`);
    }
    if (links.length >= 3) break;
  }
  if (links.length === 0) {
    const rscPattern = /\/community\/components\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g;
    while ((match = rscPattern.exec(html)) !== null) {
      const path = match[0];
      if (!seen.has(path)) {
        seen.add(path);
        links.push(`https://21st.dev${path}`);
      }
      if (links.length >= 3) break;
    }
  }
  return links;
}

// ─── Main: search + scrape ──────────────────────────────────────

const JUNK_NAME_PATTERNS = [
  /^discover\b/i, /community\s*components/i, /community-made/i,
  /^browse\b/i, /^all\s*components/i, /^21st\.dev$/i,
  /^sign\s*in/i, /^log\s*in/i, /^pricing$/i, /^home$/i,
  /^about$/i, /^contact$/i, /^docs$/i,
  /\bcomponents$/i,
];

function isJunkResult(name: string): boolean {
  return (
    name.length <= 2 ||
    name.length > 60 ||
    JUNK_NAME_PATTERNS.some((p) => p.test(name))
  );
}

async function searchSingleQuery(query: string): Promise<UIComponentResult[]> {
  const cached = componentCache.get(query);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[21st.dev] Cache hit for "${query}": ${cached.results.length} components`);
    return cached.results;
  }

  console.log(`[21st.dev] Searching Brave for: "${query}"`);

  try {
    const html = await braveSearch(`site:21st.dev/community/components/ ${query}`);
    if (!html) {
      componentCache.set(query, { results: [], timestamp: Date.now() });
      return [];
    }
    const hits = parseBraveResults(html);

    if (hits.length === 0) {
      console.log(`[21st.dev] No results for "${query}"`);
      componentCache.set(query, { results: [], timestamp: Date.now() });
      return [];
    }

    const individualHits: SearchHit[] = [];
    const listingHits: SearchHit[] = [];

    for (const hit of hits) {
      if (hit.url.includes('/components/s/') || hit.url.match(/\/s\/[^/]+$/) || hit.url.includes('/docs/')) {
        listingHits.push(hit);
      } else {
        individualHits.push(hit);
      }
    }

    if (individualHits.length === 0 && listingHits.length > 0) {
      console.log(`[21st.dev] Only got ${listingHits.length} listing pages — following links...`);
      for (const listing of listingHits.slice(0, 2)) {
        try {
          const listRes = await fetchWithTimeout(listing.url, 6000);
          if (!listRes.ok) continue;
          const listHtml = (await listRes.text()).slice(0, 200_000);
          const componentLinks = extractComponentLinksFromListing(listHtml);
          for (const link of componentLinks) individualHits.push({ url: link, title: "", snippet: "" });
          if (individualHits.length >= 4) break;
        } catch { continue; }
      }
    }

    if (individualHits.length === 0) {
      componentCache.set(query, { results: [], timestamp: Date.now() });
      return [];
    }

    console.log(`[21st.dev] Found ${hits.length} results for "${query}" (${individualHits.length} individual), scraping top 4...`);

    const scrapePromises = individualHits.slice(0, 4).map(async (hit) => {
      try {
        const pageRes = await fetchWithTimeout(hit.url, 8000);
        if (!pageRes.ok) return null;
        const pageHtml = await pageRes.text();
        return extractComponentInfo(pageHtml, hit.url);
      } catch {
        const name = hit.title.replace(/\s*[-|]\s*21st(?:\.dev)?.*/i, "").trim();
        if (isJunkResult(name)) return null;
        return {
          name,
          category: "component",
          description: hit.snippet || hit.title,
          codeHint: `${hit.title}. Implement with React + Tailwind CSS.`,
          sourceUrl: hit.url,
        } satisfies UIComponentResult;
      }
    });

    const results = (await Promise.all(scrapePromises)).filter(
      (r): r is UIComponentResult => r !== null && !isJunkResult(r.name),
    );

    console.log(`[21st.dev] Scraped ${results.length} components for "${query}": ${results.map((r) => `${r.name}(${r.codeHint.startsWith('Source code') ? 'HAS CODE' : 'no code'})`).join(", ")}`);
    componentCache.set(query, { results, timestamp: Date.now() });
    return results;
  } catch (e) {
    console.warn(`[21st.dev] Search failed for "${query}":`, e instanceof Error ? e.message : e);
    componentCache.set(query, { results: [], timestamp: Date.now() });
    return [];
  }
}

export async function search21stDev(query: string): Promise<UIComponentResult[]> {
  return searchSingleQuery(query);
}

export async function search21stDevMulti(queries: string[]): Promise<UIComponentResult[]> {
  const allResults = await Promise.all(queries.map((q) => searchSingleQuery(q)));
  const merged: UIComponentResult[] = [];
  const seen = new Set<string>();

  for (const results of allResults) {
    for (const r of results) {
      const key = r.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
  }

  console.log(`[21st.dev] Merged ${merged.length} unique components from ${queries.length} queries (${merged.filter(r => r.codeHint.startsWith('Source code')).length} with code)`);
  return merged;
}

// ─── Effect slots: WHERE in the app each effect type belongs ─────

type EffectSlot = "hero_bg" | "card_hover" | "section_reveal" | "text_effect";

interface SlotConfig {
  slot: EffectSlot;
  placement: string; // instruction for LLM on WHERE to use it
  queries: string[]; // 21st.dev search queries for this slot
}

const EFFECT_SLOTS: SlotConfig[] = [
  {
    slot: "hero_bg",
    placement: "Apply to the HERO section as a full-screen immersive background",
    queries: [
      "aurora background", "particle background", "shader background",
      "mesh gradient", "3d globe", "animated gradient background",
      "spotlight hero", "interactive background", "liquid background",
      "wave background", "orb effect", "nebula background",
    ],
  },
  {
    slot: "card_hover",
    placement: "Apply to CARDS — interactive hover effect on each card",
    queries: [
      "3d card effect", "holographic card", "spotlight card", "tilt card",
      "glass card", "neon card", "flip card", "interactive card",
      "hover card effect", "card animation", "glowing card",
    ],
  },
  {
    slot: "section_reveal",
    placement: "Apply to CONTENT SECTIONS — animate elements as user scrolls or interacts",
    queries: [
      "scroll animation", "parallax scroll", "staggered animation",
      "bento grid", "masonry layout", "animated list",
      "magnetic effect", "cursor effect", "dock navigation",
    ],
  },
  {
    slot: "text_effect",
    placement: "Apply to the HERO HEADLINE or key headings for wow factor",
    queries: [
      "text animation", "typewriter effect", "gradient text", "glitch text",
      "text reveal", "morphing text", "scramble text", "3d text",
      "neon text", "animated text", "text shimmer",
    ],
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function build21stDevSearchQuery(prompt: string, discoveredCategory?: string | null): string {
  return build21stDevSearchQueries(prompt, discoveredCategory)[0];
}

export function build21stDevSearchQueries(_prompt: string, _discoveredCategory?: string | null): string[] {
  // Pick one query from each of 3 different slots (hero_bg + card_hover + one of the others)
  const heroQuery = pickRandom(EFFECT_SLOTS[0].queries);
  const cardQuery = pickRandom(EFFECT_SLOTS[1].queries);
  const otherSlot = pickRandom(EFFECT_SLOTS.slice(2));
  const otherQuery = pickRandom(otherSlot.queries);
  const queries = [heroQuery, cardQuery, otherQuery];
  console.log(`[21st.dev] Search queries: ${queries.join(", ")}`);
  return queries;
}

// ─── Effect formatting for system prompt ─────────────────────────

/**
 * Classify a component into an effect slot based on name/category/description.
 */
function classifySlot(comp: UIComponentResult): { slot: EffectSlot; placement: string } {
  const lower = (comp.name + " " + comp.category + " " + comp.description).toLowerCase();

  if (lower.includes("background") || lower.includes("aurora") || lower.includes("particle") ||
      lower.includes("mesh") || lower.includes("hero") || lower.includes("globe") ||
      lower.includes("wave") || lower.includes("orb") || lower.includes("nebula") ||
      lower.includes("shader") || lower.includes("liquid")) {
    return { slot: "hero_bg", placement: EFFECT_SLOTS[0].placement };
  }
  if (lower.includes("card") || lower.includes("tilt") || lower.includes("spotlight") ||
      lower.includes("border") || lower.includes("glow") || lower.includes("glass") ||
      lower.includes("neon") || lower.includes("holographic") || lower.includes("flip")) {
    return { slot: "card_hover", placement: EFFECT_SLOTS[1].placement };
  }
  if (lower.includes("scroll") || lower.includes("reveal") || lower.includes("parallax") ||
      lower.includes("stagger") || lower.includes("bento") || lower.includes("masonry") ||
      lower.includes("magnetic") || lower.includes("cursor") || lower.includes("dock")) {
    return { slot: "section_reveal", placement: EFFECT_SLOTS[2].placement };
  }
  if (lower.includes("text") || lower.includes("shimmer") || lower.includes("typewriter") ||
      lower.includes("gradient text") || lower.includes("glitch") || lower.includes("morphing") ||
      lower.includes("scramble") || lower.includes("3d text") || lower.includes("neon text")) {
    return { slot: "text_effect", placement: EFFECT_SLOTS[3].placement };
  }

  return { slot: "card_hover", placement: EFFECT_SLOTS[1].placement };
}

/**
 * Format 21st.dev components as creative briefs for the code gen system prompt.
 * No code snippets — just clear descriptions of what to build and where.
 * The LLM is creative enough to implement these from a description alone.
 */
export function format21stDevComponents(components: UIComponentResult[]): string {
  if (components.length === 0) return "";

  // Use ALL components (with or without code) — descriptions are what matter
  const usable = components.filter(c => c.description && c.description.length > 10);
  if (usable.length === 0) return "";

  // Classify each component into a slot, one per slot
  const slotMap = new Map<EffectSlot, { comp: UIComponentResult; placement: string }>();
  for (const comp of usable) {
    const { slot, placement } = classifySlot(comp);
    if (!slotMap.has(slot)) {
      slotMap.set(slot, { comp, placement });
    }
  }

  if (slotMap.size === 0) return "";

  // Keep the prompt slim — effects are injected post-generation, not by prompting.
  // Just pass the creative briefs for domain inspiration.
  const lines = [
    "=== 21st.dev COMPONENT INSPIRATION ===",
    "Use these as creative direction for the app's visual style:\n",
  ];

  for (const [slot, { comp, placement }] of slotMap) {
    lines.push(`[${slot.toUpperCase()}] ${comp.name}`);
    lines.push(`  WHERE: ${placement}`);
    const desc = comp.description.replace(/UI component from 21st\.dev/i, '').trim();
    if (desc) lines.push(`  WHAT: ${desc}`);
    lines.push("");
  }

  return lines.join("\n");
}
