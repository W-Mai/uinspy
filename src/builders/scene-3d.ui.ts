// 3D exploded object tree view
import { el } from "../helpers";
import { C, DEPTH_COLORS } from "../constants";
import { registerHL, highlightObj, clearHighlight, selectObj, registerOverlay } from "../state";
import type { Display, ObjectTree, ObjNode } from "../types";

const __css = css`
  .scene-controls { @apply flex items-center gap-2 mb-1 py-1.5; }
  .scene-label { @apply text-overlay1 uppercase text-[10px] font-medium; letter-spacing: .3px; }
  .scene-slider { @apply w-30 h-1 cursor-pointer; accent-color: var(--blue); }
  .scene-reset-btn, .scene-toggle-btn, .scene-fullscreen-btn {
    @apply flex items-center gap-1 rounded py-0.5 px-2 text-[10px] text-overlay1 cursor-pointer bg-base border-s0 transition-theme;
  }
  .scene-reset-btn:hover, .scene-toggle-btn:hover, .scene-fullscreen-btn:hover { @apply border-blue text-blue; }
  .scene-spacer { @apply flex-1; }
  .obj-3d-view.screensaver .scene-controls,
  .obj-3d-view.screensaver .scene-layer-bar,
  .obj-3d-view.screensaver .scene-tooltip { @apply !hidden; }
  .obj-3d-view.screensaver .scene-viewport { @apply min-h-0 rounded-none border-0; }
  .scene-toggle-btn { @apply font-semibold; }
  .scene-toggle-btn.active { @apply bg-icon-bg-blue text-blue border-blue; }
  .scene-layer-bar { @apply flex flex-wrap gap-1 py-1; }
  .scene-layer-btn {
    @apply rounded py-0.5 px-2 font-mono text-[10px] font-medium text-overlay0 cursor-pointer select-none bg-base border-s0; border-bottom: 2px solid var(--surface1);
    @apply transition-theme;
  }
  .scene-layer-btn:hover { @apply border-blue text-txt; }
  .scene-layer-btn.active { @apply bg-icon-bg-blue text-txt border-blue; }
  .scene-viewport {
    @apply relative flex-1 w-full min-h-[400px] overflow-hidden cursor-grab rounded-lg bg-crust;
    perspective: 1200px; @apply border-s0; transform-origin: center center;
  }
  .obj-3d-view:fullscreen { @apply bg-crust p-2 flex flex-col; }
  .obj-3d-view:fullscreen .scene-viewport { @apply min-h-0; }
  .scene-3d { @apply absolute; transform-style: preserve-3d; top: 50%; left: 50%; }
  .scene-layer {
    @apply absolute rounded-[2px] cursor-pointer;
    background: var(--scene-layer-bg); border: 1.5px solid;
    transition: background .15s, box-shadow .15s;
  }
  .scene-buf-layer { @apply absolute overflow-hidden pointer-events-none rounded-[2px]; box-shadow: 0 0 0 1px var(--surface1); }
  .scene-buf-layer img { @apply block img-pixel; }
  .scene-buf-overlay { @apply absolute inset-0 w-full h-full pointer-events-none; }
  .scene-layer.hl-active { background: var(--scene-layer-hover-bg); box-shadow: var(--scene-layer-hover-shadow); z-index: 10; }
  .obj-node.hl-active > summary { @apply bg-nav-active-bg text-blue rounded; }
  .scene-tooltip {
    @apply hidden absolute z-50 whitespace-nowrap pointer-events-none rounded-md px-2 py-1 font-mono text-[10px] text-txt bg-base border-s0; box-shadow: 0 4px 12px #0000004d;
  }
`;

interface Layer {
  addr: string; class_name: string;
  x1: number; y1: number; x2: number; y2: number;
  depth: number; localDepth: number;
  child_count: number; style_count: number; screenIdx: number;
}

