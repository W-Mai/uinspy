// Base class for all uinspy components
export abstract class BaseComponent extends HTMLElement {
  protected root: ShadowRoot;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const ctor = this.constructor as typeof BaseComponent & { __style?: string };
    if (ctor.__style) {
      const style = document.createElement("style");
      style.textContent = ctor.__style;
      this.root.appendChild(style);
    }
    this.render();
  }

  protected abstract render(): void;

  // Query element within shadow root
  protected $<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector(selector) as T;
  }

  // Compile-time only: this.html`...` is transformed by plugin to DOM operations.
  // This runtime fallback exists for type checking and edge cases.
  protected html(strings: TemplateStringsArray, ...values: unknown[]): DocumentFragment {
    const tpl = document.createElement("template");
    tpl.innerHTML = String.raw(strings, ...values);
    return tpl.content.cloneNode(true) as DocumentFragment;
  }
}
