// Object tree rendering and detail panel
import { el, kvPair, xref } from "../helpers";
import { DEPTH_COLORS } from "../constants";
import { registerHL, highlightObj, clearHighlight, selectObj, objDataMap } from "../state";
import type { ObjNode } from "../types";

export function renderObjTree(obj: ObjNode, depth = 0): HTMLElement {
  const det = document.createElement("details");
  det.className = "obj-node";
  if (obj.addr) det.id = "obj-" + obj.addr;
  const sum = document.createElement("summary");
  sum.style.setProperty("--depth-color", DEPTH_COLORS[depth % DEPTH_COLORS.length]);
  sum.textContent = obj.class_name || "obj";
  det.appendChild(sum);

  if (obj.addr) {
    objDataMap[obj.addr] = obj;
    registerHL(obj.addr, det);
    sum.addEventListener("mouseenter", () => highlightObj(obj.addr));
    sum.addEventListener("mouseleave", () => clearHighlight());
    sum.addEventListener("click", e => { e.stopPropagation(); selectObj(obj.addr); });
  }

  obj.children?.forEach(ch => det.appendChild(renderObjTree(ch, depth + 1)));
  return det;
}

export function renderObjDetail(addr: string, panel: HTMLElement) {
  panel.innerHTML = "";
  const obj = objDataMap[addr];
  if (!obj) { panel.appendChild(el("p", "empty", "Select an object to inspect.")); return; }

  const hdr = el("div", "detail-header");
  hdr.appendChild(el("span", "detail-class", obj.class_name || "obj"));
  hdr.appendChild(el("span", "mono-addr", obj.addr));
  panel.appendChild(hdr);

  // Coordinates
  const c = obj.coords || { x1: 0, y1: 0, x2: 0, y2: 0 };
  const coordSec = el("div", "detail-section");
  coordSec.appendChild(el("div", "detail-section-title", "Coordinates"));
  const coordGrid = el("div", "detail-coord-grid");
  (["x1", "y1", "x2", "y2"] as const).forEach(k => {
    coordGrid.appendChild(el("span", "detail-coord-label", k));
    coordGrid.appendChild(el("span", "detail-coord-val", String(c[k] || 0)));
  });
  const w = (c.x2 || 0) - (c.x1 || 0), h = (c.y2 || 0) - (c.y1 || 0);
  coordGrid.appendChild(el("span", "detail-coord-label", "w"));
  coordGrid.appendChild(el("span", "detail-coord-val", String(w)));
  coordGrid.appendChild(el("span", "detail-coord-label", "h"));
  coordGrid.appendChild(el("span", "detail-coord-val", String(h)));
  coordSec.appendChild(coordGrid);
  panel.appendChild(coordSec);

  // References
  const refSec = el("div", "detail-section");
  refSec.appendChild(el("div", "detail-section-title", "References"));
  if (obj.parent_addr) {
    const row = el("div", "kv-row");
    row.appendChild(el("span", "kv-label", "parent"));
    row.appendChild(xref(obj.parent_addr, "obj"));
    refSec.appendChild(row);
  }
  if (obj.group_addr) {
    const row = el("div", "kv-row");
    row.appendChild(el("span", "kv-label", "group"));
    row.appendChild(xref(obj.group_addr, "group"));
    refSec.appendChild(row);
  }
  refSec.appendChild(kvPair("children", String(obj.child_count || 0)));
  refSec.appendChild(kvPair("styles", String(obj.style_count || 0)));
  panel.appendChild(refSec);

  // Styles
  if (obj.styles?.length) {
    const styleSec = el("div", "detail-section");
    styleSec.appendChild(el("div", "detail-section-title", "Styles (" + obj.styles.length + ")"));
    obj.styles.forEach(s => {
      const card = el("div", "detail-style-card");
      card.appendChild(el("div", "detail-style-hdr", "[" + s.index + "] " + s.selector_str + "  " + s.flags_str));
      if (s.properties?.length) {
        const tbl = document.createElement("table");
        tbl.className = "detail-style-table";
        const thead = tbl.createTHead().insertRow();
        ["prop", "value"].forEach(h => { const th = document.createElement("th"); th.textContent = h; thead.appendChild(th); });
        const tbody = tbl.createTBody();
        s.properties.forEach(p => {
          const r = tbody.insertRow();
          r.insertCell().textContent = p.prop_name;
          r.insertCell().textContent = p.value_str;
        });
        card.appendChild(tbl);
      }
      styleSec.appendChild(card);
    });
    panel.appendChild(styleSec);
  }
}
