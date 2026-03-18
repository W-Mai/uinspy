// Display & Objects mega-panel with tab bar, tree, 3D scene, detail
import { el, makePanel, badge } from "../helpers";
import { countObjects, objDataMap, selectedAddr } from "../state";
import { renderObjTree, renderObjDetail } from "./obj-tree";
import { build3DScene } from "./scene-3d";
import type { DashboardData, ObjNode } from "../types";

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
    // Clear obj data map for new display
    Object.keys(objDataMap).forEach(k => delete objDataMap[k]);

    const entry = entries[idx];
    const d = entry.disp;

    // Info chips
    const infoBar = el("div", "disp-info-bar");
    const chip = el("div", "disp-chip");
    chip.appendChild(el("span", "disp-addr", d.addr || ""));
    chip.appendChild(el("span", "disp-res", d.hor_res + " × " + d.ver_res));
    chip.appendChild(el("span", "disp-screens", d.screen_count + " screens"));
    [d.buf_1, d.buf_2].forEach((b, i) => {
      if (!b) return;
      chip.appendChild(badge("buf " + (i + 1) + " " + b.width + "×" + b.height + " " + b.color_format, "blue"));
    });
    infoBar.appendChild(chip);
    contentArea.appendChild(infoBar);

    // Three-column split
    const split = el("div", "obj-split");

    const treeView = el("div", "obj-tree-view");
    treeView.appendChild(el("div", "obj-tree-header", "🌳 " + entry.dispObjs[d.addr].length + " objects"));
    entry.tree.screens.forEach(s => treeView.appendChild(renderObjTree(s)));
    split.appendChild(treeView);

    const view3d = el("div", "obj-3d-view");
    build3DScene(view3d, [entry.tree], [d], entry.dispObjs);
    split.appendChild(view3d);

    detailPanel = el("div", "obj-detail-view");
    detailPanel.appendChild(el("p", "empty", "Select an object to inspect."));
    split.appendChild(detailPanel);

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
