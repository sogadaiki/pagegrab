/**
 * pagegrab CLI — Slice 1a entry point
 * shebang is added by esbuild banner in build.mjs
 *
 * Usage:
 *   node dist/cli/index.js screenshot [<url>] [-o <outDir>] [--ws <cdpUrl>]
 *
 * Exit codes:
 *   0 — success
 *   1 — argument error / target selection error
 *   2 — CDP connection failure
 *   3 — runtime failure (captureScreenshot etc.)
 */

import { connectToTarget } from "./cdp/connect.js";
import { screenshot } from "./commands/screenshot.js";

// ── argv parser ───────────────────────────────────────────────

interface ParsedArgs {
  command: string;
  url?: string;
  outDir: string;
  wsUrl?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // strip node + script path

  if (args.length === 0) {
    process.stderr.write("Usage: pagegrab <command> [options]\n");
    process.stderr.write("Commands: screenshot\n");
    process.exit(1);
  }

  const command = args[0]!;
  let url: string | undefined;
  let outDir = ".";
  let wsUrl: string | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "-o" || arg === "--output") {
      const next = args[++i];
      if (!next) {
        process.stderr.write(`ERROR: ${arg} requires a value\n`);
        process.exit(1);
      }
      outDir = next;
    } else if (arg === "--ws") {
      const next = args[++i];
      if (!next) {
        process.stderr.write("ERROR: --ws requires a value\n");
        process.exit(1);
      }
      wsUrl = next;
    } else if (!arg.startsWith("-")) {
      url = arg;
    } else {
      process.stderr.write(`ERROR: Unknown option: ${arg}\n`);
      process.exit(1);
    }
  }

  return { command, url, outDir, wsUrl };
}

// ── main ──────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { command, url, outDir, wsUrl } = parseArgs(process.argv);

  if (command === "screenshot") {
    let client;
    try {
      client = await connectToTarget({ wsUrl, targetUrl: url });
    } catch {
      // connectToTarget exits with process.exit(2) on CDP errors
      // This catch is a safety net for unexpected throws
      process.exit(2);
    }

    try {
      // Determine which URL to use for slug generation
      // If no url was specified, read the actual page URL from CDP
      let pageUrl = url;
      if (!pageUrl) {
        const result = (await client.Runtime.evaluate({
          expression: "window.location.href",
          awaitPromise: false,
          timeout: 5000,
        })) as { result: { value: string } };
        pageUrl = result.result.value;
      }

      const outputPath = await screenshot(client, pageUrl, outDir);
      process.stdout.write(`Screenshot saved: ${outputPath}\n`);
    } catch (err) {
      process.stderr.write(
        `ERROR: Screenshot failed: ${err instanceof Error ? err.message : String(err)}\n`
      );
      process.exit(3);
    } finally {
      try {
        await client.close();
      } catch {
        // ignore close errors
      }
    }
  } else {
    process.stderr.write(`ERROR: Unknown command: ${command}\n`);
    process.stderr.write("Available commands: screenshot\n");
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(
    `FATAL: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(3);
});
