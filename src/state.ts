// Global reactive state for cross-component communication
import { signal } from "../framework";
import type { DashboardData, ObjNode, WidgetSpec } from "./types";

// Highlight system
const hlAddr = signal<string | null>(null);
const hlRegistry: Record<string, HTMLElement[]> = {};
const hlOverlays: Record<string, { canvas: HTMLCanvasElement; w: number; h: number; objs: { addr: string; x1: number; y1: number; x2: number; y2: number }[] }> = {};

export function registerHL(addr: string, el: HTMLElement) {
  if (!addr) return;
  if (!hlRegistry[addr]) hlRegistry[addr] = [];
  hlRegistry[addr].push(el);
}

export function onHL(fn: (addr: string | null) => void) { hlAddr.sub(() => fn(hlAddr.val)); }

const focusAddr = signal<string | null>(null);
export function onFocus(fn: (addr: string) => void) { focusAddr.sub(() => { if (focusAddr.val) fn(focusAddr.val); }); }
export function focusObj(addr: string) { focusAddr.val = null; focusAddr.val = addr; }

export function highlightObj(addr: string | null) {
  if (hlAddr.val === addr) return;
  clearHighlight();
  hlAddr.val = addr;
  if (!addr) return;
  hlRegistry[addr]?.forEach(e => e.classList.add("hl-active"));
  Object.values(hlOverlays).forEach(ov => {
    const ctx = ov.canvas.getContext("2d")!;
    ctx.clearRect(0, 0, ov.canvas.width, ov.canvas.height);
    const obj = ov.objs.find(o => o.addr === addr);
    if (obj) {
      const sx = ov.canvas.width / ov.w, sy = ov.canvas.height / ov.h;
      const x = obj.x1 * sx, y = obj.y1 * sy;
      const w = (obj.x2 - obj.x1) * sx, h = (obj.y2 - obj.y1) * sy;
      ctx.strokeStyle = "rgba(137, 180, 250, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = "rgba(137, 180, 250, 0.15)";
      ctx.fillRect(x, y, w, h);
    }
  });
}

export function clearHighlight() {
  if (!hlAddr.val) return;
  hlRegistry[hlAddr.val]?.forEach(e => e.classList.remove("hl-active"));
  Object.values(hlOverlays).forEach(ov => {
    ov.canvas.getContext("2d")!.clearRect(0, 0, ov.canvas.width, ov.canvas.height);
  });
  hlAddr.val = null;
}

export function registerOverlay(key: string, overlay: typeof hlOverlays[string]) {
  hlOverlays[key] = overlay;
}

export function resetHL() {
  clearHighlight();
  for (const k in hlRegistry) delete hlRegistry[k];
  for (const k in hlOverlays) delete hlOverlays[k];
}

// Selection & detail
export const selectedAddr = signal<string | null>(null);
export const objDataMap: Record<string, ObjNode> = {};

export function selectObj(addr: string) {
  const prev = selectedAddr.val;
  if (prev) document.getElementById("obj-" + prev)?.classList.remove("obj-selected");
  selectedAddr.val = addr;
  document.getElementById("obj-" + addr)?.classList.add("obj-selected");
}

// Dashboard data
export const dashData = signal<DashboardData | null>(null);

// Widget specs (global lookup)
export let widgetSpecs: Record<string, WidgetSpec> = {};
export function setWidgetSpecs(specs: Record<string, WidgetSpec>) { widgetSpecs = specs; }

export function getWidgetSpec(className: string): WidgetSpec | undefined {
  return widgetSpecs[className] || widgetSpecs["lv_" + className];
}

export function widgetSummary(className: string, wd?: Record<string, unknown> | null): string {
  if (!wd) return "";
  const spec = getWidgetSpec(className);
  if (!spec?.summary_tpl) return "";
  return spec.summary_tpl.replace(/\{(\w+)\}/g, (_, k) => {
    const v = wd[k];
    if (v == null) return "";
    const s = String(v);
    return s.length > 24 ? s.slice(0, 24) + "…" : s;
  });
}

// Count objects in trees
export function countObjects(trees: { screens: ObjNode[] }[]): number {
  let n = 0;
  function walk(obj: ObjNode) { n++; obj.children?.forEach(walk); }
  trees.forEach(t => t.screens.forEach(walk));
  return n;
}
