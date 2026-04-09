import JSZip from "jszip";
import type { Message, LPAnalysis, DesignSystemAnalysis, ComponentExtraction } from "../types";
import { generateFilename, generateImageDir, generateSlug } from "../types";

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.action === "save") {
      saveExtraction(message.data)
        .then((result) => {
          chrome.runtime.sendMessage({
            action: "status",
            status: "done",
            message: `Saved: ${result.mdFile} + ${result.imageCount} images`,
          } satisfies Message);
          sendResponse({ success: true, filename: result.mdFile });
        })
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          chrome.runtime.sendMessage({
            action: "status",
            status: "error",
            message: errorMsg,
          } satisfies Message);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;
    }

    if (message.action === "save-design-system") {
      saveDesignSystem(message.data)
        .then((result) => {
          chrome.runtime.sendMessage({
            action: "status",
            status: "done",
            message: `Design System saved: ${result.dir} (${result.fileCount} files)`,
          } satisfies Message);
          sendResponse({ success: true, filename: result.dir });
        })
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          chrome.runtime.sendMessage({
            action: "status",
            status: "error",
            message: errorMsg,
          } satisfies Message);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;
    }

    if (message.action === "save-component") {
      saveComponent(message.data)
        .then((result) => {
          chrome.runtime.sendMessage({
            action: "status",
            status: "done",
            message: `Component saved: ${result.dir}`,
          } satisfies Message);
          sendResponse({ success: true, filename: result.dir });
        })
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          chrome.runtime.sendMessage({
            action: "status",
            status: "error",
            message: errorMsg,
          } satisfies Message);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;
    }

    if (message.action === "screenshot") {
      captureFullPage(message.tabId, message.url)
        .then((filename) => {
          chrome.runtime.sendMessage({
            action: "status",
            status: "done",
            message: `Screenshot saved: ${filename}`,
          } satisfies Message);
          sendResponse({ success: true, filename });
        })
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          chrome.runtime.sendMessage({
            action: "status",
            status: "error",
            message: errorMsg,
          } satisfies Message);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;
    }

    if (message.action === "save-analysis") {
      saveAnalysis(message.data)
        .then((result) => {
          chrome.runtime.sendMessage({
            action: "status",
            status: "done",
            message: `LP Analysis saved: ${result.jsonFile} (${result.imageCount} images, ${result.fontCount} fonts, ${result.colorCount} colors)`,
          } satisfies Message);
          sendResponse({ success: true, filename: result.jsonFile });
        })
        .catch((err) => {
          const errorMsg = err instanceof Error ? err.message : String(err);
          chrome.runtime.sendMessage({
            action: "status",
            status: "error",
            message: errorMsg,
          } satisfies Message);
          sendResponse({ success: false, error: errorMsg });
        });
      return true;
    }
  }
);

interface SaveResult {
  mdFile: string;
  imageCount: number;
}

async function saveExtraction(data: {
  content: string;
  url: string;
  imageUrls: string[];
}): Promise<SaveResult> {
  const imageDir = generateImageDir(data.url);
  const imageUrls = data.imageUrls ?? [];

  // Download images and build URL-to-local-path mapping
  const imageMap = new Map<string, string>();
  const downloadPromises = imageUrls.map((imgUrl, index) => {
    const ext = guessImageExtension(imgUrl);
    const localFilename = `${imageDir}/img_${String(index + 1).padStart(3, "0")}.${ext}`;
    imageMap.set(imgUrl, localFilename);
    return downloadFile(imgUrl, localFilename);
  });

  // Start image downloads (don't wait - they download in parallel)
  await Promise.allSettled(downloadPromises);

  // Replace remote image URLs with local paths in markdown
  let content = data.content;
  for (const [remoteUrl, localPath] of imageMap) {
    // Replace all occurrences of the remote URL with local path
    // Keep the remote URL as a comment for reference
    const relativePath = toRelativeImagePath(localPath);
    content = content.replaceAll(
      `](${remoteUrl})`,
      `](${relativePath})`
    );
  }

  // Append image reference section at the end
  if (imageMap.size > 0) {
    content += "\n\n---\n\n## Images (local paths)\n\n";
    for (const [_remoteUrl, localPath] of imageMap) {
      content += `- ${toRelativeImagePath(localPath)}\n`;
    }
  }

  // Save markdown
  const mdFile = generateFilename(data.url);
  await downloadTextFile(content, mdFile);

  return { mdFile, imageCount: imageMap.size };
}

// ── LP Analysis save ─────────────────────────────────────────

interface AnalysisSaveResult {
  jsonFile: string;
  imageCount: number;
  fontCount: number;
  colorCount: number;
}

