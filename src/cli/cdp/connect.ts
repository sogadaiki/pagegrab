/**
 * CDP connection via agent-browser.
 * Resolves the WebSocket URL then attaches chrome-remote-interface to a target.
 *
 * Codex C2 fixes:
 * - Page.enable / Runtime.enable failure no longer leaks the CDP client
 * - Target.setDiscoverTargets enabled so targetDestroyed events fire
 * - _destroyed flag set on targetDestroyed to allow callers to detect stale clients
 */

import { spawnSync } from "node:child_process";
// chrome-remote-interface has no @types package; library-boundary any exception per spec.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import CDP from "chrome-remote-interface";
import { selectSolePageTarget, selectTargetByUrl } from "./target.js";
import type { CdpTarget } from "./target.js";

// ── Types ─────────────────────────────────────────────────────

// Minimal CDP client surface. any is the library-boundary exception (no @types).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CDPClient = any;

interface ConnectOptions {
  /** Explicit WebSocket URL (--ws flag or PAGEGRAB_CDP_URL env) */
  wsUrl?: string;
  /** Target page URL. If omitted, auto-selects the sole page target. */
  targetUrl?: string;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Resolve CDP browser WebSocket URL.
 * Priority: wsUrl arg → PAGEGRAB_CDP_URL env → `agent-browser get cdp-url`
 */
function resolveCdpBrowserUrl(wsUrl?: string): string {
  if (wsUrl) return wsUrl;

  const envUrl = process.env["PAGEGRAB_CDP_URL"];
  if (envUrl) return envUrl;

  // Spawn agent-browser with 3-second timeout
  const result = spawnSync("agent-browser", ["get", "cdp-url"], {
    encoding: "utf8",
    timeout: 3000,
  });

  if (result.error) {
    const msg =
      (result.error as NodeJS.ErrnoException).code === "ENOENT"
        ? "agent-browser not found in PATH. Install it or pass --ws <url>."
        : `Failed to run agent-browser: ${result.error.message}`;
    process.stderr.write(`ERROR: ${msg}\n`);
    process.exit(2);
  }

  if (result.status !== 0) {
    process.stderr.write(
      `ERROR: agent-browser get cdp-url failed (exit ${result.status}).\n` +
        `stderr: ${result.stderr.trim()}\n`
    );
    process.exit(2);
  }

  const url = result.stdout.trim();
  if (!url) {
    process.stderr.write("ERROR: agent-browser get cdp-url returned empty output.\n");
    process.exit(2);
  }
  return url;
}

/**
 * Parse host and port from a WebSocket URL like
 * ws://127.0.0.1:56705/devtools/browser/<uuid>
 */
function parseHostPort(wsUrl: string): { host: string; port: number } {
  let parsed: URL;
  try {
    parsed = new URL(wsUrl);
  } catch {
    process.stderr.write(`ERROR: Invalid CDP URL: ${wsUrl}\n`);
    process.exit(2);
  }
  const host = parsed.hostname;
  const port = parseInt(parsed.port, 10);
  if (isNaN(port)) {
    process.stderr.write(`ERROR: Cannot parse port from CDP URL: ${wsUrl}\n`);
    process.exit(2);
  }
  return { host, port };
}

// ── Main export ───────────────────────────────────────────────

/**
 * Connect to a CDP target.
 * Returns the chrome-remote-interface client attached to the chosen target.
 *
 * Codex C2 guarantees:
 * 1. If Page.enable / Runtime.enable throw, client.close() is called before
 *    re-throwing so no debugger session leaks.
 * 2. Target.setDiscoverTargets is enabled so targetDestroyed events fire.
 * 3. On targetDestroyed for our target, client._destroyed is set to true and
 *    client.close() is called. Callers can check client._destroyed to detect
 *    stale clients without needing an EventEmitter.
 */
export async function connectToTarget(options: ConnectOptions): Promise<CDPClient> {
  const browserWsUrl = resolveCdpBrowserUrl(options.wsUrl);
  const { host, port } = parseHostPort(browserWsUrl);

  // List all targets via /json/list
  let targets: CdpTarget[];
  try {
    targets = (await CDP.List({ host, port })) as CdpTarget[];
  } catch (err) {
    process.stderr.write(
      `ERROR: Failed to reach CDP at ws://${host}:${port} -- is agent-browser running?\n` +
        `  Detail: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(2);
  }

  // Select target
  let target: CdpTarget;
  try {
    target = options.targetUrl
      ? selectTargetByUrl(targets, options.targetUrl)
      : selectSolePageTarget(targets);
  } catch (err) {
    process.stderr.write(
      `ERROR: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }

  if (!target.webSocketDebuggerUrl) {
    process.stderr.write(
      `ERROR: Target "${target.url}" has no webSocketDebuggerUrl. ` +
        `It may not be inspectable.\n`
    );
    process.exit(2);
  }

  // Attach to target
  let client: CDPClient;
  try {
    client = await CDP({ target: target.webSocketDebuggerUrl });
  } catch (err) {
    process.stderr.write(
      `ERROR: Failed to attach to CDP target "${target.url}".\n` +
        `  Detail: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(2);
  }

  // C2: enable domains + targetDestroyed guard inside try/catch.
  // If any enable call fails, close the client immediately to prevent leaks.
  try {
    // Enable target discovery so targetDestroyed events fire (spec Step 4).
    await client.Target.setDiscoverTargets({ discover: true });

    // Register targetDestroyed handler (spec Step 4 race-condition guard).
    // Minimal implementation: set a _destroyed flag + close the client.
    // Callers check client._destroyed before issuing CDP commands.
    client.Target.targetDestroyed(
      (event: { targetId: string }) => {
        if (event.targetId === target.id) {
          client._destroyed = true;
          // Best-effort close; errors intentionally suppressed — the session
          // is already gone and we do not want to throw inside an event handler.
          void (client.close() as Promise<void>).catch(() => undefined);
        }
      }
    );

    await client.Page.enable();
    await client.Runtime.enable();
  } catch (err) {
    // C2: partial setup failed — close the client to avoid a leaked debugger
    // session. Errors from close() are suppressed so the original error surfaces.
    await (client.close() as Promise<void>).catch(() => undefined);
    throw err;
  }

  return client;
}
