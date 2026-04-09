import type {
  DesignSystemAnalysis,
  CssCustomProperty,
  BorderRadiusToken,
  BoxShadowToken,
  GradientToken,
  TransitionToken,
  ContainerWidthToken,
} from "../types";

export function analyzeCssProperties(): DesignSystemAnalysis["cssProperties"] {
  const sheetResult = scanStylesheets();
  const domResult = scanElements();
  return mergeResults(sheetResult, domResult);
}

// ── Internal result types ───────────────────────────────────

interface ScanResult {
  customProperties: CssCustomProperty[];
  borderRadius: BorderRadiusRaw[];
  boxShadows: BoxShadowRaw[];
  gradients: GradientRaw[];
  transitions: TransitionRaw[];
  containerWidths: ContainerWidthRaw[];
}

interface BorderRadiusRaw {
  value: string;
  px: number;
  context: string;
}

interface BoxShadowRaw {
  value: string;
  context: string;
}

interface GradientRaw {
  value: string;
  type: GradientToken["type"];
  context: string;
}

interface TransitionRaw {
  property: string;
  duration: string;
  timing: string;
}

interface ContainerWidthRaw {
  value: string;
  px: number;
  selector: string;
}

// ── Stylesheet scanning ─────────────────────────────────────

function scanStylesheets(): ScanResult {
  const customPropsMap = new Map<string, { value: string; scope: string }>();
  const gradients: GradientRaw[] = [];
  const transitions: TransitionRaw[] = [];
  const containerWidths: ContainerWidthRaw[] = [];

  // Count var() references across all stylesheet text for each custom property
  const allRuleTexts: string[] = [];

  for (const sheet of document.styleSheets) {
    try {
      scanSheetRules(sheet.cssRules, customPropsMap, gradients, transitions, containerWidths, allRuleTexts);
    } catch {
      // Cross-origin stylesheets throw SecurityError — skip
    }
  }

  // Build CssCustomProperty list with var() reference counts
  const customProperties: CssCustomProperty[] = [];
  const allText = allRuleTexts.join("\n");
  for (const [name, info] of customPropsMap) {
    const varPattern = new RegExp(`var\\(\\s*${escapeRegExp(name)}[\\s,)]`, "g");
    const count = (allText.match(varPattern) ?? []).length;
    customProperties.push({ name, value: info.value, scope: info.scope, count });
  }

  return {
    customProperties,
    borderRadius: [],
    boxShadows: [],
    gradients,
    transitions,
    containerWidths,
  };
}

function scanSheetRules(
  rules: CSSRuleList,
  customPropsMap: Map<string, { value: string; scope: string }>,
  gradients: GradientRaw[],
  transitions: TransitionRaw[],
  containerWidths: ContainerWidthRaw[],
  allRuleTexts: string[]
): void {
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      allRuleTexts.push(rule.cssText);
      const style = rule.style;
      const selector = rule.selectorText;

      // Collect CSS custom properties (--xxx)
      for (let i = 0; i < style.length; i++) {
        const propName = style[i];
        if (propName.startsWith("--")) {
          const value = style.getPropertyValue(propName).trim();
          if (!customPropsMap.has(propName)) {
            customPropsMap.set(propName, { value, scope: selector });
          }
        }
      }

      // Collect gradients from background-image / background
      const bgImage = style.getPropertyValue("background-image");
      const bg = style.getPropertyValue("background");
      for (const val of [bgImage, bg]) {
        if (!val || !val.includes("gradient(")) continue;
        const gradType = detectGradientType(val);
        if (gradType) {
          gradients.push({ value: val.trim(), type: gradType, context: "stylesheet" });
        }
      }

      // Collect transitions
      const transition = style.getPropertyValue("transition");
      if (transition && transition !== "none" && transition !== "") {
        parseTransitionValue(transition, transitions);
      }

      // Collect container max-widths (>= 400px)
      const maxWidth = style.getPropertyValue("max-width");
      if (maxWidth && maxWidth !== "none" && maxWidth !== "") {
        const px = parseToPx(maxWidth);
        if (px !== null && px >= 400) {
          containerWidths.push({ value: maxWidth.trim(), px, selector });
        }
      }
    } else if (rule instanceof CSSMediaRule) {
      // Recurse into media queries
      scanSheetRules(rule.cssRules, customPropsMap, gradients, transitions, containerWidths, allRuleTexts);
    }
  }
}

// ── DOM element scanning ────────────────────────────────────

