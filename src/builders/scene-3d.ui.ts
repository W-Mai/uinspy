// 3D exploded object tree view
import { el } from "../helpers";
import { C, DEPTH_COLORS } from "../constants";
import { registerHL, highlightObj, clearHighlight, selectObj, onHL, onFocus } from "../state";
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
  .viewcube-wrap {
    @apply absolute z-40;
    perspective: 250px;
  }
  .obj-3d-view.screensaver .viewcube-wrap { @apply !hidden; }
  .viewcube {
    width: 100%; height: 100%; position: relative;
    transform-style: preserve-3d;
    transition: transform 0.01s;
  }
  .vc-face, .vc-edge, .vc-corner {
    position: absolute; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font: 600 8px/1 system-ui; color: var(--overlay1);
    backface-visibility: visible;
    transition: background 0.15s, color 0.15s;
    user-select: none;
  }
  .vc-face {
    background: var(--surface0); border: 1px solid var(--surface1);
    opacity: 0.85;
  }
  .vc-face:hover { background: var(--blue); color: var(--base); opacity: 1; }
  .vc-edge {
    background: var(--surface1); opacity: 0.6;
  }
  .vc-edge:hover { background: var(--blue); opacity: 1; }
  .vc-corner {
    width: 15px; height: 15px;
    background: var(--surface1); opacity: 0.5; border-radius: 2px;
  }
  .vc-corner:hover { background: var(--blue); opacity: 1; }
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

