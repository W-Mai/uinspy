// Base class for all uinspy components
export abstract class BaseComponent extends HTMLElement {
  protected root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  protected abstract render(): void;

  // Helper: create element with attributes and children
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