function scanElements(): ScanResult {
  const borderRadii: BorderRadiusRaw[] = [];
  const boxShadows: BoxShadowRaw[] = [];
  const gradients: GradientRaw[] = [];
  const transitions: TransitionRaw[] = [];
  const containerWidths: ContainerWidthRaw[] = [];

  const elements = document.querySelectorAll("body *");

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const style = getComputedStyle(el);
    const context = classifyContext(el);

    // Border radius
    const borderRadius = style.borderRadius;
    if (borderRadius && borderRadius !== "0px") {
      const px = parseBorderRadiusToPx(borderRadius);
      if (px !== null && px > 0) {
        borderRadii.push({ value: borderRadius, px, context });
      }
    }

    // Box shadow
    const boxShadow = style.boxShadow;
    if (boxShadow && boxShadow !== "none") {
      boxShadows.push({ value: boxShadow, context });
    }

    // Gradients from computed background-image
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage.includes("gradient(")) {
      const gradType = detectGradientType(bgImage);
      if (gradType) {
        gradients.push({ value: bgImage, type: gradType, context });
      }
    }

    // Transitions
    const transition = style.transition;
    if (
      transition &&
      transition !== "none" &&
      !transition.startsWith("all 0s") &&
      transition !== "all 0s ease 0s"
    ) {
      parseTransitionValue(transition, transitions);
    }

    // Container max-widths
    const maxWidth = style.maxWidth;
    if (maxWidth && maxWidth !== "none") {
      const px = parseToPx(maxWidth);
      if (px !== null && px >= 400) {
        const selector = buildSelector(el);
        containerWidths.push({ value: maxWidth, px, selector });
      }
    }
  });

  return {
    customProperties: [],
    borderRadius: borderRadii,
    boxShadows,
    gradients,
    transitions,
    containerWidths,
  };
}

// ── classifyContext ─────────────────────────────────────────

function classifyContext(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const className = (el.className?.toString() ?? "").toLowerCase();

  if (tag === "button" || (tag === "a" && /\bbutton\b|\bbtn\b/.test(className))) return "button";
  if (/\bcard\b|\bpanel\b|\btile\b/.test(className)) return "card";
  if (tag === "input" || tag === "select" || tag === "textarea") return "input";
  if (/\bdialog\b|\bmodal\b/.test(className) || tag === "dialog") return "modal";
  if (tag === "img" || tag === "figure" || tag === "picture") return "image";
  if (tag === "nav") return "navigation";
  if (/\bcontainer\b|\bwrapper\b|\bcontent\b/.test(className)) return "container";

  return tag;
}

// ── Merge & aggregate ───────────────────────────────────────

function mergeResults(sheet: ScanResult, dom: ScanResult): DesignSystemAnalysis["cssProperties"] {
  return {
    customProperties: mergeCustomProperties(sheet.customProperties).slice(0, 50),
    borderRadius: mergeBorderRadius(dom.borderRadius).slice(0, 20),
    boxShadows: mergeBoxShadows(dom.boxShadows).slice(0, 15),
    gradients: mergeGradients([...sheet.gradients, ...dom.gradients]).slice(0, 15),
    transitions: mergeTransitions([...sheet.transitions, ...dom.transitions]).slice(0, 15),
    containerWidths: mergeContainerWidths([...sheet.containerWidths, ...dom.containerWidths]).slice(0, 10),
  };
}

