# Framework Evolution Roadmap

## Core Principle

**Maximize compile-time, minimize runtime.** Every feature must first be considered as a compile-time transform. Runtime additions are only acceptable when the data is inherently dynamic, and must be measured in lines — not abstractions.

## Current Runtime Budget

- `BaseComponent`: ~30 lines (mount template, inject style, query helper)
- `signal`: ~15 lines (get/set/subscribe)
- Total: ~45 lines runtime

## Gaps

### G1. Nested Template Compilation

**Priority**: P0 | **Runtime cost**: 0

Current `html\`` only handles single element with text children. Need recursive compilation.

```ts
// Source
static __template = html`
  <div class="panel">
    <div class="header"><span>Title</span></div>
    <div class="body"></div>
  </div>
`;

// Compiled output
static __template = () => {
  const _e = document.createElement("div");
  _e.setAttribute("class", "panel");
  const _e1 = document.createElement("div");
  _e1.setAttribute("class", "header");
  const _e2 = document.createElement("span");
  _e2.append("Title");
  _e1.append(_e2);
  const _e3 = document.createElement("div");
  _e3.setAttribute("class", "body");
  _e.append(_e1, _e3);
  return _e;
};
```

**Approach**: recursive HTML parser in plugin.ts, emit flat variable sequence. Must handle both:
- `static __template = html\`...\`` → factory function (existing, needs recursive upgrade)
- `this.html\`...\`` → IIFE returning element (not yet implemented)

---

### G2. Component Communication (Global State)

**Priority**: P1 | **Runtime cost**: ~5 lines (reuses signal)

```ts
// framework/store.ts — thin wrapper over signal (simplified, actual impl needs proper typing)
export function store<T extends Record<string, unknown>>(init: T) {
  return Object.fromEntries(
    Object.entries(init).map(([k, v]) => [k, signal(v)])
  );
}
```

No new concepts. Just a factory that creates multiple signals.

---

### G3. Dynamic List Rendering

**Priority**: P0 | **Runtime cost**: 0

No framework helper needed. Users write plain JS loops. The key enabler is G1 (nested templates) — once `html\`` compiles nested HTML, users can create factory functions:

```ts
renderCard(item: Item) {
  return this.html`<div class="card"><span>${item.name}</span></div>`;
}

render() {
  items.forEach(item => this.el.appendChild(this.renderCard(item)));
}
```

Requires: G1 must also support `this.html\`...\`` (inline templates) compiled to IIFE with createElement calls. This transform does not exist yet — currently only `static __template = html\`...\`` is compiled.

---

### G4. Conditional Rendering

**Priority**: P1 | **Runtime cost**: 0

No framework helper needed. Plain JS:

```ts
render() {
  if (this.data) {
    this.el.appendChild(this.html`<div>...</div>`);
  }
}
```

---

### G5. Props & Re-render

**Priority**: P0 | **Runtime cost**: ~5 lines

Compile-time `prop()` wrapper → generates setter that auto-triggers render.

```ts
// Source
class MyComp extends BaseComponent {
  data = prop<Item[]>([]);
  render() { /* uses this.data.val */ }
}

// Compiled: prop() returns signal-like object
// BaseComponent.connectedCallback subscribes all props to re-render
```

Alternative (even simpler): just add `update()` to BaseComponent (~1 line: `this.render()`). User calls `el.data = x; el.update()`. Explicit, zero magic, zero compile cost.

**Decision**: start with `update()` (~3 lines runtime: clear children, re-mount template, re-run render). Add `prop()` compile sugar later only if boilerplate becomes painful.

---

### G6. Global Event System

**Priority**: P2 | **Runtime cost**: 0

Use native DOM: `document.dispatchEvent(new CustomEvent(...))` and `document.addEventListener(...)`. Zero framework code.

Document this pattern in README, don't build an abstraction.

---

### G7. Robust CSS Scoping

**Priority**: P1 | **Runtime cost**: 0

Improve `scopeCSS` in plugin.ts:

1. Recurse into `@media` / `@supports` blocks, prefix selectors inside
2. Skip `@keyframes` / `@font-face` entirely
3. `:root` → don't prefix
4. `:host` → replace with tag name (already done)
5. `::before` / `::after` → append to prefixed selector
6. Attribute selectors `[data-x]` → prefix correctly

All compile-time regex/parser work.

---

### G8. Theme System

**Priority**: P2 | **Runtime cost**: 0

Already covered by Tailwind v4. Use `@custom-variant` for theme variants and `@theme` for design tokens. Multi-theme support via CSS custom properties in `app.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
@custom-variant cyber (&:where(.cyber, .cyber *));

@theme {
  --color-accent: #7c3aed;
}
```

Toggle component switches class on `<html>`. No framework involvement, no additional work.

---

## Implementation Order

```
Phase 1 — Compile-time rendering power
  G1  Nested template compilation     (plugin.ts)
  G5  update() method                 (base.ts, +~3 lines)
  G7  Robust CSS scoping              (plugin.ts)

Phase 2 — Data-driven patterns
  G2  store() factory                 (store.ts, ~5 lines)
  G3  Enabled by G1 — no work needed
  G4  No work needed — plain JS

Phase 3 — Documentation only
  G6  Document native CustomEvent pattern
  G8  No work needed — Tailwind @custom-variant + @theme handles it
```

## Runtime Budget Target

After all phases: **< 55 lines total runtime** (current ~45 + update ~3 + store ~5).
