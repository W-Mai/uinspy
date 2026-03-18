import type { BunPlugin } from "bun";
import { resolve, relative, dirname } from "path";

/**
 * Bun plugin that transforms .ui.ts component files.
 *
 * Source syntax (IDE-friendly, no imports needed):
 *   //@ component("my-tag")
 *   class MyComp extends BaseComponent {
 *     static __style = css`...`;
 *     render() { return el; }
 *   }
 *
 * Transforms:
 *   1. Auto-inject imports from framework/
 *   2. //@ component("tag") → customElements.define()
 *   3. css`...` → plain template string
 *   4. render() return → this.root.append()
 *   5. render() → protected render()
 */

const frameworkDir = resolve(import.meta.dir);

export const uiPlugin: BunPlugin = {
  name: "uinspy-ui",
  setup(build) {
    build.onLoad({ filter: /\.ui\.ts$/ }, async (args) => {
      const original = await Bun.file(args.path).text();
      let code = original;

      // 1. Collect //@ component("tag") → class name mappings
      const defines: string[] = [];
      const compRe = /\/\/@\s*component\(["']([^"']+)["']\)[\s\S]*?class\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = compRe.exec(original)) !== null) {
        defines.push(`customElements.define("${m[1]}", ${m[2]});`);
      }
      code = code.replace(/\/\/@\s*component\(["'][^"']+["']\)\s*\n/g, "");

      // 2. css`` → plain template string
      code = code.replace(/\bcss`/g, "`");

      // 3. render() return → this.root.append()
      code = code.replace(
        /\breturn\s+([^;]+);\s*\n(\s*)\}/g,
        "this.root.append($1);\n$2}"
      );

      // 4. Make render() protected
      code = code.replace(/^(\s+)render\(\)/gm, "$1protected render()");

      // 5. Compute relative path from component file to framework/
      const fileDir = dirname(args.path);
      let rel = relative(fileDir, frameworkDir).replace(/\\/g, "/");
      if (!rel.startsWith(".")) rel = "./" + rel;

      // Remove existing framework imports
      code = code.replace(/import\s*\{[^}]*BaseComponent[^}]*\}\s*from\s*["'][^"']+["'];?\s*\n?/g, "");
      code = code.replace(/import\s*\{[^}]*signal[^}]*\}\s*from\s*["'][^"']+["'];?\s*\n?/g, "");

      const imports = [`import { BaseComponent } from "${rel}/base";`];
      if (code.includes("signal(")) {
        imports.push(`import { signal } from "${rel}/signal";`);
      }
      code = imports.join("\n") + "\n" + code;

      // 6. Append customElements.define
      if (defines.length) {
        code += "\n" + defines.join("\n") + "\n";
      }

      return { contents: code, loader: "ts" };
    });
  },
};

export default uiPlugin;
