// Section registry, stat definitions, and named constants

export const XREF_TARGET: Record<string, string> = {
  parent_addr: "obj", group_addr: "group", display_addr: "disp",
  read_timer_addr: "timer", focused_addr: "obj", var_addr: "obj",
  user_data_addr: "obj", subject_addr: "subject", target_addr: "obj",
  decoded_addr: "imgcache",
};

export const SECTIONS = [
  { key: "displays",           icon: "🖥", title: "Displays & Objects",  cls: "panel-disp-trees" },
  { key: "animations",         icon: "🎬", title: "Animations",         cls: "panel-animations" },
  { key: "timers",             icon: "⏱",  title: "Timers",             cls: "panel-timers" },
  { key: "image_cache",        icon: "🖼", title: "Image Cache",        cls: "panel-img-cache" },
  { key: "image_header_cache", icon: "📋", title: "Header Cache",       cls: "panel-hdr-cache" },
  { key: "indevs",             icon: "🕹", title: "Input Devices",      cls: "panel-indevs" },
  { key: "groups",             icon: "👥", title: "Groups",             cls: "panel-groups" },
  { key: "draw_units",         icon: "🎨", title: "Draw Units",         cls: "panel-draw-units" },
  { key: "draw_tasks",         icon: "📝", title: "Draw Tasks",         cls: "panel-draw-tasks" },
  { key: "subjects",           icon: "📡", title: "Subjects",           cls: "panel-subjects" },
  { key: "image_decoders",     icon: "🔓", title: "Decoders",           cls: "panel-decoders" },
  { key: "fs_drivers",         icon: "💾", title: "FS Drivers",         cls: "panel-fs-drivers" },
] as const;

export const STAT_DEFS = [
  { label: "Displays",   key: "displays",     icon: "🖥", color: "blue",  section: "disp-trees" },
  { label: "Objects",    key: "_objects",      icon: "🌳", color: "green", section: "disp-trees" },
  { label: "Animations", key: "animations",    icon: "🎬", color: "mauve", section: "animations" },
  { label: "Timers",     key: "timers",        icon: "⏱",  color: "peach", section: "timers" },
  { label: "Img Cache",  key: "image_cache",   icon: "🖼", color: "teal",  section: "img-cache" },
  { label: "Input Devs", key: "indevs",        icon: "🕹", color: "pink",  section: "indevs" },
] as const;

export const DEPTH_COLORS = [
  "var(--blue)", "var(--green)", "var(--mauve)", "var(--peach)",
  "var(--teal)", "var(--pink)", "var(--yellow)", "var(--red)",
  "var(--sapphire)", "var(--lavender)", "var(--flamingo)",
];

export const C = {
  INFINITE_REPEAT: 0xFFFFFFFF,
  VIEWPORT_SIZE: 520,
  PERSPECTIVE_DISTANCE: 1200,
  DEFAULT_ROT_X: -30,
  DEFAULT_ROT_Y: 30,
  MIN_ZOOM: 0.2,
  MAX_ZOOM: 10,
  ZOOM_SENSITIVITY: 0.01,
  ROTATION_SENSITIVITY: 0.4,
  SCREEN_GAP: 2,
  ANIM_DURATION: 500,
  // Camera control: 1 = camera moves, -1 = object moves
  CAM_DIR: -1 as 1 | -1,
  // ViewCube
  VC_SIZE: 100,
  VC_FACE: 50,
  VC_EDGE: 8,
  VC_CORNER: 15,
  VC_TOP: 8,
  VC_RIGHT: 8,
  // Keyboard inertia
  KB_ACCEL: 0.4,
  KB_FRICTION: 0.85,
  KB_PAN_ACCEL: 0.8,
  KB_PAN_FRICTION: 0.92,
  KB_ZOOM_ACCEL: 0.005,
  KB_ZOOM_FRICTION: 0.85,
  KB_SPREAD_ACCEL: 0.5,
} as const;

export const INDEV_ICONS: Record<string, string> = {
  pointer: "👆", keypad: "⌨️", button: "🔘", encoder: "🎛️", none: "❓",
};
