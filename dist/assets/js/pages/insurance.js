import { INSURANCE_POLICIES } from "../data.js";
import { state } from "../store.js";
import {
  $,
  $$,
  pageTitle,
} from "../utils.js";

function render() {
  const tab = ["travel", "general", "claim"].includes(state.insuranceTab)
    ? state.insuranceTab
    : "travel";
  const policies = tab === "general"
    ? INSURANCE_POLICIES.general
    : INSURANCE_POLICIES.travel;

  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "保險保障",
          "整理已有保障、規劃旅遊保險，發生狀況時再用 AI 找可能申請的項目。",
          "保險保障",
          { demo: true },
        )}
        <div class="tab-row">
          <button type="button" data-insurance="travel" class="${tab === "travel" ? "active" : ""}">旅遊保險</button>
          <button type="button" data-insurance="general" class="${tab === "general" ? "active" : ""}">一般保險</button>
          <button type="button" data-insurance="claim" class="${tab === "claim" ? "active" : ""}">AI 理賠判斷</button>
        </div>

        ${tab === "claim" ? `
          <section class="feature-card claim-box">
            <h2>描述現在發生的狀況</h2>
            <p>例如：班機延誤 8 小時、行李隔天才送達，或住院三天。</p>
            <textarea id="claimText" placeholder="請描述事件、日期、損失與手上已有的單據…"></textarea>
            <button id="claimCheck" class="primary-btn" type="button">找可能申請的理賠項目</button>
            <div id="claimResult" class="claim-result" hidden>
              <h3>可能可申請：班機延誤定額、必要住宿／餐食費用</h3>
              <p>請先保留登機證、航空公司延誤證明與費用單據；實際是否理賠仍依你的保單條款與保險公司審核。</p>
            </div>
          </section>
        ` : `
          <div class="policy-grid">
            ${policies.map((policy) => `
              <article class="policy">
                <small>${tab === "travel" ? "旅行保障" : "一般保障"}</small>
                <h3>${policy[0]}</h3>
                <p>${policy[1]}</p>
                <ul><li>${policy[2]}</li><li>正式投保前確認條款與額度</li></ul>
              </article>
            `).join("")}
          </div>
        `}
      </section>
    </main>
  `;
}

function mount({ rerender, showToast }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };

  $$("[data-insurance]").forEach((button) => {
    button.addEventListener("click", () => {
      state.insuranceTab = button.dataset.insurance;
      rerender({ scroll: false });
    }, options);
  });

  $("#claimCheck")?.addEventListener("click", () => {
    if (!$("#claimText").value.trim()) {
      showToast("請先描述發生的狀況");
      return;
    }
    $("#claimResult").hidden = false;
  }, options);

  return () => abortController.abort();
}

export default {
  render,
  mount,
};