function flattenLayers(trees: ObjectTree[]) {
  const layers: Layer[] = [];
  const screenNames: string[] = [];
  const screenMaxLocal: Record<number, number> = {};
  let globalOffset = 0, sIdx = 0;

  trees.forEach(t => (t.screens || []).forEach(s => {
    const idx = sIdx++;
    screenNames.push(s.layer_name || s.class_name || "screen_" + idx);
    let maxLocal = 0;
    function walk(obj: ObjNode, ld: number) {
      const c = obj.coords || { x1: 0, y1: 0, x2: 0, y2: 0 };
      layers.push({
        addr: obj.addr, class_name: obj.class_name || "obj",
        x1: c.x1 || 0, y1: c.y1 || 0, x2: c.x2 || 0, y2: c.y2 || 0,
        depth: globalOffset + ld, localDepth: ld,
        child_count: obj.child_count || 0, style_count: obj.style_count || 0, screenIdx: idx,
      });
      maxLocal = Math.max(maxLocal, ld);
      obj.children?.forEach(ch => walk(ch, ld + 1));
    }
    walk(s, 0);
    screenMaxLocal[idx] = maxLocal;
    globalOffset += maxLocal + C.SCREEN_GAP;
  }));

  return { layers, screenNames, screenMaxLocal };
}

type DispObjs = Record<string, { addr: string; x1: number; y1: number; x2: number; y2: number }[]>;

