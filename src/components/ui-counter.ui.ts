//@ component("ui-counter")
class UiCounter extends BaseComponent {
  static __template = html`<button class="font-mono text-sm px-4 py-1.5 rounded-md text-accent bg-accent/10 border-2 border-transparent hover:border-accent/50 dark:text-accent-light dark:bg-accent-light/10 dark:hover:border-accent-light/50 cursor-pointer transition-colors">Count is 0</button>`;

  private count = signal(0);

  render() {
    this.el.onclick = () => this.count.val++;
    this.count.sub(() => (this.el.textContent = `Count is ${this.count.val}`));
  }
}
