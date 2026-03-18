//@ component("ui-topbar")
import { dashData, countObjects } from "../state";
import { SECTIONS } from "../constants";
import type { DashboardData } from "../types";

class UiTopbar extends BaseComponent {
  static __style = css`
    .topbar {
      @apply sticky top-0 z-50 flex items-center gap-4 h-11 px-5;
      background: var(--topbar-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--panel-border); box-shadow: var(--topbar-shadow);
    }
    .topbar-brand {
      @apply flex items-center gap-2 text-blue font-bold whitespace-nowrap text-[13px];
      text-shadow: var(--brand-text-shadow);
    }
    .topbar-brand .logo {
      @apply flex items-center justify-center w-[22px] h-[22px] rounded-md bg-blue text-crust text-[10px] font-extrabold;
      box-shadow: var(--brand-logo-shadow);
    }
    .topbar-sep { @apply w-px h-5 bg-surface0; }
    .topbar-meta { @apply flex items-center gap-2.5 text-overlay1 text-[11px]; }
    .version-tag {
      @apply rounded-[5px] px-2 py-0.5 text-[10px] font-semibold text-green bg-version-bg;
      border: var(--version-border); text-shadow: var(--version-text-shadow);
    }
    .topbar-nav { @apply flex gap-0.5 ml-auto; }
    .topbar-nav a {
      @apply text-subtext0 no-underline whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-theme;
    }
    .topbar-nav a:hover { @apply bg-surface0 text-txt; }
    .topbar-nav a.active { @apply bg-nav-active-bg text-blue; }
    .topbar-search {
      @apply rounded-md w-40 ml-2 py-1 pr-2.5 pl-7 text-[11px] text-txt outline-none bg-base border-s0 transition-theme;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='var(--search-icon-fill)' viewBox='0 0 24 24'%3E%3Cpath d='M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: 8px center;
    }
    .topbar-search:focus { @apply border-blue w-[220px]; }
    .topbar-search::placeholder { @apply text-overlay0; }
    @media (max-width: 768px) { .topbar-nav { @apply hidden; } }
  `;
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
