import { rm, mkdir } from "fs/promises";
import { uiPlugin, collectedCSS } from "./framework/plugin";
import { compile } from "@tailwindcss/node";
import { optimize } from "@tailwindcss/node";

const tmpDir = ".build_tmp";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");

const buildOpts = (minify: boolean | { whitespace: boolean; syntax: boolean; identifiers: boolean }, outdir: string) => ({
  entrypoints: ["./src/app.ts"],
  outdir,
  target: "browser" as const,
  minify,
  plugins: [uiPlugin],
});

// Clear collected CSS from previous runs
collectedCSS.length = 0;

const [min, full] = await Promise.all([
  Bun.build(buildOpts(true, `${tmpDir}/min`)),
  Bun.build(buildOpts({ whitespace: false, syntax: true, identifiers: false }, `${tmpDir}/full`)),
]);

if (!min.success || !full.success) {
  console.error("Build failed:", min.logs, full.logs);
  process.exit(1);
}

// Combine app.css + all component scoped CSS, process through Tailwind
const appCss = await Bun.file("./src/app.css").text();
const componentCss = [...new Set(collectedCSS)].join("\n");
const fullCssInput = appCss + "\n" + componentCss;

const compiler = await compile(fullCssInput, {
  base: process.cwd() + "/src",
  onDependency() {},
});
const cssFull = compiler.build([]);
const cssMin = optimize(cssFull, { minify: true }).code;

const jsMin = await Bun.file(`${tmpDir}/min/app.js`).text();
const jsFull = await Bun.file(`${tmpDir}/full/app.js`).text();

const favicon = await Bun.file("./public/favicon.svg").text();
const faviconB64 = Buffer.from(favicon).toString("base64");

const indexHtml = await Bun.file("./index.html").text();
const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*)<script\s+type="module"/);
const bodyAttrs = indexHtml.match(/<body([^>]*)>/)?.[1] ?? "";
const bodyContent = bodyMatch?.[1] ?? "";

const buildHtml = (js: string, css: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>uinspy</title>
<link rel="icon" href="data:image/svg+xml;base64,${faviconB64}"/>
<style>${css}</style>
</head>
<body${bodyAttrs}>
${bodyContent.trim()}
<script>${js}</script>
</body>
</html>`;

await Promise.all([
  Bun.write("dist/uinspy.html", buildHtml(jsFull, cssFull)),
  Bun.write("dist/uinspy.min.html", buildHtml(jsMin, cssMin)),
]);
await rm(tmpDir, { recursive: true, force: true });

const sizeF = (await Bun.file("dist/uinspy.html").text()).length;
const sizeM = (await Bun.file("dist/uinspy.min.html").text()).length;
console.log(`Build complete:
  dist/uinspy.html      ${(sizeF / 1024).toFixed(1)} KB (readable, git-friendly)
  dist/uinspy.min.html  ${(sizeM / 1024).toFixed(1)} KB (minified)`);
