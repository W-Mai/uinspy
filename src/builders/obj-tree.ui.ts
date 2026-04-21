// Object tree rendering and detail panel
import { el, kvPair, xref } from "../helpers";
import { DEPTH_COLORS } from "../constants";
import { registerHL, highlightObj, clearHighlight, selectObj, focusObj, objDataMap, widgetSummary, getWidgetSpec } from "../state";
import type { ObjNode, WidgetFieldSpec } from "../types";

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
  .obj-summary-hint { @apply text-overlay0 ml-1; }
  .obj-node.obj-selected > summary { @apply bg-nav-active-bg; outline: 1px solid var(--blue); }
  .detail-header { @apply flex items-center gap-2 mb-2.5 pb-2 border-b-s0; }
  .detail-class { @apply text-blue text-sm font-bold; }
  .detail-summary-text { @apply text-overlay1 text-[12px] font-mono px-2 py-1.5 rounded bg-mantle border-s0; }
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
  .detail-state-active {
    @apply text-yellow bg-yellow/10 border-yellow/30;
  }
  .detail-adv-toggle { @apply mt-1; }
  .detail-adv-summary {
    @apply cursor-pointer text-overlay0 text-[10px] font-medium py-0.5;
    list-style: none;
  }
  .detail-adv-summary::before { content: "▸ "; }
  .detail-adv-toggle[open] > .detail-adv-summary::before { content: "▾ "; }
