# uinspy Framework

Zero-dependency Web Component micro-framework with compile-time sugar.
All components compile to a single self-contained HTML file.

## Architecture

```
framework/
  base.ts      — BaseComponent: Shadow DOM, template mount, style inject
  signal.ts    — Reactive signal: get/set .val, subscribe via .sub()
  plugin.ts    — Bun plugin: transforms .ui.ts → standard TS at build time
  env.d.ts     — Global type declarations (css, html, signal, BaseComponent)
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

### Component with State

```ts
//@ component("my-counter")
class MyCounter extends BaseComponent {
  static __style = css`button { color: #7c3aed; }`;
  static __template = html`<button>0</button>`;
  private count = signal(0);

  render() {
    this.el.onclick = () => this.count.val++;
    this.count.sub(() => (this.el.textContent = `${this.count.val}`));
  }
}
```

## API Reference

### BaseComponent

| Member | Type | Description |
|--------|------|-------------|
| `this.el` | `HTMLElement` | Template root element, auto-assigned before `render()` |
| `this.root` | `ShadowRoot` | Shadow root for direct DOM access |
| `this.$<T>(sel)` | `T` | Query helper on shadow root |
| `render()` | abstract | Called after template mounted. Bindingsgo here |
| `static __style` | `string` | Scoped CSS, injected into shadow root |
| `static __template` | `() => HTMLElement` | DOM factory, compiled from `html\`` |

### signal\<T\>(initial)

```ts
const count = signal(0);
count.val;           // read
count.val = 1;       // write (triggers subscribers, skips if same value)
count.sub(() => {}); // subscribe, returns unsubscribe function
```

## Compile-Time Transforms (plugin.ts)

The plugin processes `.ui.ts` files in this order:

| Step | Source | Output |
|------|--------|--------|
| 1 | `//@ component("tag")` | Removed; `customElements.define()` appended |
| 2 | `` css`...` `` | Plain template string (`` `...` ``) |
| 3 | `` static __template = html`<tag>...</tag>` `` | DOM factory: `() => { createElement + setAttribute + append }` |
| 4 | `render()` | `protected render()` |
| 5 | (auto) | `import { BaseComponent }` and `import { signal }` injected |

### What you DON'T write

- No `import` statements — auto-injected
- No `customElements.define()` — generated from `//@ component`
- No `protected` on `render()` — auto-added
- No `this.el` declaration — inherited from `BaseComponent`

## Rules

1. **One root element per template** — `html\`` must contain exactly one root element
2. **`this.el` is the root** — no need to query it, no need to declare it
3. **`declare el: HTMLInputElement`** — only when you need type narrowing (e.g. `.value`)
4. **Scoped styles** — all CSS lives in Shadow DOM, no leaking
5. **`render()` is for bindings** — DOM structure is static, `render()` wires up events and subscriptions
6. **No runtime HTML parsing** — `html\`` compiles to `createElement` calls, no `innerHTML` at runtime (falls back to `innerHTML` only for complex/nested HTML the compiler can't parse)

## Build

```bash
bun run build    # → dist/uinspy.html (readable) + dist/uinspy.min.html
bun run dev      # → Tailwind watch + Bun dev server
```

Readable version uses `{ syntax: true, whitespace: false, identifiers: false }` — optimized code, preserved formatting.
