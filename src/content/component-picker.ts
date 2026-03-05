import type { ComponentExtraction, SaveComponentMessage } from "../types";

let pickerActive = false;
let overlay: HTMLDivElement | null = null;
let hoveredEl: Element | null = null;

export function activatePicker(): void {
  if (pickerActive) return;
  pickerActive = true;

  overlay = document.createElement("div");
  overlay.id = "pagegrab-picker-overlay";
  overlay.style.cssText = `
    position: fixed; pointer-events: none; z-index: 2147483647;
    border: 2px solid #059669; background: rgba(5, 150, 105, 0.1);
    transition: all 0.1s ease; display: none;
  `;
  document.body.appendChild(overlay);

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.id = "pagegrab-picker-tooltip";
  tooltip.style.cssText = `
    position: fixed; z-index: 2147483647; pointer-events: none;
    background: #111; color: #fff; font-size: 12px; font-family: monospace;
    padding: 4px 8px; border-radius: 4px; display: none; white-space: nowrap;
  `;
  document.body.appendChild(tooltip);

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
}

function onMouseMove(e: MouseEvent): void {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el.id === "pagegrab-picker-overlay" || el.id === "pagegrab-picker-tooltip") return;

  hoveredEl = el;
  const rect = el.getBoundingClientRect();

  if (overlay) {
    overlay.style.display = "block";
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  const tooltip = document.getElementById("pagegrab-picker-tooltip");
  if (tooltip) {
    tooltip.style.display = "block";
    tooltip.style.top = `${Math.max(0, rect.top - 28)}px`;
    tooltip.style.left = `${rect.left}px`;
    tooltip.textContent = buildSelectorLabel(el);
  }
}

function onClick(e: MouseEvent): void {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (!hoveredEl) return;
  const el = hoveredEl;

  deactivatePicker();
  extractComponent(el);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    deactivatePicker();
  }
}

function deactivatePicker(): void {
  pickerActive = false;
  hoveredEl = null;
  document.removeEventListener("mousemove", onMouseMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKeyDown, true);

  document.getElementById("pagegrab-picker-overlay")?.remove();
  document.getElementById("pagegrab-picker-tooltip")?.remove();
  overlay = null;
}

function extractComponent(el: Element): void {
  const rect = el.getBoundingClientRect();
  const selector = buildUniqueSelector(el);

  // Extract HTML
  const html = cleanHtml(el);

  // Extract computed CSS for the element and all descendants
  const css = extractComputedCss(el);

  const extraction: ComponentExtraction = {
    html,
    css,
    selector,
    boundingRect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };

  const saveMsg: SaveComponentMessage = {
    action: "save-component",
    data: { ...extraction, url: location.href },
  };
  chrome.runtime.sendMessage(saveMsg);
}

// ── HTML extraction ─────────────────────────────────────────

function cleanHtml(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  // Remove scripts, styles, iframes
  clone.querySelectorAll("script, style, iframe, noscript").forEach((n) => n.remove());
  // Remove data attributes (noise)
  cleanAttributes(clone);
  return formatHtml(clone.outerHTML);
}

function cleanAttributes(el: Element): void {
  const keepAttrs = new Set(["class", "id", "href", "src", "alt", "type", "placeholder", "aria-label", "role"]);
  for (const attr of Array.from(el.attributes)) {
    if (!keepAttrs.has(attr.name)) {
      el.removeAttribute(attr.name);
    }
  }
  for (const child of el.children) {
    cleanAttributes(child);
  }
}

function formatHtml(html: string): string {
  // Simple indentation
  let indent = 0;
  const lines: string[] = [];
  // Split on tags
  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);
  for (const token of tokens) {
    if (token.startsWith("</")) {
      indent = Math.max(0, indent - 1);
      lines.push("  ".repeat(indent) + token.trim());
    } else if (token.startsWith("<") && !token.endsWith("/>") && !token.startsWith("<!")) {
      lines.push("  ".repeat(indent) + token.trim());
      // Don't indent for void elements
      if (!/^<(img|br|hr|input|meta|link)\b/i.test(token)) {
        indent++;
      }
    } else {
      const text = token.trim();
      if (text) {
        lines.push("  ".repeat(indent) + text);
      }
    }
  }
  return lines.join("\n");
}

