import type { PipelineContext, StateTransition } from "../types.js";
import { runGenerationPipeline } from "../../pipeline.js";

/**
 * REASONING state: run the LLM reasoner to extract structured intent from the prompt.
 * Produces: intent (ReasonedIntent) + spec (AppSpec)
 */
export async function handleReasoning(ctx: PipelineContext): Promise<StateTransition> {
  ctx.onProgress?.({ type: "status", message: "Scaffolding project..." });

  // Augment prompt with web search context so the reasoner knows what
  // referenced products actually are (e.g., "Ditto AI" → dating app)
  let reasonerPrompt = ctx.prompt;
  if (ctx.webSearchContext) {
    reasonerPrompt += ctx.webSearchContext;
  }

  const { spec, intent, degraded } = await runGenerationPipeline(reasonerPrompt, ctx.contextBrief);

  ctx.intent = intent;
  ctx.spec = spec;

  if (degraded) {
    ctx.degraded = true;
    ctx.onProgress?.({ type: "status", message: "Using simplified generation — results may be generic" });
    ctx.pipelineSummary = (ctx.pipelineSummary ?? "") + " [degraded: LLM reasoner failed, using fallback intent]";
  }

  // Emit narrative event — AI self-dialogue before the plan
  if (intent.narrative) {
    ctx.onProgress?.({
      type: "narrative",
      message: intent.narrative,
      data: { app_name: intent.app_name_hint },
    });
  }

  // Emit plan event with structured data from the reasoner
  ctx.onProgress?.({
    type: "plan",
    message: `Building ${intent.app_name_hint}`,
    data: {
      app_name: intent.app_name_hint,
      domain: intent.domain,
      design: intent.design_philosophy,
      tabs: intent.nav_tabs.map((t: { label: string; icon: string }) => t.label),
      features: intent.premium_features ?? [],
      feature_details: intent.feature_details ?? [],
    },
  });

  return { nextState: "PLANNING" };
}
