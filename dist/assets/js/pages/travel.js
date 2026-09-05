import { TRAVEL_PRESETS } from "../data.js";
import { getFinance } from "../services/finance.js";
import { state } from "../store.js";
import {
  $$,
  futureMonth,
  icon,
  money,
  pageTitle,
} from "../utils.js";

function render() {
  const priority = TRAVEL_PRESETS[state.travelPriority]
    ? state.travelPriority
    : "balanced";
  const values = TRAVEL_PRESETS[priority];
  const budget = 35000;
  const labels = ["住宿", "餐飲", "交通", "景點"];
  const finance = getFinance();

  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "旅遊規劃",
          "在預算上限內，依你想住得更好、吃得更好或玩更多景點，自動重配下方比重。",
          "旅遊規劃",
          { demo: true },
        )}
        <div class="tab-row">
          ${[
            ["balanced", "平均分配"],
            ["stay", "住得更好"],
            ["food", "吃得更好"],
            ["sights", "玩更多景點"],
          ].map(([value, label]) => `
            <button type="button" data-priority="${value}" class="${priority === value ? "active" : ""}">${label}</button>
          `).join("")}
        </div>

        <div class="two-col">
          <section class="feature-card">
            <p class="eyebrow">${icon("plane")} 日本 · 5 天</p>
            <h2>整趟預算上限 ${money(budget)}</h2>
            <p>選擇上方偏好後，下方預算線條會自動跟著改。</p>
            <div class="allocation-bars">
              ${labels.map((label, index) => `
                <div class="allocation-line">
                  <span>${label}</span>
                  <div class="bar"><i style="width:${values[index]}%"></i></div>
                  <strong>${money((budget * values[index]) / 100)}</strong>
                </div>
              `).join("")}
            </div>
          </section>
          <section class="result-panel">
            <p class="eyebrow">${icon("shield")} 出發前提醒</p>
            <h2>把旅遊保險一起算進去</h2>
            <p>目前規劃 5 天日本自由行，建議先確認海外醫療、班機延誤與行李損失保障。</p>
            <button class="primary-btn" type="button" data-route="/insurance">查看旅遊保險建議 →</button>
            <div class="card-winner">
              <small>存錢進度</small>
              <h3>每月存 ${money(finance.monthlySave)}</h3>
              <p>依目前設定，預計在 ${futureMonth(finance.months)} 完成目標。</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  `;
}

function mount({ rerender }) {
  const abortController = new AbortController();
  $$("[data-priority]").forEach((button) => {
    button.addEventListener("click", () => {
      state.travelPriority = button.dataset.priority;
      rerender({ scroll: false });
    }, { signal: abortController.signal });
  });
  return () => abortController.abort();
}

export default {
  render,
  mount,
};
