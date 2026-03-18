// Base class for all uinspy components
export abstract class BaseComponent extends HTMLElement {
  protected root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    // Auto-inject style from @style decorator
    const ctor = this.constructor as typeof BaseComponent & { __style?: string };
    if (ctor.__style) {
      const style = document.createElement("style");
      style.textContent = ctor.__style;
      this.root.appendChild(style);
    }
    this.render();
  }

  protected abstract render(): void;

  // Create element with attributes and children
  protected h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs?: Record<string, string>,
    ...children: (string | Node)[]
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    children.forEach((c) =>
      el.append(typeof c === "string" ? document.createTextNode(c) : c)
    );
    return el;
  }
}

// Type hint for css tagged template (IDE syntax highlighting)
declare global {
  function css(strings: TemplateStringsArray, ...values: unknown[]): string;
}
