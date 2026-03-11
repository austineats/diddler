/**
 * Lightweight web search — finds real product URLs and descriptions
 * by scraping DuckDuckGo HTML results. No API key needed.
 *
 * Used when a user says "make an app like Ditto AI" and we need to
 * discover what Ditto AI actually is and find its real website.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ProductSearchResult {
  /** Best guess for the product's actual URL */
  url: string | null;
  /** Short description of what the product is */
  description: string;
  /** All search results */
  results: SearchResult[];
}

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
 * Parse search results from DuckDuckGo HTML lite page.
 */
function parseDuckDuckGoResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];

  // DuckDuckGo lite has results in a simple table structure
  // Each result has a link and a snippet in subsequent rows
  // Pattern: <a rel="nofollow" href="URL" class='result-link'>TITLE</a>
  // Then: <td class="result-snippet">SNIPPET</td>
  const linkPattern = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetPattern = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: Array<{ url: string; title: string }> = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    if (url && title && !url.includes("duckduckgo.com")) {
      links.push({ url, title });
    }
  }

  const snippets: string[] = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim());
  }

  for (let i = 0; i < links.length && i < 8; i++) {
    results.push({
      url: links[i].url,
      title: links[i].title,
      snippet: snippets[i] ?? "",
    });
  }

  // Fallback: try simpler anchor tag matching if the above didn't work
  if (results.length === 0) {
    const simplePattern = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const seen = new Set<string>();
    while ((match = simplePattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      if (
        url && title && title.length > 5 &&
        !url.includes("duckduckgo.com") &&
        !url.includes("javascript:") &&
        !seen.has(url)
      ) {
        seen.add(url);
        results.push({ url, title, snippet: "" });
        if (results.length >= 6) break;
      }
    }
  }

  return results;
}

/**
 * Domains to skip — these are aggregator/social sites, not the product itself.
 */
const SKIP_DOMAINS = [
  "youtube.com", "twitter.com", "x.com", "facebook.com",
  "reddit.com", "linkedin.com", "instagram.com", "tiktok.com",
  "wikipedia.org", "amazon.com", "pinterest.com",
  "crunchbase.com", "g2.com", "capterra.com",
  "producthunt.com", "techcrunch.com",
];

function isProductDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return !SKIP_DOMAINS.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

/**
 * Search the web for a product name and find its real URL + description.
 * Uses DuckDuckGo HTML search (no API key needed).
 */
export async function searchForProduct(productName: string): Promise<ProductSearchResult> {
  const query = encodeURIComponent(`${productName} app official website`);
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${query}`;

  try {
    const res = await fetchWithTimeout(searchUrl, 8000);
    if (!res.ok) {
      console.warn(`Web search failed: HTTP ${res.status}`);
      return { url: null, description: "", results: [] };
    }

    const html = await res.text();
    const results = parseDuckDuckGoResults(html);

    if (results.length === 0) {
      console.warn(`Web search returned no results for "${productName}"`);
      return { url: null, description: "", results: [] };
    }

    // Find the best URL — prefer the product's own domain
    const productResult = results.find(r => isProductDomain(r.url));
    const bestUrl = productResult?.url ?? results[0].url;

    // Build a description from the top snippets
    const topSnippets = results
      .slice(0, 3)
      .map(r => r.snippet)
      .filter(s => s.length > 10);
    const description = topSnippets.join(" ").slice(0, 500);

    console.log(`Web search for "${productName}": found ${results.length} results, best URL: ${bestUrl}`);

    return {
      url: bestUrl,
      description,
      results,
    };
  } catch (e) {
    console.warn(`Web search failed for "${productName}":`, e instanceof Error ? e.message : e);
    return { url: null, description: "", results: [] };
  }
}

/**
 * Also try fetching the homepage meta description and title.
 * Returns a short summary of what the site is about.
 */
export async function fetchSiteSummary(url: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return "";

    const html = (await res.text()).slice(0, 50000);

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 100) ?? "";

    // Extract meta description
    const descMatch = html.match(/<meta\s+(?:name|property)="(?:description|og:description)"\s+content="([^"]+)"/i)
      ?? html.match(/content="([^"]+)"\s+(?:name|property)="(?:description|og:description)"/i);
    const desc = descMatch?.[1]?.slice(0, 300) ?? "";

    // Extract og:title for more context
    const ogTitleMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/i)
      ?? html.match(/content="([^"]+)"\s+(?:property|name)="og:title"/i);
    const ogTitle = ogTitleMatch?.[1]?.slice(0, 100) ?? "";

    const parts = [title, ogTitle, desc].filter(Boolean);
    return parts.join(" — ").slice(0, 500);
  } catch {
    return "";
  }
}
