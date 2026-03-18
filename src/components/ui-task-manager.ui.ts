//@ component("ui-task-manager")
import appState from "../state";

interface Task { id: number; text: string; done: boolean; }

class UiTaskManager extends BaseComponent {
  static __style = css`
    .task-done { text-decoration: line-through; opacity: 0.5; }
    @media (max-width: 480px) { .task-list { gap: 4px; } }
  `;
  static __template = html`
    <div class="flex flex-col gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-xl w-80">
      <div class="flex items-center justify-between">
        <span class="font-semibold text-gray-900 dark:text-gray-100">Task Manager</span>
        <ui-status-bar></ui-status-bar>
      </div>
      <div class="flex gap-2">
        <input type="text" placeholder="New task..." class="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent text-gray-900 dark:text-gray-100"/>
        <button class="px-3 py-1 text-sm bg-accent text-white rounded cursor-pointer hover:opacity-80">Add</button>
      </div>
      <div class="task-list flex flex-col gap-1"></div>
      <div class="empty-msg text-center text-xs text-gray-400 py-4">No tasks yet</div>
    </div>
  `;

  private tasks: Task[] = [];
  private nextId = 1;

  render() {
    const input = this.$<HTMLInputElement>("input");
    const addBtn = this.$<HTMLButtonElement>("button");
    const list = this.$<HTMLElement>(".task-list");
    const emptyMsg = this.$<HTMLElement>(".empty-msg");

    const refresh = () => {
      // Dynamic list rendering via this.html
      list.innerHTML = "";
      this.tasks.forEach(task => {
        const item = this.html`
          <div class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">
            <input type="checkbox" class="cursor-pointer"/>
            <span class="flex-1 text-gray-700 dark:text-gray-300">${task.text}</span>
            <button class="text-red-400 hover:text-red-600 cursor-pointer text-xs">✕</button>
          </div>
        `;
        const cb = item.querySelector("input") as HTMLInputElement;
        const label = item.querySelector("span")!;
        const delBtn = item.querySelector("button")!;

        cb.checked = task.done;
        if (task.done) label.classList.add("task-done");

        cb.onchange = () => {
          task.done = cb.checked;
          label.classList.toggle("task-done", task.done);
        };
        delBtn.onclick = () => {
          this.tasks = this.tasks.filter(t => t.id !== task.id);
          appState.taskCount.val = this.tasks.length;
          refresh();
        };
        list.appendChild(item);
      });

      // Conditional rendering
      emptyMsg.style.display = this.tasks.length === 0 ? "" : "none";
    };

    addBtn.onclick = () => {
      const text = input.value.trim();
      if (!text) return;
      this.tasks.push({ id: this.nextId++, text, done: false });
      input.value = "";
      appState.taskCount.val = this.tasks.length;
      refresh();
    };

    input.onkeydown = (e) => {
      if (e.key === "Enter") addBtn.click();
    };

    refresh();
  }
}
