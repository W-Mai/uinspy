//@ component("ui-status-bar")
import appState from "../state";

class UiStatusBar extends BaseComponent {
  static __template = html`<div class="text-xs text-gray-400 dark:text-gray-500 tabular-nums">Tasks: 0</div>`;

  render() {
    appState.taskCount.sub(() => {
      this.el.textContent = `Tasks: ${appState.taskCount.val}`;
    });
  }
}
