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

mkdirSync("dist", { recursive: true });

cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup/popup.html", "dist/popup.html");
cpSync("icons", "dist/icons", { recursive: true });

if (isWatch) {
  const contexts = await Promise.all(
    entries.map((entry) => context({ ...commonOptions, ...entry }))
  );
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log("Watching for changes...");
} else {
  await Promise.all(
    entries.map((entry) => build({ ...commonOptions, ...entry }))
  );
  console.log(`Build complete. (v${pkg.version})`);
}
