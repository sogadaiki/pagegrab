import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "fs";

const isWatch = process.argv.includes("--watch");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
if (manifest.version !== pkg.version) {
  throw new Error(
    `Version mismatch: package.json=${pkg.version} manifest.json=${manifest.version}. ` +
    `Keep both in sync.`
  );
}

const commonOptions = {
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: false,
  minify: false,
};

const entries = [
  {
    entryPoints: ["src/background/service-worker.ts"],
    outfile: "dist/background.js",
  },
  {
    entryPoints: ["src/content/extractor.ts"],
    outfile: "dist/content.js",
  },
  {
    entryPoints: ["src/popup/popup.ts"],
    outfile: "dist/popup.js",
  },
];

// CLI entry — Node platform, ESM, externalize runtime deps
// tsconfig.cli.json / bin / engines.node は Slice 1b で整備
const cliEntry = {
  entryPoints: ["src/cli/index.ts"],
  outfile: "dist/cli/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["chrome-remote-interface"],
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: false,
  minify: false,
};

mkdirSync("dist", { recursive: true });

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
cpSync("icons", "dist/icons", { recursive: true });

// Extension entries inherit commonOptions; CLI entry carries its own full options
const extensionBuilds = entries.map((entry) => ({ ...commonOptions, ...entry }));

if (isWatch) {
  const contexts = await Promise.all(
    [...extensionBuilds, cliEntry].map((entry) => context(entry))
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching for changes...");
} else {
  await Promise.all(
    [...extensionBuilds, cliEntry].map((entry) => build(entry))
  );
  console.log(`Build complete. (v${pkg.version})`);
}
