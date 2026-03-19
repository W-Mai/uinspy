import "./components/ui-theme-toggle.ui";
import "./components/ui-topbar.ui";
import "./components/ui-drop-zone.ui";
import "./components/ui-dashboard.ui";

document.getElementById("about")!.innerHTML =
  `<span>uinspy v${__UINSPY_VERSION__}</span><span>·</span><span>Built ${__UINSPY_BUILD_TIME__}</span><span>·</span><span>${__UINSPY_THREE__ ? "WebGL" : "Canvas2D"}</span><span>·</span><a href="https://github.com/W-Mai/uinspy" target="_blank">GitHub</a><span>·</span><a href="https://lvgl.io" target="_blank">LVGL</a><span>·</span><span>MIT</span>`;
