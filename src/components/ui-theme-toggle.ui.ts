//@ component("ui-theme-toggle")
class UiThemeToggle extends BaseComponent {
  static __template = html`<button class="theme-toggle" title="Toggle theme">🌙</button>`;

  render() {
    const THEMES = ["dark", "light", "cyber"];
    const ICONS: Record<string, string> = { dark: "🌙", light: "☀️", cyber: "⚡" };
    const root = document.documentElement;

    const apply = (theme: string) => {
      root.setAttribute("data-theme", theme);
      this.el.textContent = ICONS[theme] || "🌙";
    };

    const saved = localStorage.getItem("lvgl-dash-theme");
    if (saved && THEMES.includes(saved)) apply(saved);
    else if (matchMedia("(prefers-color-scheme: light)").matches) apply("light");

    this.el.onclick = () => {
      const cur = root.getAttribute("data-theme") || "dark";
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      apply(next);
      localStorage.setItem("lvgl-dash-theme", next);
    };
  }
}
