import { BaseComponent } from "./base";
import { signal } from "../signal";

@tag("ui-counter")
@style(css`
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
`)
export class UiCounter extends BaseComponent {
  private count = signal(0);

  protected render() {
    const btn = this.h("button", {}, `Count is ${this.count.val}`);
    btn.onclick = () => this.count.val++;
    this.count.sub(() => (btn.textContent = `Count is ${this.count.val}`));
    this.root.appendChild(btn);
  }
}
