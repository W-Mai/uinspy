//@ component("ui-drop-zone")
import { dashData } from "../state";

class UiDropZone extends BaseComponent {
  static __template = html`
    <div id="drop-zone" style="display:none">
      <div class="drop-icon">📂</div>
      <p>Drag &amp; drop a JSON file here, or click to select</p>
      <div class="drop-hint">Exported via <code>dump dashboard --json</code></div>
      <input type="file" id="file-input" accept=".json" aria-label="Load JSON file"/>
    </div>
  `;

  render() {
    const zone = this.el;
    const input = this.$<HTMLInputElement>("#file-input");

    // Show only when no embedded data
    const jsonEl = document.getElementById("lvgl-data");
    const raw = jsonEl?.textContent?.trim();
    if (raw) {
      try { dashData.val = JSON.parse(raw); return; } catch (e) { /* fall through to show drop zone */ }
    }

    zone.style.display = "flex";

    const load = (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          dashData.val = JSON.parse(reader.result as string);
          zone.style.display = "none";
        } catch (e) { alert("Invalid JSON: " + (e as Error).message); }
      };
      reader.readAsText(file);
    };

    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", e => {
      e.preventDefault(); zone.classList.remove("dragover");
      if (e.dataTransfer?.files[0]) load(e.dataTransfer.files[0]);
    });
    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => { if (input.files?.[0]) load(input.files[0]); });
  }
}