async function saveAnalysis(data: LPAnalysis): Promise<AnalysisSaveResult> {
  const slug = generateSlug(data.url);
  const zip = new JSZip();

  // Fetch all images and add to ZIP
  const imageMap = new Map<string, string>();
  const fetchPromises = data.images.map(async (img, index) => {
    const prefix = img.type === "background" ? "bg" : "img";
    const ext = guessImageExtension(img.url);
    const filename = `${prefix}_${String(index + 1).padStart(3, "0")}.${ext}`;
    const zipPath = `images/${filename}`;
    imageMap.set(img.url, zipPath);

    try {
      const response = await fetch(img.url, {
        headers: { "Referer": data.url },
      });
      if (!response.ok) {
        console.warn(`[PageGrab] Image fetch failed (${response.status}): ${img.url}`);
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      zip.file(zipPath, arrayBuffer);
    } catch (err) {
      console.warn(`[PageGrab] Image fetch error: ${img.url}`, err);
    }
  });

  await Promise.allSettled(fetchPromises);

  // Build analysis JSON with local paths
  const analysisWithLocalPaths = {
    ...data,
    images: data.images.map((img) => ({
      ...img,
      localPath: imageMap.get(img.url) ?? "",
    })),
  };

  zip.file("analysis.json", JSON.stringify(analysisWithLocalPaths, null, 2));
  zip.file("analysis.md", buildAnalysisMarkdown(data, imageMap));

  // Generate ZIP and download as single file
  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipDataUrl = await blobToDataUrl(zipBlob);
  const zipFile = `pagegrab/analysis/${slug}.zip`;

  await new Promise<void>((resolve, reject) => {
    chrome.downloads.download(
      { url: zipDataUrl, filename: zipFile, saveAs: false, conflictAction: "overwrite" },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (downloadId === undefined) {
          reject(new Error("ZIP download failed"));
        } else {
          resolve();
        }
      }
    );
  });

  return {
    jsonFile: zipFile,
    imageCount: imageMap.size,
    fontCount: data.fonts.used.length,
    colorCount: data.colors.palette.length,
  };
}

