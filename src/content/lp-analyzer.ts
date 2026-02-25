import type { LPAnalysis, FontInfo, ColorInfo, ImageInfo } from "../types";

export function analyzeLPDesign(): LPAnalysis {
  return {
    url: location.href,
    extractedAt: new Date().toISOString(),
    siteName: location.hostname,
    title: document.title.trim(),
    fonts: extractFonts(),
    colors: { palette: extractColors() },
    images: extractAllImages(),
  };
}

// ── Image extraction ─────────────────────────────────────────

function extractAllImages(): ImageInfo[] {
  const images: ImageInfo[] = [];
  const seenUrls = new Set<string>();

  // 1. <img> tags (including lazy-loaded)
  document.querySelectorAll("img").forEach((img) => {
    const src =
      img.src ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-lazy-src") ||
      img.getAttribute("data-original");
    if (!src || src.startsWith("data:") || seenUrls.has(src)) return;
    seenUrls.add(src);
    images.push({
      url: src,
      type: "img",
      alt: img.alt || "",
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    });
  });

  // 2. <source> inside <picture>
  document.querySelectorAll("picture source").forEach((source) => {
    const srcset = source.getAttribute("srcset");
    if (!srcset) return;
    // Parse first URL from srcset (ignore responsive descriptors)
    const url = srcset.split(",")[0].trim().split(/\s+/)[0];
    if (!url || url.startsWith("data:") || seenUrls.has(url)) return;
    seenUrls.add(url);
    images.push({
      url,
      type: "img",
      alt: "",
      width: 0,
      height: 0,
    });
  });

  // 3. CSS background-image on all visible elements
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    // Skip invisible elements
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const style = getComputedStyle(el);
    const bgImage = style.backgroundImage;
    if (!bgImage || bgImage === "none") return;

    // Parse all url() values (background-image can have multiple)
    const urlMatches = bgImage.matchAll(/url\(["']?([^"')]+)["']?\)/g);
    for (const match of urlMatches) {
      const url = match[1];
      if (!url || url.startsWith("data:") || seenUrls.has(url)) continue;
      seenUrls.add(url);
      const rect = el.getBoundingClientRect();
      images.push({
        url,
        type: "background",
        alt: "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  });

  return images;
}

// ── Font extraction ──────────────────────────────────────────

function extractFonts(): LPAnalysis["fonts"] {
  const fontMap = new Map<
    string,
    { family: string; count: number; weight: string; size: string; sampleText: string }
  >();

  // Scan text-bearing elements
  const textSelectors =
    "h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, div, label, button, dt, dd, figcaption";
  const textElements = document.querySelectorAll(textSelectors);

  textElements.forEach((el) => {
    // Only process elements with direct text content
    const hasDirectText = Array.from(el.childNodes).some(
      (n) =>
        n.nodeType === Node.TEXT_NODE &&
        (n.textContent?.trim() ?? "").length > 0
    );
    if (!hasDirectText) return;

    const text = el.textContent?.trim() ?? "";
    if (text.length === 0) return;

    const style = getComputedStyle(el);
    const family = style.fontFamily;
    const weight = style.fontWeight;
    const size = style.fontSize;

    const key = `${family}\0${weight}\0${size}`;
    const existing = fontMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      fontMap.set(key, {
        family,
        count: 1,
        weight,
        size,
        sampleText: text.slice(0, 50),
      });
    }
  });

  // Convert to sorted array
  const used: FontInfo[] = [];
  for (const [_key, val] of fontMap) {
    used.push({
      family: val.family,
      weight: val.weight,
      size: val.size,
      count: val.count,
      sampleText: val.sampleText,
    });
  }
  used.sort((a, b) => b.count - a.count);

  // Google Fonts URLs from <link> tags
  const googleFontsUrls: string[] = [];
  document
    .querySelectorAll(
      'link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]'
    )
    .forEach((link) => {
      const href = (link as HTMLLinkElement).href;
      if (href && !googleFontsUrls.includes(href)) {
        googleFontsUrls.push(href);
      }
    });

  // @font-face declarations from accessible stylesheets
  const fontFaceDeclarations: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSFontFaceRule) {
          fontFaceDeclarations.push(rule.cssText);
        }
      }
    } catch {
      // Cross-origin stylesheets throw SecurityError, skip
    }
  }

  return { used, googleFontsUrls, fontFaceDeclarations };
}

// ── Color extraction ─────────────────────────────────────────

function extractColors(): ColorInfo[] {
  const colorMap = new Map<
    string,
    { rgb: string; count: number; properties: Set<string> }
  >();

  const elements = document.querySelectorAll("body *");
  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    // Skip invisible elements
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const style = getComputedStyle(el);

    // Collect color properties
    const props: Array<{ name: string; value: string }> = [
      { name: "color", value: style.color },
      { name: "background-color", value: style.backgroundColor },
    ];

    // Collect all border colors, deduped per element
    const borderValues = new Set([
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
    ]);
    for (const value of borderValues) {
      if (value) props.push({ name: "border-color", value });
    }

    for (const prop of props) {
      if (!prop.value) continue;
      // Skip fully transparent
      if (
        prop.value === "rgba(0, 0, 0, 0)" ||
        prop.value === "transparent"
      )
        continue;

      const hex = rgbToHex(prop.value);
      if (!hex) continue;

      const existing = colorMap.get(hex);
      if (existing) {
        existing.count++;
        existing.properties.add(prop.name);
      } else {
        colorMap.set(hex, {
          rgb: prop.value,
          count: 1,
          properties: new Set([prop.name]),
        });
      }
    }
  });

  const palette: ColorInfo[] = [];
  for (const [hex, val] of colorMap) {
    palette.push({
      hex,
      rgb: val.rgb,
      property: Array.from(val.properties).join(", "),
      count: val.count,
    });
  }
  palette.sort((a, b) => b.count - a.count);

  return palette;
}

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
