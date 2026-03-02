import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AppContextBrief } from "./contextResearch.js";
import { withTimeout } from "./llmTimeout.js";
import { recordSpend } from "./costTracker.js";

const reasonedIntentSchema = z.object({
  normalized_prompt: z.string().min(1),
  app_name_hint: z.string().min(1),
  primary_goal: z.string().min(1),
  domain: z.string().min(1),
  reference_app: z.string().optional(),
  design_philosophy: z.string().min(1),
  target_user: z.string().min(1),
  key_differentiator: z.string().min(1),
  visual_style_keywords: z.array(z.string()).min(1).max(10),
  premium_features: z.array(z.string()).min(1).max(10),

  layout_composition: z.object({
    page_structure: z.enum([
      "centered_column", "bento_grid", "sidebar_main", "split_panel",
      "full_bleed_sections", "floating_cards", "magazine_layout", "kanban_board",
    ]),
    navigation_type: z.enum([
      "top_bar_tabs", "sidebar_nav", "bottom_tab_bar", "floating_pill",
      "contextual_tabs", "breadcrumb_header", "hamburger_drawer", "segmented_control",
    ]),
    hero_style: z.enum([
      "gradient_banner", "metric_dashboard", "image_hero", "minimal_header",
      "search_hero", "profile_hero", "card_hero", "none",
    ]),
    content_pattern: z.enum([
      "card_grid", "asymmetric_bento", "list_feed", "form_to_results",
      "timeline_feed", "carousel_sections", "tabbed_panels", "data_table",
    ]),
  }),

  visual_mood: z.enum([
    "glassmorphism_light", "glassmorphism_dark", "neubrutalism", "soft_minimal",
    "dark_premium", "vibrant_gradient", "clean_corporate", "playful_rounded",
    "editorial", "warm_organic", "neon_dark", "monochrome_elegant",
  ]),

  nav_items: z.array(z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string().min(1).max(30),
    purpose: z.string(),
    content_type: z.enum([
      "primary_tool", "feed_list", "data_overview", "settings_config",
      "profile_account", "gallery_grid", "detail_view", "creation_form",
    ]),
  })).min(2).max(5),

  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  app_icon: z.string().min(1).max(30),
  output_format_hint: z.enum(["markdown", "cards", "score_card", "report", "list", "plain"]),

  signature_component: z.string().min(1).describe("One unique visual component that makes this app distinct"),
  typography_style: z.enum(["bold_display", "compact_dense", "editorial_serif", "standard_clean"]),
  content_density: z.enum(["spacious", "balanced", "dense"]),

  narrative: z.string().min(1).max(300),
  feature_details: z.array(z.object({ name: z.string(), description: z.string() })).min(1).max(10),
  reasoning_summary: z.string().min(1),
});

export type ReasonedIntent = z.infer<typeof reasonedIntentSchema> & {
  // Backward-compat computed fields (set after parsing)
  visual_archetype?: string;
  theme_style?: "light" | "dark" | "vibrant";
  nav_tabs?: Array<{ id: string; label: string; icon: string; layout: string; purpose: string }>;
};

function moodToThemeStyle(mood: string): "light" | "dark" | "vibrant" {
  if (["glassmorphism_dark", "dark_premium", "neon_dark"].includes(mood)) return "dark";
  if (["vibrant_gradient", "playful_rounded", "warm_organic", "neubrutalism"].includes(mood)) return "vibrant";
  return "light";
}

