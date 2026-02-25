import type { Message } from "../types";
import { generateFilename, generateImageDir } from "../types";

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
    const downloadsPath = getAbsolutePath(localPath);
    content = content.replaceAll(
      `](${remoteUrl})`,
      `](${downloadsPath})`
    );
  }

  // Append image reference section at the end
  if (imageMap.size > 0) {
    content += "\n\n---\n\n## Images (local paths)\n\n";
    for (const [_remoteUrl, localPath] of imageMap) {
      content += `- ${getAbsolutePath(localPath)}\n`;
    }
  }

  // Save markdown
  const mdFile = generateFilename(data.url);
  await downloadMarkdown(content, mdFile);

  return { mdFile, imageCount: imageMap.size };
}

function guessImageExtension(url: string): string {
  if (url.includes("format=png")) return "png";
  if (url.includes("format=gif")) return "gif";
  if (url.includes("format=webp")) return "webp";
  if (url.includes(".png")) return "png";
  if (url.includes(".gif")) return "gif";
  if (url.includes(".webp")) return "webp";
  return "jpg";
}

function getAbsolutePath(relativePath: string): string {
  // chrome.downloads saves relative to ~/Downloads/
  return `/Users/daiki12/Downloads/${relativePath}`;
}

function downloadFile(url: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: false,
        conflictAction: "uniquify",
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

async function downloadMarkdown(
  content: string,
  filename: string
): Promise<string> {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const dataUrl = await blobToDataUrl(blob);

  return new Promise((resolve, reject) => {
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
