---
title: How I Reverse-Engineer Design Systems from Any Website
published: false
description: A deep dive into how you can extract color palettes, typography scales, spacing tokens, and Tailwind configs from any live website using browser APIs and computed styles — no paid tools, no servers.
tags: chromeextension, webdev, css, designsystem
cover_image:
---

Every frontend developer has been there. You land on a competitor's website, or a beautifully designed SaaS product, and you want to understand how their design system works. What fonts are they using? What is their spacing scale? Is that a 4px or 8px base unit?

So you open DevTools, click on a heading, scroll through the Computed panel, note down `font-size: 48px`, `line-height: 1.2`, then click another element, repeat. Twenty minutes later you have half a picture and a notepad full of pixel values that may or may not form a coherent system.

There has to be a better way.

This article explains how I built the Design System Extractor inside PageGrab, a Chrome extension I wrote to automate exactly this workflow. The extractor walks the entire DOM, collects computed styles from every visible element, then produces a structured output: color tokens with roles, a typography scale sorted by size, spacing tokens with a detected base unit, layout patterns, and a ready-to-paste `tailwind.config.js`.

All of it runs locally, in the browser, with no external servers.

---

## The Problem with Manual Design System Inspection

When you inspect a site manually, you are fighting several compounding problems.

**Computed vs. declared styles.** The value in the CSS source might be a CSS custom property like `var(--color-primary)`. The DevTools Styles panel shows you the declared value. The Computed panel shows you what the browser actually resolved. For extraction purposes, you want the computed value — the real hex color the user sees on screen.

**Volume.** A modern marketing page might have 300-500 DOM elements, each with dozens of CSS properties. No one is going to click through all of those. You need to aggregate.

**Inference vs. inventory.** A design system is not just a list of values. It is the *pattern* those values form. A spacing scale of `4, 8, 12, 16, 24, 32, 48` is not seven random numbers — it is an 8px base unit system. A typography scale of `12px, 14px, 16px, 20px, 24px, 32px, 48px` is a deliberate progression. The raw numbers are easy to find; the underlying logic is what matters.

The goal of the extractor is to solve all three of these at once: collect computed values at scale, then perform light analysis to surface the underlying system.

---

## How the Extractor Works

The extractor is a content script that runs in the context of the current page. When you click the button in the extension popup, the popup sends a message to the content script, which calls `analyzeDesignSystem()` and returns the result to the service worker for saving.

```typescript
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
  };
}
```

Four extraction pipelines run in sequence. Let's walk through each one.

---

## Spacing: Finding the Base Unit

The spacing extractor queries every element in `body *` and reads eleven CSS properties from the computed style: `marginTop`, `marginRight`, `marginBottom`, `marginLeft`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `gap`, `rowGap`, and `columnGap`.

```typescript
const SPACING_PROPERTIES = [
  "marginTop", "marginRight", "marginBottom", "marginLeft",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "gap", "rowGap", "columnGap",
] as const;

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
    // accumulate into spacingMap...
  }
});
```

A few filtering decisions worth noting. Elements with zero `offsetWidth` and `offsetHeight` are skipped — invisible elements (hidden inputs, `display: none` subtrees) would pollute the data. Values above 500px are discarded as layout-level dimensions rather than spacing tokens. Values below 1px are discarded as sub-pixel rendering artifacts.

The result is a frequency map: each pixel value paired with how many times it appears across the entire DOM, and which CSS properties carry it.

Only values that appear at least twice make it into the final scale. A single `margin-top: 37px` on one element is probably a one-off, not a token.

### Inferring the Base Unit

Once you have the frequency map, you can try to infer the base unit — the atomic increment the design system is built around. Most systems use 4px or 8px. A few use 6px or 5px.

```typescript
function inferBaseUnit(scale: SpacingToken[]): number {
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
```

The scoring is weighted by usage count, not just by how many token values are divisible. This matters because a site might have three spacing values divisible by 6 but each used once, versus twenty values divisible by 4 each used hundreds of times. The latter is the real base unit.

---

## Typography: Building the Scale

Typography extraction targets elements that actually contain text: headings, paragraphs, spans, anchors, list items, table cells, buttons, labels, and a few others.

The key filter is checking for direct text nodes — child nodes of type `TEXT_NODE` with non-empty content. This avoids reading the font size of a `div` that only contains other `div`s, which would give you the inherited value rather than a value set intentionally on that element.

```typescript
const hasDirectText = Array.from(el.childNodes).some(
  (n) => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() ?? "").length > 0
);
if (!hasDirectText) return;
```

For each qualifying element, four properties form the deduplication key: `fontSize`, `lineHeight`, `letterSpacing`, and `fontWeight`. Two elements that share all four values are considered the same typography token, and the count increments. Font family and a sample text string are stored for human readability.

