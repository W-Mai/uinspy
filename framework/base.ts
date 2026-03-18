// Base class for all uinspy components
export abstract class BaseComponent extends HTMLElement {
  protected el!: HTMLElement;

  // Track which components already injected their styles
  private static __injected = new Set<string>();

  connectedCallback() {
    const ctor = this.constructor as typeof BaseComponent & {
      __style?: string;
      __template?: () => HTMLElement;
    };
    // Inject component style once per tag
    const tag = this.tagName.toLowerCase();
    if (ctor.__style && !BaseComponent.__injected.has(tag)) {
      BaseComponent.__injected.add(tag);
      const s = document.createElement("style");
      s.textContent = ctor.__style;
      document.head.appendChild(s);
    }
    if (ctor.__template) {
      this.el = ctor.__template();
      this.appendChild(this.el);
    }
    this.render();
  }

  protected abstract render(): void;

  protected $<T extends HTMLElement>(selector: string): T {
    return this.querySelector(selector) as T;
  }
}