const REASONER_SYSTEM_PROMPT = `You are an elite AI product designer who deeply understands consumer apps, SaaS tools, and AI services.

Your job: analyze a user's app idea — enriched with competitive research context when available — and compose a UNIQUE, visually distinct product design. Every app you design must look fundamentally different from every other app.

=== ANTI-PATTERNS (VIOLATION = AUTOMATIC REJECTION) ===
NEVER compose these combinations — they produce the generic "AI template" look:
1. top_bar_tabs + centered_column + card_grid — this is the #1 template pattern
2. Every tab using the same layout structure
3. Stat cards (number + label) as the primary content element
4. Logo top-left with horizontal tab buttons as the only navigation pattern
5. Same max-width centered wrapper on every page
6. "How It Works", "Get Started", fake social proof sections

A dating app MUST NOT look like a finance dashboard.
An interior design tool MUST NOT look like a document analyzer.
A food delivery app MUST NOT look like a project manager.

=== ICON RULES (ABSOLUTE REQUIREMENT) ===
ALL icons MUST be Lucide React icon component names in PascalCase.
Common icons: Search, Star, ArrowRight, Zap, FileText, BarChart2, Upload, Download, Settings, Home, History, RefreshCw, Utensils, Dumbbell, Brain, Palette, Code, Mail, MessageSquare, Calendar, Target, TrendingUp, Shield, Heart, BookOpen, Briefcase, DollarSign, PieChart, Camera, Mic, Globe, Clock, CheckCircle, AlertTriangle, Layers, Grid, List, Hash, Tag, Award, Bookmark, Compass, MapPin, Phone, Video, Music, Image, Film, Headphones, Wifi, Database, Server, Terminal, GitBranch, Package, Truck, ShoppingCart, CreditCard, Users, UserPlus, Lock, Eye, Bell, Sun, Moon, Cloud, Flame, Sparkles, Wand2, Scissors, Pen, Type, AlignLeft, LayoutDashboard, PanelLeft, Activity, LineChart, Gauge, CircleDot, Columns, SlidersHorizontal, Menu, X, ChevronDown, ChevronRight, MoreHorizontal, Plus
NEVER use emoji characters anywhere.

=== LAYOUT COMPOSITION (compose from 4 independent axes) ===

PAGE STRUCTURE — determines the spatial skeleton:
- "centered_column": Single centered content column (max-w-2xl). ONLY for simple single-purpose tools (calculator, text analyzer, single-input form).
- "bento_grid": Asymmetric grid with mixed-size cards. Best for: dashboards, overview screens, analytics, home screens with diverse content types.
- "sidebar_main": Fixed sidebar navigation + scrollable main content. Best for: productivity suites, admin panels, settings-heavy apps, project management.
- "split_panel": Two-panel side-by-side layout. Best for: generators (input left, output right), comparison tools, editors, before/after tools.
- "full_bleed_sections": Full-width stacked sections with varied backgrounds. Best for: consumer apps, portfolio tools, lifestyle apps with visual sections.
- "floating_cards": Cards floating on a gradient/colored background. Best for: social apps, discovery apps, dating apps, music apps.
- "magazine_layout": Asymmetric editorial layout (2/3 main + 1/3 sidebar). Best for: content platforms, news readers, blog tools, research tools.
- "kanban_board": Multi-column horizontal scrollable layout. Best for: project management, pipeline tracking, workflow tools.

NAVIGATION TYPE — determines how users move between sections:
- "top_bar_tabs": Horizontal bar with logo + tab buttons. Use SPARINGLY — only for tools with 2-3 simple modes.
- "sidebar_nav": Vertical sidebar with icon+label nav items. Best for: productivity, admin dashboards, settings-heavy apps, complex apps with 4+ sections.
- "bottom_tab_bar": Mobile-style bottom navigation with icons. Best for: consumer apps, social apps, lifestyle, e-commerce, health, food.
- "floating_pill": Floating pill-shaped nav centered on screen. Best for: modern consumer apps, creative tools, portfolio sites, minimal apps.
- "contextual_tabs": Tabs embedded within content sections, no persistent nav. Best for: single-purpose tools with modes, wizard flows.
- "breadcrumb_header": Minimal header with breadcrumb navigation. Best for: multi-step flows, deep hierarchical navigation, settings.
- "hamburger_drawer": Hamburger icon that opens slide-out drawer. Best for: content-heavy apps, mobile-first apps, apps with many sections.
- "segmented_control": iOS-style segmented control in compact header. Best for: apps with 2-3 mutually exclusive views (list/grid, day/week/month).

HERO STYLE — what the user sees at the top:
- "gradient_banner": Full-width gradient with bold text overlay. For consumer apps, creative tools.
- "metric_dashboard": Row of key metrics as the hero. For analytics, health trackers, finance.
- "image_hero": Placeholder image area with overlay text. For visual apps, portfolio, media.
- "minimal_header": Just app name + subtitle, no decorative hero. For tools, productivity.
- "search_hero": Large centered search bar as primary interaction. For search-first apps, marketplaces.
- "profile_hero": User avatar/profile area. For social, dating, personal apps.
- "card_hero": Single elevated card as the hero unit. For focused tools, calculators.
- "none": No hero — content starts immediately. For dashboard-first apps.

CONTENT PATTERN — main body content structure:
- "card_grid": Uniform grid of cards. For galleries, product listings, collections.
- "asymmetric_bento": Mixed-size cards in asymmetric layout. For dashboards, overview screens.
- "list_feed": Vertical list of items/rows. For feeds, histories, message lists.
- "form_to_results": Input form that reveals results. For analyzers, generators, calculators.
- "timeline_feed": Chronological timeline with dots/connectors. For activity tracking, history, progress.
- "carousel_sections": Horizontal scroll sections. For discovery, categories, recommendations.
- "tabbed_panels": Tabbed content within a card. For settings, multi-view data, comparisons.
- "data_table": Table-centric layout with filters. For admin, analytics, data management.

=== VISUAL MOOD (determines the entire visual language) ===
- "glassmorphism_light": Frosted glass, translucent surfaces, light background. Modern SaaS, AI tools.
- "glassmorphism_dark": Frosted glass on dark background, neon accents. Premium SaaS, data tools, monitoring.
- "neubrutalism": Bold borders, chunky shadows, raw aesthetic. Creative tools, portfolios, design-forward brands.
- "soft_minimal": Ultra-clean, lots of whitespace, thin lines. Professional tools, note-taking, writing, healthcare.
- "dark_premium": Dark background, subtle gradients, premium feel (like Linear/Raycast). Developer tools, analytics.
- "vibrant_gradient": Bold gradient backgrounds, saturated colors. Fitness, food, social, dating, education.
- "clean_corporate": Professional, structured, enterprise feel. Finance, legal, HR, compliance.
- "playful_rounded": Large border-radius, bouncy feel. Education, kids, gamified apps, onboarding.
- "editorial": Magazine-like, strong typography, minimal color. Content platforms, journalism, research.
- "warm_organic": Earthy tones, soft shadows. Wellness, cooking, gardening, mindfulness.
- "neon_dark": Dark background with neon accent colors. Gaming, music production, nightlife.
- "monochrome_elegant": Single color family, tonal variations. Luxury, portfolio, premium minimal.

=== SIGNATURE COMPONENT ===
Pick ONE unique visual element that makes this app immediately recognizable. This should be a component NO OTHER app type would typically have. Examples:
- Interior design: "Before/after comparison slider with drag handle"
- Dating app: "Swipeable profile card stack with accept/reject buttons"
- Fitness tracker: "Animated circular progress ring with daily metrics"
- Recipe app: "Step-by-step cooking timeline with ingredient checklist"
- Code review: "Side-by-side diff viewer with inline comments"
- Music app: "Audio waveform visualizer with playback controls"
Be specific and creative. This component should appear on Tab 1.

=== TYPOGRAPHY STYLE ===
- "bold_display": Oversized headlines (text-4xl+), dramatic size contrast, -tracking-tight. For consumer apps, creative tools.
- "compact_dense": Tight spacing, smaller text, high information density. For dashboards, data tools, admin.
- "editorial_serif": Serif headings (font-serif) with sans body. For content, editorial, research.
- "standard_clean": Standard Inter font sizing, balanced hierarchy. For most tools and SaaS.

=== CONTENT DENSITY ===
- "spacious": Lots of whitespace, fewer items visible (py-8+ between sections). For consumer, lifestyle.
- "balanced": Standard density (py-6 between sections). For most apps.
- "dense": Compact layout, more information visible at once (py-3 between sections). For dashboards, admin, productivity.

=== NAV ITEMS ===
Generate 2-5 navigation items. Tab 1 MUST be the core working product — NEVER a landing page or marketing screen.
Each item has a content_type:
- "primary_tool": The main functional tab (analyzer, generator, editor, main view)
- "feed_list": A scrollable list/feed (messages, notifications, activity log)
- "data_overview": Dashboard/analytics view with charts and metrics
- "settings_config": Settings and preferences
- "profile_account": User profile or account page
- "gallery_grid": Visual gallery or portfolio grid
- "detail_view": Detailed single-item view or comparison
- "creation_form": Form-based creation/input flow

=== COLOR SELECTION ===
Choose colors that match the domain psychology. Professional = cooler tones. Health/fitness = greens and oranges. Creative = purples, pinks. Finance = deep blues, greens, teals. Never use pure red as primary.
ALWAYS pick a secondary_color for gradient pairing. Examples: indigo+violet, blue+cyan, emerald+teal, orange+rose, purple+pink.

=== OUTPUT FORMAT ===
- "score_card": Output includes a score/grade + breakdown
- "cards": Output is multiple distinct items
- "report": Detailed narrative with sections
- "list": Ordered steps or checklist
- "markdown": Default rich formatted content
- "plain": Simple conversational response

=== QUALITY STANDARD ===
This app must feel like a COMMERCIAL PRODUCT someone would pay $29/month for. All labels must be domain-specific. No generic placeholders. Every design choice informed by real products in this space.

=== NARRATIVE ===
Write a 1-2 sentence first-person narrative ("I'll create...") describing what you're building and WHY.

When competitive research context is provided, USE IT to inform decisions about features, colors, layout, and terminology.
Extract the user's intent even if their prompt has typos or is vague.`;

const toolInputSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    normalized_prompt: { type: "string" },
    app_name_hint: { type: "string", description: "Short, catchy product name (2-3 words)" },
    primary_goal: { type: "string" },
    domain: { type: "string" },
    reference_app: { type: "string" },
    design_philosophy: { type: "string" },
    target_user: { type: "string" },
    key_differentiator: { type: "string" },
    visual_style_keywords: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    premium_features: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 5,
    },
    layout_composition: {
      type: "object",
      additionalProperties: false,
      properties: {
        page_structure: {
          type: "string",
          enum: ["centered_column", "bento_grid", "sidebar_main", "split_panel", "full_bleed_sections", "floating_cards", "magazine_layout", "kanban_board"],
        },
        navigation_type: {
          type: "string",
          enum: ["top_bar_tabs", "sidebar_nav", "bottom_tab_bar", "floating_pill", "contextual_tabs", "breadcrumb_header", "hamburger_drawer", "segmented_control"],
        },
        hero_style: {
          type: "string",
          enum: ["gradient_banner", "metric_dashboard", "image_hero", "minimal_header", "search_hero", "profile_hero", "card_hero", "none"],
        },
        content_pattern: {
          type: "string",
          enum: ["card_grid", "asymmetric_bento", "list_feed", "form_to_results", "timeline_feed", "carousel_sections", "tabbed_panels", "data_table"],
        },
      },
      required: ["page_structure", "navigation_type", "hero_style", "content_pattern"],
    },
    visual_mood: {
      type: "string",
      enum: [
        "glassmorphism_light", "glassmorphism_dark", "neubrutalism", "soft_minimal",
        "dark_premium", "vibrant_gradient", "clean_corporate", "playful_rounded",
        "editorial", "warm_organic", "neon_dark", "monochrome_elegant",
      ],
    },
    nav_items: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          icon: { type: "string", description: "Lucide React icon name in PascalCase" },
          purpose: { type: "string" },
          content_type: {
            type: "string",
            enum: ["primary_tool", "feed_list", "data_overview", "settings_config", "profile_account", "gallery_grid", "detail_view", "creation_form"],
          },
        },
        required: ["id", "label", "icon", "purpose", "content_type"],
      },
    },
    primary_color: { type: "string", description: "Hex color based on domain psychology" },
    secondary_color: { type: "string", description: "Secondary hex color for gradients" },
    app_icon: { type: "string", description: "Lucide React icon name in PascalCase" },
    output_format_hint: { type: "string", enum: ["markdown", "cards", "score_card", "report", "list", "plain"] },
    signature_component: { type: "string", description: "One unique visual component that makes this app distinct, e.g. 'swipeable card stack', 'before/after slider', 'circular score ring'" },
    typography_style: { type: "string", enum: ["bold_display", "compact_dense", "editorial_serif", "standard_clean"] },
    content_density: { type: "string", enum: ["spacious", "balanced", "dense"] },
    narrative: { type: "string" },
    feature_details: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
      minItems: 1,
      maxItems: 10,
    },
    reasoning_summary: { type: "string" },
  },
  required: [
    "normalized_prompt", "app_name_hint", "primary_goal", "domain",
    "design_philosophy", "target_user", "key_differentiator",
    "visual_style_keywords", "premium_features",
    "layout_composition", "visual_mood", "nav_items",
    "primary_color", "app_icon", "output_format_hint",
    "signature_component", "typography_style", "content_density",
    "narrative", "feature_details", "reasoning_summary",
  ],
};

