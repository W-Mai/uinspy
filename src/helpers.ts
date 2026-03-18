// Shared DOM helper functions
import { XREF_TARGET } from "./constants";

export function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function xref(addr: string, prefix: string): HTMLElement | Text {
  if (!addr || addr === "None" || addr === "0x0") return document.createTextNode(addr || "-");
  const a = el("a", "xref", addr);
  (a as HTMLAnchorElement).href = "#" + prefix + "-" + addr;
  return a;
}

export function xrefCell(td: HTMLElement, key: string, val: string) {
  const prefix = XREF_TARGET[key];
  if (prefix && val && val !== "None" && val !== "0x0") {
    td.appendChild(xref(val, prefix));
  } else {
    td.textContent = val != null ? String(val) : "-";
  }
}

export function badge(text: string, color: string): HTMLElement {
  return el("span", "badge badge-" + color, text);
}

export function kvPair(label: string, value: string): HTMLElement {
  const row = el("div", "kv-row");
  row.appendChild(el("span", "kv-label", label));
  row.appendChild(el("span", "kv-value", String(value)));
  return row;
}

export function progressBar(ratio: number, color: string): HTMLElement {
  const wrap = el("div", "progress-bar");
  const fill = el("div", "progress-fill " + color);
  fill.style.width = Math.max(0, Math.min(100, ratio * 100)) + "%";
  wrap.appendChild(fill);
  return wrap;
}

export function makeTable(headers: string[], rows: Record<string, unknown>[], anchorPrefix?: string): HTMLElement {
  if (!rows || rows.length === 0) return el("p", "empty", "No entries.");
  const wrap = el("div", "table-wrap");
  const tbl = document.createElement("table");
  const thead = tbl.createTHead();
  const hr = thead.insertRow();
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    hr.appendChild(th);
  });
  const tbody = tbl.createTBody();
  rows.forEach(row => {
    const tr = tbody.insertRow();
    const addr = row.addr as string;
    if (anchorPrefix && addr) tr.id = anchorPrefix + "-" + addr;
    headers.forEach(h => {
      const key = h.toLowerCase().replace(/ /g, "_");
      const td = tr.insertCell();
      const val = row[key];
      if (key === "area" && typeof val === "object") {
        const a = val as { x1: number; y1: number; x2: number; y2: number };
        td.textContent = "(" + a.x1 + "," + a.y1 + "," + a.x2 + "," + a.y2 + ")";
      } else if ((key === "member_addrs" || key === "observer_addrs") && Array.isArray(val)) {
        val.forEach((a: string, i: number) => {
          if (i > 0) td.appendChild(document.createTextNode(", "));
          td.appendChild(xref(a, key === "member_addrs" ? "obj" : "observer"));
        });
      } else {
        xrefCell(td, key, val != null ? String(val) : "-");
      }
    });
  });
  wrap.appendChild(tbl);
  return wrap;
}

export function makeStatPanel(icon: string, label: string, value: number, color: string, section: string): HTMLElement {
  const panel = el("div", "panel panel-stat");
  if (section) {
    panel.style.cursor = "pointer";
    panel.addEventListener("click", () => {
      document.getElementById("sec-" + section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  const body = el("div", "stat-mini");
  body.appendChild(el("div", "stat-icon-wrap " + color, icon));
  const info = el("div", "stat-info");
  info.appendChild(el("div", "stat-value", String(value)));
  info.appendChild(el("div", "stat-label", label));
  body.appendChild(info);
  panel.appendChild(body);
  return panel;
}

export function makePanel(cls: string, icon: string, title: string, count?: number | string): { panel: HTMLElement; body: HTMLElement } {
  const panel = el("div", "panel " + cls);
  panel.id = "sec-" + cls.replace("panel-", "");
  const hdr = el("div", "panel-header");
  hdr.appendChild(el("span", "panel-icon", icon));
  hdr.appendChild(el("span", "panel-title", title));
  if (count !== undefined) hdr.appendChild(el("span", "panel-badge", String(count)));
  panel.appendChild(hdr);
  const body = el("div", "panel-body");
  panel.appendChild(body);
  return { panel, body };
}

export function buildCard(item: { addr?: string }, config: {
  cardClass: string;
  anchorPrefix?: string;
  badges?: { text: string; color: string }[];
  content?: (info: HTMLElement, item: any) => void;
}): HTMLElement {
  const card = el("div", config.cardClass);
  if (config.anchorPrefix && item.addr) card.id = config.anchorPrefix + "-" + item.addr;
  const hdr = el("div", config.cardClass.replace("-card", "-header"));
  hdr.appendChild(el("span", "mono-addr", item.addr || ""));
  config.badges?.forEach(b => hdr.appendChild(badge(b.text, b.color)));
  card.appendChild(hdr);
  const info = el("div", config.cardClass.replace("-card", "-info"));
  config.content?.(info, item);
  card.appendChild(info);
  return card;
}
