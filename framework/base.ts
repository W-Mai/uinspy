// Base class for all uinspy components
export abstract class BaseComponent extends HTMLElement {
  protected root: ShadowRoot;
  protected el!: HTMLElement;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const ctor = this.constructor as typeof BaseComponent & {
      __style?: string;
      __template?: () => HTMLElement;
    };
    if (ctor.__style) {
      const s = document.createElement("style");
      s.textContent = ctor.__style;
      this.root.appendChild(s);
    }
    if (ctor.__template) {
      this.el = ctor.__template();
      this.root.appendChild(this.el);
    }
    this.render();
  }

  protected abstract render(): void;

  protected $<T extends HTMLElement>(selector: string): T {
    return this.root.querySelector(selector) as T;
  }
}