function buildAnalysisMarkdown(
  data: LPAnalysis,
  imageMap: Map<string, string>
): string {
  const lines: string[] = [];

  lines.push("---");
  lines.push(`source: ${data.siteName}`);
  lines.push(`url: ${data.url}`);
  lines.push(`extracted_at: ${data.extractedAt}`);
  lines.push(`type: lp-analysis`);
  lines.push("---");
  lines.push("");
  lines.push(`# LP Analysis: ${data.title}`);
  lines.push("");

  // Fonts section
  lines.push("## Fonts");
  lines.push("");
  if (data.fonts.googleFontsUrls.length > 0) {
    lines.push("### Google Fonts");
    for (const url of data.fonts.googleFontsUrls) {
      lines.push(`- ${url}`);
    }
    lines.push("");
  }
  if (data.fonts.fontFaceDeclarations.length > 0) {
    lines.push("### @font-face Declarations");
    lines.push("```css");
    for (const decl of data.fonts.fontFaceDeclarations) {
      lines.push(decl);
    }
    lines.push("```");
    lines.push("");
  }
  lines.push("### Used Fonts (by frequency)");
  lines.push("");
  lines.push("| Font Family | Weight | Size | Count | Sample |");
  lines.push("|-------------|--------|------|-------|--------|");
  // Show top 20 fonts
  for (const font of data.fonts.used.slice(0, 20)) {
    const escapedFamily = font.family.replace(/\|/g, "\\|");
    const escapedSample = font.sampleText.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(
      `| ${escapedFamily} | ${font.weight} | ${font.size} | ${font.count} | ${escapedSample} |`
    );
  }
  lines.push("");

  // Colors section
  lines.push("## Color Palette");
  lines.push("");
  lines.push("| Color | Hex | RGB | Usage | Count |");
  lines.push("|-------|-----|-----|-------|-------|");
  // Show top 30 colors
  for (const color of data.colors.palette.slice(0, 30)) {
    lines.push(
      `| ${color.hex} | \`${color.hex}\` | \`${color.rgb}\` | ${color.property} | ${color.count} |`
    );
  }
  lines.push("");

  // Images section
  const imgTagImages = data.images.filter((i) => i.type === "img");
  const bgImages = data.images.filter((i) => i.type === "background");

  lines.push(`## Images (${data.images.length} total)`);
  lines.push("");

  if (imgTagImages.length > 0) {
    lines.push(`### <img> Tags (${imgTagImages.length})`);
    lines.push("");
    for (const img of imgTagImages) {
      const localPath = imageMap.get(img.url) ?? "";
      const dims = img.width && img.height ? ` (${img.width}x${img.height})` : "";
      const alt = img.alt ? ` - ${img.alt}` : "";
      lines.push(`- ![${img.alt || "image"}](${localPath})${dims}${alt}`);
    }
    lines.push("");
  }

  if (bgImages.length > 0) {
    lines.push(`### CSS Background Images (${bgImages.length})`);
    lines.push("");
    for (const img of bgImages) {
      const localPath = imageMap.get(img.url) ?? "";
      const dims = img.width && img.height ? ` (${img.width}x${img.height})` : "";
      lines.push(`- ![bg](${localPath})${dims}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Design System save ───────────────────────────────────────

interface DesignSystemSaveResult {
  dir: string;
  fileCount: number;
}

async function saveDesignSystem(data: DesignSystemAnalysis): Promise<DesignSystemSaveResult> {
  const slug = generateSlug(data.url);
  const dir = `pagegrab/design-system/${slug}`;

  const tokensCss = generateTokensCss(data);
  const tailwindConfig = generateTailwindConfig(data);
  const layoutMd = generateLayoutMarkdown(data);
  const tokensJson = JSON.stringify(data, null, 2);
  const designRef = generateDesignReference(data);

  await Promise.allSettled([
    downloadTextFile(tokensCss, `${dir}/tokens.css`, "text/css;charset=utf-8"),
    downloadTextFile(tailwindConfig, `${dir}/tailwind.config.js`, "text/javascript;charset=utf-8"),
    downloadTextFile(layoutMd, `${dir}/layout.md`, "text/markdown;charset=utf-8"),
    downloadTextFile(tokensJson, `${dir}/tokens.json`, "application/json"),
    downloadTextFile(designRef, `${dir}/DESIGN-REFERENCE.md`, "text/markdown;charset=utf-8"),
  ]);

  return { dir, fileCount: 5 };
}

function generateTokensCss(data: DesignSystemAnalysis): string {
  const lines: string[] = [];
  lines.push("/* Design System Tokens */");
  lines.push(`/* Source: ${data.url} */`);
  lines.push(`/* Extracted: ${data.extractedAt} */`);
  lines.push("");
  lines.push(":root {");

  // Spacing -- use px value as key to avoid collisions
  lines.push("  /* Spacing */");
  const base = data.spacing.baseUnit;
  lines.push(`  --spacing-base: ${base}px;`);
  const allSpacing = data.spacing.scale
    .filter((s) => s.count >= 3)
    .slice(0, 25);
  for (const token of allSpacing) {
    const label = token.px % base === 0 ? ` (${token.px / base} * base)` : "";
    lines.push(`  --spacing-${token.px}: ${token.px}px; /* ${token.count}x used${label} */`);
  }
  lines.push("");

  // Typography
  lines.push("  /* Typography */");
  const seenSizes = new Set<string>();
  const sortedTypo = [...data.typography.scale].sort(
    (a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize)
  );
  const sizeNames = ["5xl", "4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs"];
  let sizeIdx = 0;
  for (const token of sortedTypo) {
    if (seenSizes.has(token.fontSize) || sizeIdx >= sizeNames.length) continue;
    if (token.count < 2) continue;
    seenSizes.add(token.fontSize);
    const name = sizeNames[sizeIdx++];
    lines.push(`  --font-size-${name}: ${token.fontSize};`);
    if (token.lineHeight !== "normal") {
      lines.push(`  --line-height-${name}: ${token.lineHeight};`);
    }
  }
  lines.push("");

  // Font families
  const families = data.typography.families.slice(0, 5);
  const genericFonts = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
  if (families.length > 0) {
    const formatFamily = (f: string) => genericFonts.has(f.toLowerCase()) ? f : `"${f}"`;
    lines.push(`  --font-primary: ${formatFamily(families[0])}, sans-serif;`);
    if (families.length > 1) {
      lines.push(`  --font-secondary: ${formatFamily(families[1])}, sans-serif;`);
    }
  }
  lines.push("");

  // Colors
  lines.push("  /* Colors */");
  const primaryColors = data.colors.tokens.filter((c) => c.role === "primary").slice(0, 3);
  const accentColors = data.colors.tokens.filter((c) => c.role === "accent").slice(0, 3);
  const neutralColors = data.colors.tokens.filter((c) => c.role === "neutral" || c.role === "text").slice(0, 5);
  const bgColors = data.colors.tokens.filter((c) => c.role === "background").slice(0, 3);
  const borderColors = data.colors.tokens.filter((c) => c.role === "border").slice(0, 3);

  writeColorVars(lines, "primary", primaryColors);
  writeColorVars(lines, "accent", accentColors);
  writeColorVars(lines, "neutral", neutralColors);
  writeColorVars(lines, "bg", bgColors);
  writeColorVars(lines, "border", borderColors);
  lines.push("");

  // Source CSS Custom Properties
  if (data.cssProperties.customProperties.length > 0) {
    lines.push("  /* Source CSS Custom Properties */");
    for (const prop of data.cssProperties.customProperties.slice(0, 50)) {
      lines.push(`  ${prop.name}: ${prop.value}; /* ${prop.scope} — ${prop.count}x referenced */`);
    }
    lines.push("");
  }

  // Border Radius
  if (data.cssProperties.borderRadius.length > 0) {
    lines.push("  /* Border Radius */");
    const radiusSizeNames = ["sm", "md", "lg", "xl", "2xl", "full"];
    const sortedRadius = [...data.cssProperties.borderRadius].sort((a, b) => a.px - b.px);
    sortedRadius.slice(0, 6).forEach((token, i) => {
      const name = radiusSizeNames[i] ?? `r${i + 1}`;
      lines.push(`  --radius-${name}: ${token.value}; /* ${token.count}x used */`);
    });
    lines.push("");
  }

  // Box Shadow
  if (data.cssProperties.boxShadows.length > 0) {
    lines.push("  /* Box Shadows */");
    const shadowSizeNames = ["sm", "md", "lg", "xl", "2xl"];
    const sortedShadows = [...data.cssProperties.boxShadows].sort((a, b) => b.count - a.count);
    sortedShadows.slice(0, 5).forEach((token, i) => {
      const name = shadowSizeNames[i] ?? `s${i + 1}`;
      lines.push(`  --shadow-${name}: ${token.value}; /* ${token.count}x used */`);
    });
    lines.push("");
  }

  // Container Widths
  if (data.cssProperties.containerWidths.length > 0) {
    lines.push("  /* Container Widths */");
    const containerSizeNames = ["sm", "md", "lg", "xl", "2xl"];
    const sortedContainers = [...data.cssProperties.containerWidths].sort((a, b) => a.px - b.px);
    sortedContainers.slice(0, 5).forEach((token, i) => {
      const name = containerSizeNames[i] ?? `c${i + 1}`;
      lines.push(`  --container-${name}: ${token.value}; /* ${token.count}x used */`);
    });
    lines.push("");
  }

  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

function writeColorVars(lines: string[], prefix: string, colors: { hex: string; count: number }[]): void {
  colors.forEach((c, i) => {
    const suffix = colors.length > 1 ? `-${i + 1}` : "";
    lines.push(`  --color-${prefix}${suffix}: ${c.hex}; /* ${c.count}x used */`);
  });
}

function generateTailwindConfig(data: DesignSystemAnalysis): string {
  const base = data.spacing.baseUnit;

  // Spacing object
  const spacingEntries: string[] = [];
  const spacingSteps = data.spacing.scale
    .filter((s) => s.count >= 3)
    .slice(0, 25);
  for (const token of spacingSteps) {
    // Always use px value as key to avoid collisions between base-multiples and raw px
    spacingEntries.push(`      "${token.px}": "${token.px}px",`);
  }

  // Font size object
  const fontSizeEntries: string[] = [];
  const seenSizes = new Set<string>();
  const sizeNames = ["5xl", "4xl", "3xl", "2xl", "xl", "lg", "base", "sm", "xs"];
  let sizeIdx = 0;
  const sortedTypo = [...data.typography.scale].sort(
    (a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize)
  );
  for (const token of sortedTypo) {
    if (seenSizes.has(token.fontSize) || sizeIdx >= sizeNames.length) continue;
    if (token.count < 2) continue;
    seenSizes.add(token.fontSize);
    const name = sizeNames[sizeIdx++];
    const lh = token.lineHeight !== "normal" ? token.lineHeight : "1.5";
    fontSizeEntries.push(`      "${name}": ["${token.fontSize}", "${lh}"],`);
  }

  // Font family
  const familyEntries: string[] = [];
  const families = data.typography.families.slice(0, 3);
  if (families.length > 0) {
    familyEntries.push(`      primary: ["${families[0]}", "sans-serif"],`);
    if (families.length > 1) {
      familyEntries.push(`      secondary: ["${families[1]}", "sans-serif"],`);
    }
  }

  // Colors
  const colorEntries: string[] = [];
  const grouped = new Map<string, { hex: string; count: number }[]>();
  for (const token of data.colors.tokens.slice(0, 30)) {
    const arr = grouped.get(token.role) ?? [];
    arr.push(token);
    grouped.set(token.role, arr);
  }
  for (const [role, colors] of grouped) {
    if (colors.length === 1) {
      colorEntries.push(`      "${role}": "${colors[0].hex}",`);
    } else {
      colorEntries.push(`      "${role}": {`);
      colors.forEach((c, i) => {
        colorEntries.push(`        ${(i + 1) * 100}: "${c.hex}",`);
      });
      colorEntries.push("      },");
    }
  }

  // Border Radius entries
  const borderRadiusEntries: string[] = [];
  const radiusSizeNames = ["sm", "md", "lg", "xl", "2xl", "full"];
  const sortedRadius = [...data.cssProperties.borderRadius].sort((a, b) => a.px - b.px);
  sortedRadius.slice(0, 6).forEach((token, i) => {
    const name = radiusSizeNames[i] ?? `r${i + 1}`;
    borderRadiusEntries.push(`      "${name}": "${token.value}",`);
  });

  // Box Shadow entries
  const boxShadowEntries: string[] = [];
  const shadowSizeNames = ["sm", "md", "lg", "xl", "2xl"];
  const sortedShadows = [...data.cssProperties.boxShadows].sort((a, b) => b.count - a.count);
  sortedShadows.slice(0, 5).forEach((token, i) => {
    const name = shadowSizeNames[i] ?? `s${i + 1}`;
    boxShadowEntries.push(`      "${name}": "${token.value.replace(/"/g, "'")}",`);
  });

  // Max-width (container widths) entries
  const maxWidthEntries: string[] = [];
  const containerSizeNames = ["sm", "md", "lg", "xl", "2xl"];
  const sortedContainers = [...data.cssProperties.containerWidths].sort((a, b) => a.px - b.px);
  sortedContainers.slice(0, 5).forEach((token, i) => {
    const name = containerSizeNames[i] ?? `c${i + 1}`;
    maxWidthEntries.push(`      "${name}": "${token.value}",`);
  });

  return `/** @type {import('tailwindcss').Config} */
// Design System extracted from: ${data.url}
// Extracted: ${data.extractedAt}
export default {
  theme: {
    extend: {
      spacing: {
${spacingEntries.join("\n")}
      },
      fontSize: {
${fontSizeEntries.join("\n")}
      },
      fontFamily: {
${familyEntries.join("\n")}
      },
      colors: {
${colorEntries.join("\n")}
      },
      borderRadius: {
${borderRadiusEntries.join("\n")}
      },
      boxShadow: {
${boxShadowEntries.join("\n")}
      },
      maxWidth: {
${maxWidthEntries.join("\n")}
      },
    },
  },
};
`;
}

