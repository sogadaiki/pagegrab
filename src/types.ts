// Messages between components
export type MessageAction = "extract" | "save" | "status";

export interface ExtractMessage {
  action: "extract";
}

export interface SaveMessage {
  action: "save";
  data: ExtractedContent;
}

export interface StatusMessage {
  action: "status";
  status: "extracting" | "saving" | "done" | "error";
  message: string;
}

export type Message = ExtractMessage | SaveMessage | StatusMessage;

// Extracted content structure
export interface ExtractedContent {
  title: string;
  url: string;
  extractedAt: string;
  siteName: string;
  content: string;
  imageUrls: string[];
  metadata: ContentMetadata;
}

export interface ContentMetadata {
  author?: string;
  publishedAt?: string;
  description?: string;
  type?: "tweet" | "thread" | "x-article" | "generic";
}

// Generate slug from URL (shared between filename and image folder)
export function generateSlug(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.replace("www.", "");
  const path = parsed.pathname
    .replace(/^\//, "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  const date = new Date().toISOString().split("T")[0];
  return `${host}_${path}_${date}`;
}

export function generateFilename(url: string): string {
  return `pagegrab/text/${generateSlug(url)}.md`;
}

export function generateImageDir(url: string): string {
  return `pagegrab/images/${generateSlug(url)}`;
}
