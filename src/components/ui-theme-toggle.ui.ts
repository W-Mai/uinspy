//@ component("ui-theme-toggle")
class UiThemeToggle extends BaseComponent {
  static __template = html`<button class="cursor-pointer text-xl" title="Toggle theme">🌙</button>`;

  render() {
    // Init from system preference
    if (matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
      this.el.textContent = "☀️";
    }
    this.el.onclick = () => {
      const dark = document.documentElement.classList.toggle("dark");
      this.el.textContent = dark ? "☀️" : "🌙";
    };
  }
}