export function build3DScene(container: HTMLElement, trees: ObjectTree[], displays: Display[], dispObjs: DispObjs): (() => void) | void {
  const { layers, screenNames, screenMaxLocal } = flattenLayers(trees);
  if (!layers.length) { container.appendChild(el("p", "empty", "No objects.")); return; }
  let alive = true;

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
  const spreadMax = Math.max(500, defaultSpread * 5);
  const spreadSlider = html`<input type="range" min="0" max="${spreadMax}" value="${defaultSpread}" class="scene-slider"/>` as HTMLInputElement;
  controls.appendChild(el("label", "scene-label", "Z Spread"));
  controls.appendChild(spreadSlider);

  // Depth range filter
  let depthRange = { min: 0, max: maxDepth };
  const depthMinSlider = html`<input type="range" min="0" max="${maxDepth}" value="0" class="scene-slider"/>` as HTMLInputElement;
  const depthMaxSlider = html`<input type="range" min="0" max="${maxDepth}" value="${maxDepth}" class="scene-slider"/>` as HTMLInputElement;
  controls.appendChild(el("label", "scene-label", "Depth"));
  controls.appendChild(depthMinSlider);
  controls.appendChild(depthMaxSlider);
  const resetBtn = el("button", "scene-reset-btn", "Reset");
  const spacer = el("span", "scene-spacer");
  const fsBtn = el("button", "scene-fullscreen-btn", "⛶");
  fsBtn.title = "Fullscreen";
  fsBtn.onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else container.requestFullscreen();
  };
  controls.append(resetBtn, spacer);

  let inScreensaver = false;

  if (__UINSPY_SCREENSAVER__) {
    const ssBtn = el("button", "scene-fullscreen-btn", "🎬");
    ssBtn.title = "Screensaver";
    let ssAnimId: number | null = null;
    let ssTimer: ReturnType<typeof setTimeout> | null = null;
    let manualSS = false; // true = user clicked button, only ESC exits
    const SS_IDLE = 30000;

    const enterSS = (manual = false) => {
      manualSS = manual;
      inScreensaver = true;
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
      inScreensaver = false;
      renderer.markDirty();
    };

    const resetSSTimer = () => {
      if (ssTimer) clearTimeout(ssTimer);
      ssTimer = document.fullscreenElement ? setTimeout(() => enterSS(false), SS_IDLE) : null;
    };

    ssBtn.onclick = () => enterSS(true);
    // Auto screensaver: mouse/keyboard exits; manual: only ESC (fullscreenchange) exits
    for (const ev of ["mousemove", "mousedown", "keydown", "wheel"] as const)
      container.addEventListener(ev, () => { if (!manualSS) { exitSS(); resetSSTimer(); } });
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement) {
        // Force stop screensaver — ESC doesn't trigger keydown
        container.classList.remove("screensaver");
        if (ssAnimId) { cancelAnimationFrame(ssAnimId); ssAnimId = null; }
        if (ssTimer) { clearTimeout(ssTimer); ssTimer = null; }
        inScreensaver = false;
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
      btn.onclick = () => { layerVisible[i] = !layerVisible[i]; btn.classList.toggle("active", layerVisible[i]); updateDepthSliderRange(); updateVisibility(); };
      btn.ondblclick = e => {
        e.preventDefault();
        const solo = layerVisible.every((v, j) => j === i ? v : !v);
        if (solo) layerVisible.fill(true); else { layerVisible.fill(false); layerVisible[i] = true; }
        layerBtns.forEach((b, j) => b.classList.toggle("active", layerVisible[j]));
        updateDepthSliderRange(); updateVisibility();
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

  // ViewCube — CSS 3D orientation gizmo
  const S = C.VC_FACE / 2;
  type VCPreset = { rotX: number; rotY: number };
  type VCItem = { transform: string; preset: VCPreset; w: number; h: number; label?: string; cls: string };
  const vcItems: VCItem[] = [
    // 6 faces
    ...[
      [`translateZ(${S}px)`, 0, 0, "Front"], [`rotateY(180deg) translateZ(${S}px)`, 0, 180, "Back"],
      [`rotateY(90deg) translateZ(${S}px)`, 0, -90, "Right"], [`rotateY(-90deg) translateZ(${S}px)`, 0, 90, "Left"],
      [`rotateX(90deg) translateZ(${S}px)`, -90, 0, "Top"], [`rotateX(-90deg) translateZ(${S}px)`, 90, 0, "Bot"],
    ].map(([t, rx, ry, l]) => ({ transform: t as string, preset: { rotX: rx as number, rotY: ry as number }, w: C.VC_FACE, h: C.VC_FACE, label: l as string, cls: "vc-face" })),
    // 12 edges
    ...([
      [`translateY(-${S}px) translateZ(${S}px)`, -45, 0, C.VC_FACE, C.VC_EDGE],
      [`translateY(${S}px) translateZ(${S}px)`, 45, 0, C.VC_FACE, C.VC_EDGE],
      [`translateX(-${S}px) translateZ(${S}px)`, 0, 45, C.VC_EDGE, C.VC_FACE],
      [`translateX(${S}px) translateZ(${S}px)`, 0, -45, C.VC_EDGE, C.VC_FACE],
      [`translateY(-${S}px) translateZ(-${S}px) rotateY(180deg)`, -45, 180, C.VC_FACE, C.VC_EDGE],
      [`translateY(${S}px) translateZ(-${S}px) rotateY(180deg)`, 45, 180, C.VC_FACE, C.VC_EDGE],
      [`translateX(-${S}px) translateZ(-${S}px) rotateY(180deg)`, 0, 135, C.VC_EDGE, C.VC_FACE],
      [`translateX(${S}px) translateZ(-${S}px) rotateY(180deg)`, 0, -135, C.VC_EDGE, C.VC_FACE],
      [`translateX(-${S}px) translateY(-${S}px) rotateY(90deg)`, -45, 90, C.VC_FACE, C.VC_EDGE],
      [`translateX(${S}px) translateY(-${S}px) rotateY(90deg)`, -45, -90, C.VC_FACE, C.VC_EDGE],
      [`translateX(-${S}px) translateY(${S}px) rotateY(90deg)`, 45, 90, C.VC_FACE, C.VC_EDGE],
      [`translateX(${S}px) translateY(${S}px) rotateY(90deg)`, 45, -90, C.VC_FACE, C.VC_EDGE],
    ] as [string, number, number, number, number][]).map(([t, rx, ry, w, h]) => ({ transform: t, preset: { rotX: rx, rotY: ry }, w, h, cls: "vc-edge" })),
    // 8 corners
    ...([[-1,-1,1,45], [1,-1,1,-45], [-1,1,1,45], [1,1,1,-45], [-1,-1,-1,135], [1,-1,-1,-135], [-1,1,-1,135], [1,1,-1,-135]] as [number,number,number,number][])
      .map(([sx, sy, sz, ry]) => ({ transform: `translate3d(${sx*S}px,${sy*S}px,${sz*S}px)`, preset: { rotX: sy * 45, rotY: ry }, w: C.VC_CORNER, h: C.VC_CORNER, cls: "vc-corner" })),
  ];

  const vcWrap = el("div", "viewcube-wrap");
  vcWrap.style.cssText = `top:${C.VC_TOP}px;right:${C.VC_RIGHT}px;width:${C.VC_SIZE}px;height:${C.VC_SIZE}px`;
  const vcCube = el("div", "viewcube");
  const C2 = C.VC_SIZE / 2;
  for (const item of vcItems) {
    const d = el("div", item.cls, item.label);
    d.style.cssText = `transform:${item.transform};width:${item.w}px;height:${item.h}px;left:${(C.VC_SIZE-item.w)/2}px;top:${(C.VC_SIZE-item.h)/2}px`;
    d.onclick = () => animateTo({ rotX: item.preset.rotX, rotY: item.preset.rotY });
    vcCube.appendChild(d);
  }
  vcWrap.appendChild(vcCube);
  viewport.appendChild(vcWrap);

  function updateViewCube() {
    vcCube.style.transform = `rotateX(${cam.rotX}deg) rotateY(${cam.rotY}deg)`;
    // Match perspective/ortho with main view
    const p = 250 + (1 - cam.persp) * 2000;
    vcWrap.style.perspective = `${p}px`;
  }

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

  // Sync viewcube on every dirty
  const _origMarkDirty = renderer.markDirty.bind(renderer);
  renderer.markDirty = () => { _origMarkDirty(); updateViewCube(); };
  updateViewCube();

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

  // Sync highlight from obj-tree or other sources
  onHL(addr => renderer.setHighlight(addr));
  onFocus(addr => focusLayer(addr));

  // Depth + visibility update
  let currentSpread = 0; // actual rendered spread value

  function computeScreenOffsets(): Record<number, number> {
    const o: Record<number, number> = {};
    let off = 0;
    for (let i = 0; i < screenNames.length; i++) {
      if (layerVisible[i]) { o[i] = off; off += (screenMaxLocal[i] || 0) + C.SCREEN_GAP; }
    }
    return o;
  }

  function updateDepthSliderRange() {
    const so = computeScreenOffsets();
    let visMax = 0;
    layers.forEach(l => { if (so[l.screenIdx] !== undefined) visMax = Math.max(visMax, so[l.screenIdx] + l.localDepth); });
    const prevMax = Number(depthMaxSlider.max);
    depthMinSlider.max = String(visMax);
    depthMaxSlider.max = String(visMax);
    if (depthRange.max >= prevMax) { depthRange.max = visMax; depthMaxSlider.value = String(visMax); }
    else if (depthRange.max > visMax) { depthRange.max = visMax; depthMaxSlider.value = String(visMax); }
    if (depthRange.min > visMax) { depthRange.min = visMax; depthMinSlider.value = String(visMax); }
  }

  function updateDepths(spreadOv?: number, rangeOv?: { min: number; max: number }) {
    const bordersOn = toggleBorders.dataset.on === "1";
    const range = rangeOv ?? depthRange;
    const screenOffset = computeScreenOffsets();
    currentSpread = spreadOv ?? (is3d ? Number(spreadSlider.value) : 0.1);
    // Compressed depth: count only visible layers in range
    let compressedIdx = 0;
    const compressedDepth: Record<number, number> = {};
    const seenDepths = new Set<number>();
    layers.forEach(l => {
      const gd = (screenOffset[l.screenIdx] !== undefined ? screenOffset[l.screenIdx] + l.localDepth : -1);
      if (gd >= Math.round(range.min) && gd <= Math.round(range.max) && !seenDepths.has(gd)) {
        seenDepths.add(gd);
        compressedDepth[gd] = compressedIdx++;
      }
    });
    layers.forEach((l, idx) => {
      const sl = sceneLayers[idx];
      const gd = (screenOffset[l.screenIdx] !== undefined ? screenOffset[l.screenIdx] + l.localDepth : -1);
      const inRange = gd >= Math.round(range.min) && gd <= Math.round(range.max);
      sl.visible = bordersOn && layerVisible[l.screenIdx] && inRange;
      sl.depth = (compressedDepth[gd] ?? 0) * currentSpread;
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

  function animateTo(target: Partial<{ rotX: number; rotY: number; zoom: number; panX: number; panY: number; spread: number; persp: number; depthMin: number; depthMax: number }>, done?: () => void) {
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    const t = { rotX: cam.rotX, rotY: cam.rotY, zoom: cam.zoom, panX: cam.panX, panY: cam.panY, spread: currentSpread, persp: cam.persp, depthMin: depthRange.min, depthMax: depthRange.max, ...target };
    const from = { rotX: cam.rotX, rotY: cam.rotY, zoom: cam.zoom, panX: cam.panX, panY: cam.panY, spread: currentSpread, persp: cam.persp, depthMin: depthRange.min, depthMax: depthRange.max };
    const t0 = performance.now();
    const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
    function tick(now: number) {
      const p = ease(Math.min((now - t0) / C.ANIM_DURATION, 1));
      cam.rotX = lerp(from.rotX, t.rotX, p);
      cam.rotY = lerp(from.rotY, t.rotY, p);
      cam.zoom = lerp(from.zoom, t.zoom, p);
      cam.panX = lerp(from.panX, t.panX, p);
      cam.panY = lerp(from.panY, t.panY, p);
      cam.persp = lerp(from.persp, t.persp, p);
      updateDepths(lerp(from.spread, t.spread, p), { min: lerp(from.depthMin, t.depthMin, p), max: lerp(from.depthMax, t.depthMax, p) });
      if (now - t0 < C.ANIM_DURATION) animId = requestAnimationFrame(tick);
      else {
        animId = null;
        cam.rotX = t.rotX; cam.rotY = t.rotY; cam.zoom = t.zoom;
        cam.panX = t.panX; cam.panY = t.panY; cam.persp = t.persp;
        depthRange = { min: t.depthMin, max: t.depthMax };
        depthMinSlider.value = String(Math.round(t.depthMin));
        depthMaxSlider.value = String(Math.round(t.depthMax));
        spreadSlider.value = String(t.spread);
        updateDepths(); done?.();
      }
    }
    animId = requestAnimationFrame(tick);
  }

  let savedSpread = defaultSpread;
  let savedDepthRange = { min: 0, max: maxDepth };
  let savedFocusCam = { rotX: 0, rotY: 0, panX: 0, panY: 0, persp: 1 };
  let focusedAddr: string | null = null;

  function exitFocus() {
    if (!focusedAddr) return;
    focusedAddr = null;
    animateTo({ ...savedFocusCam, depthMin: savedDepthRange.min, depthMax: savedDepthRange.max });
  }

  function focusLayer(addr: string) {
    const l = layers.find(la => la.addr === addr);
    if (!l) return;
    if (focusedAddr === addr) {
      exitFocus();
      return;
    }
    // Save state before focusing
    if (!focusedAddr) {
      savedDepthRange = { ...depthRange };
      savedFocusCam = { rotX: cam.rotX, rotY: cam.rotY, panX: cam.panX, panY: cam.panY, persp: cam.persp };
    }
    focusedAddr = addr;
    const cx = l.x1 + (l.x2 - l.x1) / 2 - sceneW / 2;
    const cy = l.y1 + (l.y2 - l.y1) / 2 - sceneH / 2;
    const so = computeScreenOffsets();
    const gd = (so[l.screenIdx] ?? 0) + l.localDepth;
    animateTo({ rotX: 0, rotY: 0, panX: -cx, panY: -cy, persp: 0, depthMin: gd, depthMax: gd });
  }

  let savedPersp = cam.persp;

  function animateToggle(entering: boolean) {
    if (!entering) { savedRotX = cam.rotX; savedRotY = cam.rotY; savedSpread = Number(spreadSlider.value) || defaultSpread; savedPersp = cam.persp; }
    animateTo({ rotX: entering ? savedRotX : 0, rotY: entering ? savedRotY : 0, spread: entering ? savedSpread : 0, persp: entering ? savedPersp : 0 }, () => {
      spreadSlider.value = String(savedSpread);
    });
  }

  updateDepthSliderRange();
  updateDepths();

  // Event bindings
  spreadSlider.oninput = () => updateDepths();
  depthMinSlider.oninput = () => {
    depthRange.min = Number(depthMinSlider.value);
    if (depthRange.min > depthRange.max) { depthRange.max = depthRange.min; depthMaxSlider.value = depthMinSlider.value; }
    updateDepths();
  };
  depthMaxSlider.oninput = () => {
    depthRange.max = Number(depthMaxSlider.value);
    if (depthRange.max < depthRange.min) { depthRange.min = depthRange.max; depthMinSlider.value = depthMaxSlider.value; }
    updateDepths();
  };
  toggle3d.addEventListener("click", () => { is3d = toggle3d.dataset.on === "1"; spreadSlider.disabled = !is3d; animateToggle(is3d); });
  toggleOrtho.addEventListener("click", () => {
    const ortho = toggleOrtho.dataset.on === "1";
    animateTo({ persp: ortho ? 0 : 1 });
  });
  toggleBorders.addEventListener("click", () => updateVisibility());
  bufToggles.forEach(btn => btn.addEventListener("click", () => updateVisibility()));

  // Mouse interaction
  let dragging: false | "rotate" | "pan" = false;
  let lastX = 0, lastY = 0;

  viewport.onmousedown = e => {
    if (inScreensaver) return;
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) { e.preventDefault(); dragging = "pan"; lastX = e.clientX; lastY = e.clientY; viewport.style.cursor = "move"; }
    else if (e.button === 0 && is3d) { dragging = "rotate"; lastX = e.clientX; lastY = e.clientY; viewport.style.cursor = "grabbing"; }
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) return;
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
      exitFocus();
      cam.rotY += dx * C.ROTATION_SENSITIVITY;
      cam.rotX = Math.max(-90, Math.min(90, cam.rotX - dy * C.ROTATION_SENSITIVITY));
    } else {
      cam.panX += dx / cam.zoom;
      cam.panY += dy / cam.zoom;
    }
    renderer.markDirty();
  };
  const onMouseUp = () => { dragging = false; viewport.style.cursor = "grab"; };
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  viewport.addEventListener("wheel", e => {
    e.preventDefault();
    if (inScreensaver) return;
    if (e.ctrlKey) { cam.zoom = Math.max(C.MIN_ZOOM, Math.min(C.MAX_ZOOM, cam.zoom * (1 - e.deltaY * C.ZOOM_SENSITIVITY))); }
    else { cam.panX -= e.deltaX / cam.zoom; cam.panY -= e.deltaY / cam.zoom; }
    renderer.markDirty();
  }, { passive: false });

  // Keyboard controls — game-style continuous input
  container.tabIndex = 0;
  const keysDown = new Set<string>();
  container.addEventListener("keydown", e => {
    if (inScreensaver) return;
    if (e.key === "Shift") { keysDown.add("shift"); return; }
    switch (e.key) {
      case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
      case "w": case "W": case "s": case "S": case "a": case "A": case "d": case "D":
      case "=": case "+": case "-": case "_":
      case "q": case "Q": case "e": case "E":
        e.preventDefault(); keysDown.add(e.key.toLowerCase()); return;
      case "r": case "R": resetBtn.click(); return;
      case " ": e.preventDefault(); toggle3d.click(); return;
      case "o": case "O": toggleOrtho.click(); return;
      case "b": case "B": toggleBorders.click(); return;
      default: {
        const n = parseInt(e.key);
        if (n >= 1 && n <= layerBtns.length) { layerBtns[n - 1].click(); }
      }
    }
  });
  container.addEventListener("keyup", e => keysDown.delete(e.key.toLowerCase()));
  container.addEventListener("blur", () => keysDown.clear());

  const vel = { rotX: 0, rotY: 0, panX: 0, panY: 0, zoom: 0, spread: 0 };

  function tickKeys() {
    const s = keysDown.has("shift") ? 3 : 1;
    // Accelerate
    if (keysDown.has("arrowup") || keysDown.has("arrowdown") || keysDown.has("arrowleft") || keysDown.has("arrowright")) exitFocus();
    const d = C.CAM_DIR;
    if (keysDown.has("arrowup"))    vel.rotX -= C.KB_ACCEL * s * d;
    if (keysDown.has("arrowdown"))  vel.rotX += C.KB_ACCEL * s * d;
    if (keysDown.has("arrowleft"))  vel.rotY += C.KB_ACCEL * s * d;
    if (keysDown.has("arrowright")) vel.rotY -= C.KB_ACCEL * s * d;
    if (keysDown.has("w")) vel.panY += C.KB_PAN_ACCEL * s * d / cam.zoom;
    if (keysDown.has("s")) vel.panY -= C.KB_PAN_ACCEL * s * d / cam.zoom;
    if (keysDown.has("a")) vel.panX += C.KB_PAN_ACCEL * s * d / cam.zoom;
    if (keysDown.has("d")) vel.panX -= C.KB_PAN_ACCEL * s * d / cam.zoom;
    if (keysDown.has("=") || keysDown.has("+")) vel.zoom += C.KB_ZOOM_ACCEL * s;
    if (keysDown.has("-") || keysDown.has("_")) vel.zoom -= C.KB_ZOOM_ACCEL * s;
    if (keysDown.has("e")) vel.spread += C.KB_SPREAD_ACCEL * s;
    if (keysDown.has("q")) vel.spread -= C.KB_SPREAD_ACCEL * s;

    // Apply velocity
    cam.rotX = Math.max(-90, Math.min(90, cam.rotX + vel.rotX));
    cam.rotY += vel.rotY;
    cam.panX += vel.panX;
    cam.panY += vel.panY;
    cam.zoom = Math.max(C.MIN_ZOOM, Math.min(C.MAX_ZOOM, cam.zoom * (1 + vel.zoom)));

    // Spread
    if (Math.abs(vel.spread) > 0.01) {
      const max = spreadMax;
      const nv = Math.max(0, Math.min(max, Number(spreadSlider.value) + vel.spread));
      spreadSlider.value = String(nv);
      updateDepths();
    }

    // Friction
    vel.rotX *= C.KB_FRICTION; vel.rotY *= C.KB_FRICTION;
    vel.panX *= C.KB_PAN_FRICTION; vel.panY *= C.KB_PAN_FRICTION;
    vel.zoom *= C.KB_ZOOM_FRICTION;
    vel.spread *= C.KB_FRICTION;

    // Stop when negligible
    const moving = Math.abs(vel.rotX) + Math.abs(vel.rotY) + Math.abs(vel.panX) + Math.abs(vel.panY) + Math.abs(vel.zoom) + Math.abs(vel.spread) > 0.001;
    if (moving || keysDown.size > 0) renderer.markDirty();
  }
  (function keyLoop() { if (!alive) return; tickKeys(); requestAnimationFrame(keyLoop); })();

  // Click
  const pickAt = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); return renderer.pick(e.clientX - r.left, e.clientY - r.top); };
  canvas.addEventListener("click", e => {
    if (inScreensaver) return;
    const hit = pickAt(e);
    if (hit?.layer.addr) {
      selectObj(hit.layer.addr);
      const el = document.getElementById("obj-" + hit.layer.addr);
      if (el) {
        let p = el.parentElement;
        while (p) { if (p.tagName === "DETAILS") (p as HTMLDetailsElement).open = true; p = p.parentElement; }
        (el as HTMLDetailsElement).open = true;
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  });

  canvas.addEventListener("dblclick", e => {
    if (inScreensaver) return;
    const hit = pickAt(e);
    if (hit?.layer.addr) focusLayer(hit.layer.addr);
  });

  const setToggle = (btn: HTMLElement, on: boolean) => { btn.dataset.on = on ? "1" : "0"; btn.classList.toggle("active", on); };

  // Reset
  resetBtn.onclick = () => {
    is3d = true;
    setToggle(toggle3d, true); setToggle(toggleBorders, true); setToggle(toggleOrtho, false);
    bufToggles.forEach(btn => setToggle(btn, true));
    screenNames.forEach((name, i) => { layerVisible[i] = name === "act_scr" || screenNames.length === 1; });
    layerBtns.forEach((b, i) => b.classList.toggle("active", layerVisible[i]));
    spreadSlider.disabled = false;
    focusedAddr = null;
    updateDepthSliderRange();
    updateVisibility();
    const visMax = Number(depthMaxSlider.max);
    animateTo({ rotX: C.DEFAULT_ROT_X, rotY: C.DEFAULT_ROT_Y, zoom: 1, panX: 0, panY: 0, spread: defaultSpread, persp: 1, depthMin: 0, depthMax: visMax });
  };

  return () => {
    alive = false;
    if (animId) cancelAnimationFrame(animId);
    renderer.destroy();
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}
