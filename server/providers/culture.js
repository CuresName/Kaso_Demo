// 免費活動 — 文化部「藝文活動」開放資料（全台一次抓下來，記憶體快取，依距離 + 免費篩選）。
// 資料集：https://data.gov.tw/dataset/6478
// 端點沒有伺服器端地點查詢，所以策略是：整包抓 → 快取 6 小時 → 每次請求在記憶體裡濾。

// 文化部 API 的 category=all 目前回空 body，只能逐一分類抓再合併。
// 分類代碼 1..16（展覽 / 講座 / 音樂 / 舞蹈 / 親子 / 電影 / 文學 …）。
const FEED_BASE =
  "https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=";
const CATEGORY_CODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16];
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
const UA = "Mozilla/5.0 (compatible; KASO/1.0)";

let cache = { at: 0, events: null };
let inflight = null;

function toNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

// 是否免費：onSales 不是 "Y"，或票價字串看起來像免費 / 空白
function isFree(show) {
  const onSales = String(show?.onSales ?? "").trim().toUpperCase();
  if (onSales === "Y") return false;
  const price = String(show?.price ?? "").trim();
  if (!price) return true;
  return /免費|自由|免票|不需|免入場|0\s*元|free/i.test(price);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// 這份資料有不少活動的經緯度是錯的（例如高雄的展覽掛在台北座標），
// 所以除了距離，還用「使用者所在縣市」對照活動地址字串做二次過濾。
const CITY_BOXES = [
  ["臺北", 24.96, 25.21, 121.45, 121.66],
  ["新北", 24.67, 25.30, 121.27, 122.01],
  ["基隆", 25.08, 25.16, 121.68, 121.80],
  ["桃園", 24.78, 25.12, 120.96, 121.45],
  ["新竹", 24.66, 24.90, 120.87, 121.25],
  ["臺中", 24.05, 24.44, 120.44, 121.05],
  ["臺南", 22.88, 23.39, 120.02, 120.42],
  ["高雄", 22.45, 23.28, 120.19, 120.75],
];

function guessCity(lat, lng) {
  for (const [name, s, n, w, e] of CITY_BOXES) {
    if (lat >= s && lat <= n && lng >= w && lng <= e) return name;
  }
  return null;
}

function addressInCity(address, city) {
  if (!city) return true; // 不在已知縣市（例如離島）就不做這層過濾
  const a = String(address || "").replace(/台/g, "臺");
  if (city === "臺北") return a.includes("臺北市");
  if (city === "新北") return a.includes("新北市") || a.includes("臺北市");
  return a.includes(`${city}市`);
}

async function fetchCategory(code) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FEED_BASE + code, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) return [];
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return [];
    const raw = JSON.parse(buf.toString("utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFeed() {
  const lists = await Promise.all(CATEGORY_CODES.map(fetchCategory));
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set();
  const events = [];

  for (const list of lists) {
    for (const item of list) {
      if (item.endDate && String(item.endDate).replace(/\//g, "-") < today) continue;
      const shows = Array.isArray(item.showInfo) ? item.showInfo : [];
      for (const show of shows) {
        const lat = toNum(show.latitude);
        const lng = toNum(show.longitude);
        if (lat == null || lng == null) continue;
        const id = `${item.UID || item.uid || item.version || item.title}_${lat}_${lng}`;
        if (seen.has(id)) continue;
        seen.add(id);
        events.push({
          id,
          name: item.title || "未命名活動",
          address: show.location || "",
          venue: show.locationName || "",
          lat,
          lng,
          free: isFree(show),
          startDate: (item.startDate || show.startTime || "").slice(0, 10),
          endDate: (item.endDate || show.endTime || "").slice(0, 10),
          url: item.sourceWebPromote || item.webSales || "",
        });
      }
    }
  }
  if (!events.length) throw new Error("所有分類都沒有帶座標的活動");
  return events;
}

async function getEvents() {
  const fresh = cache.events && Date.now() - cache.at < CACHE_TTL_MS;
  if (fresh) return cache.events;
  if (inflight) return inflight;

  inflight = fetchFeed()
    .then((events) => {
      cache = { at: Date.now(), events };
      return events;
    })
    .catch((err) => {
      console.warn("[culture] 活動資料抓取失敗：", err.message);
      return cache.events || []; // 用舊快取，沒有就空陣列
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

// 附近的免費活動，依距離排序。距離 + 縣市地址雙重過濾（資料座標常有誤）。
async function nearbyFreeActivities(lat, lng, radiusM = 3000, limit = 12) {
  const events = await getEvents();
  const city = guessCity(lat, lng);
  return events
    .filter((e) => e.free && !/取消|停辦|延期|順延/.test(e.name))
    .map((e) => ({ ...e, distance: haversine(lat, lng, e.lat, e.lng) }))
    .filter((e) => e.distance <= radiusM && addressInCity(e.address, city))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

module.exports = { nearbyFreeActivities };
