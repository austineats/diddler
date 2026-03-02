import type { OutputFormat, QualityBreakdown } from "../types/index.js";

export interface QualityScoreInput {
  code: string;
  prompt: string;
  outputFormat: OutputFormat;
  requestedLayout?: string;
  requestedNavType?: string;
  requestedMood?: string;
}

const WEIGHTS: Record<keyof QualityBreakdown, number> = {
  layout_diversity:       0.18,
  visual_uniqueness:      0.16,
  domain_specificity:     0.15,
  navigation_correctness: 0.10,
  interaction_richness:   0.10,
  visual_richness:        0.10,
  component_variety:      0.08,
  brand_cohesion:         0.07,
  form_styling:           0.06,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ------------------------------------------------------------------ */
/*  Layout detection helpers                                           */
/* ------------------------------------------------------------------ */

function detectLayout(code: string): {
  hasSidebar: boolean;
  hasBottomNav: boolean;
  hasBentoGrid: boolean;
  hasSplitPanel: boolean;
  hasFullBleed: boolean;
  hasFloatingPill: boolean;
  hasFloatingCards: boolean;
  hasMagazine: boolean;
  hasKanban: boolean;
  isCenteredColumn: boolean;
  hasHamburger: boolean;
  hasSegmented: boolean;
  hasContextualTabs: boolean;
  hasBreadcrumb: boolean;
  hasTopBarTabs: boolean;
} {
  return {
    hasSidebar: /aside|sidebar|w-60|w-64|w-72|min-h-screen\s+border-r/i.test(code),
    hasBottomNav: /fixed\s+bottom|bottom-0.*justify-around|bottom.*tab.*bar|fixed.*bottom.*h-16/i.test(code),
    hasBentoGrid: /col-span-2.*row-span|grid-cols-4\s+gap|grid-cols-3.*col-span-2/i.test(code),
    hasSplitPanel: /w-\[4[05]%\]|w-\[5[05]%\]|flex.*flex-1.*border-r.*flex-1|grid-cols-2.*min-h/i.test(code),
    hasFullBleed: /w-full\s+py-(?:12|16|20)|section\s+className.*w-full/i.test(code),
    hasFloatingPill: /fixed\s+top-4.*rounded-full|translate-x.*rounded-full.*backdrop-blur/i.test(code),
    hasFloatingCards: /min-h-screen\s+bg-gradient.*glass/i.test(code),
    hasMagazine: /grid-cols-3.*col-span-2(?!.*row-span)/i.test(code),
    hasKanban: /overflow-x-auto.*gap-4.*min-h|kanban|flex.*gap-4.*overflow/i.test(code),
    isCenteredColumn: /max-w-(2xl|3xl)\s+mx-auto\s+px-5\s+py-6/i.test(code),
    hasHamburger: /hamburger|drawer|slide.*out|fixed.*left-0.*top-0.*w-72/i.test(code),
    hasSegmented: /segmented|rounded-lg\s+p-0\.5.*button.*bg-white.*shadow/i.test(code),
    hasContextualTabs: !(/sb-nav|<nav\s/).test(code) && /sb-chip.*active/i.test(code),
    hasBreadcrumb: /breadcrumb|chevron.*text-sm.*text-gray/i.test(code),
    hasTopBarTabs: /sb-nav.*sb-nav-brand.*sb-nav-tabs|sb-nav-centered|sb-nav-spread|sb-nav-minimal/i.test(code),
  };
}

function layoutMatchScore(detected: ReturnType<typeof detectLayout>, requested: string): number {
  const mapping: Record<string, keyof ReturnType<typeof detectLayout>> = {
    centered_column: "isCenteredColumn",
    bento_grid: "hasBentoGrid",
    sidebar_main: "hasSidebar",
    split_panel: "hasSplitPanel",
    full_bleed_sections: "hasFullBleed",
    floating_cards: "hasFloatingCards",
    magazine_layout: "hasMagazine",
    kanban_board: "hasKanban",
  };
  const key = mapping[requested];
  if (!key) return 50;
  return detected[key] ? 90 : 25;
}

function navMatchScore(detected: ReturnType<typeof detectLayout>, requested: string): number {
  const mapping: Record<string, keyof ReturnType<typeof detectLayout>> = {
    top_bar_tabs: "hasTopBarTabs",
    sidebar_nav: "hasSidebar",
    bottom_tab_bar: "hasBottomNav",
    floating_pill: "hasFloatingPill",
    contextual_tabs: "hasContextualTabs",
    breadcrumb_header: "hasBreadcrumb",
    hamburger_drawer: "hasHamburger",
    segmented_control: "hasSegmented",
  };
  const key = mapping[requested];
  if (!key) return 50;
  return detected[key] ? 90 : 20;
}

/* ------------------------------------------------------------------ */
/*  Main scorer                                                        */
/* ------------------------------------------------------------------ */

export function scoreGeneratedCode(input: QualityScoreInput): {
  quality_score: number;
  quality_breakdown: QualityBreakdown;
} {
  const code = input.code;
  const codeLower = code.toLowerCase();
  const promptTokens = new Set(
    input.prompt.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 3),
  );

  const detected = detectLayout(code);

  // --- layout_diversity ---
  let layoutScore: number;
  if (input.requestedLayout) {
    layoutScore = layoutMatchScore(detected, input.requestedLayout);
    // Bonus for NOT being centered_column when something else was requested
    if (input.requestedLayout !== "centered_column" && !detected.isCenteredColumn) {
      layoutScore = Math.min(100, layoutScore + 10);
    }
    // Penalty for falling back to centered column
    if (input.requestedLayout !== "centered_column" && detected.isCenteredColumn) {
      layoutScore = Math.max(0, layoutScore - 20);
    }
  } else {
    // No layout specified — reward any non-default layout
    const nonDefault = [detected.hasSidebar, detected.hasBottomNav, detected.hasBentoGrid,
      detected.hasSplitPanel, detected.hasFullBleed, detected.hasFloatingPill,
      detected.hasFloatingCards, detected.hasMagazine, detected.hasKanban];
    layoutScore = nonDefault.some(Boolean) ? 80 : 40;
  }

  // --- visual_uniqueness ---
  const templatePenalties = [
    /sb-nav\b.*sb-nav-brand.*sb-nav-tabs/s,
    /sb-stat.*sb-stat-value.*sb-stat-label/s,
    /How It Works/i,
    /10k\+|50k\+|100k\+/,
    /4\.\d\s*rating/i,
    /Get Started|Start Now/i,
    /what you can create/i,
  ].filter(p => p.test(code)).length;

  const uniqueSignals = [
    /col-span-2.*row-span/,            // bento grid
    /fixed\s+bottom/,                  // bottom nav
    /aside.*border-r|sidebar/i,        // sidebar
    /border-2.*border-black/,          // neubrutalism
    /font-serif/,                      // editorial
    /rounded-full.*backdrop-blur/,     // floating nav
    /w-\[4[05]%\]/,                    // split panel
    /overflow-x-auto.*gap-4/,          // kanban
    /bg-gradient.*min-h-screen/,       // floating cards bg
    /comparison|before.*after|slider/i, // unique interactions
    /drag|sortable|reorder/i,
    /swipe|card.*stack/i,
    /waveform|audio/i,
    /diff.*viewer/i,
  ].filter(p => p.test(code)).length;

  const uniquenessScore = clampScore(
    Math.max(0, 50 - templatePenalties * 12) + uniqueSignals * 8
  );

  // --- domain_specificity ---
  let promptTokenMatches = 0;
  for (const token of promptTokens) {
    if (codeLower.includes(token)) promptTokenMatches += 1;
  }
  const domainRatio = promptTokens.size ? promptTokenMatches / promptTokens.size : 0.5;
  const domainScore = clampScore(domainRatio * 100);

  // --- navigation_correctness ---
  let navScore: number;
  if (input.requestedNavType) {
    navScore = navMatchScore(detected, input.requestedNavType);
  } else {
    navScore = 70; // neutral
  }

  // --- interaction_richness ---
  const interactionSignals = [/onClick/, /onChange/, /transition/, /hover:/, /animate/, /useState/, /onSubmit/, /onKeyDown/];
  const interactionScore = clampScore(
    (interactionSignals.filter(p => p.test(code)).length / interactionSignals.length) * 100
  );

  // --- visual_richness ---
  const visualSignals = [
    /bg-gradient-to/,
    /linear-gradient/,
    /sb-gradient/,
    /sb-glow/,
    /sb-icon-box-gradient/,
    /glass-btn-gradient/,
    /sb-gradient-text/,
    /backdrop-filter|backdrop-blur/,
    /ScoreRing|svg.*viewBox/i,
    /animate-/,
    /sb-gradient-card/,
    /text-(3xl|4xl|5xl|6xl)/,
    /tracking-tight|-tracking/,
    /shadow-(lg|xl|2xl)/,
  ];
  const visualScore = clampScore(
    (visualSignals.filter(p => p.test(code)).length / visualSignals.length) * 100
  );

  // --- component_variety ---
  const componentTypes = [
    /sb-card/, /sb-stat/, /sb-accent-card/, /sb-list-item/,
    /glass-elevated/, /sb-tag/, /sb-avatar/, /sb-chip/,
    /sb-result-highlight/, /sb-feature-card/, /sb-section-label/,
    /sb-image-card/, /sb-carousel/, /sb-timeline-item/, /sb-step-dot/,
    /sb-kanban-col/, /sb-calendar-cell/, /sb-bottom-bar/, /sb-streak-badge/,
    /sb-chat-bubble/, /sb-gradient-card/, /sb-sparkline/, /sb-meter/,
    /sb-price/, /sb-rating/, /sb-notification-badge/, /sb-upload-zone/,
    /sb-toggle/, /sb-table/,
  ];
  const varietyCount = componentTypes.filter(p => p.test(code)).length;
  const varietyScore = clampScore((varietyCount / componentTypes.length) * 120); // cap at 100

  // --- brand_cohesion ---
  const brandSignals = [/--sb-primary/, /window\.__sb/, /sb-tag/, /sb-avatar/, /glass-btn/];
  const brandScore = clampScore(
    (brandSignals.filter(p => p.test(code)).length / brandSignals.length) * 100
  );

  // --- form_styling ---
  const formElementCount = (code.match(/<input|<textarea|<select/g) || []).length;
  const styledFormCount = (code.match(/glass-input|sb-dark-input|sb-form-group|sb-chip|sb-toggle|sb-search/g) || []).length;
  const formRatio = formElementCount === 0 ? 1 : Math.min(1, styledFormCount / Math.max(1, formElementCount));
  const bareFormElements = (code.match(/<(input|textarea|select)\s+(?!.*className)[^>]*>/g) || []).length;
  const formScore = clampScore(
    formRatio * 80 + (bareFormElements === 0 ? 20 : Math.max(0, 20 - bareFormElements * 5))
  );

  // h() regression penalty
  const usesH = /const\s+h\s*=\s*React\.createElement/.test(code);
  const hPenalty = usesH ? 15 : 0;

  const breakdown: QualityBreakdown = {
    layout_diversity: clampScore(layoutScore - hPenalty),
    visual_uniqueness: clampScore(uniquenessScore - hPenalty),
    domain_specificity: domainScore,
    navigation_correctness: clampScore(navScore - hPenalty),
    interaction_richness: interactionScore,
    visual_richness: visualScore,
    component_variety: varietyScore,
    brand_cohesion: brandScore,
    form_styling: formScore,
  };

  const weighted = Object.keys(WEIGHTS).reduce((sum, key) => {
    const k = key as keyof QualityBreakdown;
    return sum + breakdown[k] * WEIGHTS[k];
  }, 0);

  return {
    quality_score: clampScore(weighted),
    quality_breakdown: breakdown,
  };
}

