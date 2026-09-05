import { fetchNearbyOffers } from "../services/api.js";
import { getFinance } from "../services/finance.js";
import { state } from "../store.js";
import {
  $,
  $$,
  escapeAttr,
  escapeHtml,
  icon,
  money,
  pageTitle,
} from "../utils.js";

// 定位失敗時的示範座標（台北車站）
const DEMO_COORDS = { lat: 25.0478, lng: 121.517 };

const CATEGORY_ICON = {
  food: "food",
  housing: "cart",
  clothing: "cart",
  transport: "pin",
  education: "grid",
  entertainment: "grid",
};

function mapMarkup(stores) {
  if (!stores.length) return "";
  const lats = stores.map((s) => s.lat);
  const lngs = stores.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.001, maxLat - minLat);
  const lngSpan = Math.max(0.001, maxLng - minLng);

  return `
    <section class="nearby-map" aria-label="附近推薦地圖">
      <div class="nearby-map-head"><h2>附近推薦地圖</h2><small>點標記開啟導航</small></div>
      <div class="nearby-map-canvas">
        ${stores.map((store, index) => {
          const left = 12 + ((store.lng - minLng) / lngSpan) * 76;
          const top = 14 + ((maxLat - store.lat) / latSpan) * 70;
          return `
            <a
              class="map-marker"
              style="left:${left}%;top:${top}%"
              href="https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}"
              target="_blank"
              rel="noreferrer"
              title="${escapeAttr(store.name)}"
            ><span>${index + 1}</span></a>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function offerChips(offers) {
  if (!offers || !offers.length) return "";
  return `
    <div class="offer-chips">
      ${offers.map((offer) => `
        <span class="offer-chip${offer.type === "free" ? " free" : offer.affordable ? "" : " over"}">
          ${escapeHtml(offer.title)}${offer.type === "paid" ? `（折抵 ${money(offer.value)}${offer.affordable ? "" : "・超出預算"}）` : "・免費"}
        </span>
      `).join("")}
    </div>
  `;
}

function storeCard(store) {
  return `
    <article class="merchant-card">
      <span class="merchant-icon">${icon(CATEGORY_ICON[store.category] || "pin")}</span>
      <div>
        <span class="platform">${escapeHtml(store.categoryLabel || "")} · ${store.distance} 公尺</span>
        <h3>${escapeHtml(store.name)}</h3>
        ${store.address ? `<p>${escapeHtml(store.address)}</p>` : ""}
        ${offerChips(store.offers)}
      </div>
      <div class="merchant-result">
        <a class="directions" href="https://www.google.com/maps/search/?api=1&query=${store.lat},${store.lng}" target="_blank" rel="noreferrer">
          ${icon("pin")} 開啟導航
        </a>
      </div>
    </article>
  `;
}

function body() {
  const { status, stores, error, source } = state.nearby;
  const finance = getFinance();

  if (status === "loading") {
    return `<div class="feature-card"><p>正在抓你附近 1,000 公尺內的店家與可用優惠…</p></div>`;
  }
  if (status === "denied") {
    return `
      <div class="feature-card">
        <p>沒有取得定位權限，無法顯示你附近的店家。</p>
        <button class="secondary-btn" type="button" data-nearby-demo>用台北車站示範</button>
      </div>
    `;
  }
  if (status === "error") {
    return `
      <div class="feature-card route-error">
        <p>附近搜尋暫時失敗：${escapeHtml(error || "請稍後再試")}</p>
        <button class="secondary-btn" type="button" data-nearby-retry>重試</button>
      </div>
    `;
  }
  if (status === "done" && !stores.length) {
    return `<div class="feature-card"><p>這個位置 1,000 公尺內沒有找到符合的店家。</p></div>`;
  }
  if (status !== "done") {
    return `<div class="feature-card"><p>準備讀取你的位置…</p></div>`;
  }

  const sourceLabel = source === "places"
    ? "Google Places"
    : source === "overpass"
      ? "OpenStreetMap（Google 暫時無法使用）"
      : "示範資料（即時來源都連不上）";

  return `
    <div class="summary-strip">
      <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
      <div><small>找到店家</small><strong>${stores.length} 間</strong></div>
      <div><small>先保留不動</small><strong>${money(finance.reserve)}</strong></div>
      <div><small>安心可花</small><strong>${money(finance.safe)}</strong></div>
    </div>
    ${mapMarkup(stores)}
    <div class="merchant-list">
      ${stores.map(storeCard).join("")}
    </div>
    <p class="onboarding-note">店家來源：${sourceLabel}。優惠為政府活動 / 文化幣示範資料，依店家分類配對。</p>
  `;
}

function render() {
  const finance = getFinance();
  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "附近優惠",
          `帳戶有 ${money(finance.currentBalance)}，今天只放心花 ${money(finance.safe)}。`,
          "附近優惠",
        )}
        ${body()}
      </section>
    </main>
  `;
}

async function loadNearby(coords, { rerender }) {
  state.nearby = { ...state.nearby, status: "loading", coords, error: null };
  rerender({ scroll: false });
  try {
    const finance = getFinance();
    const data = await fetchNearbyOffers({
      lat: coords.lat,
      lng: coords.lng,
      safe: finance.safe,
    });
    state.nearby = {
      status: "done",
      coords,
      source: data.source,
      stores: data.stores || [],
      error: null,
    };
  } catch (err) {
    state.nearby = { ...state.nearby, status: "error", error: err.message };
  }
  rerender({ scroll: false });
}

function requestLocation({ rerender }) {
  if (!navigator.geolocation) {
    state.nearby = { ...state.nearby, status: "denied" };
    rerender({ scroll: false });
    return;
  }
  state.nearby = { ...state.nearby, status: "loading" };
  rerender({ scroll: false });
  navigator.geolocation.getCurrentPosition(
    (position) => {
      loadNearby(
        { lat: position.coords.latitude, lng: position.coords.longitude },
        { rerender },
      );
    },
    () => {
      state.nearby = { ...state.nearby, status: "denied" };
      rerender({ scroll: false });
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
  );
}

function mount({ rerender }) {
  const abortController = new AbortController();
  const options = { signal: abortController.signal };

  if (state.nearby.status === "idle") {
    requestLocation({ rerender });
  }

  $$("[data-nearby-demo]").forEach((button) => {
    button.addEventListener("click", () => loadNearby(DEMO_COORDS, { rerender }), options);
  });
  $$("[data-nearby-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      const coords = state.nearby.coords || DEMO_COORDS;
      loadNearby(coords, { rerender });
    }, options);
  });

  return () => abortController.abort();
}

export default {
  render,
  mount,
};
