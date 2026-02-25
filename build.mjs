import { build, context } from "esbuild";
import { cpSync, mkdirSync } from "fs";

const isWatch = process.argv.includes("--watch");

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
  console.log("Build complete.");
}
