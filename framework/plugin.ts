import type { BunPlugin } from "bun";
import { resolve, relative, dirname } from "path";

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

function compileElement(inner: string): string | null {
  const sc = inner.match(/^\s*<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/>\s*$/s);
  if (sc) {
    const [, tag, attrs] = sc;
    return `const _e = document.createElement("${tag}"); ${compileAttrs(attrs)}return _e;`;
  }

  const full = inner.match(/^\s*<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*>([\s\S]*)<\/\1>\s*$/s);
  if (!full) return null;

  const [, tag, attrsStr, childrenRaw] = full;
  const parts: string[] = [];
  const re = /\$\{([^}]+)\}/g;
  let last = 0;
  let cm: RegExpExecArray | null;
  while ((cm = re.exec(childrenRaw)) !== null) {
    const before = childrenRaw.slice(last, cm.index);
    if (before) parts.push(`"${before}"`);
    parts.push(cm[1]);
    last = cm.index + cm[0].length;
  }
  const after = childrenRaw.slice(last);
  if (after) parts.push(`"${after}"`);

  let code = `const _e = document.createElement("${tag}"); ${compileAttrs(attrsStr)}`;
  if (parts.length) code += `_e.append(${parts.join(", ")}); `;
  code += `return _e;`;
  return code;
}

function extractTemplate(code: string, start: number, prefix: string): { end: number; inner: string } | null {
  let j = start + prefix.length;
  let depth = 0;
  while (j < code.length) {
    if (code[j] === "`" && depth === 0) break;
    if (code[j] === "$" && code[j + 1] === "{") { depth++; j += 2; continue; }
    if (code[j] === "}" && depth > 0) { depth--; j++; continue; }
    j++;
  }
  if (j >= code.length) return null;
  return { end: j + 1, inner: code.slice(start + prefix.length, j) };
}

function transformStaticTemplates(code: string): string {
  const marker = "static __template = html`";
  let result = "";
  let i = 0;
  while (i < code.length) {
    const idx = code.indexOf(marker, i);
    if (idx === -1) { result += code.slice(i); break; }
    result += code.slice(i, idx);
    const tpl = extractTemplate(code, idx + "static __template = ".length, "html`");
    if (!tpl) { result += marker; i = idx + marker.length; continue; }
    const compiled = compileElement(tpl.inner);
    result += compiled
      ? `static __template = () => { ${compiled} }`
      : `static __template = () => { const _t = document.createElement("template"); _t.innerHTML = \`${tpl.inner}\`; return _t.content.firstElementChild; }`;
    i = tpl.end;
  }
  return result;
}

export const uiPlugin: BunPlugin = {
  name: "uinspy-ui",
  setup(build) {
    build.onLoad({ filter: /\.ui\.ts$/ }, async (args) => {
      const original = await Bun.file(args.path).text();
      let code = original;

      // //@ component → customElements.define
      const defines: string[] = [];
      const compRe = /\/\/@\s*component\(["']([^"']+)["']\)[\s\S]*?class\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = compRe.exec(original)) !== null) {
        defines.push(`customElements.define("${m[1]}", ${m[2]});`);
      }
      code = code.replace(/\/\/@\s*component\(["'][^"']+["']\)\s*\n/g, "");

      // css`` → plain string
      code = code.replace(/\bcss`/g, "`");

      // Compile static __template = html`...`
      code = transformStaticTemplates(code);

      // render() → protected render()
      code = code.replace(/^(\s+)render\(\)/gm, "$1protected render()");

      // Auto-inject imports
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

      if (defines.length) code += "\n" + defines.join("\n") + "\n";

      return { contents: code, loader: "ts" };
    });
  },
};

export default uiPlugin;
