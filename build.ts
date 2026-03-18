import { rm, mkdir } from "fs/promises";
import { uiPlugin } from "./framework/plugin";

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

// Build both minified and unminified versions
const [min, full] = await Promise.all([
  Bun.build(buildOpts(true, `${tmpDir}/min`)),
  Bun.build(buildOpts({ whitespace: false, syntax: true, identifiers: false }, `${tmpDir}/full`)),
]);

if (!min.success || !full.success) {
  console.error("Build failed:", min.logs, full.logs);
  process.exit(1);
}

const twCssMin = await Bun.file("./generated/app.min.css").text();
const twCssFull = await Bun.file("./generated/app.css").text();
const jsMin = await Bun.file(`${tmpDir}/min/app.js`).text();
const jsFull = await Bun.file(`${tmpDir}/full/app.js`).text();

// Bun bundler outputs imported CSS alongside JS
const bunCssMinFile = Bun.file(`${tmpDir}/min/app.css`);
const bunCssFullFile = Bun.file(`${tmpDir}/full/app.css`);
const bunCssMin = await bunCssMinFile.exists() ? await bunCssMinFile.text() : "";
const bunCssFull = await bunCssFullFile.exists() ? await bunCssFullFile.text() : "";

const cssMin = twCssMin + "\n" + bunCssMin;
const cssFull = twCssFull + "\n" + bunCssFull;
const favicon = await Bun.file("./public/favicon.svg").text();
const faviconB64 = Buffer.from(favicon).toString("base64");

// Read index.html as template, extract body content
const indexHtml = await Bun.file("./index.html").text();
const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*)<script\s+type="module"/);
const bodyAttrs = indexHtml.match(/<body([^>]*)>/)?.[1] ?? "";
const bodyContent = bodyMatch?.[1] ?? "";

function buildHtml(js: string, css: string) {
  return `<!doctype html>
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
}

await Bun.write("dist/uinspy.html", buildHtml(jsFull, cssFull));
await Bun.write("dist/uinspy.min.html", buildHtml(jsMin, cssMin));
await rm(`${tmpDir}/min`, { recursive: true, force: true });
await rm(`${tmpDir}/full`, { recursive: true, force: true });

const sizeF = (await Bun.file("dist/uinspy.html").text()).length;
const sizeM = (await Bun.file("dist/uinspy.min.html").text()).length;
console.log(`Build complete:
  dist/uinspy.html      ${(sizeF / 1024).toFixed(1)} KB (readable, git-friendly)
  dist/uinspy.min.html  ${(sizeM / 1024).toFixed(1)} KB (minified)`);
