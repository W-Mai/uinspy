// Three.js WebGL scene renderer

import * as THREE from "three";
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
  private camera: THREE.PerspectiveCamera;
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

  private createCamera(): THREE.PerspectiveCamera {
    const rect = this.canvas.getBoundingClientRect();
    const aspect = rect.width / rect.height || 1;
    return new THREE.PerspectiveCamera(45, aspect, 0.1, 100000);
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

      // Compute UV for border detection in shader
      // ShapeGeometry vertices are in local coords [-w/2..w/2, -h/2..h/2]
      const pos = geo.attributes.position;
      const uv = new Float32Array(pos.count * 2);
      for (let j = 0; j < pos.count; j++) {
        uv[j * 2] = (pos.getX(j) + l.w / 2) / l.w;
        uv[j * 2 + 1] = (pos.getY(j) + l.h / 2) / l.h;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

      const mat = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        uniforms: {
          fillColor: { value: new THREE.Color(0x89b4fa) },
          fillOpacity: { value: 0.06 },
          borderColor: { value: new THREE.Color(l.borderColor) },
          borderWidth: { value: 1.5 },
          size: { value: new THREE.Vector2(l.w, l.h) },
          radius: { value: r },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 fillColor;
          uniform float fillOpacity;
          uniform vec3 borderColor;
          uniform float borderWidth;
          uniform vec2 size;
          uniform float radius;
          varying vec2 vUv;
          void main() {
            vec2 px = vUv * size;
            float dL = px.x, dR = size.x - px.x;
            float dT = px.y, dB = size.y - px.y;
            float d = min(min(dL, dR), min(dT, dB));
            // borderWidth in screen pixels via fwidth
            float pixelSize = fwidth(d);
            float bw = borderWidth * pixelSize;
            float borderMask = 1.0 - smoothstep(bw - pixelSize * 0.5, bw + pixelSize * 0.5, d);
            vec3 col = mix(fillColor, borderColor, borderMask);
            float alpha = mix(fillOpacity, 1.0, borderMask);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { layerIndex: i, layer: l };
      this.layerMeshes.push(mesh);
      this.layerGroup.add(mesh);
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
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
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
      const mat = mesh.material as THREE.ShaderMaterial;
      const isHl = l.addr === this.hlAddr;
      mat.uniforms.fillOpacity.value = isHl ? 0.25 : 0.06;
      mat.uniforms.borderColor.value.set(isHl ? 0x89b4fa : l.borderColor);
      mat.uniforms.borderWidth.value = isHl ? 2.5 : 1.5;
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

    // Always use PerspectiveCamera; persp=0→1 controls FOV for smooth ortho transition
    if (!(this.camera instanceof THREE.PerspectiveCamera)) {
      this.scene.remove(this.camera);
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100000);
      this.scene.add(this.camera);
    }

    // persp: 0=ortho (tiny FOV, far camera), 1=full perspective (45° FOV)
    const maxFov = 45;
    const minFov = 0.5;
    const fov = minFov + (maxFov - minFov) * this.cam.persp;
    // Keep apparent size constant by scaling distance with FOV
    const baseDist = 1200;
    const baseTan = Math.tan(maxFov * Math.PI / 360);
    const curTan = Math.tan(fov * Math.PI / 360);
    const dist = baseDist * baseTan / curTan;

    const cam = this.camera as THREE.PerspectiveCamera;
    cam.aspect = aspect;
    cam.fov = fov;
    cam.near = dist * 0.001;
    cam.far = dist * 10;
    cam.updateProjectionMatrix();

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
    const target = new THREE.Vector3(panOffset.x, panOffset.y, panOffset.z);
    this.camera.lookAt(target);

    // Apply zoom
    this.camera.position.sub(target).multiplyScalar(1 / this.cam.zoom).add(target);
    this.camera.lookAt(target);
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