function generateLayoutMarkdown(data: DesignSystemAnalysis): string {
  const lines: string[] = [];
  lines.push(`# Layout Analysis: ${data.title}`);
  lines.push(`Source: ${data.url}`);
  lines.push(`Extracted: ${data.extractedAt}`);
  lines.push("");

  // Breakpoints
  if (data.layout.breakpoints.length > 0) {
    lines.push("## Breakpoints");
    lines.push("");
    lines.push("| Query | Min Width | Max Width | Rules |");
    lines.push("|-------|-----------|-----------|-------|");
    for (const bp of data.layout.breakpoints) {
      const min = bp.minWidth !== null ? `${bp.minWidth}px` : "-";
      const max = bp.maxWidth !== null ? `${bp.maxWidth}px` : "-";
      lines.push(`| \`${bp.query}\` | ${min} | ${max} | ${bp.ruleCount} |`);
    }
    lines.push("");
  }

  // Layout patterns
  if (data.layout.patterns.length > 0) {
    lines.push("## Layout Patterns");
    lines.push("");

    const flexPatterns = data.layout.patterns.filter((p) => p.type === "flex");
    const gridPatterns = data.layout.patterns.filter((p) => p.type === "grid");

    if (flexPatterns.length > 0) {
      lines.push("### Flexbox");
      lines.push("");
      lines.push("| Selector | Direction | Wrap | Gap | Children |");
      lines.push("|----------|-----------|------|-----|----------|");
      for (const p of flexPatterns.slice(0, 15)) {
        lines.push(`| \`${p.selector}\` | ${p.direction} | ${p.wrap} | ${p.gap} | ${p.childCount} |`);
      }
      lines.push("");
    }

    if (gridPatterns.length > 0) {
      lines.push("### Grid");
      lines.push("");
      lines.push("| Selector | Columns | Rows | Gap | Children |");
      lines.push("|----------|---------|------|-----|----------|");
      for (const p of gridPatterns.slice(0, 15)) {
        const cols = p.columns.length > 60 ? p.columns.slice(0, 57) + "..." : p.columns;
        lines.push(`| \`${p.selector}\` | \`${cols}\` | \`${p.rows}\` | ${p.gap} | ${p.childCount} |`);
      }
      lines.push("");
    }
  }

  // Section composition
  if (data.layout.sections.length > 0) {
    lines.push("## Page Sections");
    lines.push("");
    lines.push("| Pattern | Tag | Heading | Height | Has BG | Has CTA |");
    lines.push("|---------|-----|---------|--------|--------|---------|");
    for (const s of data.layout.sections) {
      lines.push(`| **${s.pattern}** | ${s.tag} | ${s.heading.slice(0, 40)} | ${s.estimatedHeight}px | ${s.hasBackground ? "Y" : "-"} | ${s.hasCta ? "Y" : "-"} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── DESIGN-REFERENCE.md generation ──────────────────────────

function generateDesignReference(data: DesignSystemAnalysis): string {
  const lines: string[] = [];

  lines.push(`# Design Reference: ${data.title}`);
  lines.push("");
  lines.push(`> Source: ${data.url}`);
  lines.push(`> Extracted: ${data.extractedAt}`);
  lines.push("");

  // Overview
  lines.push("## Overview");
  lines.push(`- **Mood**: ${inferMood(data)}`);
  lines.push(`- **Density**: ${inferDensity(data)}`);
  lines.push(`- **Key Patterns**: ${inferKeyPatterns(data)}`);
  lines.push("");

  // CSS Custom Properties
  if (data.cssProperties.customProperties.length > 0) {
    lines.push("## CSS Custom Properties");
    lines.push("");
    lines.push("```css");
    lines.push(":root {");
    for (const prop of data.cssProperties.customProperties.slice(0, 50)) {
      lines.push(`  ${prop.name}: ${prop.value};`);
    }
    lines.push("}");
    lines.push("```");
    lines.push("");
  }

  // Color Tokens
  if (data.colors.tokens.length > 0) {
    lines.push("## Color Tokens");
    lines.push("");
    lines.push("| Role | Hex | Count |");
    lines.push("|------|-----|-------|");
    for (const token of data.colors.tokens.slice(0, 20)) {
      lines.push(`| ${token.role} | \`${token.hex}\` | ${token.count} |`);
    }
    lines.push("");
  }

  // Typography Scale
  if (data.typography.scale.length > 0) {
    lines.push("## Typography Scale");
    lines.push("");
    lines.push("| Size | Line Height | Weight | Family | Sample |");
    lines.push("|------|-------------|--------|--------|--------|");
    for (const token of data.typography.scale.slice(0, 15)) {
      const family = token.fontFamily.split(",")[0].trim().replace(/["']/g, "");
      const sample = token.sampleText.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 40);
      lines.push(`| ${token.fontSize} | ${token.lineHeight} | ${token.fontWeight} | ${family} | ${sample} |`);
    }
    lines.push("");
  }

  // Spacing
  lines.push("## Spacing");
  lines.push(`- Base unit: ${data.spacing.baseUnit}px`);
  const spacingValues = data.spacing.scale.slice(0, 15).map((s) => s.value).join(", ");
  lines.push(`- Scale: ${spacingValues}`);
  lines.push("");

  // Container Widths
  if (data.cssProperties.containerWidths.length > 0) {
    lines.push("## Container Widths");
    lines.push("");
    lines.push("| Value | px | Count | Selectors |");
    lines.push("|-------|----|-------|-----------|");
    for (const token of data.cssProperties.containerWidths) {
      const selectors = token.selectors.slice(0, 3).join(", ");
      lines.push(`| ${token.value} | ${token.px} | ${token.count} | ${selectors} |`);
    }
    lines.push("");
  }

  // Border Radius
  if (data.cssProperties.borderRadius.length > 0) {
    lines.push("## Border Radius");
    lines.push("");
    lines.push("| Value | px | Count | Contexts |");
    lines.push("|-------|----|-------|----------|");
    for (const token of data.cssProperties.borderRadius) {
      const contexts = token.contexts.join(", ");
      lines.push(`| ${token.value} | ${token.px} | ${token.count} | ${contexts} |`);
    }
    lines.push("");
  }

  // Box Shadows
  if (data.cssProperties.boxShadows.length > 0) {
    lines.push("## Box Shadows");
    lines.push("");
    for (const token of data.cssProperties.boxShadows) {
      lines.push(`**Contexts**: ${token.contexts.join(", ")} — used ${token.count}x`);
      lines.push("");
      lines.push("```css");
      lines.push(`box-shadow: ${token.value};`);
      lines.push("```");
      lines.push("");
    }
  }

  // Gradients
  if (data.cssProperties.gradients.length > 0) {
    lines.push("## Gradients");
    lines.push("");
    for (const token of data.cssProperties.gradients) {
      lines.push(`**Type**: ${token.type} — Contexts: ${token.contexts.join(", ")} — used ${token.count}x`);
      lines.push("");
      lines.push("```css");
      lines.push(`background-image: ${token.value};`);
      lines.push("```");
      lines.push("");
    }
  }

  // Transitions
  if (data.cssProperties.transitions.length > 0) {
    lines.push("## Transitions");
    lines.push("");
    lines.push("| Property | Duration | Timing | Count |");
    lines.push("|----------|----------|--------|-------|");
    for (const token of data.cssProperties.transitions) {
      lines.push(`| ${token.property} | ${token.duration} | ${token.timing} | ${token.count} |`);
    }
    lines.push("");
  }

  // Layout
  lines.push("## Layout");
  lines.push("");

  if (data.layout.breakpoints.length > 0) {
    lines.push("### Breakpoints");
    lines.push("");
    lines.push("| Query | Min Width | Max Width | Rules |");
    lines.push("|-------|-----------|-----------|-------|");
    for (const bp of data.layout.breakpoints) {
      const min = bp.minWidth !== null ? `${bp.minWidth}px` : "-";
      const max = bp.maxWidth !== null ? `${bp.maxWidth}px` : "-";
      lines.push(`| \`${bp.query}\` | ${min} | ${max} | ${bp.ruleCount} |`);
    }
    lines.push("");
  }

  if (data.layout.sections.length > 0) {
    lines.push("### Section Composition");
    lines.push("");
    for (const s of data.layout.sections) {
      const heading = s.heading ? ` — "${s.heading.slice(0, 50)}"` : "";
      lines.push(`- **${s.pattern}** (${s.tag})${heading}`);
    }
    lines.push("");
  }

  if (data.layout.patterns.length > 0) {
    lines.push("### Layout Patterns");
    lines.push("");
    for (const p of data.layout.patterns.slice(0, 10)) {
      const detail = p.type === "flex"
        ? `flex ${p.direction} wrap:${p.wrap} gap:${p.gap} children:${p.childCount}`
        : `grid cols:${p.columns.slice(0, 40)} gap:${p.gap} children:${p.childCount}`;
      lines.push(`- \`${p.selector}\` — ${detail}`);
    }
    lines.push("");
  }

  // Tailwind Config
  lines.push("## Tailwind Config");
  lines.push("");
  lines.push("```js");
  lines.push(generateTailwindConfig(data));
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

function inferMood(data: DesignSystemAnalysis): string {
  const radii = data.cssProperties.borderRadius;
  if (radii.length === 0) return "Neutral";

  const avgPx = radii.reduce((sum, r) => sum + r.px * r.count, 0) /
    radii.reduce((sum, r) => sum + r.count, 0);

  let mood: string;
  if (avgPx <= 2) mood = "Sharp / Corporate";
  else if (avgPx <= 6) mood = "Balanced / Professional";
  else if (avgPx <= 12) mood = "Friendly / Approachable";
  else mood = "Playful / Rounded";

  const shadowCount = data.cssProperties.boxShadows.reduce((sum, s) => sum + s.count, 0);
  if (shadowCount > 10) mood += " + Layered (heavy shadow use)";

  return mood;
}

function inferDensity(data: DesignSystemAnalysis): string {
  const base = data.spacing.baseUnit;
  if (base <= 4) return "Dense";
  if (base <= 8) return "Standard";
  return "Spacious";
}

function inferKeyPatterns(data: DesignSystemAnalysis): string {
  const patterns: string[] = [];
  const sections = data.layout.sections;

  const hasHero = sections.some((s) => s.pattern === "hero");
  const hasCta = sections.some((s) => s.pattern === "cta");
  const hasFeatures = sections.some((s) => s.pattern === "features");
  const hasPricing = sections.some((s) => s.pattern === "pricing");
  const hasTestimonials = sections.some((s) => s.pattern === "testimonials");
  const hasFaq = sections.some((s) => s.pattern === "faq");

  if (hasHero) patterns.push("Hero section");
  if (hasFeatures) patterns.push("Feature showcase");
  if (hasPricing) patterns.push("Pricing table");
  if (hasTestimonials) patterns.push("Social proof");
  if (hasFaq) patterns.push("FAQ section");
  if (hasCta) patterns.push("Dedicated CTA");

  const gridPatterns = data.layout.patterns.filter((p) => p.type === "grid");
  if (gridPatterns.length > 0) patterns.push("Grid layouts");

  const hasCards = data.layout.patterns.some((p) => p.childCount >= 3 && p.type === "flex");
  if (hasCards) patterns.push("Card-based layout");

  return patterns.length > 0 ? patterns.join(", ") : "No clear pattern";
}

// ── Component save ───────────────────────────────────────────

interface ComponentSaveResult {
  dir: string;
}

async function saveComponent(data: ComponentExtraction & { url: string }): Promise<ComponentSaveResult> {
  const slug = generateSlug(data.url);
  const dir = `pagegrab/components/${slug}`;

  // Generate standalone HTML preview
  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Component: ${data.selector}</title>
<style>
${data.css}
</style>
</head>
<body>
${data.html}
</body>
</html>`;

  await Promise.allSettled([
    downloadTextFile(data.html, `${dir}/component.html`, "text/html;charset=utf-8"),
    downloadTextFile(data.css, `${dir}/component.css`, "text/css;charset=utf-8"),
    downloadTextFile(previewHtml, `${dir}/preview.html`, "text/html;charset=utf-8"),
    downloadTextFile(JSON.stringify(data, null, 2), `${dir}/component.json`, "application/json"),
  ]);

  return { dir };
}

// ── Full-page screenshot ─────────────────────────────────────

function debuggerSend(
  target: chrome.debugger.Debuggee,
  method: string,
  params?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve((result ?? {}) as Record<string, unknown>);
      }
    });
  });
}

async function captureFullPage(tabId: number, url: string): Promise<string> {
  const target: chrome.debugger.Debuggee = { tabId };

  // Attach debugger
  await new Promise<void>((resolve, reject) => {
    chrome.debugger.attach(target, "1.3", () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });

  try {
    // Cap height to prevent Chrome from crashing on extremely tall pages
    const maxHeight = 16384;

    // Detect and unwrap inner scroll containers, neutralize fixed/sticky elements,
    // and force html+body to be unconstrained so Page.getLayoutMetrics sees the full content
    await debuggerSend(target, "Runtime.evaluate", {
      expression: `(() => {
        // 1. Detect primary scroll container
        // scrollHeight - clientHeight が最大の要素を探す（閾値100px、幅がviewportの50%以上）
        let bestEl = null;
        let bestDelta = 100;
        document.querySelectorAll('*').forEach(el => {
          if (el === document.documentElement || el === document.body) return;
          const delta = el.scrollHeight - el.clientHeight;
          if (delta > bestDelta && el.clientWidth >= window.innerWidth * 0.5) {
            bestDelta = delta;
            bestEl = el;
          }
        });

        // 2. Unwrap scroll container + all ancestors up to body
        const unwrapped = [];
        if (bestEl) {
          let current = bestEl;
          while (current && current !== document.documentElement) {
            unwrapped.push({
              el: current,
              overflow: current.style.overflow,
              overflowX: current.style.overflowX,
              overflowY: current.style.overflowY,
              height: current.style.height,
              maxHeight: current.style.maxHeight,
              minHeight: current.style.minHeight,
            });
            current.style.setProperty('overflow', 'visible', 'important');
            current.style.setProperty('overflow-x', 'visible', 'important');
            current.style.setProperty('overflow-y', 'visible', 'important');
            current.style.setProperty('height', 'auto', 'important');
            current.style.setProperty('max-height', 'none', 'important');
            current = current.parentElement;
          }
        }

        // 3. Force html+body unconstrained
        const htmlOrig = {
          overflow: document.documentElement.style.overflow,
          height: document.documentElement.style.height,
        };
        const bodyOrig = {
          overflow: document.body.style.overflow,
          height: document.body.style.height,
        };
        document.documentElement.style.setProperty('overflow', 'visible', 'important');
        document.documentElement.style.setProperty('height', 'auto', 'important');
        document.body.style.setProperty('overflow', 'visible', 'important');
        document.body.style.setProperty('height', 'auto', 'important');

        // 4. Neutralize fixed/sticky elements
        const fixed = [];
        document.querySelectorAll('*').forEach(el => {
          const pos = getComputedStyle(el).position;
          if (pos === 'fixed' || pos === 'sticky') {
            fixed.push({ el, orig: el.style.position });
            el.style.setProperty('position', 'absolute', 'important');
          }
        });

        window.__pagegrab_unwrapped = unwrapped;
        window.__pagegrab_fixed = fixed;
        window.__pagegrab_html_orig = htmlOrig;
        window.__pagegrab_body_orig = bodyOrig;
      })()`,
    });

    // Delay for re-layout after style changes
    await new Promise((r) => setTimeout(r, 500));

    // Measure after unwrapping scroll containers so full content size is visible
    const metrics2 = await debuggerSend(target, "Page.getLayoutMetrics");
    const contentSize2 = metrics2.cssContentSize as { width: number; height: number };
    const finalWidth = Math.ceil(contentSize2.width);
    const finalHeight = Math.min(Math.ceil(contentSize2.height), maxHeight);

    // Capture with clip rect
    const screenshot = await debuggerSend(target, "Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: finalWidth,
        height: finalHeight,
        scale: 1,
      },
    });

    // Save the PNG
    const slug = generateSlug(url);
    const filename = `pagegrab/screenshots/${slug}.png`;
    const dataUrl = `data:image/png;base64,${screenshot.data as string}`;

    await new Promise<void>((resolve, reject) => {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename,
          saveAs: false,
          conflictAction: "uniquify",
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (downloadId === undefined) {
            reject(new Error("Screenshot download failed"));
          } else {
            resolve();
          }
        }
      );
    });

    return filename;
  } finally {
    // Restore original styles — must run even if screenshot or download failed
    await debuggerSend(target, "Runtime.evaluate", {
      expression: `(() => {
        if (window.__pagegrab_unwrapped) {
          for (const item of window.__pagegrab_unwrapped) {
            item.el.style.overflow = item.overflow;
            item.el.style.overflowX = item.overflowX;
            item.el.style.overflowY = item.overflowY;
            item.el.style.height = item.height;
            item.el.style.maxHeight = item.maxHeight;
            item.el.style.minHeight = item.minHeight;
          }
          delete window.__pagegrab_unwrapped;
        }
        if (window.__pagegrab_html_orig) {
          document.documentElement.style.overflow = window.__pagegrab_html_orig.overflow;
          document.documentElement.style.height = window.__pagegrab_html_orig.height;
          delete window.__pagegrab_html_orig;
        }
        if (window.__pagegrab_body_orig) {
          document.body.style.overflow = window.__pagegrab_body_orig.overflow;
          document.body.style.height = window.__pagegrab_body_orig.height;
          delete window.__pagegrab_body_orig;
        }
        if (window.__pagegrab_fixed) {
          window.__pagegrab_fixed.forEach(({ el, orig }) => {
            el.style.position = orig;
          });
          delete window.__pagegrab_fixed;
        }
      })()`,
    }).catch(() => {
      // Ignore restore errors — debugger may already be detached
    });
    // Always detach debugger
    chrome.debugger.detach(target, () => {
      // Ignore detach errors
    });
  }
}

// ── Shared utilities ─────────────────────────────────────────

function guessImageExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\.(png|gif|webp|svg|avif|jpe?g)$/i);
    if (match) return match[1].toLowerCase().replace("jpeg", "jpg");
  } catch {
    // invalid URL, fall through
  }
  if (url.includes("format=png")) return "png";
  if (url.includes("format=webp")) return "webp";
  if (url.includes("format=gif")) return "gif";
  return "jpg";
}

/**
 * Convert a Downloads-relative image path to a relative path
 * usable from markdown files in pagegrab/text/ or pagegrab/analysis/.
 *
 * e.g. "pagegrab/images/slug/img_001.jpg" → "../images/slug/img_001.jpg"
 */
function toRelativeImagePath(downloadPath: string): string {
  return downloadPath.replace(/^pagegrab\//, "../");
}

function downloadFile(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: false,
        conflictAction: "overwrite",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (downloadId === undefined) {
          reject(new Error(`Download failed for ${url}`));
          return;
        }
        resolve();
      }
    );
  });
}

async function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string = "text/markdown;charset=utf-8"
): Promise<string> {
  const blob = new Blob([content], { type: mimeType });
  const dataUrl = await blobToDataUrl(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename,
        saveAs: false,
        conflictAction: "overwrite",
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (downloadId === undefined) {
          reject(new Error("Download failed: no download ID returned"));
          return;
        }
        resolve(filename);
      }
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}
