import { fetchNearbyOffers } from "../services/api.js";
import { getFinance } from "../services/finance.js";
import { loadGoogleMaps } from "../services/maps.js";
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

// Google Places 的價位 enum → 顯示符號 + 是否算「平價」
const PRICE_LEVEL = {
  PRICE_LEVEL_FREE: { label: "免費", cheap: true },
  PRICE_LEVEL_INEXPENSIVE: { label: "$", cheap: true },
  PRICE_LEVEL_MODERATE: { label: "$$", cheap: true },
  PRICE_LEVEL_EXPENSIVE: { label: "$$$", cheap: false },
  PRICE_LEVEL_VERY_EXPENSIVE: { label: "$$$$", cheap: false },
};

function visibleStores() {
  const stores = state.nearby.stores || [];
  if (!state.nearby.budgetOnly) return stores;
  // 「安心預算內」= Google 標示為平價（$–$$）或沒有標價位的店家
  return stores.filter((s) => {
    const p = PRICE_LEVEL[s.priceLevel];
    return !p || p.cheap;
  });
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

function navLink(lat, lng, label = "開啟導航") {
  return `
    <a class="directions" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noreferrer">
      ${icon("pin")} ${label}
    </a>
  `;
}

function storeCard(store) {
  const price = PRICE_LEVEL[store.priceLevel];
  return `
    <article class="merchant-card">
      <span class="merchant-icon">${icon(CATEGORY_ICON[store.category] || "pin")}</span>
      <div>
        <span class="platform">${escapeHtml(store.categoryLabel || "")} · ${store.distance} 公尺${price ? ` · ${price.label}` : ""}</span>
        <h3>${escapeHtml(store.name)}${store.acceptsCultureCoin ? ' <span class="offer-chip free">收文化幣</span>' : ""}</h3>
        ${store.address ? `<p>${escapeHtml(store.address)}</p>` : ""}
        ${offerChips(store.offers)}
      </div>
      <div class="merchant-result">${navLink(store.lat, store.lng)}</div>
    </article>
  `;
}

function activityCard(act) {
  const dates = act.startDate && act.endDate
    ? `${act.startDate}${act.endDate !== act.startDate ? ` ~ ${act.endDate}` : ""}`
    : "";
  return `
    <article class="merchant-card">
      <span class="merchant-icon">${icon("grid")}</span>
      <div>
        <span class="platform">免費活動 · ${act.distance} 公尺${dates ? ` · ${dates}` : ""}</span>
        <h3>${escapeHtml(act.name)}</h3>
        ${act.venue ? `<p>${escapeHtml(act.venue)}${act.address ? `｜${escapeHtml(act.address)}` : ""}</p>` : ""}
      </div>
      <div class="merchant-result">
        ${act.url ? `<a class="directions" href="${escapeAttr(act.url)}" target="_blank" rel="noreferrer">${icon("arrow")} 活動頁</a>` : ""}
        ${navLink(act.lat, act.lng)}
      </div>
    </article>
  `;
}

function cultureCard(store) {
  return `
    <article class="merchant-card">
      <span class="merchant-icon">${icon("music")}</span>
      <div>
        <span class="platform">文化幣 · ${escapeHtml(store.area || "")} · ${store.distance} 公尺</span>
        <h3>${escapeHtml(store.name)}</h3>
      </div>
      <div class="merchant-result">${navLink(store.lat, store.lng)}</div>
    </article>
  `;
}

function body() {
  const { status, error, source, budgetOnly } = state.nearby;
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
  if (status !== "done") {
    return `<div class="feature-card"><p>準備讀取你的位置…</p></div>`;
  }

  const stores = visibleStores();
  const total = state.nearby.stores.length;
  const activities = state.nearby.activities || [];
  const cultureStores = state.nearby.cultureStores || [];
  const sourceLabel = source === "places"
    ? "Google Places"
    : source === "overpass"
      ? "OpenStreetMap（Google 暫時無法使用）"
      : "示範資料（即時來源都連不上）";

  return `
    <div class="summary-strip">
      <div><small>搜尋半徑</small><strong>1,000 公尺</strong></div>
      <div><small>${budgetOnly ? "預算內店家" : "找到店家"}</small><strong>${stores.length}${budgetOnly ? ` / ${total}` : ""} 間</strong></div>
      <div><small>免費活動</small><strong>${activities.length}</strong></div>
      <div><small>文化幣店家</small><strong>${cultureStores.length}</strong></div>
    </div>

    <div class="nearby-toolbar">
      <button type="button" class="filter-toggle${budgetOnly ? " active" : ""}" data-nearby-budget aria-pressed="${budgetOnly}">
        ${icon("filter")} 只看安心預算內店家（$–$$）
      </button>
    </div>

    <section class="nearby-map" aria-label="附近推薦地圖">
      <div class="nearby-map-head"><h2>附近推薦地圖</h2><small>點標記看店名與距離</small></div>
      <div id="nearbyMapCanvas" class="nearby-map-canvas"></div>
    </section>

    <div class="merchant-list">
      ${stores.length ? stores.map(storeCard).join("") : '<div class="feature-card"><p>目前篩選條件下沒有店家。</p></div>'}
    </div>

    <div class="section-head" style="margin-top:22px">
      <div><h2>附近免費藝文活動</h2><p>文化部藝文活動開放資料，只列免費、且在你所在縣市的活動。</p></div>
      <span>${activities.length} 場</span>
    </div>
    <div class="merchant-list">
      ${activities.length ? activities.map(activityCard).join("") : '<div class="feature-card"><p>3 公里內目前沒有免費藝文活動。</p></div>'}
    </div>

    <div class="section-head" style="margin-top:22px">
      <div><h2>文化幣可用店家</h2><p>16–22 歲的文化成長券可用，人工整理的常見店家清單。</p></div>
      <span>${cultureStores.length} 間</span>
    </div>
    <div class="merchant-list">
      ${cultureStores.length ? cultureStores.map(cultureCard).join("") : '<div class="feature-card"><p>1.5 公里內沒有清單上的文化幣店家。</p></div>'}
    </div>

    <p class="onboarding-note">店家來源：${sourceLabel}；價位($)為 Google 標示。免費活動：文化部藝文活動開放資料（每日更新，座標偶有誤差）。文化幣店家：人工清單。政府活動優惠仍為示範資料。</p>
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

async function initMap() {
  const canvas = $("#nearbyMapCanvas");
  if (!canvas) return;
  const stores = visibleStores();
  const center = state.nearby.coords || DEMO_COORDS;

  let maps;
  try {
    maps = await loadGoogleMaps();
  } catch {
    // 首次載入偶爾會 race，等一下再試一次
    await new Promise((r) => setTimeout(r, 1500));
    try {
      maps = await loadGoogleMaps();
    } catch {
      if (!canvas.isConnected) return;
      canvas.classList.add("map-fallback");
      canvas.innerHTML = `<p>地圖載入失敗。請確認 Google key 已允許「Maps JavaScript API」，且 HTTP referrer 限制包含本網域。</p>`;
      return;
    }
  }
  if (!canvas.isConnected) return; // 使用者已切走

  const map = new maps.Map(canvas, {
    center,
    zoom: 15,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
  });

  new maps.Marker({
    position: center,
    map,
    title: "目前位置",
    label: { text: "你", color: "#fff", fontSize: "11px" },
  });

  const bounds = new maps.LatLngBounds();
  bounds.extend(center);

  const addMarker = (item, label, subtitle, color) => {
    const position = { lat: item.lat, lng: item.lng };
    const marker = new maps.Marker({
      position, map, title: item.name, label: { text: label, color: "#fff", fontSize: "10px" },
      ...(color ? { icon: { path: maps.SymbolPath.CIRCLE, scale: 11, fillColor: color, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } } : {}),
    });
    const info = new maps.InfoWindow({
      content: `<strong>${escapeHtml(item.name)}</strong><br>${escapeHtml(subtitle)}`,
    });
    marker.addListener("click", () => info.open({ map, anchor: marker }));
    bounds.extend(position);
  };

  stores.forEach((s, i) => addMarker(s, String(i + 1), `${s.categoryLabel || ""} · ${s.distance} 公尺`));
  (state.nearby.activities || []).forEach((a) =>
    addMarker(a, "活", `免費活動 · ${a.distance} 公尺`, "#2f5fd0"));
  (state.nearby.cultureStores || []).forEach((c) =>
    addMarker(c, "幣", `文化幣 · ${c.distance} 公尺`, "#7a4dff"));

  const pointCount = stores.length
    + (state.nearby.activities || []).length
    + (state.nearby.cultureStores || []).length;
  if (pointCount) map.fitBounds(bounds, 40);
}

async function loadNearby(coords, { rerender }) {
  state.nearby = { ...state.nearby, status: "loading", coords, error: null };
  rerender({ scroll: false });
  try {
    const finance = getFinance();
    const data = await fetchNearbyOffers({ lat: coords.lat, lng: coords.lng, safe: finance.safe });
    state.nearby = {
      status: "done",
      coords,
      source: data.source,
      stores: data.stores || [],
      activities: data.activities || [],
      cultureStores: data.cultureStores || [],
      budgetOnly: state.nearby.budgetOnly || false,
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
    (position) => loadNearby(
      { lat: position.coords.latitude, lng: position.coords.longitude },
      { rerender },
    ),
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
  } else if (state.nearby.status === "done") {
    initMap();
  }

  $$("[data-nearby-demo]").forEach((button) => {
    button.addEventListener("click", () => loadNearby(DEMO_COORDS, { rerender }), options);
  });
  $$("[data-nearby-retry]").forEach((button) => {
    button.addEventListener("click", () => {
      loadNearby(state.nearby.coords || DEMO_COORDS, { rerender });
    }, options);
  });
  $$("[data-nearby-budget]").forEach((button) => {
    button.addEventListener("click", () => {
      state.nearby = { ...state.nearby, budgetOnly: !state.nearby.budgetOnly };
      rerender({ scroll: false });
    }, options);
  });

  return () => abortController.abort();
}

export default {
  render,
  mount,
};