The final scale is sorted from largest font size to smallest, giving you a natural heading-to-body progression. The extractor also collects Google Fonts URLs from `link` tags, which tells you exactly which font weights and subsets the site is loading.

---

## Colors: Extraction and Role Classification

Color extraction is where things get more interesting, because raw collection is straightforward but making sense of colors requires inference.

The extractor reads `color`, `backgroundColor`, and border colors (top, right, bottom, left) from every visible element. Transparent and fully-invisible colors are excluded — `rgba(0, 0, 0, 0)` is essentially "no color" and would create false entries.

```typescript
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
```

The `rgbToHex` conversion is necessary because `getComputedStyle` always returns colors in `rgb()` or `rgba()` format, never as hex — even if the original CSS was written as `#3b82f6`.

### Role Classification

Each color token gets a semantic role: `primary`, `secondary`, `accent`, `background`, `border`, or `text`. The classification logic is heuristic but works well in practice.

First, check the CSS properties the color appears on. A color that only ever appears as a `border-color` is a border token. A color that only appears as `background-color` is a background token. A color only used as `color` is a text token.

When a color appears across multiple property types, lightness breaks the tie:

```typescript
function classifyColorRole(raw: RawColor): ColorToken["role"] {
  const props = raw.properties;
  const hasBg = props.has("background-color");
  const hasBorder = props.has("border-color");
  const hasText = props.has("color");

  if (hasBorder && !hasBg && !hasText) return "border";
  if (hasBg && !hasText && !hasBorder) return "background";
  if (hasText && !hasBg && !hasBorder) return "text";

  // Mixed usage: use luminance
  const lightness = hexToLightness(raw.hex);
  if (lightness > 0.9) return "background";
  if (lightness < 0.2) return "text";

  if (hasText && raw.count > 5) return "primary";
  if (hasBg && raw.count > 5) return "accent";

  return "secondary";
}
```

The luminance calculation uses the standard ITU-R BT.709 coefficients (`0.2126 * R + 0.7152 * G + 0.0722 * B`), which approximate how the human eye perceives brightness across the three channels. Very light colors (luminance > 0.9) are almost always page backgrounds. Very dark colors (luminance < 0.2) are almost always body text.

High-frequency colors that appear both as `color` and elsewhere are likely brand primaries. This is imperfect, but it is right often enough to be useful as a starting point.

---

## Layout: Breakpoints and Section Patterns

The layout analyzer adds a fourth dimension that the other three do not cover: structural information about how the page is organized.

### Breakpoint Extraction

The extractor walks `document.styleSheets` and recurses through all `CSSMediaRule` instances, collecting width-based media queries and counting the number of CSS rules inside each.

```typescript
for (const sheet of document.styleSheets) {
  try {
    extractBreakpointsFromRules(sheet.cssRules, breakpointMap);
  } catch {
    // Cross-origin stylesheets throw SecurityError — skip silently
  }
}
```

Cross-origin stylesheets (loaded from a CDN, for instance) throw a `SecurityError` when you try to access `cssRules`. The try/catch is required here — it is one of the few legitimate uses of caught exceptions in this codebase, since there is no way to check cross-origin access before attempting it.

The result tells you what breakpoints the site uses and how many rules live inside each, which gives you a rough idea of how heavily the site relies on each breakpoint.

### Section Composition

The section analyzer finds the high-level structural blocks of the page — hero, features, pricing, CTA, footer — by examining semantic HTML tags, ARIA roles, id attributes, class names, and heading text.

```typescript
const SECTION_PATTERNS = [
  { pattern: "hero", signals: [/hero/i, /banner/i, /jumbotron/i, /main-?visual/i] },
  { pattern: "features", signals: [/feature/i, /benefit/i, /service/i, /merit/i] },
  { pattern: "testimonials", signals: [/testimon/i, /review/i, /voice/i] },
  { pattern: "pricing", signals: [/pric/i, /plan/i, /cost/i, /fee/i] },
  { pattern: "cta", signals: [/cta/i, /contact/i, /signup/i, /register/i] },
  // ...
];
```

This is admittedly pattern-matching against class names and IDs, which is fragile. But it works surprisingly well on most marketing sites, because teams tend to use descriptive class names for their major sections.

---

## The Output: Four Files per Extraction

When you run the extractor on a site, the service worker saves four files into `~/Downloads/pagegrab/design-system/[site-slug]/`:

**`tokens.css`** — CSS custom properties for everything: spacing, typography sizes, font families, and colors organized by role.

```css
:root {
  /* Spacing */
  --spacing-base: 8px;
  --spacing-4: 4px;    /* 12x used */
  --spacing-8: 8px;    /* 47x used (1 * base) */
  --spacing-16: 16px;  /* 38x used (2 * base) */
  --spacing-24: 24px;  /* 29x used (3 * base) */

  /* Typography */
  --font-size-5xl: 48px;
  --line-height-5xl: 57.6px;
  --font-size-2xl: 24px;
  --font-size-base: 16px;

  /* Colors */
  --color-primary: #3b82f6;   /* 84x used */
  --color-text: #111827;      /* 203x used */
  --color-bg: #ffffff;        /* 156x used */
}
```

