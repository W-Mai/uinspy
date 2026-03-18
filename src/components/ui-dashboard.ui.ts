//@ component("ui-dashboard")
import { dashData, countObjects } from "../state";
import { STAT_DEFS } from "../constants";
import { makeStatPanel, el } from "../helpers";
import { buildDisplayAndTrees } from "../builders/display.ui";
import { buildAnimations, buildTimers, buildIndevs, buildImageCache, buildSubjects, buildGroups, buildDrawTasks, buildDrawUnits, buildDecoders, buildFsDrivers, buildSimpleTable } from "../builders/sections.ui";
import type { DashboardData } from "../types";

class UiDashboard extends BaseComponent {
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

      grid.appendChild(bento);
    });
  }
}
