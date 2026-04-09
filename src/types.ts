// Messages between components
export type MessageAction =
  | "extract" | "save"
  | "analyze" | "save-analysis"
  | "design-system" | "save-design-system"
  | "pick-component" | "save-component"
  | "screenshot"
  | "status";

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

export interface DesignSystemMessage {
  action: "design-system";
}

export interface SaveDesignSystemMessage {
  action: "save-design-system";
  data: DesignSystemAnalysis;
}

export interface ScreenshotMessage {
  action: "screenshot";
  tabId: number;
  url: string;
}

export interface PickComponentMessage {
  action: "pick-component";
}

export interface SaveComponentMessage {
  action: "save-component";
  data: ComponentExtraction & { url: string };
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
  | DesignSystemMessage
  | SaveDesignSystemMessage
  | ScreenshotMessage
  | PickComponentMessage
  | SaveComponentMessage
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

// ── Design System types ──────────────────────────────────────

export interface SpacingToken {
  value: string;
  px: number;
  count: number;
  properties: string[];
}

export interface TypographyToken {
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  fontFamily: string;
  fontWeight: string;
  count: number;
  sampleText: string;
  element: string;
}

export interface ColorToken {
  hex: string;
  rgb: string;
  count: number;
  role: "primary" | "secondary" | "accent" | "neutral" | "background" | "border" | "text";
  properties: string[];
}

export interface LayoutInfo {
  type: "flex" | "grid" | "block";
  direction: string;
  wrap: string;
  gap: string;
  columns: string;
  rows: string;
  childCount: number;
  selector: string;
}

export interface BreakpointInfo {
  query: string;
  minWidth: number | null;
  maxWidth: number | null;
  ruleCount: number;
}

export interface SectionInfo {
  tag: string;
  role: string;
  pattern: "hero" | "features" | "cta" | "testimonials" | "pricing" | "faq" | "footer" | "header" | "nav" | "content" | "unknown";
  heading: string;
  depth: number;
  hasBackground: boolean;
  hasCta: boolean;
  estimatedHeight: number;
}

export interface CssCustomProperty {
  name: string;
  value: string;
  scope: string;
  count: number;
}

export interface BorderRadiusToken {
  value: string;
  px: number;
  count: number;
  contexts: string[];
}

export interface BoxShadowToken {
  value: string;
  count: number;
  contexts: string[];
}

export interface GradientToken {
  value: string;
  type: "linear" | "radial" | "conic";
  count: number;
  contexts: string[];
}

export interface TransitionToken {
  property: string;
  duration: string;
  timing: string;
  count: number;
}

export interface ContainerWidthToken {
  value: string;
  px: number;
  count: number;
  selectors: string[];
}

export interface ComponentExtraction {
  html: string;
  css: string;
  selector: string;
  boundingRect: { x: number; y: number; width: number; height: number };
}

export interface DesignSystemAnalysis {
  url: string;
  extractedAt: string;
  siteName: string;
  title: string;
  spacing: {
    scale: SpacingToken[];
    baseUnit: number;
  };
  typography: {
    scale: TypographyToken[];
    families: string[];
    googleFontsUrls: string[];
  };
  colors: {
    tokens: ColorToken[];
    backgrounds: ColorToken[];
    borders: ColorToken[];
    texts: ColorToken[];
  };
  layout: {
    patterns: LayoutInfo[];
    breakpoints: BreakpointInfo[];
    sections: SectionInfo[];
  };
  cssProperties: {
    customProperties: CssCustomProperty[];
    borderRadius: BorderRadiusToken[];
    boxShadows: BoxShadowToken[];
    gradients: GradientToken[];
    transitions: TransitionToken[];
    containerWidths: ContainerWidthToken[];
  };
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
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return path ? `${host}_${path}_${date}_${time}` : `${host}_${date}_${time}`;
}

export function generateFilename(url: string): string {
  return `pagegrab/text/${generateSlug(url)}.md`;
}

export function generateImageDir(url: string): string {
  return `pagegrab/images/${generateSlug(url)}`;
}
