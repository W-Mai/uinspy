// LVGL Dashboard JSON data types

export interface DashboardData {
  meta?: { timestamp?: string; lvgl_version?: string };
  displays?: Display[];
  object_trees?: ObjectTree[];
  animations?: Animation[];
  timers?: Timer[];
  image_cache?: ImageCacheEntry[];
  image_header_cache?: HeaderCacheEntry[];
  indevs?: InputDevice[];
  groups?: Group[];
  draw_units?: DrawUnit[];
  draw_tasks?: DrawTask[];
  subjects?: Subject[];
  image_decoders?: Decoder[];
  fs_drivers?: FsDriver[];
}

export interface Display {
  addr: string;
  hor_res: number;
  ver_res: number;
  screen_count: number;
  buf_1?: DisplayBuffer;
  buf_2?: DisplayBuffer;
}

export interface DisplayBuffer {
  width: number;
  height: number;
  color_format: string;
  image_base64?: string;
}

export interface ObjectTree {
  display_addr: string;
  screens: ObjNode[];
}

export interface ObjNode {
  addr: string;
  class_name: string;
  child_count: number;
  style_count: number;
  coords?: { x1: number; y1: number; x2: number; y2: number };
  parent_addr?: string;
  group_addr?: string;
  layer_name?: string;
  children?: ObjNode[];
  styles?: ObjStyle[];
}

export interface ObjStyle {
  index: number;
  selector_str: string;
  flags_str: string;
  properties?: { prop_name: string; value_str: string }[];
}

export interface Animation {
  addr: string;
  status: string;
  exec_cb: string;
  duration: number;
  start_value: number;
  end_value: number;
  current_value: number;
  repeat_cnt: number;
  act_time: number;
}

export interface Timer {
  addr: string;
  timer_cb: string;
  period: number;
  frequency?: string;
  repeat_count: number;
  last_run: number;
  paused: boolean;
}

export interface ImageCacheEntry {
  entry_addr: string;
  src: string;
  size: string;
  cf: string;
  ref_count: number;
  decoder_name?: string;
  preview_base64?: string;
}

export interface HeaderCacheEntry {
  entry_addr: string;
  src: string;
  size: string;
  cf: string;
  ref_count: number;
  src_type: string;
  decoder_name: string;
}

export interface InputDevice {
  addr: string;
  type_name: string;
  enabled: boolean;
  read_cb: string;
  long_press_time: number;
  scroll_limit: number;
  display_addr?: string;
  group_addr?: string;
}

export interface Group {
  addr: string;
  obj_count: number;
  frozen: boolean;
  editing: boolean;
  wrap: boolean;
  focused_addr?: string;
  member_addrs?: string[];
}

export interface DrawUnit {
  addr: string;
  name: string;
  idx: number;
}

export interface DrawTask {
  addr: string;
  type_name: string;
  state_name: string;
  area?: { x1: number; y1: number; x2: number; y2: number };
  opa: number;
  preferred_draw_unit_id?: number;
}

export interface Subject {
  addr: string;
  type_name: string;
  observers?: Observer[];
}

export interface Observer {
  addr: string;
  cb: string;
  target_addr: string;
  for_obj: boolean;
}

export interface Decoder {
  addr: string;
  name: string;
  info_cb: string;
  open_cb: string;
  close_cb: string;
}

export interface FsDriver {
  addr: string;
  letter: string;
  driver_name: string;
  cache_size: number;
  open_cb: string;
  read_cb: string;
  write_cb: string;
  close_cb: string;
}
