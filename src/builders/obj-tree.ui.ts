// Object tree rendering and detail panel
import { el, kvPair, xref } from "../helpers";
import { DEPTH_COLORS } from "../constants";
import { registerHL, highlightObj, clearHighlight, selectObj, focusObj, objDataMap } from "../state";
import type { ObjNode } from "../types";

const __css = css`
  .obj-node { @apply ml-3; }
  .obj-node > summary {
    @apply cursor-pointer text-subtext1 list-none rounded py-[3px] px-[6px] pl-1 font-mono text-[11px];
    transition: background var(--transition);
  }
  .obj-node > summary::-webkit-details-marker { @apply hidden; }
  .obj-node > summary::before {
    content: ""; display: inline-block; width: 6px; height: 6px;
    border-radius: 50%; vertical-align: middle; margin-right: 5px; flex-shrink: 0;
    background: var(--depth-color, var(--overlay0));
  }
  .obj-node[open] > summary::before { border-radius: 2px; }
  .obj-node > summary:hover { @apply bg-hover-summary; }
  .obj-node.obj-selected > summary { @apply bg-nav-active-bg; outline: 1px solid var(--blue); }
  .detail-header { @apply flex items-center gap-2 mb-2.5 pb-2 border-b-s0; }
  .detail-class { @apply text-blue text-sm font-bold; }
  .detail-section { @apply mb-2.5; }
  .detail-section-title { @apply uppercase text-overlay0 text-[10px] font-bold mb-1; letter-spacing: .5px; }
  .detail-coord-grid { @apply flex gap-3 font-mono text-[11px]; }
  .detail-coord-group { @apply flex items-center gap-1.5 rounded px-2 py-1 bg-mantle border-s0; }
  .detail-coord-label { @apply text-overlay1 text-[9px] font-semibold uppercase; }
  .detail-coord-val { @apply text-txt; }
  .detail-style-card { @apply rounded-lg mb-1 p-[6px_8px] bg-mantle border-s0; }
  .detail-style-hdr { @apply text-mauve text-[10px] font-semibold mb-1; }
  .detail-style-table { @apply w-full text-[11px]; }
  .detail-style-table th { @apply text-left p-[1px_4px] text-[9px]; }
  .detail-style-table td { @apply p-[1px_4px]; }
  .detail-flags-wrap { @apply flex flex-wrap gap-1; }
  .detail-flag-badge {
    @apply inline-block rounded px-1.5 py-[1px] font-mono text-[10px] font-medium text-overlay1 bg-surface0 border-s0;
  }
`;

export function renderObjTree(obj: ObjNode, depth = 0): HTMLElement {
  const det = document.createElement("details");
  det.className = "obj-node";
  if (obj.addr) det.id = "obj-" + obj.addr;
  const sum = document.createElement("summary");
  sum.style.setProperty("--depth-color", DEPTH_COLORS[depth % DEPTH_COLORS.length]);
  sum.textContent = obj.class_name || "obj";
  if (obj.flags_list?.includes("HIDDEN")) sum.textContent += " 👁‍🗨";
  det.appendChild(sum);

  if (obj.addr) {
    objDataMap[obj.addr] = obj;
    registerHL(obj.addr, det);
    sum.addEventListener("mouseenter", () => highlightObj(obj.addr));
    sum.addEventListener("mouseleave", () => clearHighlight());
    sum.addEventListener("click", e => { e.stopPropagation(); selectObj(obj.addr); });
    sum.addEventListener("dblclick", e => { e.stopPropagation(); focusObj(obj.addr); });
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
      <div class="detail-coord-group">
        <span class="detail-coord-label">pos</span>
        <span class="detail-coord-val">${String(c.x1 || 0)}, ${String(c.y1 || 0)}</span>
        <span class="detail-coord-label">→</span>
        <span class="detail-coord-val">${String(c.x2 || 0)}, ${String(c.y2 || 0)}</span>
      </div>
      <div class="detail-coord-group">
        <span class="detail-coord-label">size</span>
        <span class="detail-coord-val">${String(w)} × ${String(h)}</span>
      </div>
    </div>
  </div>`;
  panel.appendChild(coordSec);

  // Flags
  if (obj.flags_list?.length) {
    const flagSec = el("div", "detail-section");
    flagSec.appendChild(el("div", "detail-section-title", "Flags"));
    const wrap = el("div", "detail-flags-wrap");
    obj.flags_list.forEach(f => wrap.appendChild(el("span", "detail-flag-badge", f)));
    flagSec.appendChild(wrap);
    panel.appendChild(flagSec);
  }

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
