// 3D exploded object tree view
import { el } from "../helpers";
import { C, DEPTH_COLORS } from "../constants";
import { registerHL, highlightObj, clearHighlight, selectObj } from "../state";
import { Canvas2DRenderer } from "./canvas2d-renderer";
import type { SceneLayer, BufImage, Camera, ISceneRenderer } from "./scene-renderer";
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
    @apply border-s0;
  }
  .obj-3d-view:fullscreen { @apply bg-crust p-2 flex flex-col; }
  .obj-3d-view:fullscreen .scene-viewport { @apply min-h-0; }
  .scene-canvas { @apply block w-full h-full; }
  .scene-tooltip {
    @apply hidden absolute z-50 whitespace-nowrap pointer-events-none rounded-md px-2 py-1 font-mono text-[10px] text-txt bg-base border-s0; box-shadow: 0 4px 12px #0000004d;
  }
`;

interface LayerData {
  addr: string; class_name: string;
  x1: number; y1: number; x2: number; y2: number;
  depth: number; localDepth: number;
  child_count: number; style_count: number; screenIdx: number;
}

function flattenLayers(trees: ObjectTree[]) {
  const layers: LayerData[] = [];
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

// Resolve CSS variable to actual color value
function resolveCSSColor(cssVar: string): string {
  if (!cssVar.startsWith("var(")) return cssVar;
  const name = cssVar.slice(4, -1);
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#89b4fa";
}

type DispObjs = Record<string, { addr: string; x1: number; y1: number; x2: number; y2: number }[]>;

export function build3DScene(container: HTMLElement, trees: ObjectTree[], displays: Display[], dispObjs: DispObjs) {
  const { layers, screenNames, screenMaxLocal } = flattenLayers(trees);
  if (!layers.length) { container.appendChild(el("p", "empty", "No objects.")); return; }

  let maxX = 0, maxY = 0, maxDepth = 0;
  displays.forEach(d => { maxX = Math.max(maxX, d.hor_res || 0); maxY = Math.max(maxY, d.ver_res || 0); });
  layers.forEach(l => { maxDepth = Math.max(maxDepth, l.depth); });
  const sceneW = maxX || 1, sceneH = maxY || 1;

  // Buffer images
  const bufImages: { img: HTMLImageElement; label: string; base64: string }[] = [];
  displays.forEach(d => {
    [d.buf_1, d.buf_2].forEach((b, i) => {
      if (!b?.image_base64) return;
      const img = new Image();
      img.src = "data:image/png;base64," + b.image_base64;
      bufImages.push({ img, label: "Buf" + (i + 1), base64: b.image_base64 });
    });
  });

  // Camera state
  const cam: Camera = {
    rotX: C.DEFAULT_ROT_X, rotY: C.DEFAULT_ROT_Y,
    zoom: 1, panX: 0, panY: 0,
    persp: 1,
  };

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
  bufImages.forEach(bi => {
    const btn = makeToggle(bi.label, true);
    const thumb = html`<img draggable="false" style="height:1.2em;border-radius:2px;vertical-align:middle;image-rendering:pixelated"/>` as HTMLImageElement;
    thumb.src = "data:image/png;base64," + bi.base64;
    btn.appendChild(thumb);
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
    let manualSS = false; // true = user clicked button, only ESC exits
    const SS_IDLE = 30000;

    const enterSS = (manual = false) => {
      manualSS = manual;
      if (!document.fullscreenElement) container.requestFullscreen();
      container.classList.add("screensaver");
      const t0 = performance.now();
      const baseRx = cam.rotX, baseRy = cam.rotY, baseSp = Number(spreadSlider.value);
      const tick = (now: number) => {
        const t = (now - t0) / 1000;
        cam.rotX = Math.max(-90, Math.min(90, baseRx + 12 * Math.sin(t * 0.065) + 5 * Math.sin(t * 0.155)));
        cam.rotY = baseRy + 8 * Math.sin(t * 0.085) + 2 * Math.sin(t * 0.205);
        updateDepths(Math.max(0, baseSp + baseSp * 0.3 * Math.sin(t * 0.055) + baseSp * 0.15 * Math.sin(t * 0.145)));
        renderer.markDirty();
        ssAnimId = requestAnimationFrame(tick);
      };
      ssAnimId = requestAnimationFrame(tick);
    };

    const exitSS = () => {
      if (!container.classList.contains("screensaver")) return;
      container.classList.remove("screensaver");
      if (ssAnimId) { cancelAnimationFrame(ssAnimId); ssAnimId = null; }
      manualSS = false;
      renderer.markDirty();
    };

    const resetSSTimer = () => {
      if (ssTimer) clearTimeout(ssTimer);
      ssTimer = document.fullscreenElement ? setTimeout(() => enterSS(false), SS_IDLE) : null;
    };

    ssBtn.onclick = () => enterSS(true);
    // Auto screensaver: mouse/keyboard exits; manual: only ESC (fullscreenchange) exits
    container.addEventListener("mousemove", () => { if (!manualSS) { exitSS(); resetSSTimer(); } });
    container.addEventListener("mousedown", () => { if (!manualSS) { exitSS(); resetSSTimer(); } });
    container.addEventListener("keydown", () => { if (!manualSS) { exitSS(); resetSSTimer(); } });
    container.addEventListener("wheel", () => { if (!manualSS) { exitSS(); resetSSTimer(); } });
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        // Force stop screensaver — ESC doesn't trigger keydown
        container.classList.remove("screensaver");
        if (ssAnimId) { cancelAnimationFrame(ssAnimId); ssAnimId = null; }
        if (ssTimer) { clearTimeout(ssTimer); ssTimer = null; }
        renderer.markDirty();
      }
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
      btn.onclick = () => { layerVisible[i] = !layerVisible[i]; btn.classList.toggle("active", layerVisible[i]); updateVisibility(); };
      btn.ondblclick = e => {
        e.preventDefault();
        const solo = layerVisible.every((v, j) => j === i ? v : !v);
        if (solo) layerVisible.fill(true); else { layerVisible.fill(false); layerVisible[i] = true; }
        layerBtns.forEach((b, j) => b.classList.toggle("active", layerVisible[j]));
        updateVisibility();
      };
      layerBtns.push(btn); bar.appendChild(btn);
    });
    container.appendChild(bar);
  }

  // Tooltip
  const tooltip = el("div", "scene-tooltip");
  container.appendChild(tooltip);

  // Viewport & canvas
  const viewport = el("div", "scene-viewport");
  const canvas = html`<canvas class="scene-canvas"/>` as HTMLCanvasElement;
  viewport.appendChild(canvas);
  container.appendChild(viewport);

  // Create renderer — WebGL (three.js) or Canvas2D based on build flag
  let renderer: ISceneRenderer;
  if (__UINSPY_THREE__) {
    const { ThreeRenderer } = require("./three-renderer");
    renderer = new ThreeRenderer(canvas, cam);
  } else {
    renderer = new Canvas2DRenderer(canvas, cam);
  }
  renderer.setSceneSize(sceneW, sceneH);

  // Build scene layers
  const sceneLayers: SceneLayer[] = layers.map(l => ({
    x: l.x1, y: l.y1,
    w: Math.max(2, l.x2 - l.x1), h: Math.max(2, l.y2 - l.y1),
    depth: 0,
    borderColor: resolveCSSColor(DEPTH_COLORS[l.depth % DEPTH_COLORS.length]),
    addr: l.addr,
    info: l.class_name + "@" + (l.addr || "?") + " [" + l.x1 + "," + l.y1 + "," + l.x2 + "," + l.y2 + "] children=" + l.child_count + " styles=" + l.style_count,
    screenIdx: l.screenIdx,
    visible: true,
  }));

  // Build buf entries for renderer
  const sceneBufs: BufImage[] = bufImages.map(bi => ({ img: bi.img, depth: 0, visible: true }));
  sceneBufs.forEach(b => renderer.addBuf(b));
  renderer.setLayers(sceneLayers);

  // Depth + visibility update
  let currentSpread = 0; // actual rendered spread value

  function updateDepths(spreadOv?: number) {
    const bordersOn = toggleBorders.dataset.on === "1";
    const screenOffset: Record<number, number> = {};
    let off = 0;
    for (let i = 0; i < screenNames.length; i++) {
      if (layerVisible[i]) { screenOffset[i] = off; off += (screenMaxLocal[i] || 0) + C.SCREEN_GAP; }
    }
    currentSpread = spreadOv ?? (is3d ? Number(spreadSlider.value) : 0);
    layers.forEach((l, idx) => {
      const sl = sceneLayers[idx];
      sl.visible = bordersOn && layerVisible[l.screenIdx];
      sl.depth = (screenOffset[l.screenIdx] !== undefined ? screenOffset[l.screenIdx] + l.localDepth : 0) * currentSpread;
    });
    sceneBufs.forEach(b => { b.depth = -currentSpread * 0.5; });
    renderer.markDirty();
  }

  function updateVisibility() {
    bufToggles.forEach((btn, i) => { sceneBufs[i].visible = btn.dataset.on === "1"; });
    updateDepths();
  }

  // Animation
  let is3d = true;
  let savedRotX = C.DEFAULT_ROT_X as number, savedRotY = C.DEFAULT_ROT_Y as number;
  let animId: number | null = null;

  function ease(t: number) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function animateTo(target: { rotX: number; rotY: number; zoom: number; panX: number; panY: number; spread: number; persp: number }, done?: () => void) {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    const from = { rotX: cam.rotX, rotY: cam.rotY, zoom: cam.zoom, panX: cam.panX, panY: cam.panY, spread: currentSpread, persp: cam.persp };
    const t0 = performance.now();
    function tick(now: number) {
      const t = ease(Math.min((now - t0) / C.ANIM_DURATION, 1));
      cam.rotX = from.rotX + (target.rotX - from.rotX) * t;
      cam.rotY = from.rotY + (target.rotY - from.rotY) * t;
      cam.zoom = from.zoom + (target.zoom - from.zoom) * t;
      cam.panX = from.panX + (target.panX - from.panX) * t;
      cam.panY = from.panY + (target.panY - from.panY) * t;
      cam.persp = from.persp + (target.persp - from.persp) * t;
      updateDepths(from.spread + (target.spread - from.spread) * t);
      if (now - t0 < C.ANIM_DURATION) animId = requestAnimationFrame(tick);
      else {
        animId = null;
        cam.rotX = target.rotX; cam.rotY = target.rotY; cam.zoom = target.zoom;
        cam.panX = target.panX; cam.panY = target.panY; cam.persp = target.persp;
        spreadSlider.value = String(target.spread);
        updateDepths(); done?.();
      }
    }
    animId = requestAnimationFrame(tick);
  }

  let savedSpread = defaultSpread;

  function animateToggle(entering: boolean) {
    if (!entering) { savedRotX = cam.rotX; savedRotY = cam.rotY; savedSpread = Number(spreadSlider.value) || defaultSpread; }
    animateTo({ rotX: entering ? savedRotX : 0, rotY: entering ? savedRotY : 0, zoom: cam.zoom, panX: cam.panX, panY: cam.panY, spread: entering ? savedSpread : 0, persp: cam.persp }, () => {
      spreadSlider.value = String(savedSpread);
    });
  }

  updateDepths();

  // Event bindings
  spreadSlider.oninput = () => updateDepths();
  toggle3d.addEventListener("click", () => { is3d = toggle3d.dataset.on === "1"; spreadSlider.disabled = !is3d; animateToggle(is3d); });
  toggleOrtho.addEventListener("click", () => {
    const ortho = toggleOrtho.dataset.on === "1";
    animateTo({ rotX: cam.rotX, rotY: cam.rotY, zoom: cam.zoom, panX: cam.panX, panY: cam.panY, spread: currentSpread, persp: ortho ? 0 : 1 });
  });
  toggleBorders.addEventListener("click", () => updateVisibility());
  bufToggles.forEach(btn => btn.addEventListener("click", () => updateVisibility()));

  // Mouse interaction
  let dragging: false | "rotate" | "pan" = false;
  let lastX = 0, lastY = 0;

  viewport.onmousedown = e => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); dragging = "pan"; lastX = e.clientX; lastY = e.clientY; viewport.style.cursor = "move"; }
    else if (e.button === 0 && is3d) { dragging = "rotate"; lastX = e.clientX; lastY = e.clientY; viewport.style.cursor = "grabbing"; }
  };
  window.addEventListener("mousemove", e => {
    if (!dragging) {
      // Hover picking
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = renderer.pick(mx, my);
      if (hit) {
        tooltip.textContent = hit.layer.info;
        tooltip.style.display = "block";
        const cr = container.getBoundingClientRect();
        tooltip.style.left = (e.clientX - cr.left + 12) + "px";
        tooltip.style.top = (e.clientY - cr.top - 8) + "px";
        renderer.setHighlight(hit.layer.addr);
        if (hit.layer.addr) highlightObj(hit.layer.addr);
      } else {
        tooltip.style.display = "none";
        renderer.setHighlight(null);
        clearHighlight();
      }
      return;
    }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (dragging === "rotate") {
      cam.rotY += dx * C.ROTATION_SENSITIVITY;
      cam.rotX = Math.max(-90, Math.min(90, cam.rotX - dy * C.ROTATION_SENSITIVITY));
    } else {
      cam.panX += dx / cam.zoom;
      cam.panY += dy / cam.zoom;
    }
    renderer.markDirty();
  });
  window.addEventListener("mouseup", () => { dragging = false; viewport.style.cursor = "grab"; });
  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    if (e.ctrlKey) { cam.zoom = Math.max(C.MIN_ZOOM, Math.min(C.MAX_ZOOM, cam.zoom * (1 - e.deltaY * C.ZOOM_SENSITIVITY))); }
    else { cam.panX -= e.deltaX / cam.zoom; cam.panY -= e.deltaY / cam.zoom; }
    renderer.markDirty();
  }, { passive: false });

  // Click
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    const hit = renderer.pick(e.clientX - rect.left, e.clientY - rect.top);
    if (hit?.layer.addr) {
      selectObj(hit.layer.addr);
      const target = document.getElementById("obj-" + hit.layer.addr);
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
    is3d = true;
    toggle3d.dataset.on = "1"; toggle3d.classList.add("active");
    toggleBorders.dataset.on = "1"; toggleBorders.classList.add("active");
    bufToggles.forEach(btn => { btn.dataset.on = "1"; btn.classList.add("active"); });
    toggleOrtho.dataset.on = "0"; toggleOrtho.classList.remove("active");
    screenNames.forEach((name, i) => { layerVisible[i] = name === "act_scr" || screenNames.length === 1; });
    layerBtns.forEach((b, i) => b.classList.toggle("active", layerVisible[i]));
    spreadSlider.disabled = false;
    animateTo({ rotX: C.DEFAULT_ROT_X, rotY: C.DEFAULT_ROT_Y, zoom: 1, panX: 0, panY: 0, spread: defaultSpread, persp: 1 });
  };
}
