/**
 * Figma API client — fetches files and extracts design tokens.
 * Templates are cached in DB so Figma is never called at generation time.
 */

import type { AppContextBrief } from "./contextResearch.js";

// ─── Types ───────────────────────────────────────────────────────

export interface FigmaDesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    all: string[]; // every unique color found
  };
  typography: {
    fonts: string[];
    heading_sizes: number[];
    body_size: number;
    weights: number[];
  };
  spacing: {
    base: number;
    values: number[];
  };
  borders: {
    radii: number[];
    default_radius: number;
  };
  shadows: string[];
  layout: {
    type: string; // "sidebar", "top-nav", "centered", etc.
    columns: number;
    frame_names: string[];
    component_names: string[];
  };
}

export interface FigmaTemplateData {
  file_key: string;
  file_name: string;
  last_modified: string;
  thumbnail_url: string | null;
  design_tokens: FigmaDesignTokens;
  page_names: string[];
  component_count: number;
  raw_metadata: Record<string, unknown>;
}

// ─── Figma API helpers ───────────────────────────────────────────

const FIGMA_API = "https://api.figma.com/v1";

function getApiKey(): string {
  const key = process.env.FIGMA_API_KEY;
  if (!key) throw new Error("FIGMA_API_KEY not set");
  return key;
}

