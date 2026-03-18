//@ component("ui-topbar")
import { dashData, countObjects } from "../state";
import { SECTIONS } from "../constants";
import type { DashboardData } from "../types";

class UiTopbar extends BaseComponent {
  static __template = html`
    <header class="topbar">
      <div class="topbar-brand">
        <span class="logo">LV</span> LVGL Dashboard
      </div>
      <div class="topbar-sep"></div>
      <div class="topbar-meta" id="header-meta"></div>
      <nav class="topbar-nav" id="topbar-nav"></nav>
      <ui-theme-toggle></ui-theme-toggle>
      <input type="text" class="topbar-search" id="search" placeholder="Filter..." aria-label="Search"/>
    </header>
  `;

  render() {
    const meta = this.$<HTMLElement>("#header-meta");
    const nav = this.$<HTMLElement>("#topbar-nav");
    const search = this.$<HTMLInputElement>("#search");

    dashData.sub(() => {
      const data = dashData.val;
      if (!data) return;

      // Meta
      meta.innerHTML = "";
      meta.appendChild(document.createTextNode(data.meta?.timestamp || ""));
      if (data.meta?.lvgl_version) {
        const tag = document.createElement("span");
        tag.className = "version-tag";
        tag.textContent = "LVGL " + data.meta.lvgl_version;
        meta.appendChild(tag);
      }

      // Nav
      nav.innerHTML = "";
      SECTIONS.forEach(s => {
        const arr = (data as any)[s.key] as unknown[] | undefined;
        const count = arr?.length || 0;
        if (count === 0) return;
        const a = document.createElement("a");
        a.textContent = s.icon + " " + count;
        a.title = s.title + " (" + count + ")";
        a.style.cursor = "pointer";
        a.addEventListener("click", e => {
          e.preventDefault();
          document.getElementById("sec-" + s.cls.replace("panel-", ""))
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        nav.appendChild(a);
      });
    });

    // Search filter
    search.addEventListener("input", () => {
      const q = search.value.toLowerCase();
      document.querySelectorAll(".panel").forEach(p => {
        if (p.classList.contains("panel-stat")) return;
        if (!q) { p.classList.remove("hidden"); return; }
        p.classList.toggle("hidden", !p.textContent!.toLowerCase().includes(q));
      });
    });
  }
}
