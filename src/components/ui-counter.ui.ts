//@ component("ui-counter")
class UiCounter extends BaseComponent {
  static __style = css`
    button {
      font-family: ui-monospace, monospace;
      font-size: 14px;
      padding: 6px 16px;
      border-radius: 6px;
      color: #7c3aed;
      background: rgba(124, 58, 237, 0.1);
      border: 2px solid transparent;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    button:hover { border-color: rgba(124, 58, 237, 0.5); }
  `;
  static __template = html`<button>Count is 0</button>`;

  private count = signal(0);

  render() {
    this.el.onclick = () => this.count.val++;
    this.count.sub(() => (this.el.textContent = `Count is ${this.count.val}`));
  }
}
