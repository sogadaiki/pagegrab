import type { Message, LPAnalysis } from "../types";
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
