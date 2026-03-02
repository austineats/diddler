import { appSpecSchema } from "./schema.js";
import { translateEnglishPromptWithReasoning, type ReasonedIntent } from "./reasoner.js";
import type { AppContextBrief } from "./contextResearch.js";
import type { AppSpec, LayoutType } from "../types/index.js";

// Sanitize nav IDs to match schema regex /^[a-z_]+$/
function sanitizeNavId(id: string): string {
  return id.toLowerCase().replace(/[^a-z_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'tab';
}

// Map content_type to LayoutType for AppSpec backward compat
function contentTypeToLayout(contentType: string): LayoutType {
  switch (contentType) {
    case "primary_tool": return "analyzer";
    case "data_overview": return "dashboard";
    case "creation_form": return "generator";
    case "settings_config": return "tool";
    case "feed_list": return "dashboard";
    case "gallery_grid": return "dashboard";
    case "profile_account": return "tool";
    case "detail_view": return "analyzer";
    default: return "tool";
  }
}

function buildDeterministicAppSpec(intent: ReasonedIntent, originalPrompt: string): AppSpec {
  // Use nav_items (new) with fallback to nav_tabs (backward compat)
  const navSource = intent.nav_items ?? intent.nav_tabs ?? [];

  const screens = navSource.map((tab, i) => ({
    nav_id: sanitizeNavId(tab.id),
    layout: ('layout' in tab ? tab.layout : contentTypeToLayout((tab as { content_type?: string }).content_type ?? 'primary_tool')) as LayoutType,
    hero: {
      title: i === 0 ? intent.primary_goal.slice(0, 60) : tab.purpose.slice(0, 60),
      subtitle: i === 0 ? `Powered by AI for ${intent.domain}` : tab.purpose.slice(0, 120),
      cta_label: i === 0 ? "Run Analysis" : "Generate",
    },
    input_fields: [{
      key: "input",
      label: (intent.domain.charAt(0).toUpperCase() + intent.domain.slice(1) + " Input").slice(0, 80),
      type: "textarea" as const,
      placeholder: `Describe your ${intent.domain.slice(0, 60)} here...`.slice(0, 500),
      required: true,
    }],
    ai_logic: {
      system_prompt: `You are an expert ${intent.domain} AI assistant. ${intent.primary_goal}. Provide detailed, actionable, professionally formatted responses.`,
      context_template: `{{input}}`,
      temperature: 0.7,
      max_tokens: 800,
    },
    output_format: intent.output_format_hint,
    output_label: i === 0 ? "Analysis" : "Results",
  }));

  // theme_style: use computed field or derive from visual_mood
  const themeStyle = intent.theme_style ?? "vibrant";

  return {
    schema_version: "2",
    name: intent.app_name_hint.slice(0, 80),
    tagline: intent.primary_goal.slice(0, 120),
    description: intent.primary_goal.slice(0, 500),
    theme: {
      primary: intent.primary_color,
      style: themeStyle,
      icon: intent.app_icon,
    },
    navigation: navSource.map((t) => ({ id: sanitizeNavId(t.id), label: t.label, icon: t.icon })),
    screens,
  };
}

export interface PipelineResult {
  spec: AppSpec;
  intent: ReasonedIntent;
  pipeline: string[];
}

export async function runGenerationPipeline(
  prompt: string,
  contextBrief?: AppContextBrief | null,
): Promise<PipelineResult> {
  const pipeline: string[] = [];

  pipeline.push("Prompt Reasoning");
  const intent = await translateEnglishPromptWithReasoning(prompt, contextBrief);

  const resolvedIntent: ReasonedIntent = intent ?? {
    normalized_prompt: prompt,
    app_name_hint: prompt.slice(0, 40),
    primary_goal: prompt,
    domain: "AI tools",
    design_philosophy: "Clean, functional tool",
    target_user: "General users",
    key_differentiator: "AI-powered analysis and generation",
    visual_style_keywords: ["clean", "minimal"],
    premium_features: ["AI analysis", "Instant results"],
    layout_composition: {
      page_structure: "centered_column",
      navigation_type: "top_bar_tabs",
      hero_style: "card_hero",
      content_pattern: "form_to_results",
    },
    visual_mood: "soft_minimal",
    nav_items: [
      { id: "analyze", label: "Analyze", icon: "Search", purpose: "Main analysis tool", content_type: "primary_tool" },
      { id: "results", label: "Results", icon: "BarChart2", purpose: "View results", content_type: "data_overview" },
    ],
    primary_color: "#6366f1",
    secondary_color: "#8b5cf6",
    app_icon: "Zap",
    output_format_hint: "markdown",
    signature_component: "Score ring with animated fill showing analysis quality",
    typography_style: "standard_clean",
    content_density: "balanced",
    narrative: `I'll build an AI-powered tool based on your request: "${prompt.slice(0, 100)}".`,
    feature_details: [
      { name: "AI analysis", description: "Intelligent analysis powered by AI" },
      { name: "Instant results", description: "Get results in seconds" },
    ],
    reasoning_summary: "Fallback: no LLM available",
    // Backward-compat computed fields
    visual_archetype: "content_tool",
    theme_style: "vibrant",
    nav_tabs: [
      { id: "analyze", label: "Analyze", icon: "Search", layout: "analyzer", purpose: "Main analysis tool" },
      { id: "results", label: "Results", icon: "BarChart2", layout: "dashboard", purpose: "View results" },
    ],
  };

  pipeline.push("Schema Validation");
  const spec = buildDeterministicAppSpec(resolvedIntent, prompt);
  const validatedSpec = appSpecSchema.parse(spec);

  return { spec: validatedSpec, intent: resolvedIntent, pipeline };
}