/* ------------------------------------------------------------------ */
/*  Retry feedback                                                     */
/* ------------------------------------------------------------------ */

export function generateRetryFeedback(
  breakdown: QualityBreakdown,
  code: string,
  requestedLayout?: string,
  requestedNavType?: string,
): string {
  const issues: string[] = [];

  if (breakdown.layout_diversity < 60) {
    issues.push(
      `Layout fell back to centered column. The requested layout was "${requestedLayout ?? 'non-default'}". ` +
      `Implement the specified page_structure: use the correct grid, sidebar, split-panel, or other structural pattern. ` +
      `Do NOT use max-w-3xl mx-auto px-5 py-6 as a default wrapper.`
    );
  }

  if (breakdown.visual_uniqueness < 60) {
    issues.push(
      'TEMPLATE DETECTED: Remove the logo-top-left + horizontal-tabs + stat-cards pattern. ' +
      'Create a visually distinct layout. Avoid sb-stat cards as primary content. ' +
      'Use the specified navigation type and page structure instead of the default pattern.'
    );
  }

  if (breakdown.domain_specificity < 60) {
    issues.push('Use more domain-specific terminology in labels, categories, and data values — no generic text.');
  }

  if (breakdown.navigation_correctness < 60) {
    issues.push(
      `Wrong navigation pattern. Requested: "${requestedNavType ?? 'non-default'}". ` +
      `Implement the correct nav: sidebar_nav uses <aside>, bottom_tab_bar uses fixed bottom bar, ` +
      `floating_pill uses centered pill, etc. Do NOT default to sb-nav horizontal tabs.`
    );
  }

  if (breakdown.interaction_richness < 60) {
    issues.push('Add more interactive elements: onClick handlers, filter chips, toggle controls, hover effects.');
  }

  if (breakdown.visual_richness < 60) {
    issues.push(
      'Improve visual richness: add gradients (bg-gradient-to-br), SVG visualizations, ' +
      'backdrop-blur effects, shadow-lg/xl, large typography (text-3xl+), ' +
      'sb-gradient-card for hero elements, glass-btn-gradient for CTAs.'
    );
  }

  if (breakdown.component_variety < 50) {
    issues.push('Use more varied component types. Mix cards, lists, badges, timelines, chips, avatars — not just one type.');
  }

  if (breakdown.form_styling < 60) {
    issues.push('Add className="glass-input" to all <input>, <textarea>, <select> elements.');
  }

  if (/const\s+h\s*=\s*React\.createElement/.test(code)) {
    issues.push('CRITICAL: Write JSX syntax, NOT h()/React.createElement. Babel handles transpilation.');
  }

  return issues.length > 0
    ? issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')
    : 'General: improve layout diversity, visual uniqueness, and domain specificity.';
}
