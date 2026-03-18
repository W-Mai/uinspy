// Section panel builders for dashboard
import { el, makePanel, makeTable, badge, kvPair, xref, xrefCell, buildCard, progressBar } from "../helpers";
import { C, INDEV_ICONS } from "../constants";
import type { DashboardData } from "../types";

export function buildSimpleTable(data: DashboardData, key: string, cls: string, icon: string, title: string, headers: string[], prefix: string) {
  const items = (data as any)[key] || [];
  const { panel, body } = makePanel(cls, icon, title, items.length);
  body.appendChild(makeTable(headers, items, prefix));
  return panel;
}

export function buildAnimations(data: DashboardData) {
  const items = data.animations || [];
  const { panel, body } = makePanel("panel-animations", "🎬", "Animations", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  items.forEach(a => {
    const statusColor = a.status === "paused" ? "yellow" : a.status === "reverse" ? "mauve" : "green";
    const range = a.end_value - a.start_value;
    const ratio = range !== 0 ? (a.current_value - a.start_value) / range : 0;
    body.appendChild(buildCard(a, {
      cardClass: "anim-card", anchorPrefix: "anim",
      badges: [{ text: a.status || "running", color: statusColor }],
      content: info => {
        info.appendChild(kvPair("callback", a.exec_cb || "-"));
        info.appendChild(kvPair("duration", a.duration + "ms"));
        const valRow = html`<div class="anim-value-row">
          <span class="anim-val-label">${String(a.start_value)}</span>
          <span class="anim-val-label">${String(a.end_value)}</span>
        </div>`;
        // Insert progress bar before the end label
        valRow.insertBefore(progressBar(ratio, "blue"), valRow.lastChild);
        info.appendChild(valRow);
        info.appendChild(el("div", "anim-cur-val", "current: " + a.current_value + "  (" + Math.round(ratio * 100) + "%)"));
        info.appendChild(kvPair("repeat", a.repeat_cnt === C.INFINITE_REPEAT ? "∞" : String(a.repeat_cnt)));
        info.appendChild(kvPair("act_time", a.act_time + "ms"));
      }
    }));
  });
  return panel;
}

export function buildTimers(data: DashboardData) {
  const items = data.timers || [];
  const { panel, body } = makePanel("panel-timers", "⏱", "Timers", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  items.forEach(t => {
    body.appendChild(buildCard(t, {
      cardClass: "timer-card", anchorPrefix: "timer",
      badges: [{ text: t.paused ? "paused" : "active", color: t.paused ? "yellow" : "green" }],
      content: info => {
        info.classList.add("timer-info-row");
        info.appendChild(kvPair("callback", t.timer_cb || "-"));
        info.appendChild(kvPair("period", t.period + "ms"));
        info.appendChild(kvPair("frequency", t.frequency || "-"));
        info.appendChild(kvPair("repeat", t.repeat_count === -1 ? "∞" : String(t.repeat_count)));
        info.appendChild(kvPair("last_run", String(t.last_run)));
      }
    }));
  });
  return panel;
}

export function buildIndevs(data: DashboardData) {
  const items = data.indevs || [];
  const { panel, body } = makePanel("panel-indevs", "🕹", "Input Devices", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  items.forEach(d => {
    const card = buildCard(d, {
      cardClass: "indev-card", anchorPrefix: "indev",
      badges: [{ text: d.enabled ? "enabled" : "disabled", color: d.enabled ? "green" : "red" }],
      content: info => {
        info.appendChild(kvPair("read_cb", d.read_cb || "-"));
        info.appendChild(kvPair("long_press", d.long_press_time + "ms"));
        info.appendChild(kvPair("scroll_limit", String(d.scroll_limit)));
        if (d.display_addr) {
          const row = el("div", "kv-row");
          row.appendChild(el("span", "kv-label", "display"));
          row.appendChild(xref(d.display_addr, "disp"));
          info.appendChild(row);
        }
        if (d.group_addr) {
          const row = el("div", "kv-row");
          row.appendChild(el("span", "kv-label", "group"));
          row.appendChild(xref(d.group_addr, "group"));
          info.appendChild(row);
        }
      }
    });
    const hdr = card.querySelector(".indev-header")!;
    const addrSpan = hdr.firstChild!;
    hdr.insertBefore(el("span", "indev-type-name", d.type_name || "unknown"), addrSpan);
    hdr.insertBefore(el("span", "indev-type-icon", INDEV_ICONS[d.type_name] || "🕹"), hdr.firstChild);
    body.appendChild(card);
  });
  return panel;
}

export function buildImageCache(data: DashboardData) {
  const entries = data.image_cache || [];
  const { panel, body } = makePanel("panel-img-cache", "🖼", "Image Cache", entries.length);
  if (!entries.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  const grid = el("div", "cache-grid");
  entries.forEach(e => {
    const card = el("div", "cache-entry");
    if (e.entry_addr) card.id = "imgcache-" + e.entry_addr;
    if (e.preview_base64) {
      const img = document.createElement("img");
      img.className = "cache-thumb"; img.src = "data:image/png;base64," + e.preview_base64; img.alt = "preview";
      card.appendChild(img);
    }
    const info = html`<div class="cache-info">
      <div class="cache-src">${e.src || "-"}</div>
      <div class="cache-meta-row"></div>
    </div>`;
    const meta = info.querySelector(".cache-meta-row")!;
    meta.append(badge(e.cf || "?", "blue"), el("span", "cache-size-label", e.size || ""), badge("rc=" + e.ref_count, "teal"));
    if (e.decoder_name) info.appendChild(el("div", "cache-decoder-label", e.decoder_name));
    card.appendChild(info);
    grid.appendChild(card);
  });
  body.appendChild(grid);
  return panel;
}

export function buildSubjects(data: DashboardData) {
  const subjects = data.subjects || [];
  const { panel, body } = makePanel("panel-subjects", "📡", "Subjects", subjects.length);
  if (!subjects.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  subjects.forEach(s => {
    const card = el("div", "subject-card");
    if (s.addr) card.id = "subject-" + s.addr;
    const hdr = html`<div class="subject-header">
      <span class="subject-addr">${s.addr || ""}</span>
      <span class="subject-type">${s.type_name}</span>
    </div>`;
    hdr.appendChild(document.createTextNode("  " + (s.observers?.length || 0) + " observers"));
    card.appendChild(hdr);
    if (s.observers?.length) {
      const t = document.createElement("table");
      const th = t.createTHead().insertRow();
      ["addr", "cb", "target_addr", "for_obj"].forEach(h => { const c = document.createElement("th"); c.textContent = h; th.appendChild(c); });
      const tb = t.createTBody();
      s.observers.forEach(o => {
        const r = tb.insertRow();
        if (o.addr) r.id = "observer-" + o.addr;
        r.insertCell().textContent = o.addr || "-";
        r.insertCell().textContent = o.cb || "-";
        xrefCell(r.insertCell(), "target_addr", o.target_addr);
        r.insertCell().textContent = String(o.for_obj);
      });
      card.appendChild(t);
    }
    body.appendChild(card);
  });
  return panel;
}

export function buildGroups(data: DashboardData) {
  const items = data.groups || [];
  const { panel, body } = makePanel("panel-groups", "👥", "Groups", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  items.forEach(g => {
    const badges = [{ text: g.obj_count + " objects", color: "blue" }];
    if (g.frozen) badges.push({ text: "frozen", color: "yellow" });
    if (g.editing) badges.push({ text: "editing", color: "peach" });
    body.appendChild(buildCard(g, {
      cardClass: "group-card", anchorPrefix: "group", badges,
      content: info => {
        info.appendChild(kvPair("wrap", String(g.wrap)));
        if (g.focused_addr) { const row = el("div", "kv-row"); row.appendChild(el("span", "kv-label", "focused")); row.appendChild(xref(g.focused_addr, "obj")); info.appendChild(row); }
        if (g.member_addrs?.length) {
          const mRow = el("div", "group-members");
          mRow.appendChild(el("span", "kv-label", "members"));
          const mList = el("div", "member-list");
          g.member_addrs.forEach(a => mList.appendChild(xref(a, "obj")));
          mRow.appendChild(mList);
          info.appendChild(mRow);
        }
      }
    }));
  });
  return panel;
}

export function buildDrawTasks(data: DashboardData) {
  const items = data.draw_tasks || [];
  const { panel, body } = makePanel("panel-draw-tasks", "📝", "Draw Tasks", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  items.forEach(t => {
    const stateColor = t.state_name === "ready" ? "green" : t.state_name === "queued" ? "yellow" : "mauve";
    body.appendChild(buildCard(t, {
      cardClass: "dtask-card", anchorPrefix: "drawtask",
      badges: [{ text: t.type_name || "?", color: "blue" }, { text: t.state_name || "?", color: stateColor }],
      content: info => {
        if (t.area) {
          info.appendChild(kvPair("area", "(" + t.area.x1 + "," + t.area.y1 + ") → (" + t.area.x2 + "," + t.area.y2 + ")"));
          info.appendChild(kvPair("size", (t.area.x2 - t.area.x1) + " × " + (t.area.y2 - t.area.y1)));
        }
        info.appendChild(kvPair("opacity", String(t.opa)));
        if (t.preferred_draw_unit_id !== undefined) info.appendChild(kvPair("unit_id", String(t.preferred_draw_unit_id)));
      }
    }));
  });
  return panel;
}

export function buildDrawUnits(data: DashboardData) {
  const items = data.draw_units || [];
  const { panel, body } = makePanel("panel-draw-units", "🎨", "Draw Units", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  const grid = el("div", "unit-grid");
  items.forEach(u => {
    const card = html`<div class="unit-card">
      <div class="unit-name">${u.name || "(unnamed)"}</div>
      <div class="unit-idx">${"#" + u.idx}</div>
      <div class="mono-addr">${u.addr}</div>
    </div>`;
    if (u.addr) card.id = "drawunit-" + u.addr;
    grid.appendChild(card);
  });
  body.appendChild(grid);
  return panel;
}

export function buildDecoders(data: DashboardData) {
  const items = data.image_decoders || [];
  const { panel, body } = makePanel("panel-decoders", "🔓", "Decoders", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  const grid = el("div", "decoder-grid");
  items.forEach(d => {
    const card = html`<div class="decoder-card">
      <div class="decoder-name">${d.name || "(unnamed)"}</div>
      <div class="decoder-cbs"></div>
      <div class="mono-addr">${d.addr}</div>
    </div>`;
    if (d.addr) card.id = "decoder-" + d.addr;
    const cbs = card.querySelector(".decoder-cbs")!;
    if (d.info_cb && d.info_cb !== "-") cbs.appendChild(badge("info", "blue"));
    if (d.open_cb && d.open_cb !== "-") cbs.appendChild(badge("open", "green"));
    if (d.close_cb && d.close_cb !== "-") cbs.appendChild(badge("close", "peach"));
    grid.appendChild(card);
  });
  body.appendChild(grid);
  return panel;
}

export function buildFsDrivers(data: DashboardData) {
  const items = data.fs_drivers || [];
  const { panel, body } = makePanel("panel-fs-drivers", "💾", "FS Drivers", items.length);
  if (!items.length) { body.appendChild(el("p", "empty", "No entries.")); return panel; }
  const grid = el("div", "fs-grid");
  items.forEach(d => {
    const card = html`<div class="fs-card">
      <div class="fs-letter">${d.letter + ":"}</div>
      <div class="fs-driver-name">${d.driver_name || "(unnamed)"}</div>
      <div class="fs-info">
        <div class="fs-cbs"></div>
      </div>
    </div>`;
    if (d.addr) card.id = "fsdrv-" + d.addr;
    const info = card.querySelector(".fs-info")!;
    info.insertBefore(kvPair("cache", String(d.cache_size)), info.firstChild);
    const cbs = card.querySelector(".fs-cbs")!;
    if (d.open_cb && d.open_cb !== "-") cbs.appendChild(badge("open", "green"));
    if (d.read_cb && d.read_cb !== "-") cbs.appendChild(badge("read", "blue"));
    if (d.write_cb && d.write_cb !== "-") cbs.appendChild(badge("write", "peach"));
    if (d.close_cb && d.close_cb !== "-") cbs.appendChild(badge("close", "mauve"));
    grid.appendChild(card);
  });
  body.appendChild(grid);
  return panel;
}
