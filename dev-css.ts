// Dev: generate CSS via Tailwind JS API, then start Bun dev server
import { compile } from "@tailwindcss/node";
import { optimize } from "@tailwindcss/node";
import { uiPlugin, collectedCSS } from "./framework/plugin";
import { mkdir } from "fs/promises";

// Run a dummy build to collect component CSS
collectedCSS.length = 0;
await Bun.build({
  entrypoints: ["./src/app.ts"],
  outdir: "/tmp/uinspy-dev-build",
  target: "browser",
  plugins: [uiPlugin],
});

// Compile all CSS through Tailwind
const appCss = await Bun.file("./src/app.css").text();
const fullInput = appCss + "\n" + [...new Set(collectedCSS)].join("\n");
const compiler = await compile(fullInput, {
  base: process.cwd() + "/src",
  onDependency() {},
});
const css = compiler.build([]);

await mkdir("generated", { recursive: true });
await Bun.write("generated/app.css", css);
console.log(`CSS generated: ${(css.length / 1024).toFixed(1)} KB`);
