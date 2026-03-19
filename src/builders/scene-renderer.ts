// Canvas 2D scene renderer with manual 3D projection
// Replaces CSS 3D transforms for better performance with many layers

export interface SceneLayer {
  x: number; y: number; w: number; h: number;
  depth: number;
  borderColor: string;
  addr: string;
  info: string;
  screenIdx: number;
  visible: boolean;
}

export interface BufImage {
  img: HTMLImageElement;
  depth: number;
  visible: boolean;
}

export interface Camera {
  rotX: number; rotY: number;
  zoom: number; panX: number; panY: number;
  perspective: number;
  ortho: boolean;
}

type HitResult = { layer: SceneLayer; index: number } | null;

export class SceneRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layers: SceneLayer[] = [];
  private bufs: BufImage[] = [];
  private cam: Camera;
  private sceneW = 0;
  private sceneH = 0;
  private hlAddr: string | null = null;
  private dirty = true;
  private rafId: number | null = null;
  // Projected quads cache for picking
  private projected: { quad: [number, number][]; layer: SceneLayer; z: number }[] = [];

  constructor(canvas: HTMLCanvasElement, cam: Camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cam = cam;
    this.startLoop();
  }

  setSceneSize(w: number, h: number) { this.sceneW = w; this.sceneH = h; this.dirty = true; }
  setLayers(layers: SceneLayer[]) { this.layers = layers; this.dirty = true; }
  addBuf(buf: BufImage) { this.bufs.push(buf); this.dirty = true; }
  setHighlight(addr: string | null) { this.hlAddr = addr; this.dirty = true; }
  markDirty() { this.dirty = true; }

  // 3D point → 2D screen projection
  private project(px: number, py: number, pz: number): [number, number, number] {
    const { rotX, rotY, zoom, panX, panY, perspective, ortho } = this.cam;
    // Negate angles to match CSS 3D transform convention
    const rx = -rotX * Math.PI / 180, ry = -rotY * Math.PI / 180;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);

    // Center origin; negate Z so positive depth = toward viewer (CSS convention)
    const ox = px - this.sceneW / 2, oy = py - this.sceneH / 2, oz = -pz;

    // Rotate Y then X
    let x = ox * cy + oz * sy;
    let z = -ox * sy + oz * cy;
    let y = oy * cx - z * sx;
    z = oy * sx + z * cx;

    // Perspective or ortho
    const rect = this.canvas.getBoundingClientRect();
    const cw = rect.width, ch = rect.height;
    const scale = ortho ? zoom : (perspective / (perspective + z)) * zoom;

    return [
      cw / 2 + (x + panX) * scale,
      ch / 2 + (y + panY) * scale,
      z,
    ];
  }

  // Point-in-convex-quad test
  private pointInQuad(px: number, py: number, q: [number, number][]): boolean {
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4];
      if ((bx - ax) * (py - ay) - (by - ay) * (px - ax) < 0) return false;
    }
    return true;
  }

  pick(mx: number, my: number): HitResult {
    for (let i = this.projected.length - 1; i >= 0; i--) {
      const p = this.projected[i];
      if (!p.layer.visible) continue;
      if (this.pointInQuad(mx, my, p.quad)) return { layer: p.layer, index: i };
    }
    return null;
  }

  private render() {
    const ctx = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const items: { quad: [number, number][]; z: number; type: "buf" | "layer"; layer?: SceneLayer; buf?: BufImage }[] = [];

    // Buffer images — use center z for sorting
    this.bufs.forEach(buf => {
      if (!buf.visible) return;
      const d = buf.depth;
      const p0 = this.project(0, 0, d);
      const p1 = this.project(this.sceneW, 0, d);
      const p2 = this.project(this.sceneW, this.sceneH, d);
      const p3 = this.project(0, this.sceneH, d);
      const avgZ = (p0[2] + p1[2] + p2[2] + p3[2]) / 4;
      items.push({ quad: [[p0[0], p0[1]], [p1[0], p1[1]], [p2[0], p2[1]], [p3[0], p3[1]]], z: avgZ, type: "buf", buf });
    });

    // Object layers
    this.layers.forEach(l => {
      if (!l.visible) return;
      const p0 = this.project(l.x, l.y, l.depth);
      const p1 = this.project(l.x + l.w, l.y, l.depth);
      const p2 = this.project(l.x + l.w, l.y + l.h, l.depth);
      const p3 = this.project(l.x, l.y + l.h, l.depth);
      const avgZ = (p0[2] + p1[2] + p2[2] + p3[2]) / 4;
      items.push({ quad: [[p0[0], p0[1]], [p1[0], p1[1]], [p2[0], p2[1]], [p3[0], p3[1]]], z: avgZ, type: "layer", layer: l });
    });

    // Sort back-to-front: larger z = farther from viewer = draw first
    items.sort((a, b) => b.z - a.z);

    this.projected = items.filter(i => i.type === "layer").map(i => ({ quad: i.quad, layer: i.layer!, z: i.z }));

    // Draw
    const SUBDIVS = 16;
    items.forEach(item => {
      const q = item.quad;
      if (item.type === "buf" && item.buf) {
        // Subdivide into grid for perspective-correct texture mapping
        // Draw each cell slightly oversized to eliminate seams
        const N = SUBDIVS;
        const sw = this.sceneW, sh = this.sceneH;
        const dpr = window.devicePixelRatio || 1;
        const margin = 1.0 / N; // overlap in UV space
        for (let iy = 0; iy < N; iy++) {
          for (let ix = 0; ix < N; ix++) {
            const u0 = ix / N, v0 = iy / N;
            // Slightly expanded sample for overlap
            const u0e = Math.max(0, u0 - margin * 0.5), v0e = Math.max(0, v0 - margin * 0.5);
            const u1e = Math.min(1, (ix + 1) / N + margin * 0.5), v1e = Math.min(1, (iy + 1) / N + margin * 0.5);
            const p00 = this.project(sw * u0e, sh * v0e, item.buf!.depth);
            const p10 = this.project(sw * u1e, sh * v0e, item.buf!.depth);
            const p01 = this.project(sw * u0e, sh * v1e, item.buf!.depth);

            ctx.save();
            ctx.globalAlpha = 0.85;
            const dx = p10[0] - p00[0], dy = p10[1] - p00[1];
            const ex = p01[0] - p00[0], ey = p01[1] - p00[1];
            const srcW = (u1e - u0e) * sw, srcH = (v1e - v0e) * sh;
            ctx.setTransform(
              dx / srcW * dpr, dy / srcW * dpr,
              ex / srcH * dpr, ey / srcH * dpr,
              p00[0] * dpr, p00[1] * dpr
            );
            ctx.drawImage(item.buf!.img, u0e * sw, v0e * sh, srcW, srcH, 0, 0, srcW, srcH);
            ctx.restore();
          }
        }
        return;
      }

      const l = item.layer!;
      const isHl = l.addr === this.hlAddr;

      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
      ctx.closePath();
      ctx.fillStyle = isHl ? "rgba(137, 180, 250, 0.25)" : "rgba(137, 180, 250, 0.06)";
      ctx.fill();

      ctx.strokeStyle = isHl ? "rgba(137, 180, 250, 0.9)" : l.borderColor;
      ctx.lineWidth = isHl ? 2 : 1;
      ctx.stroke();
    });
  }

  private startLoop() {
    const tick = () => {
      if (this.dirty) {
        this.dirty = false;
        this.resizeCanvas();
        this.render();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private resizeCanvas() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = rect.width + "px";
      this.canvas.style.height = rect.height + "px";
      this.ctx.scale(dpr, dpr);
    }
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