export function build3DScene(container: HTMLElement, trees: ObjectTree[], displays: Display[], dispObjs: DispObjs) {
  const { layers, screenNames, screenMaxLocal } = flattenLayers(trees);
  if (!layers.length) { container.appendChild(el("p", "empty", "No objects.")); return; }

  // Scene bounds from display resolution
  let maxX = 0, maxY = 0, maxDepth = 0;
  displays.forEach(d => { maxX = Math.max(maxX, d.hor_res || 0); maxY = Math.max(maxY, d.ver_res || 0); });
  layers.forEach(l => { maxDepth = Math.max(maxDepth, l.depth); });
  const sceneW = maxX || 1, sceneH = maxY || 1;
  const scale = C.VIEWPORT_SIZE / Math.max(sceneW, sceneH);
  const sw = sceneW * scale, sh = sceneH * scale;

  // Buffer layers (supports buf_1 + buf_2)
  const bufEntries: { el: HTMLElement; label: string; base64: string }[] = [];
  displays.forEach(d => {
    [d.buf_1, d.buf_2].forEach((b, i) => {
      if (!b?.image_base64) return;
      const layer = el("div", "scene-buf-layer");
      layer.style.width = sw + "px"; layer.style.height = sh + "px";
      const img = html`<img draggable="false" style="width:100%;height:100%;object-fit:fill"/>` as HTMLImageElement;
      img.src = "data:image/png;base64," + b.image_base64;
      layer.appendChild(img);
      const bufCanvas = html`<canvas class="scene-buf-overlay" width="${sw}" height="${sh}"/>` as HTMLCanvasElement;
      layer.appendChild(bufCanvas);
      registerOverlay(d.addr + "-3d-buf" + (i + 1), { canvas: bufCanvas, w: d.hor_res, h: d.ver_res, objs: dispObjs[d.addr] || [] });
      bufEntries.push({ el: layer, label: "Buf" + (i + 1), base64: b.image_base64 });
    });
  });
  const hasBuf = bufEntries.length > 0;

  // Controls
  const makeToggle = (label: string, on: boolean) => {
    const btn = el("button", "scene-toggle-btn" + (on ? " active" : ""), label);
    btn.dataset.on = on ? "1" : "0";
    btn.onclick = () => { const v = btn.dataset.on === "1"; btn.dataset.on = v ? "0" : "1"; btn.classList.toggle("active", !v); };
    return btn;
  };
  const controls = el("div", "scene-controls");
  const toggle3d = makeToggle("3D", true);
  const toggleBorders = makeToggle("Borders", true);
  const bufToggles: HTMLButtonElement[] = [];
  const toggleOrtho = makeToggle("Ortho", false);
  controls.append(toggle3d, toggleBorders);
  bufEntries.forEach((be, i) => {
    const btn = makeToggle(be.label, true);
    const thumb = html`<img draggable="false" style="height:1.2em;border-radius:2px;vertical-align:middle;image-rendering:pixelated"/>` as HTMLImageElement;
    thumb.src = "data:image/png;base64," + be.base64;
    btn.appendChild(thumb);
    btn.addEventListener("click", () => { be.el.style.display = btn.dataset.on === "1" ? "" : "none"; });
    bufToggles.push(btn);
    controls.appendChild(btn);
  });
  controls.appendChild(toggleOrtho);

  const defaultSpread = maxDepth > 0 ? Math.round(300 / maxDepth) : 30;
  const spreadSlider = html`<input type="range" min="0" max="${Math.max(200, defaultSpread * 5)}" value="${defaultSpread}" class="scene-slider"/>` as HTMLInputElement;
  controls.appendChild(el("label", "scene-label", "Z Spread"));
  controls.appendChild(spreadSlider);
  const resetBtn = el("button", "scene-reset-btn", "Reset");
  const spacer = el("span", "scene-spacer");
  const fsBtn = el("button", "scene-fullscreen-btn", "⛶");
  fsBtn.title = "Fullscreen";
  fsBtn.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
  };
  controls.append(resetBtn, spacer);

  if (__UINSPY_SCREENSAVER__) {
    const ssBtn = el("button", "scene-fullscreen-btn", "🎬");
    ssBtn.title = "Screensaver";
    let ssAnimId: number | null = null;
    let ssTimer: ReturnType<typeof setTimeout> | null = null;
    const SS_IDLE = 30000;

    const enterSS = () => {
      if (!document.fullscreenElement) container.requestFullscreen();
      container.classList.add("screensaver");
      const t0 = performance.now();
      const baseRx = st.rotX, baseRy = st.rotY, baseSp = Number(spreadSlider.value);
      const tick = (now: number) => {
        const t = (now - t0) / 1000;
        // Smooth non-linear wandering via layered sine waves
        const rx = baseRx + 12 * Math.sin(t * 0.065) + 5 * Math.sin(t * 0.155);
        const ry = baseRy + 8 * Math.sin(t * 0.085) + 2 * Math.sin(t * 0.205);
        const sp = Math.max(0, baseSp + baseSp * 0.3 * Math.sin(t * 0.055) + baseSp * 0.15 * Math.sin(t * 0.145));
        st.rotX = Math.max(-90, Math.min(90, rx));
        st.rotY = ry;
        applyRot();
        applyVis(sp);
        ssAnimId = requestAnimationFrame(tick);
      };
      ssAnimId = requestAnimationFrame(tick);
    };

    const exitSS = () => {
      if (!container.classList.contains("screensaver")) return;
      container.classList.remove("screensaver");
      if (ssAnimId) { cancelAnimationFrame(ssAnimId); ssAnimId = null; }
      applyRot(); applyVis();
    };

    const resetSSTimer = () => {
      if (ssTimer) clearTimeout(ssTimer);
      ssTimer = document.fullscreenElement ? setTimeout(enterSS, SS_IDLE) : null;
    };

    ssBtn.onclick = enterSS;
    container.addEventListener("mousemove", () => { exitSS(); resetSSTimer(); });
    container.addEventListener("mousedown", () => { exitSS(); resetSSTimer(); });
    container.addEventListener("keydown", () => { exitSS(); resetSSTimer(); });
    container.addEventListener("wheel", () => { exitSS(); resetSSTimer(); });
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) { exitSS(); if (ssTimer) { clearTimeout(ssTimer); ssTimer = null; } }
      else resetSSTimer();
    });
    controls.appendChild(ssBtn);
  }

  controls.appendChild(fsBtn);
  container.appendChild(controls);

  // Layer filter bar
  const layerVisible: boolean[] = [];
  const layerBtns: HTMLElement[] = [];
  if (screenNames.length > 0) {
    const bar = el("div", "scene-layer-bar");
    screenNames.forEach((name, i) => {
      const on = name === "act_scr" || screenNames.length === 1;
      layerVisible.push(on);
      const btn = el("button", "scene-layer-btn" + (on ? " active" : ""), name);
      btn.style.borderBottomColor = DEPTH_COLORS[i % DEPTH_COLORS.length];
      btn.onclick = () => { layerVisible[i] = !layerVisible[i]; btn.classList.toggle("active", layerVisible[i]); applyVis(); };
      btn.ondblclick = e => {
        e.preventDefault();
        const solo = layerVisible.every((v, j) => j === i ? v : !v);
        if (solo) layerVisible.fill(true); else { layerVisible.fill(false); layerVisible[i] = true; }
        layerBtns.forEach((b, j) => b.classList.toggle("active", layerVisible[j]));
        applyVis();
      };
      layerBtns.push(btn); bar.appendChild(btn);
    });
    container.appendChild(bar);
  }

  // Tooltip
  const tooltip = el("div", "scene-tooltip");
  container.appendChild(tooltip);

  // Viewport & scene
  const viewport = el("div", "scene-viewport");
  const scene = el("div", "scene-3d");
  scene.style.width = sw + "px"; scene.style.height = sh + "px";
  viewport.appendChild(scene);
  container.appendChild(viewport);
  bufEntries.forEach(be => scene.appendChild(be.el));

  // Layer elements
  const layerEls: { el: HTMLElement; depth: number; localDepth: number; screenIdx: number }[] = [];
  layers.forEach(l => {
    const div = el("div", "scene-layer");
    const w = (l.x2 - l.x1) * scale, h = (l.y2 - l.y1) * scale;
    div.style.width = Math.max(2, w) + "px"; div.style.height = Math.max(2, h) + "px";
    div.style.left = (l.x1 * scale) + "px"; div.style.top = (l.y1 * scale) + "px";
    div.style.borderColor = DEPTH_COLORS[l.depth % DEPTH_COLORS.length];
    div.dataset.depth = String(l.depth); div.dataset.addr = l.addr || "";
    div.dataset.screenIdx = String(l.screenIdx);
    div.dataset.info = l.class_name + "@" + (l.addr || "?") + " [" + l.x1 + "," + l.y1 + "," + l.x2 + "," + l.y2 + "] children=" + l.child_count + " styles=" + l.style_count;
    if (l.addr) registerHL(l.addr, div);
    layerEls.push({ el: div, depth: l.depth, localDepth: l.localDepth, screenIdx: l.screenIdx });
    scene.appendChild(div);
  });

  // Interaction state
  const st: { rotX: number; rotY: number; dragging: false | "rotate" | "pan"; lastX: number; lastY: number; is3d: boolean; zoom: number; panX: number; panY: number } = { rotX: C.DEFAULT_ROT_X, rotY: C.DEFAULT_ROT_Y, dragging: false, lastX: 0, lastY: 0, is3d: true, zoom: 1, panX: 0, panY: 0 };
  let savedRotX = C.DEFAULT_ROT_X as number, savedRotY = C.DEFAULT_ROT_Y as number;
  let animId: number | null = null;

  function applyVis(spreadOv?: number) {
    const bordersOn = toggleBorders.dataset.on === "1";
    const screenOffset: Record<number, number> = {};
    let off = 0;
    for (let i = 0; i < screenNames.length; i++) {
      if (layerVisible[i]) { screenOffset[i] = off; off += (screenMaxLocal[i] || 0) + C.SCREEN_GAP; }
    }
    const spread = spreadOv ?? (st.is3d ? Number(spreadSlider.value) : 0);
    layerEls.forEach(le => {
      if (!bordersOn || !layerVisible[le.screenIdx]) { le.el.style.display = "none"; return; }
      le.el.style.display = "";
      le.el.style.transform = "translateZ(" + ((screenOffset[le.screenIdx] + le.localDepth) * spread) + "px)";
    });
    bufEntries.forEach(be => { be.el.style.transform = "translateZ(" + (-spread * 1.5) + "px)"; });
  }

  function applyRot(ov?: { rotX: number; rotY: number }) {
    const ortho = toggleOrtho.dataset.on === "1";
    viewport.style.perspective = ortho ? "none" : C.PERSPECTIVE_DISTANCE + "px";
    const rx = ov ? ov.rotX : st.rotX, ry = ov ? ov.rotY : st.rotY;
    const base = "translate(-50%,-50%) scale(" + st.zoom + ") translate(" + (st.panX / st.zoom) + "px," + (st.panY / st.zoom) + "px)";
    scene.style.transform = (st.is3d || ov) ? base + " rotateX(" + rx + "deg) rotateY(" + ry + "deg)" : base;
  }

  function ease(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function animateToggle(entering: boolean) {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (!entering) { savedRotX = st.rotX; savedRotY = st.rotY; }
    const [fromRx, fromRy, toRx, toRy] = entering ? [0, 0, savedRotX, savedRotY] : [savedRotX, savedRotY, 0, 0];
    const targetSpread = Number(spreadSlider.value);
    const t0 = performance.now();
    function tick(now: number) {
      const t = ease(Math.min((now - t0) / C.ANIM_DURATION, 1));
      applyRot({ rotX: fromRx + (toRx - fromRx) * t, rotY: fromRy + (toRy - fromRy) * t });
      applyVis(entering ? targetSpread * t : targetSpread * (1 - t));
      if (now - t0 < C.ANIM_DURATION) animId = requestAnimationFrame(tick);
      else { animId = null; st.rotX = toRx; st.rotY = toRy; applyRot(); applyVis(); }
    }
    animId = requestAnimationFrame(tick);
  }

  applyVis(); applyRot();

  // Event bindings
  spreadSlider.oninput = () => applyVis();
  toggle3d.addEventListener("click", () => { st.is3d = toggle3d.dataset.on === "1"; spreadSlider.disabled = !st.is3d; animateToggle(st.is3d); });
  toggleOrtho.addEventListener("click", () => applyRot());
  toggleBorders.addEventListener("click", () => applyVis());
  // (buf toggle events already bound above)

  // Mouse interaction
  viewport.onmousedown = e => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); st.dragging = "pan"; st.lastX = e.clientX; st.lastY = e.clientY; viewport.style.cursor = "move"; }
    else if (e.button === 0 && st.is3d) { st.dragging = "rotate"; st.lastX = e.clientX; st.lastY = e.clientY; viewport.style.cursor = "grabbing"; }
  };
  window.addEventListener("mousemove", e => {
    if (!st.dragging) return;
    const dx = e.clientX - st.lastX, dy = e.clientY - st.lastY;
    st.lastX = e.clientX; st.lastY = e.clientY;
    if (st.dragging === "rotate") { st.rotY += dx * C.ROTATION_SENSITIVITY; st.rotX = Math.max(-90, Math.min(90, st.rotX - dy * C.ROTATION_SENSITIVITY)); }
    else { st.panX += dx / st.zoom; st.panY += dy / st.zoom; }
    applyRot();
  });
  window.addEventListener("mouseup", () => { st.dragging = false; viewport.style.cursor = "grab"; });
  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    if (e.ctrlKey) { st.zoom = Math.max(C.MIN_ZOOM, Math.min(C.MAX_ZOOM, st.zoom * (1 - e.deltaY * C.ZOOM_SENSITIVITY))); }
    else { st.panX -= e.deltaX / st.zoom; st.panY -= e.deltaY / st.zoom; }
    applyRot();
  }, { passive: false });

  // Hover & click
  scene.addEventListener("mouseover", e => {
    const t = (e.target as HTMLElement).closest(".scene-layer") as HTMLElement | null;
    if (t) { tooltip.textContent = t.dataset.info || ""; tooltip.style.display = "block"; if (t.dataset.addr) highlightObj(t.dataset.addr); }
  });
  scene.addEventListener("mouseout", e => {
    if ((e.target as HTMLElement).closest(".scene-layer")) { tooltip.style.display = "none"; clearHighlight(); }
  });
  scene.addEventListener("mousemove", e => {
    if (tooltip.style.display === "block") {
      const r = container.getBoundingClientRect();
      tooltip.style.left = (e.clientX - r.left + 12) + "px"; tooltip.style.top = (e.clientY - r.top - 8) + "px";
    }
  });
  scene.addEventListener("click", e => {
    const t = (e.target as HTMLElement).closest(".scene-layer") as HTMLElement | null;
    if (t?.dataset.addr) {
      selectObj(t.dataset.addr);
      const target = document.getElementById("obj-" + t.dataset.addr);
      if (target) {
        let p = target.parentElement;
        while (p) { if (p.tagName === "DETAILS") (p as HTMLDetailsElement).open = true; p = p.parentElement; }
        (target as HTMLDetailsElement).open = true;
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  });

  // Reset
  resetBtn.onclick = () => {
    st.rotX = C.DEFAULT_ROT_X; st.rotY = C.DEFAULT_ROT_Y; st.zoom = 1; st.panX = 0; st.panY = 0; st.is3d = true;
    spreadSlider.value = String(defaultSpread); spreadSlider.disabled = false;
    toggle3d.dataset.on = "1"; toggle3d.classList.add("active");
    toggleBorders.dataset.on = "1"; toggleBorders.classList.add("active");
    bufToggles.forEach(btn => { btn.dataset.on = "1"; btn.classList.add("active"); });
    bufEntries.forEach(be => { be.el.style.display = ""; });
    toggleOrtho.dataset.on = "0"; toggleOrtho.classList.remove("active");
    screenNames.forEach((name, i) => { layerVisible[i] = name === "act_scr" || screenNames.length === 1; });
    layerBtns.forEach((b, i) => b.classList.toggle("active", layerVisible[i]));
    applyRot(); applyVis();
  };
}