// ── CSS extraction ──────────────────────────────────────────

function extractComputedCss(root: Element): string {
  const elements = [root, ...root.querySelectorAll("*")];
  const rules: string[] = [];
  const processed = new Set<string>();

  for (const el of elements) {
    const selector = buildUniqueSelector(el, root);
    if (processed.has(selector)) continue;
    processed.add(selector);

    const styles = getRelevantStyles(el);
    if (styles.length === 0) continue;

    rules.push(`${selector} {\n${styles.map((s) => `  ${s};`).join("\n")}\n}`);
  }

  return rules.join("\n\n");
}

const RELEVANT_PROPERTIES = [
  "display", "position", "top", "right", "bottom", "left",
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "flex-direction", "flex-wrap", "justify-content", "align-items", "gap",
  "grid-template-columns", "grid-template-rows", "grid-gap",
  "font-family", "font-size", "font-weight", "line-height", "letter-spacing", "text-align", "text-decoration", "text-transform",
  "color", "background-color", "background-image", "background-size", "background-position",
  "border", "border-radius", "border-top", "border-right", "border-bottom", "border-left",
  "box-shadow", "opacity", "overflow", "z-index",
];

// Default values to skip
const DEFAULTS: Record<string, string[]> = {
  "display": ["inline"],
  "position": ["static"],
  "top": ["auto"], "right": ["auto"], "bottom": ["auto"], "left": ["auto"],
  "width": ["auto"], "height": ["auto"],
  "min-width": ["auto", "0px"], "max-width": ["none"],
  "min-height": ["auto", "0px"], "max-height": ["none"],
  "margin-top": ["0px"], "margin-right": ["0px"], "margin-bottom": ["0px"], "margin-left": ["0px"],
  "padding-top": ["0px"], "padding-right": ["0px"], "padding-bottom": ["0px"], "padding-left": ["0px"],
  "flex-direction": ["row"], "flex-wrap": ["nowrap"],
  "justify-content": ["normal", "flex-start"], "align-items": ["normal", "stretch"],
  "gap": ["normal", "0px"],
  "grid-template-columns": ["none"], "grid-template-rows": ["none"], "grid-gap": ["normal", "0px"],
  "font-weight": ["400", "normal"],
  "line-height": ["normal"],
  "letter-spacing": ["normal"],
  "text-align": ["start"], "text-decoration": ["none"], "text-transform": ["none"],
  "background-color": ["rgba(0, 0, 0, 0)", "transparent"],
  "background-image": ["none"],
  "background-size": ["auto"], "background-position": ["0% 0%"],
  "border": ["none"],
  "border-radius": ["0px"],
  "border-top": ["none"], "border-right": ["none"],
  "border-bottom": ["none"], "border-left": ["none"],
  "box-shadow": ["none"],
  "opacity": ["1"],
  "overflow": ["visible"],
  "z-index": ["auto"],
};

function getRelevantStyles(el: Element): string[] {
  const computed = getComputedStyle(el);
  const styles: string[] = [];

  for (const prop of RELEVANT_PROPERTIES) {
    const value = computed.getPropertyValue(prop);
    if (!value) continue;

    const defaults = DEFAULTS[prop];
    if (defaults && defaults.includes(value)) continue;

    // Skip border properties with 0px width (e.g. "0px none rgb(51, 51, 51)")
    if (prop.startsWith("border") && prop !== "border-radius" && /^0px\b/.test(value)) continue;

    styles.push(`${prop}: ${value}`);
  }

  return styles;
}

// ── Selector building ───────────────────────────────────────

function buildSelectorLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = el.className?.toString()
    ? "." + el.className.toString().trim().split(/\s+/).slice(0, 2).join(".")
    : "";
  return `${tag}${id}${cls}`;
}

function buildUniqueSelector(el: Element, root?: Element): string {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;
  const boundary = root?.parentElement ?? document.body;

  while (current && current !== boundary) {
    const tag = current.tagName.toLowerCase();
    const classes = current.className?.toString().trim();

    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }

    let part = tag;
    if (classes) {
      const firstClass = classes.split(/\s+/)[0];
      part = `${tag}.${firstClass}`;
    } else {
      // Add nth-child if no class/id
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          part = `${tag}:nth-child(${idx})`;
        }
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(" > ").slice(0, 200);
}
