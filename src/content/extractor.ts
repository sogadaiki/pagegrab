import type { ExtractedContent, Message, SaveMessage, SaveAnalysisMessage } from "../types";
import { analyzeLPDesign } from "./lp-analyzer";

// ── Site detection ──────────────────────────────────────────

function isXDomain(): boolean {
  const host = location.hostname;
  return host === "x.com" || host === "twitter.com";
}

function isXArticlePage(): boolean {
  return isXDomain() && /\/article\//.test(location.pathname);
}

function isXStatusPage(): boolean {
  return isXDomain() && /\/status\//.test(location.pathname);
}

// ── X(Twitter) extractors ───────────────────────────────────

/**
 * Extract the primary tweet/post on the current X status page.
 * Handles 3 cases:
 *   1. Regular tweet: text in data-testid="tweetText"
 *   2. Note/long-form post: text spread across div[dir="auto"] inside article
 *   3. Fallback: innerText of the main content area
 */
function extractXContent(): ExtractedContent {
  const primaryTweet = document.querySelector('article[data-testid="tweet"]');
  const userNameEl = primaryTweet?.querySelector('div[data-testid="User-Name"]');
  const timeEl = primaryTweet?.querySelector("time");
  const mainAuthor = userNameEl?.textContent?.trim() ?? "Unknown";
  const time = timeEl?.getAttribute("datetime") ?? "";

  // Strategy 1: Try tweetText (works for regular tweets)
  const tweetTextEl = primaryTweet?.querySelector(
    'div[data-testid="tweetText"]'
  );
  let bodyText = tweetTextEl ? domToMarkdown(tweetTextEl) : "";

  // Strategy 2: If tweetText is empty/short, this is likely a Note/long-form post.
  // Extract all visible text from the primary tweet's content area,
  // excluding navigation chrome (user-name, action buttons, etc.)
  if (bodyText.trim().length < 50 && primaryTweet) {
    bodyText = extractXNoteContent(primaryTweet);
  }

  // Strategy 3: If still insufficient, grab the entire main content area
  if (bodyText.trim().length < 50) {
    bodyText = extractXPageFallback();
  }

  // Collect images from the primary tweet
  const images = primaryTweet?.querySelectorAll(
    'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"]'
  );
  const imageUrls = images
    ? Array.from(images)
        .map((img) => (img as HTMLImageElement).src)
        .filter(
          (src) =>
            src &&
            !src.includes("emoji") &&
            !src.includes("profile_images") &&
            !src.includes("data:image/svg")
        )
        .filter((src, i, arr) => arr.indexOf(src) === i) // dedupe
    : [];

  // Collect reply tweets (for threads / replies section)
  const replyParts = extractXReplies(mainAuthor);

  // Detect if this is a Note (long post) vs regular tweet
  const isNote = bodyText.trim().length > 280;
  const type = replyParts.length > 0 ? "thread" : isNote ? "x-article" : "tweet";

  // Build title from document.title or first line of content
  const docTitle = document.title
    .replace(/^(\(\d+\)\s*)?/, "") // remove "(1) " notification prefix
    .replace(/\s*[/|]\s*X\s*$/, "") // remove "/ X" or "| X" suffix
    .trim();
  const title = docTitle || `${mainAuthor} ${type}`;

  // Assemble content
  let content = "";

  // Author + timestamp
  content += `**${mainAuthor}**`;
  if (time) content += ` - ${time}`;
  content += "\n\n";

  // Main body
  content += bodyText;

  // Images: only append if they weren't already embedded in the body text
  const hasInlineImages = bodyText.includes("![");
  if (!hasInlineImages && imageUrls.length > 0) {
    content += "\n\n" + imageUrls.map((u) => `![image](${u})`).join("\n");
  }

  // Replies
  if (replyParts.length > 0) {
    content += "\n\n---\n\n## Replies\n\n" + replyParts.join("\n\n---\n\n");
  }

  const frontmatter = [
    "---",
    `source: ${location.hostname}`,
    `type: ${type}`,
    `author: "${mainAuthor}"`,
    `url: ${location.href}`,
    `extracted_at: ${new Date().toISOString()}`,
    "---",
  ].join("\n");

  // Post-process: remove leaked X UI text lines
  const cleanedContent = cleanXUiLines(content);

  // Collect all image URLs from the final content
  const allImageUrls = collectImageUrls(cleanedContent);

  return {
    title,
    url: location.href,
    extractedAt: new Date().toISOString(),
    siteName: "X",
    content: frontmatter + "\n\n# " + title + "\n\n" + cleanedContent,
    imageUrls: allImageUrls,
    metadata: { author: mainAuthor, type },
  };
}

