# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.1] - 2026-04-22

### Added

- Spec-driven widget rendering — summary template, primary fields, enum/bool formatting all from JSON.
- Widget summary section in detail panel (standalone card below header).
- Widget summary hint in object tree node labels.
- Props toggle in 3D scene — show widget summary text on layer surfaces with perspective-aware affine transform.
- `widgetSummary()` template renderer using `widget_specs` from dashboard JSON.

### Changed

- Remove hardcoded `PRIMARY_KEYS` table; primary/advanced split now driven by `widget_specs.primary`.
- `formatField()` replaces `formatWdVal()` with spec-aware enum names, bool, and string formatting.

### Fixed

- Layout/scroll detail fields with value `0` were hidden due to truthy checks; now use `!= null`.

## [0.5.0] - 2026-04-21

### Added

- Object flags display with badge styling in detail panel.
- Object state display with active highlighting (PRESSED, FOCUSED, etc.).
- Hidden toggle in 3D scene — parent HIDDEN state inherits to children.
- Hidden object marker (👁‍🗨) in object tree.
- Object name display in tree node labels.
- Layout & Scroll section in detail panel (scroll offset, ext_click_pad, ext_draw_size, scrollbar_mode, scroll_dir, scroll_snap, layer_type, w/h_layout).
- Internal state section in detail panel (layout_inv, is_deleting, rendered, skip_trans).
- Widget-specific data rendering with primary/advanced field groups and collapsible toggle.

### Fixed

- Layout/scroll detail fields with value `0` were hidden due to truthy checks; now use `!= null`.

## [0.4.6] - 2026-03-27

### Added

- Deterministic CSS order and git hash in footer.

### Fixed

- Resource leaks on display switch and security hardening.
- Template interpolation in `html``` attributes.
- Reset buf visibility and block input during screensaver.

## [0.4.5] - 2026-03-20

### Changed

- Use `signal.sub` for highlight/focus, minor cleanup.
- Simplify `animateTo` to `Partial` params and extract `pickAt` helper.
- Compact ViewCube data and fix corner rotX direction.

### Fixed

- Use global depth for slider range, filter, and focus.

## [0.4.4] - 2026-03-20

### Added

- Configurable camera direction via `C.CAM_DIR`.

### Fixed

- Keep mouse drag direction unchanged; `CAM_DIR` only affects keyboard.

## [0.4.3] - 2026-03-19

### Added

- Depth range filter with min/max sliders.
- Double-click to focus a layer; auto-exit focus on rotate.
- Q/E keys to control Z spread with inertia.
- Sync obj-tree hover with 3D view highlight.
- Highlight layer region on framebuffer when hovered.

### Changed

- Move keyboard inertia constants to `C.KB_*`.
- Parameterize ViewCube — move constants to `C.VC_*`.

### Fixed

- Clip quads behind near plane in perspective mode.
- Prevent text selection on ViewCube.

## [0.4.2] - 2026-03-19

### Added

- ViewCube orientation gizmo with click-to-rotate.
- Keyboard controls with game-style inertia (arrow keys, WASD, +/-).
- Animate perspective→orthographic on 3D toggle exit, restore on re-enter.

### Changed

- Unify ortho/perspective as `cam.persp` (0~1 blend).

### Fixed

- ThreeRenderer 2D layer ordering — unified ShaderMaterial.

## [0.4.1] - 2026-03-18

### Added

- Unified `animateTo` — smooth transitions for reset, 3D toggle, ortho switch.
- Manual screensaver mode — only ESC exits when user-triggered.
- ThreeRenderer polish — Shape+Line2 borders, sRGB colors, ortho clipping fix.

### Fixed

- 3D toggle spread — track actual rendered spread, preserve slider position.
- Screensaver not stopping on ESC fullscreen exit.
- Ortho near-plane clipping in ThreeRenderer.
- ThreeRenderer pan direction — use camera-local axes.

## [0.4.0] - 2026-03-18

### Added

- Three.js WebGL renderer as alternative to Canvas 2D.

### Changed

- Extract `ISceneRenderer` interface; split `Canvas2DRenderer` into own module.

## [0.3.0] - 2026-03-18

### Added

- Canvas 2D 3D scene renderer — replace CSS 3D transforms with manual projection.

## [0.2.4] - 2026-03-18

### Added

- Customizable title/logo via `UINSPY_TITLE` env var.
- `build:lvgl` target for LVGL Dashboard builds.

### Changed

- Rebrand to UINSPY.

## [0.2.3] - 2026-03-18

### Added

- Improved coordinates display — grouped pos/size cards.
- Release CI workflow — build 4 HTML variants as release assets.
- GitHub Pages deployment workflow.

## [0.2.2] - 2026-03-18

### Added

- Buf toggle thumbnails in 3D controls.
- Replace `document.createElement` with `html``/el()` helpers.

## [0.2.1] - 2026-03-18

### Added

- Support dual draw buffers — independent toggle per buf in 3D scene.

## [0.2.0] - 2026-03-18

### Added

- 3D scene screensaver mode with idle detection and cinematic animation.
- Fullscreen button for 3D scene panel.

## [0.1.1] - 2026-03-18

### Added

- About footer panel with dynamic version, build time, GitHub/LVGL links.

### Fixed

- Drop zone layout margin.

## [0.1.0] - 2026-03-18

### Added

- Modular component architecture — types, constants, helpers, builders.
- Tailwind v4 CSS pipeline with `@apply` + `@theme` design tokens.
- Compile-time `html``` template transform via Bun plugin.
- Framework: `BaseComponent`, `signal`, `store`, plugin system.
- Dashboard sections: displays, object trees, animations, timers, image cache, header cache, input devices, groups, draw units, draw tasks, subjects, decoders, FS drivers.
- 3D exploded object tree view with layer toggle, depth spread slider, border toggle.
- Theme toggle (Catppuccin Latte/Mocha).
- Drag & drop JSON file loading.
- Embedded JSON data via `{{JSON_DATA}}` placeholder.
- Self-contained single HTML file output.

[Unreleased]: https://github.com/w-mai/uinspy/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/w-mai/uinspy/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/w-mai/uinspy/compare/v0.4.6...v0.5.0
[0.4.6]: https://github.com/w-mai/uinspy/compare/v0.4.5...v0.4.6
[0.4.5]: https://github.com/w-mai/uinspy/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/w-mai/uinspy/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/w-mai/uinspy/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/w-mai/uinspy/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/w-mai/uinspy/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/w-mai/uinspy/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/w-mai/uinspy/compare/v0.2.4...v0.3.0
[0.2.4]: https://github.com/w-mai/uinspy/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/w-mai/uinspy/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/w-mai/uinspy/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/w-mai/uinspy/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/w-mai/uinspy/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/w-mai/uinspy/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/w-mai/uinspy/releases/tag/v0.1.0
