import type { BunPlugin } from "bun";
import { resolve, relative, dirname } from "path";

const frameworkDir = resolve(import.meta.dir);

// Prefix CSS selectors with component tag name for scoping
function scopeCSS(css: string, tag: string): string {
  return processBlock(css, tag);
}

function processBlock(css: string, tag: string): string {
  let result = "";
  let i = 0;
  while (i < css.length) {
    // Skip whitespace
    if (/\s/.test(css[i])) { result += css[i]; i++; continue; }

    // At-rules
    if (css[i] === "@") {
      const atMatch = css.slice(i).match(/^@([\w-]+)\s*([^{;]*)/);
      if (!atMatch) { result += css[i]; i++; continue; }
      const rule = atMatch[1];
      const afterAt = i + atMatch[0].length;

      if (rule === "keyframes" || rule === "font-face") {
        // Pass through without scoping
        const blockEnd = findBlockEnd(css, afterAt);
        result += css.slice(i, blockEnd);
        i = blockEnd;
      } else if (css[afterAt] === "{") {
        // @media, @supports, etc — recurse into block
        const blockEnd = findBlockEnd(css, afterAt);
        const inner = css.slice(afterAt + 1, blockEnd - 1);
        result += css.slice(i, afterAt + 1) + processBlock(inner, tag) + "}";
        i = blockEnd;
      } else {
        // @import, @charset, etc — pass through
        const semi = css.indexOf(";", i);
        const end = semi === -1 ? css.length : semi + 1;
        result += css.slice(i, end);
        i = end;
      }
      continue;
    }

    // Regular rule: selector { ... }
    const braceIdx = css.indexOf("{", i);
    if (braceIdx === -1) { result += css.slice(i); break; }
    const selectors = css.slice(i, braceIdx);
    const blockEnd = findBlockEnd(css, braceIdx);
    const body = css.slice(braceIdx, blockEnd);

    const scoped = selectors.split(",").map(s => scopeSelector(s.trim(), tag)).join(", ");
    result += scoped + body;
    i = blockEnd;
  }
  return result;
}

function scopeSelector(sel: string, tag: string): string {
  if (!sel) return sel;
  if (sel === ":host") return tag;
  if (sel.startsWith(":host(")) return tag + sel.slice(5);
  if (sel === ":root" || sel === "*") return sel;
  return `${tag} ${sel}`;
}

function findBlockEnd(css: string, openBrace: number): number {
  let depth = 0;
  for (let i = openBrace; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") { depth--; if (depth === 0) return i + 1; }
  }
  return css.length;
}

// --- Recursive HTML parser + compiler ---

interface ParsedNode {
  type: "element" | "text" | "expr";
  tag?: string;
  attrs?: string;
  children?: ParsedNode[];
  text?: string;
  expr?: string;
}

// Parse HTML string into node tree
function parseHTML(html: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      // Self-closing tag
      const sc = html.slice(i).match(/^<([\w-]+)((?:\s+(?:[\w-]+="[^"]*"|[\w-]+))*)\s*\/>/s);
      if (sc) {
        nodes.push({ type: "element", tag: sc[1], attrs: sc[2] || "", children: [] });
        i += sc[0].length;
        continue;
      }
      // Opening tag
      const op = html.slice(i).match(/^<([\w-]+)((?:\s+(?:[\w-]+="[^"]*"|[\w-]+))*)\s*>/s);
      if (op) {
        const tag = op[1];
        i += op[0].length;
        // Find matching close tag (handle nesting)
        let depth = 1;
        let j = i;
        while (j < html.length && depth > 0) {
          const closeIdx = html.indexOf("</" + tag, j);
          const openIdx = html.indexOf("<" + tag, j);
          // Find next same-tag open (not self-closing)
          let nextOpen = -1;
          if (openIdx !== -1 && openIdx < (closeIdx === -1 ? Infinity : closeIdx)) {
            const afterOpen = html.slice(openIdx).match(new RegExp(`^<${tag}(?:\\s[^>]*)?>`, "s"));
            if (afterOpen && !afterOpen[0].endsWith("/>")) {
              nextOpen = openIdx;
            }
          }
          if (nextOpen !== -1 && nextOpen < (closeIdx === -1 ? Infinity : closeIdx)) {
            depth++;
            j = nextOpen + 1;
          } else if (closeIdx !== -1) {
            depth--;
            if (depth === 0) {
              const inner = html.slice(i, closeIdx);
              const closeTag = html.slice(closeIdx).match(new RegExp(`^</${tag}\\s*>`));
              nodes.push({ type: "element", tag, attrs: op[2] || "", children: parseHTML(inner) });
              i = closeIdx + (closeTag ? closeTag[0].length : tag.length + 3);
            } else {
              j = closeIdx + 1;
            }
          } else {
            break; // No close tag found
          }
        }
        continue;
      }
    }

    // Text / expression content until next '<'
    let end = html.indexOf("<", i);
    if (end === -1) end = html.length;
    const chunk = html.slice(i, end);
    if (chunk) {
      // Split by ${...} expressions
      const exprRe = /\$\{([^}]+)\}/g;
      let last = 0;
      let em: RegExpExecArray | null;
      while ((em = exprRe.exec(chunk)) !== null) {
        const before = chunk.slice(last, em.index);
        if (before.trim()) nodes.push({ type: "text", text: before });
        nodes.push({ type: "expr", expr: em[1] });
        last = em.index + em[0].length;
      }
      const after = chunk.slice(last);
      if (after.trim()) nodes.push({ type: "text", text: after });
    }
    i = end;
  }
  return nodes;
}

function compileAttrs(attrsStr: string, varName: string): string {
  if (!attrsStr.trim()) return "";
  const attrRe = /([\w-]+)="([^"]*)"/g;
  let code = "";
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(attrsStr)) !== null) {
    code += `${varName}.setAttribute("${m[1]}", "${m[2]}"); `;
  }
  return code;
}