**`tailwind.config.js`** — A ready-to-use Tailwind configuration with `extend` blocks for spacing, fontSize, fontFamily, and colors. You can drop this directly into a new project to match the extracted design system.

```javascript
/** @type {import('tailwindcss').Config} */
// Design System extracted from: https://example.com
export default {
  theme: {
    extend: {
      spacing: {
        "4": "4px",
        "8": "8px",
        "16": "16px",
      },
      fontSize: {
        "5xl": ["48px", "57.6px"],
        "base": ["16px", "24px"],
      },
      colors: {
        "primary": "#3b82f6",
        "text": "#111827",
      },
    },
  },
};
```

**`layout.md`** — A Markdown report with breakpoint tables, flex/grid pattern inventories, and the detected page section sequence.

**`tokens.json`** — The full raw data as JSON, including every token with its count and associated CSS properties. Useful for programmatic processing or piping into other tools.

---

## Who Is This For?

**Frontend developers doing competitive analysis.** When you are building a new product in a crowded space, understanding how competitors have solved their design language is useful. Not to copy, but to understand the conventions users already expect.

**Designers collecting inspiration.** Pulling apart a site's color palette and type scale takes about ten seconds with the extractor, versus ten minutes in DevTools. If you are building a mood board or exploring design directions, this removes a lot of friction.

**Agencies inheriting existing codebases.** When a client hands you a live site to redesign or extend, the first thing you need is a full picture of what design tokens are actually in use. The extractor gives you that inventory in one click, including how frequently each value appears — which tells you what is core to the system versus a one-off.

**Anyone migrating to Tailwind.** If you are taking an existing site and want to reconfigure it to use Tailwind, having the current spacing and color system in `tailwind.config.js` format is a practical starting point.

---

## What It Does Not Do

A few important caveats.

The extractor works on computed styles, not source code. It cannot tell you what CSS custom properties or design tokens the site uses internally. If a site defines `--primary: #3b82f6` and uses that variable everywhere, the extractor will find `#3b82f6` in abundance but will not know the variable name.

Color clustering — grouping `#3b82f6` and `#3b83f7` as the same color — is not implemented. The extractor works with exact hex values. If a site has dozens of nearly-identical colors (common in older codebases where values were specified ad-hoc), you will get a noisy palette. The role classification still works because the frequency-weighted sorting pushes the most common values to the top.

The section classifier uses class name and ID pattern matching, which is heuristic. Sites that use opaque BEM or utility-only class names will produce many `content` or `unknown` entries.

Cross-origin stylesheets are skipped for breakpoint extraction. If a site loads all its CSS from a third-party CDN without CORS headers, the breakpoint analysis will be incomplete.

---

## The Architecture: Why a Chrome Extension?

The key constraint that makes all of this possible is that a content script runs inside the page's JavaScript context. It has access to the live DOM, the resolved computed styles, and the browser's CSSOM — everything that has already been processed by the browser's layout engine.

This is fundamentally different from what a web scraper or a headless browser can do. A scraper sees raw HTML. The extractor sees the final rendered state: CSS variables resolved, inheritance applied, media queries evaluated for the current viewport. The computed styles are the ground truth.

Running everything locally also means there is no data sent anywhere. The tokens.json for a large site might include hundreds of values, some of which could theoretically fingerprint browsing behavior. Keeping everything in the Downloads folder and off any network is a deliberate design choice, not a technical constraint.

The extension uses Chrome Manifest V3, which means content scripts communicate with the service worker via `chrome.runtime.sendMessage`. The service worker handles all file saving via `chrome.downloads.download`. No persistent background page, no `XMLHttpRequest` from content scripts.

---

## Try It

PageGrab is open source and available on GitHub: **https://github.com/sogadaiki/pagegrab**

It is not on the Chrome Web Store yet — installation is via developer mode with `npm run build` and loading the `dist/` folder as an unpacked extension. The README has the exact steps.

The Design System Extractor is one of five tools in the extension. The others are a Text Extractor that converts page content to Markdown (useful for feeding pages into Claude Code without bot-blocking issues), a Full Page Screenshot tool that uses `chrome.debugger` to neutralize fixed headers before capture, a Component Picker for inspecting and copying computed CSS from specific elements, and an LP Analyzer for landing page structure analysis.

If you find the extractor useful, or have ideas for making the color clustering or base-unit inference smarter, I would be glad to hear it. The codebase is small — around 1,000 lines of TypeScript with no runtime dependencies — and the relevant logic lives in `src/content/design-system-analyzer.ts`.

The extension is also launching on Product Hunt soon, if you want to follow along or show support there.
