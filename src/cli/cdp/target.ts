/**
 * Target selection logic for CDP connections.
 * Pure functions — no side effects, no I/O (unit-testable).
 *
 * Codex C3 fix: selectTargetByUrl now throws instead of returning null,
 * and each match stage enforces "exactly 1" — multiple matches are an error.
 */

export interface CdpTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

const CHROME_INTERNAL_PREFIXES = [
  "chrome://",
  "devtools://",
  "about:",
  "chrome-extension://",
];

function isUserPageTarget(target: CdpTarget): boolean {
  if (target.type !== "page") return false;
  return !CHROME_INTERNAL_PREFIXES.some((prefix) =>
    target.url.startsWith(prefix)
  );
}

// ── selectTargetByUrl ─────────────────────────────────────────

/**
 * Select a single target by URL hint (exact → path → host).
 *
 * Each stage enforces "exactly 1 match":
 *   - 0 matches at a stage → fall through to the next stage
 *   - 1 match             → return immediately
 *   - 2+ matches          → throw (ambiguous; user must be more specific)
 *
 * Throws if no stage yields a match.
 *
 * C3 change: previously returned null on no-match. Now always throws so callers
 * never silently pick the wrong tab.
 */
export function selectTargetByUrl(targets: CdpTarget[], urlHint: string): CdpTarget {
  const pages = targets.filter(isUserPageTarget);

  // Stage 1: Exact URL match
  const exactMatches = pages.filter((t) => t.url === urlHint);
  if (exactMatches.length === 1) return exactMatches[0]!;
  if (exactMatches.length > 1) {
    throw new Error(
      `Multiple tabs match exact URL "${urlHint}": ${exactMatches.map((t) => t.url).join(", ")}`
    );
  }

  // Parse the hint URL for path/host comparison
  let parsedHint: URL;
  try {
    parsedHint = new URL(urlHint);
  } catch {
    throw new Error(`No tab matches "${urlHint}" (invalid URL)`);
  }

  // Stage 2: Path partial match (same host, pathname prefix)
  const pathMatches = pages.filter((t) => {
    try {
      const tu = new URL(t.url);
      return (
        tu.host === parsedHint.host &&
        tu.pathname.startsWith(parsedHint.pathname)
      );
    } catch {
      return false;
    }
  });
  if (pathMatches.length === 1) return pathMatches[0]!;
  if (pathMatches.length > 1) {
    throw new Error(
      `Multiple tabs match path "${urlHint}": ${pathMatches.map((t) => t.url).join(", ")}. Pass a more specific URL.`
    );
  }

  // Stage 3: Host-only match
  const hostMatches = pages.filter((t) => {
    try {
      return new URL(t.url).host === parsedHint.host;
    } catch {
      return false;
    }
  });
  if (hostMatches.length === 1) return hostMatches[0]!;
  if (hostMatches.length > 1) {
    throw new Error(
      `Multiple tabs match host "${parsedHint.host}": ${hostMatches.map((t) => t.url).join(", ")}. Pass a more specific URL.`
    );
  }

  throw new Error(`No tab matches "${urlHint}"`);
}

// ── selectSolePageTarget ─────────────────────────────────────

/**
 * Select the sole user page target when no URL is specified.
 * Throws on 0 or 2+ matches (fail-fast per spec).
 */
export function selectSolePageTarget(targets: CdpTarget[]): CdpTarget {
  const pageTargets = targets.filter(isUserPageTarget);

  if (pageTargets.length === 0) {
    throw new Error("No page targets found. Is agent-browser running?");
  }

  if (pageTargets.length > 1) {
    const urls = pageTargets.map((t) => t.url).join(", ");
    throw new Error(
      `Multiple page targets; pass <url> explicitly: ${urls}`
    );
  }

  return pageTargets[0]!;
}