// Compile parsed nodes to JS code, returns { code, varCounter }
function compileNodes(nodes: ParsedNode[], parentVar: string, counter: number): { code: string; counter: number } {
  let code = "";
  const children: string[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      children.push(`"${node.text}"`);
    } else if (node.type === "expr") {
      children.push(node.expr!);
    } else if (node.type === "element") {
      const v = counter === 0 ? "_e" : `_e${counter}`;
      counter++;
      code += `const ${v} = document.createElement("${node.tag}"); `;
      code += compileAttrs(node.attrs || "", v);
      if (node.children && node.children.length > 0) {
        const sub = compileNodes(node.children, v, counter);
        code += sub.code;
        counter = sub.counter;
      }
      children.push(v);
    }
  }

  if (children.length > 0) {
    code += `${parentVar}.append(${children.join(", ")}); `;
  }
  return { code, counter };
}

function compileTemplate(html: string): string | null {
  const nodes = parseHTML(html);
  if (nodes.length === 0) return null;

  // Single root element expected
  const roots = nodes.filter(n => n.type === "element");
  if (roots.length !== 1) return null;

  const root = roots[0];
  const rootVar = "_e";
  let code = `const ${rootVar} = document.createElement("${root.tag}"); `;
  code += compileAttrs(root.attrs || "", rootVar);

  if (root.children && root.children.length > 0) {
    const sub = compileNodes(root.children, rootVar, 1);
    code += sub.code;
  }
  code += `return ${rootVar};`;
  return code;
}

// --- Template extraction ---

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
    const compiled = compileTemplate(tpl.inner);
    result += compiled
      ? `static __template = () => { ${compiled} }`
      : `static __template = () => { const _t = document.createElement("template"); _t.innerHTML = \`${tpl.inner}\`; return _t.content.firstElementChild; }`;
    i = tpl.end;
  }
  return result;
}

// Compile this.html`...` → IIFE
function transformInlineTemplates(code: string): string {
  const marker = "this.html`";
  let result = "";
  let i = 0;
  while (i < code.length) {
    const idx = code.indexOf(marker, i);
    if (idx === -1) { result += code.slice(i); break; }
    result += code.slice(i, idx);
    const tpl = extractTemplate(code, idx, marker);
    if (!tpl) { result += marker; i = idx + marker.length; continue; }
    const compiled = compileTemplate(tpl.inner);
    result += compiled
      ? `(() => { ${compiled} })()`
      : `(() => { const _t = document.createElement("template"); _t.innerHTML = \`${tpl.inner}\`; return _t.content.firstElementChild; })()`;
    i = tpl.end;
  }
  return result;
}

// --- Plugin ---

export const uiPlugin: BunPlugin = {
  name: "uinspy-ui",
  setup(build) {
    build.onLoad({ filter: /\.ui\.ts$/ }, async (args) => {
      const original = await Bun.file(args.path).text();
      let code = original;

      // //@ component → collect tag→class mappings, append customElements.define
      const defines: string[] = [];
      const tagMap = new Map<string, string>(); // className → tagName
      const compRe = /\/\/@\s*component\(["']([^"']+)["']\)[\s\S]*?class\s+(\w+)/g;
      let m: RegExpExecArray | null;
      while ((m = compRe.exec(original)) !== null) {
        defines.push(`customElements.define("${m[1]}", ${m[2]});`);
        tagMap.set(m[2], m[1]);
      }
      code = code.replace(/\/\/@\s*component\(["'][^"']+["']\)\s*\n/g, "");

      // Scope css`` with component tag name, then strip tag
      for (const [className, tagName] of tagMap) {
        const styleRe = new RegExp(
          `(class\\s+${className}[\\s\\S]*?static\\s+__style\\s*=\\s*)css\`([\\s\\S]*?)\``,
        );
        code = code.replace(styleRe, (_, prefix, cssContent) => {
          return `${prefix}\`${scopeCSS(cssContent, tagName)}\``;
        });
      }
      code = code.replace(/\bcss`/g, "`");

      // Compile templates (static + inline)
      code = transformStaticTemplates(code);
      code = transformInlineTemplates(code);

      // render() → protected render()
      code = code.replace(/^(\s+)render\(\)/gm, "$1protected render()");

      // Auto-inject imports
      const fileDir = dirname(args.path);
      let rel = relative(fileDir, frameworkDir).replace(/\\/g, "/");
      if (!rel.startsWith(".")) rel = "./" + rel;

      code = code.replace(/import\s*\{[^}]*BaseComponent[^}]*\}\s*from\s*["'][^"']+["'];?\s*\n?/g, "");
      code = code.replace(/import\s*\{[^}]*signal[^}]*\}\s*from\s*["'][^"']+["'];?\s*\n?/g, "");
      code = code.replace(/import\s*\{[^}]*store[^}]*\}\s*from\s*["'][^"']+["'];?\s*\n?/g, "");

      const imports = [`import { BaseComponent } from "${rel}/base";`];
      if (code.includes("signal(")) {
        imports.push(`import { signal } from "${rel}/signal";`);
      }
      if (code.includes("store(")) {
        imports.push(`import { store } from "${rel}/store";`);
      }
      code = imports.join("\n") + "\n" + code;

      if (defines.length) code += "\n" + defines.join("\n") + "\n";

      return { contents: code, loader: "ts" };
    });
  },
};

export default uiPlugin;
