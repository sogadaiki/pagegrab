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
  const imageDir = `pagegrab/images/${slug}`;

  // Download all images (both <img> and background-image)
  const imageMap = new Map<string, string>();
  const downloadPromises = data.images.map((img, index) => {
    const prefix = img.type === "background" ? "bg" : "img";
    const ext = guessImageExtension(img.url);
    const localFilename = `${imageDir}/${prefix}_${String(index + 1).padStart(3, "0")}.${ext}`;
    imageMap.set(img.url, localFilename);
    return downloadFile(img.url, localFilename);
  });

  await Promise.allSettled(downloadPromises);

  // Build analysis JSON with local paths
  const analysisWithLocalPaths = {
    ...data,
    images: data.images.map((img) => ({
      ...img,
      localPath: imageMap.get(img.url) ?? "",
    })),
  };

  // Save JSON
  const jsonFile = `pagegrab/analysis/${slug}.json`;
  const jsonContent = JSON.stringify(analysisWithLocalPaths, null, 2);
  await downloadTextFile(jsonContent, jsonFile, "application/json");

  // Save Markdown summary
  const mdFile = `pagegrab/analysis/${slug}.md`;
  const mdContent = buildAnalysisMarkdown(data, imageMap);
  await downloadTextFile(mdContent, mdFile, "text/markdown;charset=utf-8");

  return {
    jsonFile,
    imageCount: data.images.length,
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
      const localPath = toRelativeImagePath(imageMap.get(img.url) ?? "");
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
      const localPath = toRelativeImagePath(imageMap.get(img.url) ?? "");
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

  await Promise.allSettled([
    downloadTextFile(tokensCss, `${dir}/tokens.css`, "text/css;charset=utf-8"),
    downloadTextFile(tailwindConfig, `${dir}/tailwind.config.js`, "text/javascript;charset=utf-8"),
    downloadTextFile(layoutMd, `${dir}/layout.md`, "text/markdown;charset=utf-8"),
    downloadTextFile(tokensJson, `${dir}/tokens.json`, "application/json"),
  ]);

  return { dir, fileCount: 4 };
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
