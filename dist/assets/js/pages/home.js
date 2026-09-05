import { dailyQuota, getFinance } from "../services/finance.js";
import { personaModeLabel } from "../services/persona.js";
import { saveProfile, state } from "../store.js";
import { $, $$, icon, money } from "../utils.js";

// 交易分類 → 首頁明細用的顯示名稱
function spentByCategory() {
  const totals = new Map();
  for (const t of state.transactions) {
    const key = t.category || "其他";
    totals.set(key, (totals.get(key) || 0) + Number(t.amount || 0));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function budgetPill(id, label, value) {
  return `
    <button class="spend-pill${state.budgetDetail === id ? " active" : ""}" type="button" data-budget-detail="${id}">
      <span class="plus">+</span>
      <span><strong>${label}</strong><small>${value}</small></span>
    </button>
  `;
}

function budgetDetailData(finance, id) {
  const savingProgress = finance.target > 0
    ? Math.min(100, Math.round((finance.monthlySave / finance.target) * 100))
    : 0;
  const quota = dailyQuota(finance);
  const spentLines = spentByCategory();
  const spentTotal = finance.spent || 1;
  const details = {
    fixed: {
      kicker: "每月必要保留",
      amount: finance.fixed,
      title: "固定支出",
      copy: "房租、帳單與必要支出先整筆保留，不會出現在可花預算裡。這是你在初次設定填的每月固定支出總額。",
      glow: "rgba(0,113,227,.30)",
      lines: [],
    },
    saving: {
      kicker: "存款目標進度",
      amount: finance.monthlySave,
      title: "本月先存",
      copy: `目標 ${money(finance.target)}，目前已完成 ${savingProgress}%。`,
      glow: "rgba(109,74,255,.42)",
      lines: [["目標進度", savingProgress, finance.monthlySave]],
    },
    spent: {
      kicker: "交易自動分類",
      amount: finance.spent,
      title: "本月已記帳",
      copy: finance.spent
        ? "以下依你記帳的分類加總；每一筆都在自動記帳頁。"
        : "本月還沒有任何記帳。到自動記帳頁新增，這裡會即時更新。",
      glow: "rgba(8,120,223,.42)",
      lines: spentLines.map(([label, amount]) => [
        label,
        Math.round((amount / spentTotal) * 100),
        amount,
      ]),
    },
    safe: {
      kicker: "扣除保留後",
      amount: finance.safe,
      title: "安心可花",
      copy: "扣掉固定支出與每月先存之後，目前真正能用的金額；商品與附近優惠都以它為上限。",
      glow: "rgba(184,255,61,.28)",
      lines: [
        ["今日配額", finance.safe ? Math.round((quota / finance.safe) * 100) : 0, quota],
        ["本月其餘天數", finance.safe ? Math.round(((finance.safe - quota) / finance.safe) * 100) : 0, Math.max(0, finance.safe - quota)],
      ],
    },
  };
  return details[id] || details.safe;
}

function budgetDetailMarkup(finance, id) {
  const detail = budgetDetailData(finance, id);
  const detailIcon = id === "saving"
    ? "target"
    : id === "spent"
      ? "bell"
      : "wallet";
  return `
    <span class="detail-kicker">${icon(detailIcon)} ${detail.kicker}</span>
    <div class="detail-amount">${money(detail.amount)}</div>
    <h2 class="detail-title">${detail.title}</h2>
    <p class="detail-copy">${detail.copy}</p>
    <div class="detail-lines">
      ${detail.lines.map(([label, width, amount]) => `
        <div class="detail-line">
          <span>${label}</span>
          <i style="--line-width:${amount > 0 ? Math.max(3, width) : 0}%;--line-color:${
            id === "saving" ? "#2f5fd0" : id === "safe" ? "#f4d400" : "#94a79b"
          }"></i>
          <strong>${Math.round(width)}%</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function render() {
  const finance = getFinance();
  const carryover = Math.min(dailyQuota(finance), finance.safe);
  const settledCarryover = state.settlementDone ? carryover : 0;
  const total = Math.max(
    finance.reserve + finance.spent + finance.safe + settledCarryover,
    1,
  );
  const reserveStop = (finance.fixed / total) * 100;
  const saveStop = reserveStop + (finance.monthlySave / total) * 100;
  const spentStop = Math.min(
    100,
    saveStop + (finance.spent / total) * 100,
  );
  const donutBackground = `conic-gradient(
    #0b0b0b 0 ${reserveStop}%,
    #2f5fd0 ${reserveStop}% ${saveStop}%,
    #94a79b ${saveStop}% ${spentStop}%,
    #f4d400 ${spentStop}% 100%
  )`;
  const quota = dailyQuota(finance);
  const status = quota > 0
    ? `今天可以放心花約 ${money(quota)}`
    : "今天的額度用完了";
  const displayBalance = finance.currentBalance + settledCarryover;
  const needsDelay = (
    finance.safe <= 0
    || finance.currentBalance < finance.monthlySave
  );
  const savingProgress = finance.target > 0
    ? Math.min(100, Math.round((finance.monthlySave / finance.target) * 100))
    : 0;

  return `
    <main class="shell main-content">
      <section class="view money-overview dashboard-stage">
        <div class="balance-stage-head">
          <div>
            <p class="eyebrow">${icon("wallet")} ${personaModeLabel(state.profile?.mode)}首頁</p>
            <h1>${status}</h1>
          </div>
          <div class="money-actions">
            <button type="button" data-route="/ledger">${icon("bell")} 查看記帳</button>
            <div id="dailyPocket" class="daily-compact${state.settlementDone ? " is-done" : ""}">
              <span><small>今日未用</small><strong id="dailyCarryoverAmount">${money(state.settlementDone ? 0 : carryover)}</strong></span>
              <button id="settleDaily" type="button" ${state.settlementDone || carryover <= 0 ? "disabled" : ""}>
                ${state.settlementDone ? "已結算" : "結算"}
              </button>
            </div>
          </div>
        </div>

        <div class="balance-stage-grid">
          <nav class="spend-rail" aria-label="花費分類明細">
            <small>按下分類放大檢視</small>
            ${budgetPill("fixed", "固定支出", `${Math.round((finance.fixed / total) * 100)}%`)}
            ${budgetPill("saving", "存款目標", `${savingProgress}%`)}
            ${budgetPill("spent", "本月已花", `${Math.round((finance.spent / total) * 100)}%`)}
            ${budgetPill("safe", "安心可花", `${Math.round((finance.safe / total) * 100)}%`)}
          </nav>

          <section
            id="spendDetail"
            class="spend-detail"
            style="--detail-glow:${budgetDetailData(finance, state.budgetDetail).glow}"
            aria-live="polite"
          >
            <div id="spendDetailContent" class="spend-detail-content">
              ${budgetDetailMarkup(finance, state.budgetDetail)}
            </div>
          </section>

          <aside id="balanceDonut" class="donut-side">
            <small>目前餘額</small>
            <div class="donut large" style="background:${donutBackground}">
              <span><small>目前餘額</small><strong id="balanceAmountDisplay">${money(displayBalance)}</strong></span>
            </div>
            <div class="legend">
              <span><i class="legend-fixed"></i>固定</span>
              <span><i class="legend-saving"></i>存款</span>
              <span><i class="legend-spent"></i>已花</span>
              <span><i class="legend-available"></i>可花</span>
            </div>
            <span class="status-pill">${finance.safe > 0 ? "預算還在軌道上" : "已超出安心可花"}</span>
          </aside>
        </div>

        ${needsDelay ? `
          <div class="zero-balance-card">
            <p>
              <strong>目前可花餘額不足，建議延後完成期限</strong>
              <small>延長一個月能降低每月存款壓力，避免再用信用額度補生活費。</small>
            </p>
            <button id="delayGoal" class="primary-btn" type="button">延後 1 個月</button>
          </div>
        ` : ""}
      </section>

      <section class="view qa-section" aria-labelledby="qaTitle">
        <div class="qa-title">
          <p class="eyebrow">${icon("grid")} KASO 使用說明</p>
          <h2 id="qaTitle">有問？有答。</h2>
        </div>
        <div class="qa-list">
          <details open>
            <summary>怎麼知道今天還能花多少？</summary>
            <div class="qa-answer"><p>系統會先保留固定支出與存款，再從目前餘額扣除已記帳金額，計算安心可花。</p><a href="#/ledger" data-route="/ledger">查看自動記帳</a></div>
          </details>
          <details>
            <summary>餘額不夠時怎麼處理？</summary>
            <div class="qa-answer"><p>當可花餘額歸零或不足，會先建議延後目標期限，讓每月需要保留的金額下降。</p><a href="#/ledger" data-route="/ledger">查看支出與調整方案</a></div>
          </details>
          <details>
            <summary>商品比價如何確認是同一項商品？</summary>
            <div class="qa-answer"><p>比價前會核對完整型號、容量、版本與商品狀況，資料不足時先追問。</p><a href="#/search" data-route="/search">前往商品比價</a></div>
          </details>
          <details>
            <summary>旅遊預算會包含保險嗎？</summary>
            <div class="qa-answer"><p>旅遊頁會同時保留住宿、餐飲、交通、景點與保險入口，方便在同一個預算上限內安排。</p><a href="#/insurance" data-route="/insurance">查看保險保障</a></div>
          </details>
        </div>
      </section>
    </main>
  `;
}

function mount({ rerender, showToast }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };
  let animationFrame = null;

  $$("[data-budget-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.budgetDetail;
      state.budgetDetail = id;
      const finance = getFinance();
      const detail = budgetDetailData(finance, id);
      $$("[data-budget-detail]").forEach((item) => {
        item.classList.toggle("active", item.dataset.budgetDetail === id);
      });
      const panel = $("#spendDetail");
      const content = $("#spendDetailContent");
      if (!panel || !content) return;
      panel.style.setProperty("--detail-glow", detail.glow);
      content.innerHTML = budgetDetailMarkup(finance, id);
      content.classList.remove("is-changing");
      window.requestAnimationFrame(() => content.classList.add("is-changing"));
    }, options);
  });

  $("#settleDaily")?.addEventListener("click", () => {
    const button = $("#settleDaily");
    const sourceAmount = $("#dailyCarryoverAmount");
    const balanceAmount = $("#balanceAmountDisplay");
    if (!button || !sourceAmount || !balanceAmount || state.settlementDone) return;

    const finance = getFinance();
    const carryover = Math.min(dailyQuota(finance), finance.safe);
    if (carryover <= 0) return;
    button.disabled = true;
    button.textContent = "結算中";
    const startBalance = finance.currentBalance;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 1
      : 1050;
    const startedAt = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      const moved = Math.round(carryover * eased);
      sourceAmount.textContent = money(carryover - moved);
      balanceAmount.textContent = money(startBalance + moved);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
        return;
      }
      state.settlementDone = true;
      rerender({ scroll: false });
      showToast("今日未用預算已加回目前餘額");
    };
    animationFrame = window.requestAnimationFrame(tick);
  }, options);

  $("#delayGoal")?.addEventListener("click", () => {
    if (!state.profile) return;
    saveProfile({ ...state.profile, months: state.profile.months + 1 });
    rerender({ scroll: false });
    showToast("已將完成期限延後 1 個月");
  }, options);

  return () => {
    abortController.abort();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
  };
}

export default {
  render,
  mount,
};
