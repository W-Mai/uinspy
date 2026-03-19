//@ component("ui-dashboard")
import { dashData, countObjects } from "../state";
import { STAT_DEFS } from "../constants";
import { makeStatPanel, el } from "../helpers";
import { buildDisplayAndTrees } from "../builders/display.ui";
import { buildAnimations, buildTimers, buildIndevs, buildImageCache, buildSubjects, buildGroups, buildDrawTasks, buildDrawUnits, buildDecoders, buildFsDrivers, buildSimpleTable } from "../builders/sections.ui";
import type { DashboardData } from "../types";

class UiDashboard extends BaseComponent {
  static __style = css`
    .main { @apply max-w-[1800px] mx-auto px-4 py-3 pb-6; }
    .bento { @apply grid grid-cols-12 gap-[var(--gap)]; grid-auto-rows: minmax(40px, auto); }

    /* Grid spans */
    .panel-stat { grid-column: span 2; }
    .panel-disp-trees { grid-column: span 12; }
    .panel-disp-trees > .panel-body { @apply overflow-auto; }
    .panel-img-cache, .panel-hdr-cache, .panel-decoders,
    .panel-animations, .panel-timers, .panel-indevs,
    .panel-groups, .panel-draw-units, .panel-draw-tasks,
    .panel-subjects, .panel-fs-drivers { grid-column: span 4; }
    .panel-img-cache > .panel-body, .panel-hdr-cache > .panel-body { @apply overflow-y-auto max-h-[400px]; }
    .panel-hdr-cache .table-wrap { @apply overflow-x-auto; }
    .panel-hdr-cache table { @apply text-[11px]; }
    .panel-animations, .panel-timers, .panel-indevs, .panel-groups,
    .panel-draw-units, .panel-draw-tasks, .panel-subjects,
    .panel-fs-drivers, .panel-decoders { @apply max-h-[360px]; }
    .panel-animations > .panel-body, .panel-timers > .panel-body,
    .panel-indevs > .panel-body, .panel-groups > .panel-body,
    .panel-draw-units > .panel-body, .panel-draw-tasks > .panel-body,
    .panel-subjects > .panel-body, .panel-fs-drivers > .panel-body,
    .panel-decoders > .panel-body { @apply overflow-y-auto; }

    .panel-about { grid-column: 1 / -1; }
    .panel-about .panel-body {
      @apply flex items-center justify-center gap-4 text-overlay0 text-[11px] py-1.5;
    }
    .panel-about a { @apply text-blue no-underline; }
    .panel-about a:hover { @apply underline; }

    /* Responsive */
    @media (max-width: 1200px) {
      .bento { grid-template-columns: repeat(6, 1fr); }
      .panel-stat { grid-column: span 2; }
      .panel-disp-trees { grid-column: span 6; }
      .panel-disp-trees .obj-split { @apply flex-col h-auto; }
      .panel-disp-trees .obj-split > .obj-tree-view,
      .panel-disp-trees .obj-split > .obj-detail-view { @apply flex-none max-h-[300px]; }
      .panel-img-cache, .panel-hdr-cache, .panel-decoders { grid-column: span 6; }
      .panel-animations, .panel-timers, .panel-indevs, .panel-groups,
      .panel-draw-units, .panel-draw-tasks, .panel-subjects, .panel-fs-drivers { grid-column: span 3; }
    }
    @media (max-width: 768px) {
      .bento { grid-template-columns: 1fr; }
      .bento > * { grid-column: span 1; }
    }
  `;
  static __template = html`<div class="main" id="bento-grid"></div>`;

  render() {
    const grid = this.el;
    dashData.sub(() => {
      const data = dashData.val;
      if (!data) return;
      grid.innerHTML = "";
      const bento = el("div", "bento");

      const objCount = countObjects(data.object_trees || []);
      STAT_DEFS.forEach(s => {
        const val = s.key === "_objects" ? objCount : ((data as any)[s.key]?.length || 0);
        bento.appendChild(makeStatPanel(s.icon, s.label, val, s.color, s.section));
      });

      bento.appendChild(buildDisplayAndTrees(data));
      bento.appendChild(buildImageCache(data));
      bento.appendChild(buildSimpleTable(data, "image_header_cache", "panel-hdr-cache", "📋", "Header Cache",
        ["entry_addr", "src", "size", "cf", "ref_count", "src_type", "decoder_name"], "imghdr"));
      bento.appendChild(buildDecoders(data));
      bento.appendChild(buildAnimations(data));
      bento.appendChild(buildTimers(data));
      bento.appendChild(buildIndevs(data));
      bento.appendChild(buildGroups(data));
      bento.appendChild(buildDrawUnits(data));
      bento.appendChild(buildDrawTasks(data));
      bento.appendChild(buildSubjects(data));
      bento.appendChild(buildFsDrivers(data));

      const about = el("div", "panel panel-about");
      const body = el("div", "panel-body");
      body.innerHTML = `<span>uinspy v${__UINSPY_VERSION__}</span><span>·</span><span>Built ${__UINSPY_BUILD_TIME__}</span><span>·</span><a href="https://github.com/W-Mai/uinspy" target="_blank">GitHub</a><span>·</span><a href="https://lvgl.io" target="_blank">LVGL</a><span>·</span><span>MIT</span>`;
      about.appendChild(body);
      bento.appendChild(about);

      grid.appendChild(bento);
    });
  }
}