/**
 * Post-process filter: remove lines that are X UI artifacts.
 * This catches anything the DOM-level filters missed.
 */
function cleanXUiLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep blank lines
      if (isXUiText(trimmed)) return false;
      // Remove "ALT参照" prefix text (image accessibility UI)
      if (/^ALT\s*参照/.test(trimmed)) return false;
      // Remove timestamp + "関連性が高い" suffix
      if (/関連性が高い\s*$/.test(trimmed)) return false;
      // Remove "Replying to @user" lines
      if (/^(Replying to|返信先:?\s*)@/.test(trimmed)) return false;
      // Remove standalone @mentions (not part of content)
      if (/^@[\w]+$/.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

/** X UI text patterns to filter out from extracted content */
const X_UI_PATTERNS: RegExp[] = [
  // ── Japanese UI ──
  /^画像の説明を読む$/,
  /^関連性が高い$/,
  /^引用を表示$/,
  /^返信をさらに表示$/,
  /^このスレッドを表示$/,
  /^リプライをポスト$/,
  /^もっと見る$/,
  /^翻訳する$/,
  /^ALT$/,
  /^ポスト$/,
  /^リポスト$/,
  /^いいね$/,
  /^ブックマーク$/,
  /^共有$/,
  /^固定$/,
  /^フォロー$/,
  /^フォロー中$/,
  /^クリックして.*をフォロー$/,
  /^おすすめ$/,
  /^トレンド$/,
  /^返信$/,
  /^コピー$/,
  /^その他$/,
  /^通報する$/,
  /^ミュート$/,
  /^ブロック$/,
  /^興味がない$/,
  /^この会話をミュート$/,
  /^リストに追加\/削除$/,
  /^プロフィールを表示$/,
  /^ポストを埋め込む$/,
  /^ポストのアクティビティを表示$/,
  /^ポストのリンクをコピー$/,
  /^認証済みアカウント$/,
  /^表示回数$/,
  /^\d+件の(リプライ|引用|いいね|リポスト|ブックマーク|表示)$/,
  // ── English UI ──
  /^Verified account$/i,
  /^Show more$/i,
  /^Translate$/i,
  /^Quote$/i,
  /^Repost$/i,
  /^Like$/i,
  /^Bookmark$/i,
  /^Share$/i,
  /^Show this thread$/i,
  /^Read \d+ repl/i,
  /^Replying to$/i,
  /^Pinned$/i,
  /^Follow$/i,
  /^Following$/i,
  /^Click to Follow/i,
  /^Reply$/i,
  /^Copy link$/i,
  /^More$/i,
  /^Report$/i,
  /^Mute$/i,
  /^Block$/i,
  /^Not interested$/i,
  /^Mute this conversation$/i,
  /^Add\/remove .* from Lists$/i,
  /^View profile$/i,
  /^Embed post$/i,
  /^View post activity$/i,
  /^View post engagements$/i,
  /^Copy link to post$/i,
  /^Views$/i,
  /^\d+ views?$/i,
  // ── Engagement counts (standalone numbers) ──
  /^[\d,.]+[KMBkmb]?$/,
  /^\d+万$/,
];

function isXUiText(text: string): boolean {
  return X_UI_PATTERNS.some((pat) => pat.test(text));
}

/**
 * Extract Note/long-form post content from within a tweet article element.
 * X Notes render rich text in div[dir="auto"] elements and other containers
 * that are NOT inside data-testid="tweetText".
 */
function extractXNoteContent(articleEl: Element): string {
  // X renders Note content inside the tweet article.
  // We need to skip: user name area, action buttons, and engagement metrics.
  // The content area is typically between the user-name and the action bar.

  // Identify elements to exclude
  const excludeSelectors = [
    'div[data-testid="User-Name"]',
    '[role="group"]', // action buttons (like, retweet, etc.)
    '[role="button"]', // all buttons (follow, etc.)
    'div[data-testid="app-text-transition-container"]', // engagement counts
    'a[href*="/analytics"]',
    'div[data-testid="caret"]', // menu button
    '[data-testid="TextAltBadge"]', // ALT badge on images
    '[data-testid="socialContext"]', // "Pinned" indicator
    '[aria-label*="画像の説明"]', // image description button
    'button', // all button elements
  ];

  // Clone the article to avoid modifying the live DOM
  const clone = articleEl.cloneNode(true) as Element;

  // Remove excluded elements from the clone
  for (const sel of excludeSelectors) {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  }

  // Extract text from all div[dir="auto"] and span[dir="auto"] elements
  // which is how X renders rich text content
  const textNodes = clone.querySelectorAll(
    'div[dir="auto"], span[dir="auto"]'
  );

  if (textNodes.length > 0) {
    const parts: string[] = [];
    const seen = new Set<string>();

    textNodes.forEach((node) => {
      // Skip if this node is a child of another dir="auto" we already processed
      const parent = node.parentElement?.closest('[dir="auto"]');
      if (parent && clone.contains(parent)) return;

      const text = domToMarkdown(node);
      const trimmed = text.trim();
      if (trimmed && !seen.has(trimmed) && !isXUiText(trimmed)) {
        seen.add(trimmed);
        parts.push(trimmed);
      }
    });

    const result = parts.join("\n\n");
    if (result.length > 50) return result;
  }

  // Fallback: use the full article clone
  return domToMarkdown(clone);
}

/**
 * Final fallback: extract text from the main timeline/content area.
 * This grabs essentially everything visible on the page.
 */
function extractXPageFallback(): string {
  // X's main content is in [data-testid="primaryColumn"]
  const main =
    document.querySelector('[data-testid="primaryColumn"]') ??
    document.querySelector("main") ??
    document.querySelector('[role="main"]');

  const el = (main ?? document.body) as HTMLElement;
  const raw = el.innerText;

  return raw
    .split("\n")
    .map((line: string) => line.trim())
    .filter((line: string, i: number, arr: string[]) => {
      if (!line && i > 0 && !arr[i - 1]) return false;
      return true;
    })
    .join("\n")
    .slice(0, 50000);
}

/**
 * Extract reply tweets below the main post.
 * Returns an array of formatted reply strings.
 */
function extractXReplies(mainAuthor: string): string[] {
  const allTweets = document.querySelectorAll('article[data-testid="tweet"]');
  if (allTweets.length <= 1) return [];

  const replies: string[] = [];

  // Skip the first tweet (primary post), process the rest
  for (let i = 1; i < allTweets.length && i <= 20; i++) {
    const tweet = allTweets[i];
    const userNameEl = tweet.querySelector('div[data-testid="User-Name"]');
    const textEl = tweet.querySelector('div[data-testid="tweetText"]');
    const timeEl = tweet.querySelector("time");

    const userName = userNameEl?.textContent?.trim() ?? "Unknown";
    let text = textEl ? domToMarkdown(textEl) : "";

    // For reply Notes, also try broader extraction
    if (text.trim().length < 50) {
      text = extractXNoteContent(tweet);
    }

    const time = timeEl?.getAttribute("datetime") ?? "";

    if (!text.trim()) continue;

    let part = `**${userName}**`;
    if (time) part += ` - ${time}`;
    part += "\n\n" + text;

    replies.push(part);
  }

  return replies;
}

function extractXArticle(): ExtractedContent {
  // X Articles (x.com/user/articles/slug) render as rich text
  const articleBody =
    document.querySelector("article") ??
    document.querySelector('[data-testid="primaryColumn"]');

  const title =
    document.querySelector("h1")?.textContent?.trim() ??
    document.title
      .replace(/^(\(\d+\)\s*)?/, "")
      .replace(/\s*[/|]\s*X\s*$/, "")
      .trim();

  let content = "";
  if (articleBody) {
    content = extractXNoteContent(articleBody);
    if (content.trim().length < 50) {
      content = domToMarkdown(articleBody);
    }
  }
  if (content.trim().length < 50) {
    content = extractXPageFallback();
  }

  const authorEl = document.querySelector('div[data-testid="User-Name"]');
  const author = authorEl?.textContent?.trim() ?? "";

  const frontmatter = [
    "---",
    `source: ${location.hostname}`,
    `type: x-article`,
    `author: "${author}"`,
    `url: ${location.href}`,
    `extracted_at: ${new Date().toISOString()}`,
    "---",
  ].join("\n");

  const allImageUrls = collectImageUrls(content);

  return {
    title,
    url: location.href,
    extractedAt: new Date().toISOString(),
    siteName: "X",
    content: frontmatter + "\n\n# " + title + "\n\n" + content,
    imageUrls: allImageUrls,
    metadata: { author, type: "x-article" },
  };
}

// ── Generic extractor ───────────────────────────────────────

function extractGenericContent(): string {
  const root =
    document.querySelector("article") ??
    document.querySelector("main") ??
    document.querySelector('[role="main"]') ??
    document.body;

  return domToMarkdown(root);
}

function extractGeneric(): ExtractedContent {
  const title = document.title.trim();
  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content") ?? undefined;
  const author =
    document
      .querySelector('meta[name="author"]')
      ?.getAttribute("content") ?? undefined;
  const publishedAt =
    document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ??
    document.querySelector("time")?.getAttribute("datetime") ??
    undefined;

  const content = extractGenericContent();
  const siteName =
    document
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute("content") ?? location.hostname;

  const frontmatter = [
    "---",
    `source: ${location.hostname}`,
    `type: generic`,
    `url: ${location.href}`,
    `extracted_at: ${new Date().toISOString()}`,
    author ? `author: "${author}"` : null,
    publishedAt ? `published_at: ${publishedAt}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const allImageUrls = collectImageUrls(content);

  return {
    title,
    url: location.href,
    extractedAt: new Date().toISOString(),
    siteName,
    content: frontmatter + "\n\n# " + title + "\n\n" + content,
    imageUrls: allImageUrls,
    metadata: { author, publishedAt, description, type: "generic" },
  };
}

// ── DOM to Markdown conversion ──────────────────────────────

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "IFRAME",
  "VIDEO", "AUDIO", "CANVAS",
]);

const SKIP_SELECTORS = [
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
];

function shouldSkip(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  // Don't skip NAV/FOOTER/ASIDE inside articles (X uses these differently)
  if (isXDomain()) return SKIP_SELECTORS.some((sel) => el.matches(sel));
  // For generic sites, also skip nav/footer/aside
  if (["NAV", "FOOTER", "ASIDE"].includes(el.tagName)) return true;
  return SKIP_SELECTORS.some((sel) => el.matches(sel));
}

function domToMarkdown(root: Element): string {
  const lines: string[] = [];
  walkNode(root, lines, 0);
  return cleanMarkdown(lines.join(""));
}

function walkNode(node: Node, lines: string[], depth: number): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    if (text.trim()) {
      lines.push(text);
    }
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (shouldSkip(el)) return;

  const tag = el.tagName;

  // Headings
  if (/^H[1-6]$/.test(tag)) {
    const level = parseInt(tag[1]);
    lines.push("\n\n" + "#".repeat(level) + " ");
    walkChildren(el, lines, depth);
    lines.push("\n\n");
    return;
  }

  // Paragraph
  if (tag === "P") {
    lines.push("\n\n");
    walkChildren(el, lines, depth + 1);
    lines.push("\n\n");
    return;
  }

  // DIV: only add breaks if it looks like a paragraph
  // (has text content and is a leaf-ish container)
  if (tag === "DIV") {
    const hasDirectText = Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent?.trim() ?? "").length > 0
    );
    const hasBlockChildren = el.querySelector("div, p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre");
    // If div has direct text or is a leaf container, treat as paragraph
    if (hasDirectText && !hasBlockChildren) {
      lines.push("\n\n");
      walkChildren(el, lines, depth + 1);
      lines.push("\n\n");
    } else {
      walkChildren(el, lines, depth + 1);
    }
    return;
  }

  // SPAN: inline, just recurse
  if (tag === "SPAN") {
    walkChildren(el, lines, depth);
    return;
  }

  // Links
  if (tag === "A") {
    const href = (el as HTMLAnchorElement).href;
    const text = el.textContent?.trim() ?? "";
    // Skip X UI links (analytics, quotes, etc.)
    if (isXDomain() && (
      href.includes("/analytics") ||
      href.includes("/quotes") ||
      href.includes("/retweets") ||
      href.includes("/likes") ||
      isXUiText(text)
    )) {
      return;
    }
    if (href && text && !href.startsWith("javascript:")) {
      lines.push(`[${text}](${href})`);
    } else {
      walkChildren(el, lines, depth);
    }
    return;
  }

  // Images
  if (tag === "IMG") {
    const src = (el as HTMLImageElement).src;
    const alt = (el as HTMLImageElement).alt || "image";
    if (
      src &&
      !src.includes("emoji") &&
      !src.includes("data:image/svg") &&
      !src.includes("profile_images")
    ) {
      lines.push(`\n\n![${alt}](${src})\n\n`);
    }
    return;
  }

  // Bold/Strong
  if (tag === "STRONG" || tag === "B") {
    lines.push("**");
    walkChildren(el, lines, depth);
    lines.push("**");
    return;
  }

  // Italic/Emphasis
  if (tag === "EM" || tag === "I") {
    lines.push("*");
    walkChildren(el, lines, depth);
    lines.push("*");
    return;
  }

  // Code
  if (tag === "CODE") {
    const isBlock = el.parentElement?.tagName === "PRE";
    if (isBlock) return;
    lines.push("`");
    lines.push(el.textContent ?? "");
    lines.push("`");
    return;
  }

  // Pre/Code block
  if (tag === "PRE") {
    const code = el.querySelector("code")?.textContent ?? el.textContent ?? "";
    lines.push("\n\n```\n" + code.trim() + "\n```\n\n");
    return;
  }

  // Blockquote
  if (tag === "BLOCKQUOTE") {
    const inner: string[] = [];
    walkChildren(el, inner, depth);
    const text = cleanMarkdown(inner.join(""));
    lines.push("\n\n> " + text.replace(/\n/g, "\n> ") + "\n\n");
    return;
  }

  // Lists
  if (tag === "UL" || tag === "OL") {
    lines.push("\n\n");
    let index = 1;
    el.querySelectorAll(":scope > li").forEach((li) => {
      const prefix = tag === "OL" ? `${index++}. ` : "- ";
      const inner: string[] = [];
      walkChildren(li, inner, depth + 1);
      lines.push(prefix + cleanMarkdown(inner.join("")).trim() + "\n");
    });
    lines.push("\n");
    return;
  }

  // Line break
  if (tag === "BR") {
    lines.push("\n");
    return;
  }

  // Horizontal rule
  if (tag === "HR") {
    lines.push("\n\n---\n\n");
    return;
  }

  // Default: recurse
  walkChildren(el, lines, depth);
}

function walkChildren(el: Element, lines: string[], depth: number): void {
  el.childNodes.forEach((child) => walkNode(child, lines, depth));
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .replace(/ +/g, " ");
}

/** Extract all image URLs from markdown content */
function collectImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  const regex = /!\[.*?\]\((https?:\/\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const url = match[1];
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

// ── Entry point: message listener ───────────────────────────

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.action === "extract") {
      try {
        let result: ExtractedContent;

        if (isXArticlePage()) {
          result = extractXArticle();
        } else if (isXDomain()) {
          result = extractXContent();
        } else {
          result = extractGeneric();
        }

        const saveMessage: SaveMessage = { action: "save", data: result };
        chrome.runtime.sendMessage(saveMessage);

        sendResponse({ success: true, title: result.title });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      }
      return true;
    }

    if (message.action === "analyze") {
      try {
        const analysis = analyzeLPDesign();
        const saveMsg: SaveAnalysisMessage = { action: "save-analysis", data: analysis };
        chrome.runtime.sendMessage(saveMsg);
        sendResponse({
          success: true,
          title: `LP Analysis: ${analysis.images.length} images, ${analysis.fonts.used.length} fonts, ${analysis.colors.palette.length} colors`,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      }
      return true;
    }
  }
);