function mergeCustomProperties(props: CssCustomProperty[]): CssCustomProperty[] {
  const map = new Map<string, CssCustomProperty>();
  for (const p of props) {
    const existing = map.get(p.name);
    if (existing) {
      existing.count += p.count;
    } else {
      map.set(p.name, { ...p });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function mergeBorderRadius(raws: BorderRadiusRaw[]): BorderRadiusToken[] {
  // Group by px value (1px tolerance)
  const buckets = new Map<number, { value: string; count: number; contexts: Set<string> }>();
  for (const raw of raws) {
    const bucketKey = findBucket(raw.px, buckets, 1);
    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.count++;
      existing.contexts.add(raw.context);
    } else {
      buckets.set(raw.px, { value: raw.value, count: 1, contexts: new Set([raw.context]) });
    }
  }
  return Array.from(buckets.entries())
    .map(([px, data]) => ({
      value: data.value,
      px,
      count: data.count,
      contexts: Array.from(data.contexts),
    }))
    .sort((a, b) => b.count - a.count);
}

function mergeBoxShadows(raws: BoxShadowRaw[]): BoxShadowToken[] {
  const map = new Map<string, { count: number; contexts: Set<string> }>();
  for (const raw of raws) {
    const existing = map.get(raw.value);
    if (existing) {
      existing.count++;
      existing.contexts.add(raw.context);
    } else {
      map.set(raw.value, { count: 1, contexts: new Set([raw.context]) });
    }
  }
  return Array.from(map.entries())
    .map(([value, data]) => ({
      value,
      count: data.count,
      contexts: Array.from(data.contexts),
    }))
    .sort((a, b) => b.count - a.count);
}

function mergeGradients(raws: GradientRaw[]): GradientToken[] {
  const map = new Map<string, { type: GradientToken["type"]; count: number; contexts: Set<string> }>();
  for (const raw of raws) {
    const existing = map.get(raw.value);
    if (existing) {
      existing.count++;
      existing.contexts.add(raw.context);
    } else {
      map.set(raw.value, { type: raw.type, count: 1, contexts: new Set([raw.context]) });
    }
  }
  return Array.from(map.entries())
    .map(([value, data]) => ({
      value,
      type: data.type,
      count: data.count,
      contexts: Array.from(data.contexts),
    }))
    .sort((a, b) => b.count - a.count);
}

function mergeTransitions(raws: TransitionRaw[]): TransitionToken[] {
  const map = new Map<string, { duration: string; timing: string; count: number }>();
  for (const raw of raws) {
    const key = `${raw.property}|${raw.duration}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
    } else {
      map.set(key, { duration: raw.duration, timing: raw.timing, count: 1 });
    }
  }
  return Array.from(map.entries())
    .map(([key, data]) => ({
      property: key.split("|")[0],
      duration: data.duration,
      timing: data.timing,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

function mergeContainerWidths(raws: ContainerWidthRaw[]): ContainerWidthToken[] {
  // Group by px value
  const buckets = new Map<number, { value: string; count: number; selectors: Set<string> }>();
  for (const raw of raws) {
    const existing = buckets.get(raw.px);
    if (existing) {
      existing.count++;
      existing.selectors.add(raw.selector);
    } else {
      buckets.set(raw.px, { value: raw.value, count: 1, selectors: new Set([raw.selector]) });
    }
  }
  return Array.from(buckets.entries())
    .map(([px, data]) => ({
      value: data.value,
      px,
      count: data.count,
      selectors: Array.from(data.selectors),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Utility functions ───────────────────────────────────────

function detectGradientType(value: string): GradientToken["type"] | null {
  if (value.includes("linear-gradient(")) return "linear";
  if (value.includes("radial-gradient(")) return "radial";
  if (value.includes("conic-gradient(")) return "conic";
  return null;
}

function parseTransitionValue(value: string, out: TransitionRaw[]): void {
  // transitions can be comma-separated: "opacity 0.3s ease, transform 0.2s ease-in-out"
  const parts = value.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "none") continue;

    // Format: property duration timing-function delay
    const tokens = trimmed.split(/\s+/);
    const property = tokens[0] ?? "all";
    const duration = tokens[1] ?? "0s";
    const timing = tokens[2] ?? "ease";

    // Skip zero-duration transitions
    if (duration === "0s" || duration === "0ms") continue;

    out.push({ property, duration, timing });
  }
}

function parseToPx(value: string): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  if (isNaN(num)) return null;
  if (value.includes("rem")) return Math.round(num * 16);
  if (value.includes("em")) return Math.round(num * 16);
  if (value.includes("px")) return Math.round(num);
  // Bare integer (e.g. SVG attribute) — only when no unit suffix present
  if (/^\d+(\.\d+)?$/.test(value.trim())) return Math.round(num);
  // Percentage, vw, vh, ch, fr, etc. — not convertible to absolute px
  return null;
}

function parseBorderRadiusToPx(value: string): number | null {
  // border-radius can be "8px 8px 8px 8px" — take the first value
  const first = value.split(/\s+/)[0];
  if (!first) return null;
  return parseToPx(first);
}

function findBucket(
  px: number,
  buckets: Map<number, unknown>,
  tolerance: number
): number {
  for (const key of buckets.keys()) {
    if (Math.abs(key - px) <= tolerance) return key;
  }
  return px;
}

function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = el.className?.toString()
    ? "." + el.className.toString().trim().split(/\s+/).slice(0, 2).join(".")
    : "";
  return `${tag}${id}${classes}`.slice(0, 120);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
