import { searchProducts } from "../services/api.js";
import {
  getFinance,
  shoppingBudgetFor,
} from "../services/finance.js";
import { state } from "../store.js";
import {
  $,
  escapeAttr,
  escapeHtml,
  icon,
  money,
  pageTitle,
} from "../utils.js";

function summaryStrip(finance, result) {
  const platforms = new Set((result?.items || []).map((item) => item.platform));
  return `
    <div class="summary-strip">
      <div><small>比價來源</small><strong>BigGo</strong></div>
      <div><small>找到候選</small><strong>${result ? (result.total || result.items.length) : "—"} 筆</strong></div>
      <div><small>平台數</small><strong>${result ? platforms.size : "—"}</strong></div>
      <div><small>安心可花</small><strong>${money(finance.safe)}</strong></div>
    </div>
  `;
}

function productCard(product, finance, shopping) {
  const remaining = shopping.available - product.price;
  const months = remaining >= 0
    ? 0
    : Math.ceil(Math.abs(remaining) / Math.max(1, finance.monthlySave));
  const recommended = remaining >= 0 && product.price <= shopping.available * 0.35;
  const image = product.image
    ? `<img src="${escapeAttr(product.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : icon("phone");

  return `
    <article class="product-flip-card" tabindex="0" aria-label="${escapeAttr(product.title)}，滑入查看購買判斷">
      <div class="product-flip-inner">
        <div class="product-flip-face product-flip-front">
          <div class="product-image">${image}</div>
          <div class="product-body">
            <div class="product-meta">
              <span class="platform">${escapeHtml(product.platform)}</span>
              ${product.isAd ? '<span class="match">廣告</span>' : ""}
            </div>
            <h3>${escapeHtml(product.title)}</h3>
            <div class="product-price">${money(product.price)}</div>
            <span class="flip-prompt">滑入查看購買判斷 →</span>
          </div>
        </div>
        <div class="product-flip-face product-flip-back">
          <div class="purchase-analysis">
            <span class="purchase-verdict${recommended ? " ok" : ""}">${recommended ? "可以考慮購買" : "目前不建議購買"}</span>
            <h3>${remaining >= 0 ? `買下後還剩 ${money(remaining)}` : `現在購買會不足 ${money(Math.abs(remaining))}`}</h3>
            <p>已先排除餐飲預算 ${money(shopping.foodBudget)}，不會把吃飯的錢算進可購物金額。</p>
          </div>
          <div>
            <div class="purchase-metrics">
              <span>可用購物預算 <strong>${money(shopping.available)}</strong></span>
              <span>目前存錢速度 <strong>${money(finance.monthlySave)}／月</strong></span>
              <span>還要存多久 <strong>${months ? `約 ${months} 個月` : "資金已足夠"}</strong></span>
            </div>
            <div class="purchase-back-actions">
              <button type="button" data-ask-product="${escapeAttr(`${product.title}｜${product.platform}｜${product.price}`)}">問 AI</button>
              ${product.url ? `<a href="${escapeAttr(product.url)}" target="_blank" rel="noreferrer">查看來源</a>` : ""}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

function resultsBlock(finance) {
  const { status, result, error, query } = state.search;

  if (status === "loading") {
    return `<div class="feature-card"><p>正在向 BigGo 查「${escapeHtml(query)}」…</p></div>`;
  }
  if (status === "error") {
    return `<div class="feature-card route-error"><p>比價暫時失敗：${escapeHtml(error || "請稍後再試")}</p><button class="secondary-btn" type="button" data-retry-search>重試</button></div>`;
  }
  if (status === "idle" || !result) {
    return `<div class="feature-card"><p>輸入完整商品名稱或貼上商品連結，KASO 會用 BigGo 跨平台比價，再依你的安心可花給購買判斷。</p></div>`;
  }
  if (!result.items.length) {
    return `<div class="feature-card"><p>找不到「${escapeHtml(query)}」的比價結果，換個關鍵字或補上完整型號試試。</p></div>`;
  }

  const shopping = shoppingBudgetFor(finance);
  return `
    <div class="result-grid">
      ${result.items.map((product) => productCard(product, finance, shopping)).join("")}
    </div>
    <p class="onboarding-note">資料來源：BigGo 跨平台候選清單，依價格排序；不做同品項比對。購買判斷為前端依你的預算即時計算。</p>
  `;
}

function render() {
  const finance = getFinance();

  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "商品比價",
          "輸入完整型號或商品連結，用 BigGo 跨平台比價，再依安心可花給購買判斷。",
          "商品比價",
        )}
        <form id="searchForm" class="toolbar">
          <input id="searchInput" value="${escapeAttr(state.searchQuery)}" placeholder="輸入完整商品名稱，或貼上商品連結">
          <button
            id="filterToggle"
            class="filter-toggle${state.filterOpen ? " active" : ""}"
            type="button"
            aria-label="展開篩選條件"
            aria-expanded="${state.filterOpen}"
          >${icon("filter")}</button>
          <button class="primary-btn" type="submit">${icon("search")} 開始比價</button>
        </form>

        ${state.filterOpen ? `
          <div class="filter-dropdown" aria-label="商品篩選條件">
            <label>排序方式<select id="searchSort"><option value="price">價格最低</option><option value="price-desc">價格最高</option></select></label>
          </div>
        ` : ""}

        ${summaryStrip(finance, state.search.result)}
        ${resultsBlock(finance)}
      </section>
    </main>
  `;
}

async function runSearch(query, { rerender }) {
  state.searchQuery = query;
  state.search = { status: "loading", query, result: null, error: null };
  rerender({ scroll: false });
  try {
    const result = await searchProducts(query);
    if (result.error) throw new Error(result.error);
    state.search = { status: "done", query, result, error: null };
  } catch (err) {
    state.search = { status: "error", query, result: null, error: err.message };
  }
  rerender({ scroll: false });
}

function mount({ rerender, showToast, openAssistant }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };

  // 帶著關鍵字進頁面、且還沒查過 → 自動查一次
  if (
    state.searchQuery
    && state.search.status === "idle"
  ) {
    runSearch(state.searchQuery, { rerender });
  }

  $("#searchForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#searchInput").value.trim();
    if (!query) {
      openAssistant("我想比價");
      return;
    }
    runSearch(query, { rerender });
    showToast("開始比價");
  }, options);

  $("#filterToggle")?.addEventListener("click", () => {
    state.filterOpen = !state.filterOpen;
    rerender({ scroll: false });
  }, options);

  $("#searchSort")?.addEventListener("change", (event) => {
    const result = state.search.result;
    if (!result) return;
    const dir = event.target.value === "price-desc" ? -1 : 1;
    result.items = [...result.items].sort((a, b) => (a.price - b.price) * dir);
    rerender({ scroll: false });
  }, options);

  document.querySelector("[data-retry-search]")?.addEventListener("click", () => {
    if (state.searchQuery) runSearch(state.searchQuery, { rerender });
  }, options);

  return () => abortController.abort();
}

export default {
  render,
  mount,
};
