// Scene renderer interface — shared data types and renderer contract

export interface SceneLayer {
  x: number; y: number; w: number; h: number;
  depth: number;
  borderColor: string;
  addr: string;
  info: string;
  label: string;
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
  persp: number; // 0 = orthographic, 1 = full perspective
}

export type HitResult = { layer: SceneLayer; index: number } | null;

export interface ISceneRenderer {
  setSceneSize(w: number, h: number): void;
  setLayers(layers: SceneLayer[]): void;
  addBuf(buf: BufImage): void;
  setHighlight(addr: string | null): void;
  markDirty(): void;
  pick(mx: number, my: number): HitResult;
  destroy(): void;
}
