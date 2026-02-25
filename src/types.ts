// Messages between components
export type MessageAction = "extract" | "save" | "analyze" | "save-analysis" | "status";

export interface ExtractMessage {
  action: "extract";
}

export interface AnalyzeMessage {
  action: "analyze";
}

export interface SaveMessage {
  action: "save";
  data: ExtractedContent;
}

export interface SaveAnalysisMessage {
  action: "save-analysis";
  data: LPAnalysis;
}

export interface StatusMessage {
  action: "status";
  status: "extracting" | "saving" | "analyzing" | "done" | "error";
  message: string;
}

export type Message =
  | ExtractMessage
  | AnalyzeMessage
  | SaveMessage
  | SaveAnalysisMessage
  | StatusMessage;

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

// LP Analysis types
export interface FontInfo {
  family: string;
  weight: string;
  size: string;
  count: number;
  sampleText: string;
}

export interface ColorInfo {
  hex: string;
  rgb: string;
  property: string;
  count: number;
}

export interface ImageInfo {
  url: string;
  type: "img" | "background";
  alt: string;
  width: number;
  height: number;
}

export interface LPAnalysis {
  url: string;
  extractedAt: string;
  siteName: string;
  title: string;
  fonts: {
    used: FontInfo[];
    googleFontsUrls: string[];
    fontFaceDeclarations: string[];
  };
  colors: {
    palette: ColorInfo[];
  };
  images: ImageInfo[];
}

// Generate slug from URL (shared between filename and image folder)
export function generateSlug(url: string): string {
  const parsed = new URL(url);
  const host = parsed.hostname.replace("www.", "");
  const path = parsed.pathname
    .replace(/^\//, "")
    .replace(/\//g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/_+$/, "")
    .slice(0, 80);
  const date = new Date().toISOString().split("T")[0];
  return path ? `${host}_${path}_${date}` : `${host}_${date}`;
}

export function generateFilename(url: string): string {
  return `pagegrab/text/${generateSlug(url)}.md`;
}

export function generateImageDir(url: string): string {
  return `pagegrab/images/${generateSlug(url)}`;
}
