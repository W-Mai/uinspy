//@ component("ui-tree")
class UiTree extends BaseComponent {
  static __style = css`
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
  `;
  static __template = html`<div class="empty">No UI data loaded. Pass JSON to inspect.</div>`;

  render() {}
}
