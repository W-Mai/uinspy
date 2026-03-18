# uinspy Framework

Zero-dependency Web Component micro-framework with compile-time sugar.
All components compile to a single self-contained HTML file.

## Architecture

```
framework/
  base.ts      — BaseComponent: template mount, style inject, update()
  signal.ts    — Reactive signal: get/set .val, subscribe via .sub()
  store.ts     — Shared reactive store: keyed bag of signals
  plugin.ts    — Bun plugin: transforms .ui.ts → standard TS at build time
  env.d.ts     — Global type declarations (css, html, signal, store, BaseComponent)
  index.ts     — Barrel export
```

## Component Authoring (.ui.ts)

Components use `.ui.ts` extension. The plugin handles all imports and registration — write only the essential code.

### Minimal Component

```ts
//@ component("my-tag")
class MyTag extends BaseComponent {
  static __style = css`div { color: red; }`;
  static __template = html`<div>Hello</div>`;
  render() {}
}
```

### Nested Template

```ts
//@ component("my-card")
class MyCard extends BaseComponent {
  static __template = html`
    <div class="card">
      <div class="header"><span>Title</span></div>
      <div class="body"></div>
    </div>
  `;
  render() {}
}
```

### Component Composition

Custom component tags work in templates:

```ts
//@ component("my-app")
class MyApp extends BaseComponent {
  static __template = html`
    <div>
      <my-header></my-header>
      <my-content></my-content>
    </div>
  `;
  render() {}
}
```

### Inline Templates (Dynamic DOM)

Use `this.html` inside methods for dynamic DOM creation:

```ts
renderItem(name: string) {
  return this.html`<div class="item"><span>${name}</span></div>`;
}

render() {
  items.forEach(item => this.el.appendChild(this.renderItem(item.name)));
}
```

### Component with State

```ts
//@ component("my-counter")
class MyCounter extends BaseComponent {
  static __template = html`<button>0</button>`;
  private count = signal(0);

  render() {
    this.el.onclick = () => this.count.val++;
    this.count.sub(() => (this.el.textContent = `${this.count.val}`));
  }
}
```

### Shared State Across Components

```ts
// src/state.ts
const appState = store({ selectedId: null as string | null });
export default appState;

// In any component
import appState from "../state";
render() {
  appState.selectedId.sub(() => { /* react to changes */ });
}
```

### Re-rendering

```ts
const panel = document.querySelector("my-panel") as MyPanel;
panel.data = newData;
panel.update(); // clears DOM, re-mounts template, re-runs render()
```

## Styling

Components use light DOM (no Shadow DOM). Two approaches coexist:

- **`__style`** — component CSS, auto-scoped at compile time with tag name prefix. Handles `@media`, `@keyframes`, `:host`, pseudo-elements correctly.
- **Tailwind classes** — usable directly in templates.

```ts
// Source → Compiled
css`button { color: red; }`       → `my-tag button { color: red; }`
css`:host { display: block; }`    → `my-tag { display: block; }`
css`@media (...) { .x { ... } }` → `@media (...) { my-tag .x { ... } }`
```

## API Reference

### BaseComponent

| Member | Type | Description |
|--------|------|-------------|
| `this.el` | `HTMLElement` | Template root element, auto-assigned before `render()` |
| `this.$<T>(sel)` | `T` | Query helper on component's children |
| `render()` | abstract | Called after template mounted. Bindings go here |
| `update()` | method | Re-render: clear DOM, re-mount template, re-run render |
| `static __style` | `string` | Component CSS, auto-scoped with tag name prefix |
| `static __template` | `() => HTMLElement` | DOM factory, compiled from `html\`` |

### signal\<T\>(initial)

```ts
const count = signal(0);
count.val;           // read
count.val = 1;       // write (triggers subscribers, skips if same value)
count.sub(() => {}); // subscribe, returns unsubscribe function
```

### store\<T\>(init)

```ts
const state = store({ name: "hello", count: 0 });
state.name.val;          // read
state.count.val = 1;     // write
state.count.sub(() => {});  // subscribe
```

Each key becomes an independent signal.

## Compile-Time Transforms (plugin.ts)

| Step | Source | Output |
|------|--------|--------|
| 1 | `//@ component("tag")` | Removed; `customElements.define()` appended |
| 2 | `` css`...` `` | Plain string with selectors prefixed by tag name |
| 3 | `` static __template = html`...` `` | DOM factory with recursive `createElement` calls |
| 4 | `` this.html`...` `` | IIFE returning element via `createElement` calls |
| 5 | `render()` | `protected render()` |
| 6 | (auto) | `import { BaseComponent, signal, store }` injected as needed |

### What you DON'T write

- No `import` statements — auto-injected based on usage
- No `customElements.define()` — generated from `//@ component`
- No `protected` on `render()` — auto-added
- No `this.el` declaration — inherited from `BaseComponent`

## Patterns

### Dynamic Lists — plain JS loops + `this.html`

```ts
render() {
  items.forEach(item => this.el.appendChild(
    this.html`<div class="card">${item.name}</div>`
  ));
}
```

### Conditional Rendering — plain JS

```ts
render() {
  if (this.data) this.el.appendChild(this.html`<div>...</div>`);
}
```

### Global Events — native CustomEvent

```ts
// Emit
document.dispatchEvent(new CustomEvent("search", { detail: query }));
// Listen
document.addEventListener("search", (e) => { /* e.detail */ });
```

### Theming — Tailwind @custom-variant

```css
@custom-variant dark (&:where(.dark, .dark *));
@theme { --color-accent: #7c3aed; }
```

## Build

```bash
bun run build    # → dist/uinspy.html (readable) + dist/uinspy.min.html
bun run dev      # → Tailwind watch + Bun dev server
```

## Runtime Budget

- `BaseComponent`: ~35 lines
- `signal`: ~15 lines
- `store`: ~8 lines
- **Total: ~58 lines runtime**
