import type { BunPlugin } from "bun";

/**
 * Bun plugin that transforms .ui.ts component files.
 *
 * Syntax sugar:
 *   1. `@tag("my-tag")` → auto customElements.define at end of file
 *   2. `@style(css\`...\`)` → static __style property on class
 *   3. `css\`...\`` → plain template string (enables IDE CSS highlighting)
 */
export const uiPlugin: BunPlugin = {
  name: "uinspy-ui",
  setup(build) {
    build.onLoad({ filter: /\.ui\.ts$/ }, async (args) => {
      const original = await Bun.file(args.path).text();
      let code = original;

      // Collect @tag mappings before removing decorators
      const defines: string[] = [];
      const tagRe = /@tag\(["']([^"']+)["']\)\s*/g;
      // Find class name that follows @tag (possibly with @style in between)
      const tagClassRe = /@tag\(["']([^"']+)["']\)[\s\S]*?(?:export\s+)?class\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = tagClassRe.exec(original)) !== null) {
        defines.push(`customElements.define("${m[1]}", ${m[2]});`);
      }

      // Remove @tag(...) decorators
      code = code.replace(tagRe, "");

      // Transform @style(css`...`) → static __style after class closing brace
      // Match @style(css`...`) followed by class declaration
      code = code.replace(
        /@style\(css(`[^`]*`)\)\s*((?:export\s+)?class\s+(\w+)[^{]*\{)/g,
        (_match, cssContent, classDecl, className) => {
          return `${classDecl}\n  static __style = ${cssContent};`;
        }
      );

      // css`` tagged template → plain template string
      code = code.replace(/\bcss`/g, "`");

      // Append customElements.define calls
      if (defines.length) {
        code += "\n" + defines.join("\n") + "\n";
      }

      return { contents: code, loader: "ts" };
    });
  },
};

export default uiPlugin;