async function figmaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { "X-Figma-Token": getApiKey() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Figma API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Color extraction ────────────────────────────────────────────

function rgbaToHex(r: number, g: number, b: number, a = 1): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return a < 1
    ? `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`
    : `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function extractColorsFromNode(node: Record<string, unknown>, colors: Set<string>) {
  // Fill colors
  const fills = node.fills as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(fills)) {
    for (const fill of fills) {
      if (fill.type === "SOLID" && fill.color) {
        const c = fill.color as { r: number; g: number; b: number; a?: number };
        colors.add(rgbaToHex(c.r, c.g, c.b, c.a));
      }
    }
  }
  // Stroke colors
  const strokes = node.strokes as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(strokes)) {
    for (const stroke of strokes) {
      if (stroke.type === "SOLID" && stroke.color) {
        const c = stroke.color as { r: number; g: number; b: number; a?: number };
        colors.add(rgbaToHex(c.r, c.g, c.b, c.a));
      }
    }
  }
  // Recurse into children
  const children = node.children as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(children)) {
    for (const child of children) extractColorsFromNode(child, colors);
  }
}

// ─── Typography extraction ───────────────────────────────────────

function extractTypographyFromNode(
  node: Record<string, unknown>,
  fonts: Set<string>,
  sizes: Set<number>,
  weights: Set<number>,
) {
  const style = node.style as Record<string, unknown> | undefined;
  if (style) {
    if (typeof style.fontFamily === "string") fonts.add(style.fontFamily);
    if (typeof style.fontSize === "number") sizes.add(style.fontSize);
    if (typeof style.fontWeight === "number") weights.add(style.fontWeight);
  }
  const children = node.children as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(children)) {
    for (const child of children) extractTypographyFromNode(child, fonts, sizes, weights);
  }
}

// ─── Spacing / borders ──────────────────────────────────────────

function extractLayoutFromNode(
  node: Record<string, unknown>,
  radii: Set<number>,
  paddings: Set<number>,
  frameNames: string[],
  componentNames: string[],
) {
  const type = node.type as string | undefined;
  const name = node.name as string | undefined;

  if (type === "FRAME" && name) frameNames.push(name);
  if (type === "COMPONENT" && name) componentNames.push(name);

  const cornerRadius = node.cornerRadius as number | undefined;
  if (typeof cornerRadius === "number" && cornerRadius > 0) radii.add(cornerRadius);

  const padding = node.paddingLeft as number | undefined;
  if (typeof padding === "number" && padding > 0) paddings.add(padding);
  const paddingTop = node.paddingTop as number | undefined;
  if (typeof paddingTop === "number" && paddingTop > 0) paddings.add(paddingTop);

  const children = node.children as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(children)) {
    for (const child of children)
      extractLayoutFromNode(child, radii, paddings, frameNames, componentNames);
  }
}

// ─── Shadow extraction ──────────────────────────────────────────

function extractShadowsFromNode(node: Record<string, unknown>, shadows: Set<string>) {
  const effects = node.effects as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(effects)) {
    for (const e of effects) {
      if (e.type === "DROP_SHADOW" && e.visible !== false) {
        const offset = e.offset as { x: number; y: number } | undefined;
        const radius = e.radius as number | undefined;
        const color = e.color as { r: number; g: number; b: number; a?: number } | undefined;
        if (offset && radius != null && color) {
          shadows.add(
            `${offset.x}px ${offset.y}px ${radius}px ${rgbaToHex(color.r, color.g, color.b, color.a)}`,
          );
        }
      }
    }
  }
  const children = node.children as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(children)) {
    for (const child of children) extractShadowsFromNode(child, shadows);
  }
}

// ─── Layout type detection ──────────────────────────────────────

function detectLayoutType(frameNames: string[]): string {
  const lower = frameNames.map((n) => n.toLowerCase());
  if (lower.some((n) => n.includes("sidebar"))) return "sidebar";
  if (lower.some((n) => n.includes("nav") || n.includes("header"))) return "top-nav";
  if (lower.some((n) => n.includes("tab"))) return "tab-bar";
  return "centered";
}

// ─── Main: fetch + extract ──────────────────────────────────────

export async function fetchFigmaTemplate(fileKey: string): Promise<FigmaTemplateData> {
  // Fetch the full file tree
  const file = await figmaFetch<Record<string, unknown>>(`/files/${fileKey}`);

  const document = file.document as Record<string, unknown>;
  const pages = (document.children ?? []) as Array<Record<string, unknown>>;
  const pageNames = pages.map((p) => (p.name as string) || "Untitled");

  // Extract all design tokens from the document tree
  const colors = new Set<string>();
  const fonts = new Set<string>();
  const fontSizes = new Set<number>();
  const fontWeights = new Set<number>();
  const radii = new Set<number>();
  const paddings = new Set<number>();
  const shadows = new Set<string>();
  const frameNames: string[] = [];
  const componentNames: string[] = [];

  for (const page of pages) {
    extractColorsFromNode(page, colors);
    extractTypographyFromNode(page, fonts, fontSizes, fontWeights);
    extractLayoutFromNode(page, radii, paddings, frameNames, componentNames);
    extractShadowsFromNode(page, shadows);
  }

  const allColors = [...colors].filter((c) => c !== "#000000" && c !== "#ffffff");
  const sortedSizes = [...fontSizes].sort((a, b) => b - a);

  const design_tokens: FigmaDesignTokens = {
    colors: {
      primary: allColors[0] ?? "#6366f1",
      secondary: allColors[1] ?? "#8b5cf6",
      accent: allColors[2] ?? "#f59e0b",
      background: "#ffffff",
      surface: allColors[3] ?? "#f8fafc",
      text: "#0f172a",
      muted: "#64748b",
      all: allColors.slice(0, 20),
    },
    typography: {
      fonts: [...fonts].slice(0, 5),
      heading_sizes: sortedSizes.filter((s) => s >= 18).slice(0, 5),
      body_size: sortedSizes.find((s) => s >= 14 && s <= 18) ?? 16,
      weights: [...fontWeights].sort(),
    },
    spacing: {
      base: [...paddings].sort()[0] ?? 8,
      values: [...paddings].sort((a, b) => a - b).slice(0, 10),
    },
    borders: {
      radii: [...radii].sort((a, b) => a - b),
      default_radius: [...radii].sort()[0] ?? 8,
    },
    shadows: [...shadows].slice(0, 5),
    layout: {
      type: detectLayoutType(frameNames),
      columns: Math.min(frameNames.length, 12),
      frame_names: frameNames.slice(0, 30),
      component_names: componentNames.slice(0, 50),
    },
  };

  return {
    file_key: fileKey,
    file_name: (file.name as string) ?? "Untitled",
    last_modified: (file.lastModified as string) ?? new Date().toISOString(),
    thumbnail_url: (file.thumbnailUrl as string) ?? null,
    design_tokens,
    page_names: pageNames,
    component_count: componentNames.length,
    raw_metadata: {
      version: file.version,
      schemaVersion: file.schemaVersion,
    },
  };
}

// ─── Convert template to AppContextBrief overlay ─────────────────

export function templateToContextBrief(template: FigmaTemplateData): Partial<AppContextBrief> {
  const t = template.design_tokens;
  return {
    design_references: {
      color_psychology: `Figma template uses ${t.colors.primary} as primary, ${t.colors.secondary} as secondary`,
      layout_pattern: t.layout.type,
      typography_style: t.typography.fonts[0] ?? "system sans-serif",
      visual_motifs: t.layout.component_names.slice(0, 5),
    },
    ui_component_suggestions: t.layout.component_names.slice(0, 10),
    layout_blueprint: `${t.layout.type} layout with ${t.layout.frame_names.length} sections: ${t.layout.frame_names.slice(0, 6).join(", ")}`,
    competitor_visuals: [
      {
        name: `Figma: ${template.file_name}`,
        colors: t.colors.all.slice(0, 8),
        og_image: template.thumbnail_url,
        layout_signals: [
          `Layout: ${t.layout.type}`,
          `Border radius: ${t.borders.default_radius}px`,
          `Spacing base: ${t.spacing.base}px`,
          ...t.layout.frame_names.slice(0, 5).map((f) => `Section: ${f}`),
        ],
        screenshot_analysis: {
          color_palette: t.colors.all.slice(0, 8),
          layout_type: t.layout.type,
          component_patterns: t.layout.component_names.slice(0, 10),
          navigation_style: t.layout.type === "sidebar" ? "sidebar navigation" : "top navigation bar",
          image_usage: "minimal",
          interactive_elements: ["buttons", "inputs", "cards"],
          key_ui_to_replicate: t.layout.component_names.slice(0, 5),
          background_treatment: `solid ${t.colors.background}`,
          card_design_spec: `border-radius: ${t.borders.default_radius}px, shadow: ${t.shadows[0] ?? "none"}`,
          typography_hierarchy: t.typography.fonts.length > 0
            ? `${t.typography.fonts[0]} for headings (${t.typography.heading_sizes.slice(0, 3).join("/")}px), body ${t.typography.body_size}px`
            : "system sans-serif hierarchy",
          spacing_pattern: `base ${t.spacing.base}px, scale: ${t.spacing.values.slice(0, 5).join(", ")}px`,
          gradient_specs: [],
          border_and_shadow_system: `radius ${t.borders.radii.slice(0, 3).join("/")}px, shadows: ${t.shadows.length}`,
          hero_section_spec: t.layout.frame_names[0] ? `Hero: ${t.layout.frame_names[0]}` : undefined,
          section_patterns: t.layout.frame_names.slice(0, 8),
        },
      },
    ],
  };
}

/**
 * Parse a Figma URL to extract the file key.
 * Supports:
 *   https://www.figma.com/file/ABC123/...
 *   https://www.figma.com/design/ABC123/...
 *   https://www.figma.com/community/file/ABC123/...
 */
export function parseFigmaUrl(url: string): string | null {
  const match = url.match(/figma\.com\/(?:community\/)?(?:file|design)\/([a-zA-Z0-9]+)/);
  return match?.[1] ?? null;
}
