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

  // Header
  const hdr = html`<div class="detail-header">
    <span class="detail-class">${obj.class_name || "obj"}</span>
    <span class="mono-addr">${obj.addr}</span>
  </div>`;
  panel.appendChild(hdr);

  // Coordinates
  const c = obj.coords || { x1: 0, y1: 0, x2: 0, y2: 0 };
  const w = (c.x2 || 0) - (c.x1 || 0), h = (c.y2 || 0) - (c.y1 || 0);
  const coordSec = html`<div class="detail-section">
    <div class="detail-section-title">Coordinates</div>
    <div class="detail-coord-grid">
      <span class="detail-coord-label">x1</span><span class="detail-coord-val">${String(c.x1 || 0)}</span>
      <span class="detail-coord-label">y1</span><span class="detail-coord-val">${String(c.y1 || 0)}</span>
      <span class="detail-coord-label">x2</span><span class="detail-coord-val">${String(c.x2 || 0)}</span>
      <span class="detail-coord-label">y2</span><span class="detail-coord-val">${String(c.y2 || 0)}</span>
      <span class="detail-coord-label">w</span><span class="detail-coord-val">${String(w)}</span>
      <span class="detail-coord-label">h</span><span class="detail-coord-val">${String(h)}</span>
    </div>
  </div>`;
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
