// Global reactive state for cross-component communication
import { signal } from "../framework";
import type { DashboardData, ObjNode } from "./types";

// Highlight system
const hlAddr = signal<string | null>(null);
const hlRegistry: Record<string, HTMLElement[]> = {};
const hlOverlays: Record<string, { canvas: HTMLCanvasElement; w: number; h: number; objs: { addr: string; x1: number; y1: number; x2: number; y2: number }[] }> = {};

export function registerHL(addr: string, el: HTMLElement) {
  if (!addr) return;
  if (!hlRegistry[addr]) hlRegistry[addr] = [];
  hlRegistry[addr].push(el);
}

const hlListeners: ((addr: string | null) => void)[] = [];
export function onHL(fn: (addr: string | null) => void) { hlListeners.push(fn); }

const focusListeners: ((addr: string) => void)[] = [];
export function onFocus(fn: (addr: string) => void) { focusListeners.push(fn); }
export function focusObj(addr: string) { focusListeners.forEach(fn => fn(addr)); }

export function highlightObj(addr: string | null) {
  if (hlAddr.val === addr) return;
  clearHighlight();
  hlAddr.val = addr;
  hlListeners.forEach(fn => fn(addr));
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
  hlListeners.forEach(fn => fn(null));
}

export function registerOverlay(key: string, overlay: typeof hlOverlays[string]) {
  hlOverlays[key] = overlay;
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

// Count objects in trees
export function countObjects(trees: { screens: ObjNode[] }[]): number {
  let n = 0;
  function walk(obj: ObjNode) { n++; obj.children?.forEach(walk); }
  trees.forEach(t => t.screens.forEach(walk));
  return n;
}
