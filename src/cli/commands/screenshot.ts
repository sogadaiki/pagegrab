/**
 * screenshot command: unwrap → stabilize → captureScreenshot → restore
 *
 * Codex C4: restore is always awaited in finally, regardless of errors.
 * Postcondition: window.__pagegrab_unwrapped === undefined after restore.
 *
 * Codex C1 (finally-throw mask prevention):
 * Primary errors from the capture phase are captured in `primaryError` so that
 * finally-block failures (restore / postcondition) can never replace them.
 * The original error always surfaces first.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateSlug } from "../../types.js";
import { UNWRAP_IIFE, RESTORE_IIFE, STABILIZE_IIFE } from "../injected/screenshot-unwrap.js";
import type { CDPClient } from "../cdp/connect.js";

const MAX_HEIGHT = 16384;
// Stabilize poll config
const STABILIZE_POLL_INTERVAL_MS = 100;
const STABILIZE_MAX_TRIES = 10;
const STABILIZE_FALLBACK_MS = 500;

// ── Internal helpers ──────────────────────────────────────────

interface LayoutMetrics {
  cssContentSize: { width: number; height: number };
}

async function getLayoutMetrics(client: CDPClient): Promise<{ width: number; height: number }> {
  const metrics = (await client.Page.getLayoutMetrics()) as LayoutMetrics;
  return metrics.cssContentSize;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for layout to stabilize after unwrap.
 *
 * 1. Runs rAF×2 in-page (STABILIZE_IIFE with awaitPromise:true)
 * 2. Polls getLayoutMetrics up to 10 times at 100ms intervals, looking for
 *    2 consecutive identical cssContentSize readings.
 * 3. Falls back to 500ms wait if no stable point reached.
 */
async function stabilizeLayout(client: CDPClient): Promise<void> {
  // rAF x2
  await client.Runtime.evaluate({
    expression: STABILIZE_IIFE,
    awaitPromise: true,
    timeout: 5000,
  });

  let prev: { width: number; height: number } | null = null;
  for (let i = 0; i < STABILIZE_MAX_TRIES; i++) {
    await sleep(STABILIZE_POLL_INTERVAL_MS);
    const cur = await getLayoutMetrics(client);
    if (prev && prev.width === cur.width && prev.height === cur.height) {
      return; // stable
    }
    prev = cur;
  }
  // Fallback: fixed wait
  await sleep(STABILIZE_FALLBACK_MS);
}

// ── Main export ───────────────────────────────────────────────

/**
 * Take a full-page screenshot of the current CDP target.
 *
 * @param client  - Connected CDPClient (Page + Runtime already enabled)
 * @param pageUrl - URL of the page (used for slug filename)
 * @param outDir  - Base output directory (e.g. /tmp/pg-test)
 */
export async function screenshot(
  client: CDPClient,
  pageUrl: string,
  outDir: string
): Promise<string> {
  // Step 1: unwrap scroll containers + neutralize fixed/sticky
  await client.Runtime.evaluate({
    expression: UNWRAP_IIFE,
    awaitPromise: false,
    timeout: 10000,
  });

  // C1: capture primaryError explicitly so finally-block failures cannot mask it.
  // JavaScript semantics: a throw inside finally replaces any in-flight exception.
  // By catching the capture error here and re-throwing after finally, the original
  // error always surfaces regardless of what the restore/postcondition path does.
  let primaryError: Error | undefined;
  let screenshotData: string | undefined;

  try {
    // Step 2: stabilize layout (rAF×2 + getLayoutMetrics 2-consecutive-match)
    await stabilizeLayout(client);

    // Step 3: measure content size after unwrap
    const size = await getLayoutMetrics(client);
    const finalWidth = Math.ceil(size.width);
    const finalHeight = Math.min(Math.ceil(size.height), MAX_HEIGHT);

    // Step 4: capture screenshot with clip rect
    const result = (await client.Page.captureScreenshot({
      format: "png",
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: finalWidth,
        height: finalHeight,
        scale: 1,
      },
    })) as { data: string };

    screenshotData = result.data;
  } catch (err) {
    // Store capture error; do not throw yet — restore must still run (Codex C4).
    primaryError = err instanceof Error ? err : new Error(String(err));
  } finally {
    // Step 5 (Codex C4): restore MUST run even if capture failed.
    // External-boundary try/catch (CLAUDE.md): CDP may throw if the target was
    // destroyed between capture and restore. In that case `primaryError` already
    // holds the real cause, so we only warn — never replace the original error.
    try {
      await client.Runtime.evaluate({
        expression: RESTORE_IIFE,
        awaitPromise: false,
        timeout: 10000,
      });
    } catch (restoreErr) {
      if (!primaryError) {
        // Restore itself is the primary failure — surface it.
        process.stderr.write(
          `WARNING: Failed to restore page styles: ${restoreErr instanceof Error ? restoreErr.message : String(restoreErr)}\n`
        );
      }
      // If primaryError is set, restore threw because the target is already gone;
      // suppress to avoid masking the original capture error.
    }

    // Step 6: postcondition — window.__pagegrab_unwrapped must be undefined.
    // Only checked on the success path (primaryError absent). If the capture
    // failed, the target may be gone and evaluate() would throw; checking here
    // would mask the real error (C1 fix).
    if (!primaryError) {
      try {
        const check = (await client.Runtime.evaluate({
          expression: "typeof window.__pagegrab_unwrapped",
          awaitPromise: false,
          timeout: 5000,
        })) as { result: { value: unknown } };
        if (check.result.value !== "undefined") {
          primaryError = new Error(
            "postcondition failed: window.__pagegrab_unwrapped still defined after restore"
          );
        }
      } catch (postErr) {
        // postcondition evaluate failed — treat as primary error (fail fast,
        // CLAUDE.md: フォールバック禁止).
        primaryError = postErr instanceof Error ? postErr : new Error(String(postErr));
      }
    }
  }

  // Re-throw original error after finally has safely completed restore.
  if (primaryError) throw primaryError;

  // Explicit guard: screenshotData is undefined only if the try block threw
  // (which is already handled above), but TypeScript needs the narrowing.
  if (screenshotData === undefined) {
    throw new Error("Screenshot data missing — captureScreenshot did not return data");
  }

  // Step 7: write PNG to disk
  const slug = generateSlug(pageUrl);
  const screenshotsDir = join(outDir, "pagegrab", "screenshots");
  mkdirSync(screenshotsDir, { recursive: true });

  const outputPath = join(screenshotsDir, `${slug}.png`);
  const buffer = Buffer.from(screenshotData, "base64");
  writeFileSync(outputPath, buffer);

  return outputPath;
}
