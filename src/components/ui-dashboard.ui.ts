//@ component("ui-dashboard")
class UiDashboard extends BaseComponent {
  static __style = css`
    .card {
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
    }
    @media (prefers-color-scheme: dark) {
      .card { border-color: #374151; }
    }
  `;
  static __template = html`
    <div class="card">
      <span class="title">Dashboard</span>
      <ui-theme-toggle></ui-theme-toggle>
      <ui-counter></ui-counter>
      <ui-tree></ui-tree>
    </div>
  `;
  render() {}
}
