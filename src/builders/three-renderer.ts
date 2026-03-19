// Three.js WebGL scene renderer

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { SceneLayer, BufImage, Camera, HitResult } from "./scene-renderer";
import type { ISceneRenderer } from "./scene-renderer";

// Rounded rect shape — r=0 gives a plain rectangle
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  r = Math.min(r, hw, hh);
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  if (r > 0) s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  if (r > 0) s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  if (r > 0) s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  if (r > 0) s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

export class ThreeRenderer implements ISceneRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private cam: Camera;
  private sceneW = 0;
  private sceneH = 0;
  private canvas: HTMLCanvasElement;
  private layers: SceneLayer[] = [];
  private bufs: BufImage[] = [];
  private hlAddr: string | null = null;
  private dirty = true;
  private rafId: number | null = null;

  // Three.js objects mapped to data
  private layerMeshes: THREE.Mesh[] = [];
  private bufMeshes: THREE.Mesh[] = [];
  private layerGroup = new THREE.Group();
  private bufGroup = new THREE.Group();

  // For picking
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement, cam: Camera) {
    this.canvas = canvas;
    this.cam = cam;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.camera = this.createCamera();

    this.scene.add(this.layerGroup);
    this.scene.add(this.bufGroup);

    // Ambient light for visibility
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(1, 2, 3);
    this.scene.add(dirLight);

    this.startLoop();
  }

  private createCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    if (this.cam.ortho) {
      const h = 300 / this.cam.zoom;
      return new THREE.OrthographicCamera(-h * aspect, h * aspect, h, -h, -10000, 10000);
    }
    return new THREE.PerspectiveCamera(45, aspect, 0.1, 10000);
  }

  setSceneSize(w: number, h: number) {
    this.sceneW = w;
    this.sceneH = h;
    this.dirty = true;
  }

  setLayers(layers: SceneLayer[]) {
    this.layers = layers;
    this.rebuildLayerMeshes();
    this.dirty = true;
  }

  addBuf(buf: BufImage) {
    this.bufs.push(buf);
    this.rebuildBufMesh(buf, this.bufs.length - 1);
    this.dirty = true;
  }

  setHighlight(addr: string | null) {
    this.hlAddr = addr;
    this.dirty = true;
  }

  markDirty() { this.dirty = true; }

  private rebuildLayerMeshes() {
    this.layerGroup.clear();
    this.layerMeshes = [];

    this.layers.forEach((l, i) => {
      const r = 0; // border radius — ready for future use
      const shape = roundedRectShape(l.w, l.h, r);
      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x89b4fa,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { layerIndex: i, layer: l };
      this.layerMeshes.push(mesh);
      this.layerGroup.add(mesh);

      // Border via Line2 (fat lines with controllable width)
      const pts = shape.getPoints(r > 0 ? 32 : 4);
      const positions: number[] = [];
      // Close loop: append first point, skip duplicate last point from getPoints
      const loop = pts[pts.length - 1].equals(pts[0]) ? pts.slice(0, -1) : pts;
      for (const p of loop) positions.push(p.x, p.y, 0);
      positions.push(loop[0].x, loop[0].y, 0);
      const lineGeo = new LineGeometry();
      lineGeo.setPositions(positions);
      const lineMat = new LineMaterial({
        color: new THREE.Color(l.borderColor).getHex(),
        linewidth: 1,
        resolution: new THREE.Vector2(1, 1),
      });
      const line = new Line2(lineGeo, lineMat);
      line.computeLineDistances();
      mesh.add(line);
    });
  }

  private rebuildBufMesh(buf: BufImage, _idx: number) {
    const tex = new THREE.Texture(buf.img);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(this.sceneW, this.sceneH);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { buf };
    this.bufMeshes.push(mesh);
    this.bufGroup.add(mesh);
  }

  pick(mx: number, my: number): HitResult {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = (mx / rect.width) * 2 - 1;
    this.mouse.y = -(my / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const hits = this.raycaster.intersectObjects(this.layerMeshes, false);
    for (const h of hits) {
      const ud = h.object.userData;
      if (ud.layer && ud.layer.visible) {
        return { layer: ud.layer, index: ud.layerIndex };
      }
    }
    return null;
  }

  private syncTransforms() {
    // Update layer positions
    this.layerMeshes.forEach((mesh, i) => {
      const l = this.layers[i];
      mesh.visible = l.visible;
      // Position: center of layer, Z = depth
      mesh.position.set(
        l.x + l.w / 2 - this.sceneW / 2,
        -(l.y + l.h / 2 - this.sceneH / 2),
        l.depth
      );

      // Update highlight
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const isHl = l.addr === this.hlAddr;
      mat.opacity = isHl ? 0.25 : 0.06;

      // Update border
      const line = mesh.children[0] as Line2;
      if (line) {
        const lmat = line.material as LineMaterial;
        lmat.color.set(isHl ? 0x89b4fa : l.borderColor);
        lmat.linewidth = isHl ? 2 : 1;
      }
    });

    // Update buf positions
    this.bufMeshes.forEach((mesh, i) => {
      const buf = this.bufs[i];
      mesh.visible = buf.visible;
      mesh.position.set(0, 0, buf.depth);
    });

    // Update camera from cam state
    this.updateCamera();
  }

  private updateCamera() {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;

    // Recreate camera if ortho mode changed
    const needsOrtho = this.cam.ortho;
    const isOrtho = this.camera instanceof THREE.OrthographicCamera;
    if (needsOrtho !== isOrtho) {
      this.scene.remove(this.camera);
      this.camera = this.createCamera();
      this.scene.add(this.camera);
    }

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    } else {
      const h = 300 / this.cam.zoom;
      this.camera.left = -h * aspect;
      this.camera.right = h * aspect;
      this.camera.top = h;
      this.camera.bottom = -h;
      this.camera.updateProjectionMatrix();
    }

    // Convert rotX/rotY + distance to camera position
    const dist = this.cam.perspective;
    const rx = -this.cam.rotX * Math.PI / 180;
    const ry = -this.cam.rotY * Math.PI / 180;

    const x = dist * Math.sin(ry) * Math.cos(rx);
    const y = dist * Math.sin(rx);
    const z = dist * Math.cos(ry) * Math.cos(rx);

    // Pan along camera-local right/up axes
    const forward = new THREE.Vector3(-x, -y, -z).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const panOffset = right.multiplyScalar(-this.cam.panX).add(up.multiplyScalar(this.cam.panY));

    this.camera.position.set(x + panOffset.x, y + panOffset.y, z + panOffset.z);
    this.camera.lookAt(panOffset.x, panOffset.y, panOffset.z);

    // Apply zoom for perspective
    if (this.camera instanceof THREE.PerspectiveCamera) {
      const target = new THREE.Vector3(panOffset.x, panOffset.y, panOffset.z);
      this.camera.position.sub(target).multiplyScalar(1 / this.cam.zoom).add(target);
      this.camera.lookAt(target);
    }
  }

  private resizeRenderer() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const w = Math.round(rect.width), h = Math.round(rect.height);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
  }

  private render() {
    this.resizeRenderer();
    this.syncTransforms();
    // Update LineMaterial resolution
    const rect = this.canvas.getBoundingClientRect();
    const res = new THREE.Vector2(rect.width, rect.height);
    this.layerMeshes.forEach(m => {
      const line = m.children[0] as Line2;
      if (line) (line.material as LineMaterial).resolution = res;
    });
    this.renderer.render(this.scene, this.camera);
  }

  private startLoop() {
    const tick = () => {
      if (this.dirty) {
        this.dirty = false;
        this.render();
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
    this.scene.clear();
  }
}
