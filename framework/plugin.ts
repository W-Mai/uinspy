import type { BunPlugin } from "bun";
import { resolve, relative, dirname } from "path";

/**
 * Bun plugin that transforms .ui.ts component files.
 *
 * Transforms:
 *   1. Auto-inject imports from framework/
 *   2. //@ component("tag") → customElements.define()
 *   3. css`...` → plain template string
 *   4. this.html`<tag attr="v">...${expr}...</tag>` → compiled DOM creation
 *   5. render() → protected render()
 */

const frameworkDir = resolve(import.meta.dir);

function compileAttrs(attrsStr: string): string {
  if (!attrsStr.trim()) return "";
  const attrRe = /([\w-]+)="([^"]*)"/g;
  let code = "";
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(attrsStr)) !== null) {
    code += `_e.setAttribute("${m[1]}", "${m[2]}"); `;
  }
  return code;
}

/**
 * Compile this.html`<tag attrs>...children...</tag>` to DOM operations.
 * Handles ${expr} in children by splitting into static/dynamic parts.
 *
 * Input (raw template literal source including ${} syntax):
 *   this.html`<button class="x">Count is ${this.count.val}</button>`
 *
 * Output:
 *   (() => { const _e = document.createElement("button"); _e.setAttribute("class", "x"); _e.append("Count is ", this.count.val); return _e; })()
 */
function compileHtmlExpr(fullMatch: string): string {
  // Extract everything between this.html` and the final `
  const inner = fullMatch.slice("this.html`".length, -1);

  // Try self-closing: <tag attrs/>
  const selfClosing = inner.match(/^\s*<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/>\s*$/s);
  if (selfClosing) {
    const [, tag, attrsStr] = selfClosing;
    return `(() => { const _e = document.createElement("${tag}"); ${compileAttrs(attrsStr)}return _e; })()`;
  }

  // Try full element: <tag attrs>children</tag>
  const full = inner.match(/^\s*<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*>([\s\S]*)<\/\1>\s*$/s);
  if (!full) return fullMatch; // Can't parse, leave as-is (runtime fallback)

  const [, tag, attrsStr, childrenRaw] = full;
  const attrs = compileAttrs(attrsStr);

  // Build children: split by ${...} to get static text and expressions
  // In source, ${expr} appears literally. We need to produce: "static", expr, "static"
  const parts: string[] = [];
  const childRe = /\$\{([^}]+)\}/g;
  let last = 0;
  let cm: RegExpExecArray | null;
  while ((cm = childRe.exec(childrenRaw)) !== null) {
    const before = childrenRaw.slice(last, cm.index);
    if (before) parts.push(`"${before}"`);
    parts.push(cm[1]); // The expression itself
    last = cm.index + cm[0].length;
  }
  const after = childrenRaw.slice(last);
  if (after) parts.push(`"${after}"`);

  let code = `(() => { const _e = document.createElement("${tag}"); ${attrs}`;
  if (parts.length) code += `_e.append(${parts.join(", ")}); `;
  code += `return _e; })()`;
  return code;
}

function transformHtmlTemplates(code: string): string {
  // Match this.html`...` including ${} expressions
  // Use a manual scan to handle nested ${} correctly
  const marker = "this.html`";
  let result = "";
  let i = 0;

  while (i < code.length) {
    const idx = code.indexOf(marker, i);
    if (idx === -1) {
      result += code.slice(i);
      break;
    }
    result += code.slice(i, idx);

    // Find matching closing backtick, accounting for ${} blocks
    let j = idx + marker.length;
    let depth = 0;
    while (j < code.length) {
      if (code[j] === "`" && depth === 0) break;
      if (code[j] === "$" && code[j + 1] === "{") { depth++; j += 2; continue; }
      if (code[j] === "}" && depth > 0) { depth--; j++; continue; }
      j++;
    }

    const fullMatch = code.slice(idx, j + 1);
    result += compileHtmlExpr(fullMatch);
    i = j + 1;
  }

  return result;
}

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

      // 3. Compile this.html`...` → DOM operations
      code = transformHtmlTemplates(code);

      // 4. Make render() protected
      code = code.replace(/^(\s+)render\(\)/gm, "$1protected render()");

      // 5. Auto-inject imports
      const fileDir = dirname(args.path);
      let rel = relative(fileDir, frameworkDir).replace(/\\/g, "/");
      if (!rel.startsWith(".")) rel = "./" + rel;

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
