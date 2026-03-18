import { BaseComponent } from "./base";

// Placeholder: will render a UI node tree from JSON
export class UiTree extends BaseComponent {
  protected render() {
    const style = this.h("style", {}, `
      :host { display: block; }
      .empty {
        color: #9ca3af;
        font-size: 14px;
        text-align: center;
        padding: 32px;
        border: 1px dashed #e5e7eb;
        border-radius: 8px;
      }
      @media (prefers-color-scheme: dark) {
        .empty { color: #6b7280; border-color: #374151; }
      }
    `);

    const container = this.h("div", { class: "empty" }, "No UI data loaded. Pass JSON to inspect.");
    this.root.replaceChildren(style, container);
  }
}

customElements.define("ui-tree", UiTree);
