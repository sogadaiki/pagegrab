import type { LayoutInfo, BreakpointInfo, SectionInfo, DesignSystemAnalysis } from "../types";

export function analyzeLayout(): DesignSystemAnalysis["layout"] {
  return {
    patterns: extractLayoutPatterns(),
    breakpoints: extractBreakpoints(),
    sections: extractSections(),
  };
}

// ── Layout pattern detection ────────────────────────────────

function extractLayoutPatterns(): LayoutInfo[] {
  const layouts: LayoutInfo[] = [];
  const elements = document.querySelectorAll("body *");

  elements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const style = getComputedStyle(el);
    const display = style.display;

    if (display === "flex" || display === "inline-flex") {
      layouts.push({
        type: "flex",
        direction: style.flexDirection,
        wrap: style.flexWrap,
        gap: style.gap,
        columns: "",
        rows: "",
        childCount: el.children.length,
        selector: buildSelector(el),
      });
    } else if (display === "grid" || display === "inline-grid") {
      layouts.push({
        type: "grid",
        direction: "",
        wrap: "",
        gap: style.gap,
        columns: style.gridTemplateColumns,
        rows: style.gridTemplateRows,
        childCount: el.children.length,
        selector: buildSelector(el),
      });
    }
  });

  // Deduplicate by structural similarity, keep most common patterns
  const grouped = new Map<string, { layout: LayoutInfo; count: number }>();
  for (const layout of layouts) {
    const key = `${layout.type}|${layout.direction}|${layout.wrap}|${layout.columns}|${layout.childCount}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
    } else {
      grouped.set(key, { layout, count: 1 });
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
    .map((g) => g.layout);
}

// ── Breakpoint extraction ───────────────────────────────────

function extractBreakpoints(): BreakpointInfo[] {
  const breakpointMap = new Map<string, { minWidth: number | null; maxWidth: number | null; ruleCount: number }>();

  for (const sheet of document.styleSheets) {
    try {
      extractBreakpointsFromRules(sheet.cssRules, breakpointMap);
    } catch {
      // Cross-origin stylesheets throw SecurityError
    }
  }

  const breakpoints: BreakpointInfo[] = [];
  for (const [query, info] of breakpointMap) {
    breakpoints.push({
      query,
      minWidth: info.minWidth,
      maxWidth: info.maxWidth,
      ruleCount: info.ruleCount,
    });
  }

  breakpoints.sort((a, b) => (a.minWidth ?? 0) - (b.minWidth ?? 0));
  return breakpoints;
}

function extractBreakpointsFromRules(
  rules: CSSRuleList,
  map: Map<string, { minWidth: number | null; maxWidth: number | null; ruleCount: number }>
): void {
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      const query = rule.conditionText;
      // Only collect width-based media queries
      if (!query.includes("width")) continue;

      const minMatch = query.match(/min-width:\s*([\d.]+)/);
      const maxMatch = query.match(/max-width:\s*([\d.]+)/);
      const minWidth = minMatch ? parseFloat(minMatch[1]) : null;
      const maxWidth = maxMatch ? parseFloat(maxMatch[1]) : null;

      const existing = map.get(query);
      if (existing) {
        existing.ruleCount += rule.cssRules.length;
      } else {
        map.set(query, { minWidth, maxWidth, ruleCount: rule.cssRules.length });
      }

      // Recurse into nested media queries
      extractBreakpointsFromRules(rule.cssRules, map);
    }
  }
}

// ── Section composition analysis ────────────────────────────

const SECTION_PATTERNS: Array<{
  pattern: SectionInfo["pattern"];
  signals: RegExp[];
}> = [
  {
    pattern: "hero",
    signals: [/hero/i, /banner/i, /jumbotron/i, /main-?visual/i, /key-?visual/i, /first-?view/i, /mv\b/i],
  },
  {
    pattern: "nav",
    signals: [/nav/i, /menu/i, /header.*nav/i, /navigation/i],
  },
  {
    pattern: "header",
    signals: [/header/i, /site-?header/i, /page-?header/i],
  },
  {
    pattern: "features",
    signals: [/feature/i, /benefit/i, /service/i, /advantage/i, /merit/i, /point/i, /tokuchou/i],
  },
  {
    pattern: "testimonials",
    signals: [/testimon/i, /review/i, /voice/i, /feedback/i, /koe/i, /case/i],
  },
  {
    pattern: "pricing",
    signals: [/pric/i, /plan/i, /cost/i, /ryoukin/i, /fee/i],
  },
  {
    pattern: "cta",
    signals: [/cta/i, /call-?to-?action/i, /contact/i, /signup/i, /register/i, /apply/i, /conversion/i, /cv\b/i],
  },
  {
    pattern: "faq",
    signals: [/faq/i, /question/i, /q-?and-?a/i, /qa\b/i],
  },
  {
    pattern: "footer",
    signals: [/footer/i, /site-?footer/i, /page-?footer/i],
  },
];

function extractSections(): SectionInfo[] {
  const sections: SectionInfo[] = [];

  // Scan top-level semantic elements and major divs
  const candidates = document.querySelectorAll(
    "header, nav, main, section, footer, [role='banner'], [role='main'], [role='contentinfo'], [role='navigation'], body > div, body > div > div"
  );

  candidates.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (htmlEl.offsetWidth === 0 && htmlEl.offsetHeight === 0) return;

    const rect = el.getBoundingClientRect();
    // Skip tiny elements
    if (rect.height < 50) return;

    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") ?? "";
    const id = el.id ?? "";
    const className = el.className?.toString() ?? "";
    const heading = el.querySelector("h1, h2, h3")?.textContent?.trim().slice(0, 80) ?? "";

    const style = getComputedStyle(el);
    const bgColor = style.backgroundColor;
    const bgImage = style.backgroundImage;
    const hasBackground =
      (bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") ||
      (bgImage !== "none");

    const hasCta = el.querySelector(
      'a[href*="contact"], a[href*="signup"], a[href*="register"], button, [role="button"], form, input[type="submit"]'
    ) !== null;

    const pattern = classifySection(tag, role, id, className, heading);

    sections.push({
      tag,
      role,
      pattern,
      heading,
      depth: getDepth(el),
      hasBackground,
      hasCta,
      estimatedHeight: Math.round(rect.height),
    });
  });

  // Deduplicate: if a parent and child both detected, prefer the more specific one
  return deduplicateSections(sections);
}

function classifySection(
  tag: string,
  role: string,
  id: string,
  className: string,
  heading: string
): SectionInfo["pattern"] {
  // Check tag/role first
  if (tag === "nav" || role === "navigation") return "nav";
  if (tag === "header" || role === "banner") return "header";
  if (tag === "footer" || role === "contentinfo") return "footer";

  // Check id, className, and heading against patterns
  const searchText = `${id} ${className} ${heading}`;
  for (const { pattern, signals } of SECTION_PATTERNS) {
    if (signals.some((re) => re.test(searchText))) {
      return pattern;
    }
  }

  return "content";
}

function getDepth(el: Element): number {
  let depth = 0;
  let current = el.parentElement;
  while (current && current !== document.body) {
    depth++;
    current = current.parentElement;
  }
  return depth;
}

function deduplicateSections(sections: SectionInfo[]): SectionInfo[] {
  // Sort by depth (deeper = more specific), then height (taller = more important)
  const sorted = [...sections].sort((a, b) => {
    if (a.depth !== b.depth) return b.depth - a.depth;
    return b.estimatedHeight - a.estimatedHeight;
  });

  const seen = new Set<string>();
  const result: SectionInfo[] = [];

  for (const section of sorted) {
    // Skip unknown/content patterns that overlap with classified ones
    const key = `${section.pattern}-${section.heading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(section);
  }

  return result;
}

// ── Utility ─────────────────────────────────────────────────

function buildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const classes = el.className?.toString()
    ? "." + el.className.toString().trim().split(/\s+/).slice(0, 2).join(".")
    : "";
  return `${tag}${id}${classes}`.slice(0, 120);
}
