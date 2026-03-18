# uinspy

*you eye spy* — A single-file UI inspector for [LVGL](https://lvgl.io) runtime state.

Drop a JSON dump from your LVGL device and get an interactive dashboard: object trees, 3D exploded view, animations, timers, input devices, image caches, and more — all in one self-contained HTML file with zero dependencies.

## Features

- 📂 Drag & drop JSON or embed data at build time
- 🌲 Recursive object tree with click-to-select
- 🧊 3D exploded view with rotation, zoom, pan, layer toggle
- 📊 Section panels: displays, animations, timers, input devices, groups, draw units/tasks, image/header caches, decoders, subjects, FS drivers
- 🎨 Three themes: dark (Catppuccin Mocha), light (Catppuccin Latte), cyber (neon)
- 🔍 Live search filter across all panels
- 📦 Single HTML file output (~70 KB minified), no server needed

## Quick Start

```bash
bun install
bun run build
open dist/uinspy.html
```

To embed device data at build time:

```bash
python3 -c "
html = open('dist/uinspy.html').read()
data = open('your_dump.json').read()
print(html.replace('{{JSON_DATA}}', data))
" > inspector.html
```

## Development

```bash
bun run dev       # Generate CSS + start dev server at localhost:3000
bun run build     # Production build → dist/
```

## Build Pipeline

```
src/*.ts ──→ Bun.build (uiPlugin) ──→ JS bundle
                  │
                  ├─ html`` → compiled DOM calls
                  ├─ css``  → scopeCSS → collected
                  └─ //@ component() → customElements.define

src/app.css ─┐
collected CSS ┘──→ @tailwindcss/node compile() ──→ CSS bundle
                        │
                        ├─ @theme tokens resolved
                        ├─ @apply expanded
                        └─ @utility expanded

JS + CSS ──→ inline into single HTML file
```

## License

MIT
