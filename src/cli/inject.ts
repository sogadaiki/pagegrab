/**
 * Resolves pre-bundled injected IIFE scripts via import.meta.url.
 *
 * This ensures npm-link scenarios work correctly — the path is always
 * resolved relative to this file, never relative to CWD (Codex C2).
 *
 * NOTE: In Slice 1a, screenshot-unwrap IIFEs are inline string constants
 * (not files), so this helper is wired up for future Slice 3+ use when
 * design-system.iife.js and lp-analyze.iife.js exist as pre-bundled files.
 *
 * TODO(Slice 3): build.mjs で dist/cli/injected/*.iife.js を emit する設定を追加する。
 * 現状は Slice 1a で未使用のため bundle ファイルが存在しなくても動作する。
 */

import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

/**
 * Resolves a pre-bundled IIFE file relative to this module's directory.
 * The file must exist at `dist/cli/injected/<name>.iife.js` after build.
 *
 * @param name - The base name without extension, e.g. "design-system"
 * @returns The IIFE source as a UTF-8 string
 */
export function resolveInjectedBundle(name: string): string {
  const filePath = fileURLToPath(
    new URL(`./injected/${name}.iife.js`, import.meta.url)
  );
  return readFileSync(filePath, "utf8");
}