`;

function formatField(v: unknown, spec?: WidgetFieldSpec): string {
  if (v == null) return "-";
  if (spec) {
    if (spec.type === "enum" && spec.names && typeof v === "number") {
      return spec.names[v] ?? String(v);
    }
    if (spec.type === "bool") return v ? "true" : "false";
    if (spec.type === "string" && typeof v === "string") {
      return v.length > 60 ? '"' + v.slice(0, 60) + '…"' : '"' + v + '"';
    }
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function renderObjTree(obj: ObjNode, depth = 0): HTMLElement {
  const det = document.createElement("details");
  det.className = "obj-node";
  if (obj.addr) det.id = "obj-" + obj.addr;
  const sum = document.createElement("summary");
  sum.style.setProperty("--depth-color", DEPTH_COLORS[depth % DEPTH_COLORS.length]);
  const nameText = (obj.name ? obj.name + " " : "") + (obj.class_name || "obj");
  sum.textContent = nameText;
  const hint = widgetSummary(obj.class_name, obj.widget_data as Record<string, unknown>);
  if (hint) {
    const span = document.createElement("span");
    span.className = "obj-summary-hint";
    span.textContent = hint;
    sum.appendChild(span);
  }
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
  const summary = widgetSummary(obj.class_name, obj.widget_data as Record<string, unknown>);
  const hdr = html`<div class="detail-header">
    <span class="detail-class">${obj.class_name || "obj"}</span>
    <span class="mono-addr">${obj.addr}</span>
  </div>`;
  panel.appendChild(hdr);

  // Summary
  if (summary) {
    const sumSec = el("div", "detail-section");
    sumSec.appendChild(el("div", "detail-summary-text", summary));
    panel.appendChild(sumSec);
  }

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

  // State
  if (obj.state_list?.length) {
    const stateSec = el("div", "detail-section");
    stateSec.appendChild(el("div", "detail-section-title", "State"));
    const wrap = el("div", "detail-flags-wrap");
    obj.state_list.forEach(s => wrap.appendChild(el("span", "detail-flag-badge" + (s === "DEFAULT" ? "" : " detail-state-active"), s)));
    stateSec.appendChild(wrap);
    panel.appendChild(stateSec);
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
  if (obj.user_data) refSec.appendChild(kvPair("user_data", obj.user_data));
  if (obj.name) refSec.appendChild(kvPair("name", obj.name));
  refSec.appendChild(kvPair("children", String(obj.child_count || 0)));
  refSec.appendChild(kvPair("styles", String(obj.style_count || 0)));
  panel.appendChild(refSec);

  // Layout & Scroll
  const _n = (v: unknown) => v != null;
  const hasLayout = obj.scroll || _n(obj.ext_click_pad) || _n(obj.ext_draw_size) ||
    _n(obj.scrollbar_mode) || _n(obj.layer_type) || obj.w_layout || obj.h_layout;
  if (hasLayout) {
    const layoutSec = el("div", "detail-section");
    layoutSec.appendChild(el("div", "detail-section-title", "Layout & Scroll"));
    if (obj.scroll) layoutSec.appendChild(kvPair("scroll", `${obj.scroll.x}, ${obj.scroll.y}`));
    if (_n(obj.ext_click_pad)) layoutSec.appendChild(kvPair("ext_click_pad", String(obj.ext_click_pad)));
    if (_n(obj.ext_draw_size)) layoutSec.appendChild(kvPair("ext_draw_size", String(obj.ext_draw_size)));
    if (_n(obj.scrollbar_mode)) layoutSec.appendChild(kvPair("scrollbar_mode", String(obj.scrollbar_mode)));
    if (_n(obj.scroll_dir)) layoutSec.appendChild(kvPair("scroll_dir", String(obj.scroll_dir)));
    if (_n(obj.scroll_snap_x)) layoutSec.appendChild(kvPair("scroll_snap_x", String(obj.scroll_snap_x)));
    if (_n(obj.scroll_snap_y)) layoutSec.appendChild(kvPair("scroll_snap_y", String(obj.scroll_snap_y)));
    if (_n(obj.layer_type)) layoutSec.appendChild(kvPair("layer_type", String(obj.layer_type)));
    if (obj.w_layout) layoutSec.appendChild(kvPair("w_layout", "true"));
    if (obj.h_layout) layoutSec.appendChild(kvPair("h_layout", "true"));
    panel.appendChild(layoutSec);
  }

  // Internal state bits
  const hasInternal = obj.layout_inv || obj.is_deleting || obj.rendered || obj.skip_trans;
  if (hasInternal) {
    const intSec = el("div", "detail-section");
    intSec.appendChild(el("div", "detail-section-title", "Internal"));
    const wrap = el("div", "detail-flags-wrap");
    if (obj.layout_inv) wrap.appendChild(el("span", "detail-flag-badge detail-state-active", "layout_inv"));
    if (obj.is_deleting) wrap.appendChild(el("span", "detail-flag-badge detail-state-active", "is_deleting"));
    if (obj.rendered) wrap.appendChild(el("span", "detail-flag-badge", "rendered"));
    if (obj.skip_trans) wrap.appendChild(el("span", "detail-flag-badge", "skip_trans"));
    intSec.appendChild(wrap);
    panel.appendChild(intSec);
  }

  // Widget Data (spec-driven)
  if (obj.widget_data && Object.keys(obj.widget_data).length) {
    const wd = obj.widget_data as Record<string, unknown>;
    const spec = getWidgetSpec(obj.class_name);
    const fieldSpecs = spec?.fields || {};
    const primary = spec?.primary || [];
    const allKeys = Object.keys(wd);
    const priKeys = primary.filter(k => k in wd);
    const advKeys = allKeys.filter(k => !priKeys.includes(k));

    const wdSec = el("div", "detail-section");
    wdSec.appendChild(el("div", "detail-section-title", "Widget · " + obj.class_name));

    const renderField = (k: string) => {
      const fs = fieldSpecs[k] as WidgetFieldSpec | undefined;
      const raw = wd[k];
      wdSec.appendChild(kvPair(k, formatField(raw, fs)));
    };

    for (const k of (priKeys.length ? priKeys : allKeys.slice(0, 6))) renderField(k);

    const rest = priKeys.length ? advKeys : allKeys.slice(6);
    if (rest.length) {
      const toggle = el("details", "detail-adv-toggle");
      toggle.appendChild(el("summary", "detail-adv-summary", `${rest.length} more fields`));
      const inner = el("div", "");
      for (const k of rest) {
        const fs = fieldSpecs[k] as WidgetFieldSpec | undefined;
        inner.appendChild(kvPair(k, formatField(wd[k], fs)));
      }
      toggle.appendChild(inner);
      wdSec.appendChild(toggle);
    }
    panel.appendChild(wdSec);
  }

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
