// Display & Objects mega-panel with tab bar, tree, 3D scene, detail
import { el, makePanel, badge } from "../helpers";
import { countObjects, objDataMap, selectedAddr } from "../state";
import { renderObjTree, renderObjDetail } from "./obj-tree.ui";
import { build3DScene } from "./scene-3d.ui";
import type { DashboardData, ObjNode } from "../types";

const __css = css`
  .disp-tab-bar { @apply flex gap-1 mb-2 pb-2; border-bottom: 1px solid var(--surface0); }
  .disp-tab-btn {
    @apply flex flex-col items-center gap-1 font-mono text-[11px] text-subtext0 cursor-pointer bg-mantle px-3 py-1;
    border: 1px solid var(--surface0); border-bottom: none;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    transition: background var(--transition), color var(--transition);
  }
  .disp-tab-btn:hover { @apply bg-surface0; }
  .disp-tab-btn.active { @apply bg-base text-blue font-semibold; border-color: var(--blue); border-bottom: 2px solid var(--base); }
  .disp-tab-thumb { @apply w-12 h-12 object-contain rounded bg-crust; border: 1px solid var(--surface0); image-rendering: pixelated; }
  .disp-info-bar { @apply flex flex-wrap gap-1.5 mb-1 pb-2; border-bottom: 1px solid var(--surface0); }
  .disp-chip {
    @apply flex flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-[5px] text-[11px] bg-base;
    border: 1px solid var(--surface0);
  }
  .disp-addr { @apply text-sapphire font-mono text-[11px]; }
  .disp-res { @apply text-txt font-semibold; }
  .disp-screens { @apply text-overlay1 text-[11px]; }
  .obj-tree-header { @apply text-overlay1 text-[.75rem] mb-1 px-2 py-1; border-bottom: 1px solid var(--surface0); }
  .obj-split { @apply flex items-stretch gap-2 h-[700px]; }
  .obj-split > .obj-tree-view { @apply flex-[0_0_220px] min-w-0 overflow-auto text-[11px]; }
  .obj-split > .obj-3d-view { @apply relative flex flex-col flex-1 min-w-0; }
  .obj-split > .obj-detail-view {
    @apply flex-[0_0_280px] min-w-0 overflow-auto rounded-lg p-2.5 text-xs bg-base;
    border: 1px solid var(--surface0);
  }
`;

export function buildDisplayAndTrees(data: DashboardData) {
  const displays = data.displays || [];
  const trees = data.object_trees || [];
  const objCount = countObjects(trees);
  const { panel, body } = makePanel("panel-disp-trees", "🖥", "Displays & Objects", displays.length + " disp / " + objCount + " obj");

  if (!displays.length && !trees.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }

  // Per-display data
  const entries = displays.map((d, i) => {
    const tree = trees.find(t => t.display_addr === d.addr) || { display_addr: d.addr, screens: [] };
    const objs: { addr: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    function walk(obj: ObjNode) {
      const c = obj.coords || { x1: 0, y1: 0, x2: 0, y2: 0 };
      objs.push({ addr: obj.addr, x1: c.x1 || 0, y1: c.y1 || 0, x2: c.x2 || 0, y2: c.y2 || 0 });
      obj.children?.forEach(walk);
    }
    tree.screens.forEach(walk);
    return { disp: d, tree, dispObjs: { [d.addr]: objs }, idx: i };
  });

  const tabBar = el("div", "disp-tab-bar");
  const contentArea = el("div", "disp-content-area");
  const tabBtns: HTMLElement[] = [];
  let detailPanel: HTMLElement | null = null;

  function showDisplay(idx: number) {
    tabBtns.forEach((b, j) => b.classList.toggle("active", j === idx));
    contentArea.innerHTML = "";
    Object.keys(objDataMap).forEach(k => delete objDataMap[k]);

    const entry = entries[idx];
    const d = entry.disp;

    // Info chips
    const chip = html`<div class="disp-chip">
      <span class="disp-addr">${d.addr || ""}</span>
      <span class="disp-res">${d.hor_res + " × " + d.ver_res}</span>
      <span class="disp-screens">${d.screen_count + " screens"}</span>
    </div>`;
    [d.buf_1, d.buf_2].forEach((b, i) => {
      if (!b) return;
      chip.appendChild(badge("buf " + (i + 1) + " " + b.width + "×" + b.height + " " + b.color_format, "blue"));
    });
    const infoBar = el("div", "disp-info-bar");
    infoBar.appendChild(chip);
    contentArea.appendChild(infoBar);

    // Three-column split
    const treeView = el("div", "obj-tree-view");
    treeView.appendChild(el("div", "obj-tree-header", "🌳 " + entry.dispObjs[d.addr].length + " objects"));
    entry.tree.screens.forEach(s => treeView.appendChild(renderObjTree(s)));

    const view3d = el("div", "obj-3d-view");
    build3DScene(view3d, [entry.tree], [d], entry.dispObjs);

    detailPanel = html`<div class="obj-detail-view">
      <p class="empty">Select an object to inspect.</p>
    </div>`;

    const split = html`<div class="obj-split"></div>`;
    split.append(treeView, view3d, detailPanel);
    contentArea.appendChild(split);
  }

  // Subscribe to selection changes
  selectedAddr.sub(() => {
    if (selectedAddr.val && detailPanel) renderObjDetail(selectedAddr.val, detailPanel);
  });

  entries.forEach((entry, i) => {
    const d = entry.disp;
    const btn = el("button", "disp-tab-btn");
    const bufData = d.buf_1?.image_base64 || d.buf_2?.image_base64;
    if (bufData) {
      const thumb = document.createElement("img");
      thumb.className = "disp-tab-thumb"; thumb.src = "data:image/png;base64," + bufData; thumb.draggable = false;
      btn.appendChild(thumb);
    }
    btn.appendChild(document.createTextNode(d.hor_res + "×" + d.ver_res));
    btn.addEventListener("click", () => showDisplay(i));
    tabBtns.push(btn);
    tabBar.appendChild(btn);
  });

  body.appendChild(tabBar);
  body.appendChild(contentArea);
  if (entries.length > 0) showDisplay(0);

  return panel;
}