export async function translateEnglishPromptWithReasoning(
  prompt: string,
  contextBrief?: AppContextBrief | null,
): Promise<ReasonedIntent | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey, maxRetries: 0 });
  const timeoutMs = Number(process.env.STARTBOX_REASONER_TIMEOUT_MS ?? 30000);

  const contextSection = contextBrief
    ? [
        `\n--- COMPETITIVE RESEARCH CONTEXT ---`,
        `Similar products: ${contextBrief.competitive_landscape.map(c => `${c.name}: ${c.key_ux_patterns.join(', ')}`).join(' | ')}`,
        `Visual signatures: ${contextBrief.competitive_landscape.map(c => `${c.name}: ${c.visual_signature}`).join(' | ')}`,
        `Target user: ${contextBrief.target_persona.role} — Pain points: ${contextBrief.target_persona.pain_points.join(', ')}`,
        `User expectations: ${contextBrief.target_persona.expectations.join(', ')}`,
        `Must-have features: ${contextBrief.must_have_features.join(', ')}`,
        `Differentiating features: ${contextBrief.differentiating_features.join(', ')}`,
        `Design guidance: ${contextBrief.design_references.color_psychology}. Layout: ${contextBrief.design_references.layout_pattern}. Typography: ${contextBrief.design_references.typography_style}`,
        `Visual motifs: ${contextBrief.design_references.visual_motifs.join(', ')}`,
        `Domain field labels: ${JSON.stringify(contextBrief.domain_terminology.field_labels)}`,
        `CTA verbs: ${contextBrief.domain_terminology.cta_verbs.join(', ')}`,
        `Section headers: ${contextBrief.domain_terminology.section_headers.join(', ')}`,
        ...(contextBrief.ui_component_suggestions?.length ? [`UI component patterns: ${contextBrief.ui_component_suggestions.join(', ')}`] : []),
        ...(contextBrief.animation_style ? [`Recommended animation style: ${contextBrief.animation_style}`] : []),
        ...(contextBrief.layout_blueprint ? [`Layout blueprint: ${contextBrief.layout_blueprint}`] : []),
        `---`,
      ].join('\n')
    : '';

  try {
    const response = await withTimeout(
      (signal) => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: [
          {
            type: "text" as const,
            text: REASONER_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{
          role: "user",
          content: `Analyze this app idea and compose a UNIQUE layout design:\n\n"${prompt}"${contextSection}\n\nReturn structured intent with a distinct layout composition. Use Lucide icon names (PascalCase) — NEVER emoji. The layout MUST be visually different from a generic centered-column tool.`,
        }],
        tools: [{
          name: "extract_intent",
          description: "Extract structured app-building intent with compositional layout design",
          input_schema: toolInputSchema,
          cache_control: { type: "ephemeral" as const },
        }],
        tool_choice: { type: "tool", name: "extract_intent" },
      }, { signal }),
      timeoutMs,
      "Prompt reasoner",
    );

    const u = response.usage as unknown as Record<string, number>;
    const cr = u.cache_read_input_tokens ?? 0;
    const cw = u.cache_creation_input_tokens ?? 0;
    const uc = u.input_tokens - cr - cw;
    recordSpend((uc * 0.80 + cw * 1 + cr * 0.08 + u.output_tokens * 4) / 1_000_000);

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const parsed = reasonedIntentSchema.parse(toolUse.input);

    // Add backward-compat computed fields
    const result: ReasonedIntent = {
      ...parsed,
      visual_archetype: "content_tool", // legacy fallback
      theme_style: moodToThemeStyle(parsed.visual_mood),
      nav_tabs: parsed.nav_items.map(item => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        layout: item.content_type === "primary_tool" ? "analyzer"
          : item.content_type === "data_overview" ? "dashboard"
          : item.content_type === "creation_form" ? "generator"
          : item.content_type === "settings_config" ? "tool"
          : "tool",
        purpose: item.purpose,
      })),
    };

    return result;
  } catch (e) {
    console.error("Reasoner failed:", e);
    return null;
  }
}
