import type { PipelineContext, StateTransition } from "../types.js";
import { gatherAppContext } from "../../contextResearch.js";
import { resolveModel } from "../../modelResolver.js";
import { getUnifiedClient } from "../../unifiedClient.js";
import { extractReferences } from "../../referenceExtractor.js";
import { searchForProduct, fetchSiteSummary } from "../../webSearch.js";
import type { CompetitorVisual } from "../../competitorScraper.js";

/**
 * RESEARCHING state: gather competitive context and competitor visuals.
 * This is fail-safe — errors don't block the pipeline.
 *
 * If the user says "like [website]" or includes a URL, we:
 *  1. Web search to discover what the product actually is (for name-only refs)
 *  2. Scrape the real website for visual/layout data
 *  3. Feed all discovered context into the LLM pipeline
 */
export async function handleResearch(ctx: PipelineContext): Promise<StateTransition> {
  ctx.onProgress?.({ type: "status", message: "Researching competitive landscape..." });

  // Step 0: Detect referenced websites from the prompt
  const references = extractReferences(ctx.prompt);
  let referenceVisual: CompetitorVisual | null = null;
  let webSearchContext = ""; // Extra context from web search to feed into the LLM

  if (references.length > 0) {
    const ref = references[0]; // Primary reference
    try {
      // Step 0a: If it's a product name (not an explicit URL), web search first
      // to discover what it really is and find the correct URL.
      // This solves: user says "like Ditto AI" → we need to find out it's a dating app
      if (!ref.isExplicitUrl) {
        ctx.onProgress?.({ type: "status", message: `Searching for ${ref.raw}...` });
        console.log(`Web searching for product: "${ref.raw}"`);

        const searchResult = await searchForProduct(ref.raw);

        if (searchResult.url) {
          console.log(`Web search found URL for "${ref.raw}": ${searchResult.url}`);
          // Override the guessed URL with the real one from web search
          ref.url = searchResult.url;
        }

        if (searchResult.description) {
          console.log(`Web search description for "${ref.raw}": ${searchResult.description.slice(0, 150)}...`);
          webSearchContext += `\n\n--- WEB SEARCH RESULTS FOR "${ref.raw}" ---\n`;
          webSearchContext += `Product URL: ${searchResult.url ?? "unknown"}\n`;
          webSearchContext += `Description: ${searchResult.description}\n`;

          // Include top search result titles for additional context
          if (searchResult.results.length > 0) {
            webSearchContext += `Top results:\n`;
            for (const r of searchResult.results.slice(0, 5)) {
              webSearchContext += `  - ${r.title} (${r.url})\n`;
              if (r.snippet) webSearchContext += `    ${r.snippet.slice(0, 200)}\n`;
            }
          }
        }

        // Also fetch the homepage meta for a richer summary
        if (ref.url) {
          try {
            const siteSummary = await fetchSiteSummary(ref.url);
            if (siteSummary) {
              console.log(`Site summary for ${ref.url}: ${siteSummary.slice(0, 100)}...`);
              webSearchContext += `Site summary: ${siteSummary}\n`;
            }
          } catch {
            // non-fatal
          }
        }
      }

      // Store web search context on pipeline context for downstream handlers (reasoner)
      if (webSearchContext) {
        ctx.webSearchContext = webSearchContext;
      }

      // Step 0b: Scrape the reference URL (now using the correct URL from web search)
      ctx.onProgress?.({ type: "status", message: `Analyzing ${ref.raw}...` });
      console.log(`Reference detected: "${ref.raw}" → ${ref.url}`);

      const { scrapeReferenceUrl } = await import("../../competitorScraper.js");
      const apiKey = process.env.KIMI_API_KEY;
      if (apiKey) {
        const visionClient = getUnifiedClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        referenceVisual = await scrapeReferenceUrl(
          ref.url,
          ref.raw,
          visionClient as any,
          resolveModel("fast"),
        );
        if (referenceVisual) {
          const hasVision = !!referenceVisual.screenshot_analysis;
          const hasHtml = referenceVisual.colors.length > 0 || referenceVisual.layout_signals.length > 0;
          console.log(
            `Reference scrape complete for "${ref.raw}" — ` +
            `vision: ${hasVision}, html metadata: ${hasHtml}, ` +
            `colors: [${referenceVisual.colors.join(", ")}]`
          );
        }
      }
    } catch (e) {
      console.warn(`Reference scrape failed for "${ref.raw}" (non-fatal):`, e);
    }
  }

  // Step 1: Gather competitive research context
  // Augment the prompt with web search data + reference visual data
  try {
    let researchPrompt = ctx.prompt;

    // Inject web search context so the LLM knows what the referenced product actually is
    if (webSearchContext) {
      researchPrompt += webSearchContext;
    }

    if (referenceVisual) {
      const refData: string[] = [];
      if (referenceVisual.meta_description) {
        refData.push(`Site description: "${referenceVisual.meta_description}"`);
      }
      if (referenceVisual.colors.length > 0) {
        refData.push(`Brand colors found: ${referenceVisual.colors.join(", ")}`);
      }
      if (referenceVisual.layout_signals.length > 0) {
        refData.push(`Layout patterns detected: ${referenceVisual.layout_signals.join(", ")}`);
      }
      if (referenceVisual.screenshot_analysis) {
        const sa = referenceVisual.screenshot_analysis;
        refData.push(`Visual analysis of ${referenceVisual.name}:`);
        refData.push(`  Layout: ${sa.layout_type}`);
        refData.push(`  Colors: ${sa.color_palette.join(", ")}`);
        refData.push(`  Nav style: ${sa.navigation_style}`);
        refData.push(`  Key UI elements: ${sa.key_ui_to_replicate.join("; ")}`);
        if (sa.hero_section_spec) refData.push(`  Hero: ${sa.hero_section_spec}`);
        if (sa.card_design_spec) refData.push(`  Cards: ${sa.card_design_spec}`);
        if (sa.typography_hierarchy) refData.push(`  Typography: ${sa.typography_hierarchy}`);
      }
      if (refData.length > 0) {
        researchPrompt += `\n\n--- LIVE WEBSITE ANALYSIS OF "${referenceVisual.name}" (${referenceVisual.url}) ---\n${refData.join("\n")}`;
      }
    }

    ctx.contextBrief = await gatherAppContext(researchPrompt);
    if (ctx.contextBrief) {
      console.log(
        `Context research complete — ${ctx.contextBrief.competitive_landscape.length} competitors, ` +
        `${ctx.contextBrief.must_have_features.length} must-have features`
      );
    }
  } catch (e) {
    console.warn("Context research failed (non-fatal):", e);
  }

  // Step 2: Visual agent — screenshot + analyze competitor UIs
  // Start with the reference visual (priority), then add other competitors
  const allVisuals: CompetitorVisual[] = [];
  if (referenceVisual) {
    allVisuals.push(referenceVisual);
  }

  if (ctx.contextBrief?.competitive_landscape?.length) {
    try {
      ctx.onProgress?.({ type: "status", message: "Analyzing competitor interfaces..." });
      const { scrapeCompetitorVisuals } = await import("../../competitorScraper.js");
      const apiKey = process.env.KIMI_API_KEY;
      if (apiKey) {
        const visionClient = getUnifiedClient();
        // Skip competitors we already scraped via reference
        const refUrl = referenceVisual?.url?.toLowerCase();
        const remainingCompetitors = ctx.contextBrief.competitive_landscape
          .filter(c => {
            const cUrl = c.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
            return !refUrl || !refUrl.includes(cUrl);
          })
          .slice(0, referenceVisual ? 2 : 3) // Fewer generic competitors if we have a reference
          .map(c => ({ name: c.name }));

        if (remainingCompetitors.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const visuals = await scrapeCompetitorVisuals(
            remainingCompetitors,
            visionClient as any,
            resolveModel("fast"),
          );
          allVisuals.push(...visuals);
        }
      }
    } catch (e) {
      console.warn("Visual agent failed (non-fatal):", e);
    }
  }

  if (allVisuals.length > 0) {
    ctx.competitorVisuals = allVisuals;
    if (ctx.contextBrief) {
      (ctx.contextBrief as Record<string, unknown>).competitor_visuals = allVisuals;
    }
    const analyzed = allVisuals.filter(v => v.screenshot_analysis).length;
    console.log(`Visual agent complete — ${allVisuals.length} total scraped, ${analyzed} visually analyzed`);
  }

  return { nextState: "REASONING" };
}
