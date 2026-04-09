import type {
  DesignSystemAnalysis,
  SpacingToken,
  TypographyToken,
  ColorToken,
} from "../types";
import { analyzeLayout } from "./layout-analyzer";
import { analyzeCssProperties } from "./css-property-analyzer";

export function analyzeDesignSystem(): DesignSystemAnalysis {
  return {
    url: location.href,
    extractedAt: new Date().toISOString(),
    siteName: location.hostname,
    title: document.title.trim(),
    spacing: extractSpacing(),
    typography: extractTypography(),
    colors: extractColorSystem(),
    layout: analyzeLayout(),
    cssProperties: analyzeCssProperties(),
  };
}

// ── Spacing extraction ──────────────────────────────────────

const SPACING_PROPERTIES = [
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
] as const;

function extractSpacing(): DesignSystemAnalysis["spacing"] {
  const spacingMap = new Map<number, { count: number; properties: Set<string> }>();
  const elements = document.querySelectorAll("body *");

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const style = getComputedStyle(el);

    for (const prop of SPACING_PROPERTIES) {
      const raw = style[prop as keyof CSSStyleDeclaration] as string;
      if (!raw || raw === "normal" || raw === "auto") continue;

      const px = parseFloat(raw);
      if (isNaN(px) || px <= 0 || px > 500) continue;

      const rounded = Math.round(px);
      const existing = spacingMap.get(rounded);
      if (existing) {
        existing.count++;
        existing.properties.add(camelToKebab(prop));
      } else {
        spacingMap.set(rounded, { count: 1, properties: new Set([camelToKebab(prop)]) });
      }
    }
  });

  const scale: SpacingToken[] = [];
  for (const [px, val] of spacingMap) {
    if (val.count < 2) continue;
    scale.push({
      value: `${px}px`,
      px,
      count: val.count,
      properties: Array.from(val.properties),
    });
  }
  scale.sort((a, b) => a.px - b.px);

  const baseUnit = inferBaseUnit(scale);

  return { scale, baseUnit };
}

function inferBaseUnit(scale: SpacingToken[]): number {
  if (scale.length === 0) return 4;

  // Find the GCD-like base by checking common base units (4, 8, 6, 5)
  const candidates = [4, 8, 6, 5];
  let bestBase = 4;
  let bestScore = 0;

  for (const base of candidates) {
    let score = 0;
    for (const token of scale) {
      if (token.px % base === 0) {
        score += token.count;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestBase = base;
    }
  }

  return bestBase;
}

// ── Typography extraction ───────────────────────────────────

function extractTypography(): DesignSystemAnalysis["typography"] {
  const typoMap = new Map<
    string,
    {
      fontSize: string;
      lineHeight: string;
      letterSpacing: string;
      fontFamily: string;
      fontWeight: string;
      count: number;
      sampleText: string;
      element: string;
    }
  >();
  const familySet = new Set<string>();

  const textSelectors =
    "h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, div, label, button, dt, dd, figcaption, blockquote";
  const textElements = document.querySelectorAll(textSelectors);

  textElements.forEach((el) => {
    const hasDirectText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() ?? "").length > 0
    );
    if (!hasDirectText) return;

    const text = el.textContent?.trim() ?? "";
    if (text.length === 0) return;

    const style = getComputedStyle(el);
    const fontSize = style.fontSize;
    const lineHeight = style.lineHeight;
    const letterSpacing = style.letterSpacing;
    const fontFamily = style.fontFamily;
    const fontWeight = style.fontWeight;

    const key = `${fontSize}\0${lineHeight}\0${letterSpacing}\0${fontWeight}`;
    const existing = typoMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      typoMap.set(key, {
        fontSize,
        lineHeight,
        letterSpacing,
        fontFamily,
        fontWeight,
        count: 1,
        sampleText: text.slice(0, 60),
        element: el.tagName.toLowerCase(),
      });
    }

    // Track unique font families
    const primary = fontFamily.split(",")[0].trim().replace(/["']/g, "");
    if (primary) familySet.add(primary);
  });

  const scale: TypographyToken[] = [];
  for (const [, val] of typoMap) {
    scale.push(val);
  }
  scale.sort((a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize));

  // Google Fonts URLs
  const googleFontsUrls: string[] = [];
  document
    .querySelectorAll('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]')
    .forEach((link) => {
      const href = (link as HTMLLinkElement).href;
      if (href && !googleFontsUrls.includes(href)) {
        googleFontsUrls.push(href);
      }
    });

  return {
    scale,
    families: Array.from(familySet),
    googleFontsUrls,
  };
}

// ── Color system extraction ─────────────────────────────────

interface RawColor {
  hex: string;
  rgb: string;
  count: number;
  properties: Set<string>;
}

function extractColorSystem(): DesignSystemAnalysis["colors"] {
  const colorMap = new Map<string, RawColor>();
  const elements = document.querySelectorAll("body *");

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const style = getComputedStyle(el);

    collectColor(colorMap, style.color, "color");
    collectColor(colorMap, style.backgroundColor, "background-color");

    const borderValues = new Set([
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
    ]);
    for (const value of borderValues) {
      if (value) collectColor(colorMap, value, "border-color");
    }
  });

  // Classify colors by their dominant usage
  const allTokens: ColorToken[] = [];
  for (const [hex, raw] of colorMap) {
    const role = classifyColorRole(raw);
    allTokens.push({
      hex,
      rgb: raw.rgb,
      count: raw.count,
      role,
      properties: Array.from(raw.properties),
    });
  }
  allTokens.sort((a, b) => b.count - a.count);

  return {
    tokens: allTokens.slice(0, 50),
    backgrounds: allTokens.filter((c) => c.role === "background"),
    borders: allTokens.filter((c) => c.role === "border"),
    texts: allTokens.filter((c) => c.role === "text"),
  };
}

function collectColor(map: Map<string, RawColor>, value: string, property: string): void {
  if (!value) return;
  if (value === "rgba(0, 0, 0, 0)" || value === "transparent") return;

  const hex = rgbToHex(value);
  if (!hex) return;

  const existing = map.get(hex);
  if (existing) {
    existing.count++;
    existing.properties.add(property);
  } else {
    map.set(hex, { hex, rgb: value, count: 1, properties: new Set([property]) });
  }
}

function classifyColorRole(raw: RawColor): ColorToken["role"] {
  const props = raw.properties;
  const hasBg = props.has("background-color");
  const hasBorder = props.has("border-color");
  const hasText = props.has("color");

  // If it's only used as border color
  if (hasBorder && !hasBg && !hasText) return "border";
  // If only background
  if (hasBg && !hasText && !hasBorder) return "background";
  // If only text color
  if (hasText && !hasBg && !hasBorder) return "text";

  // Mixed usage: classify by lightness
  const lightness = hexToLightness(raw.hex);
  if (lightness > 0.9) return "background";
  if (lightness < 0.2) return "text";

  // High-count colors with text usage tend to be primary
  if (hasText && raw.count > 5) return "primary";
  if (hasBg && raw.count > 5) return "accent";

  return "secondary";
}

function hexToLightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ── Shared utilities ────────────────────────────────────────

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
