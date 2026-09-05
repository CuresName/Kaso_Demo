// 附近店家 — 主來源 Google Places API (New) 的 Nearby Search（後端呼叫，key 不外流）。
// Places 掛掉 / 沒設 key / 超額時，自動退回 OpenStreetMap Overpass；再掛就退回一組假資料，
// 確保畫面不會整個空掉。回傳的店家會標記 source: "places" | "overpass" | "mock"。

const {
  categoryFromPlaceTypes,
  categoryFromOsmTag,
} = require("./offerPool");

const RADIUS_M = 1000;
const MAX_RESULTS = 20;

const PLACES_URL = "https://places.googleapis.com/v1/places:searchNearby";
// 公開 Overpass 實例常常忙碌 / 擋流量，準備幾個鏡像輪流試。
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// 給 Places 的 includedTypes（涵蓋六大分類的常見店家型別）。
const PLACES_INCLUDED_TYPES = [
  "restaurant", "cafe", "bakery", "meal_takeaway",
  "clothing_store", "shoe_store",
  "supermarket", "convenience_store", "pharmacy", "department_store",
  "gas_station", "bicycle_store",
  "book_store", "library",
  "movie_theater", "gym", "park",
];

// Overpass fallback 用的 tag 清單
const OSM_TAGS = [
  "restaurant", "cafe", "fast_food", "bar",
  "clothes", "shoes",
  "supermarket", "convenience", "pharmacy", "chemist", "department_store",
  "fuel", "bicycle",
  "books", "stationery", "library",
  "cinema", "theatre",
];

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

function placesKey() {
  return (
    process.env.GOOGLE_PLACES_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_BROWSER_KEY ||
    ""
  );
}

async function fromGooglePlaces(lat, lng) {
  const key = placesKey();
  if (!key) throw new Error("no-places-key");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.primaryType,places.types,places.formattedAddress,places.priceLevel",
      },
      body: JSON.stringify({
        includedTypes: PLACES_INCLUDED_TYPES,
        maxResultCount: MAX_RESULTS,
        languageCode: "zh-TW",
        regionCode: "TW",
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: RADIUS_M,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`places ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    return (json.places || [])
      .map((p) => {
        const plat = p.location?.latitude;
        const plng = p.location?.longitude;
        if (plat == null || plng == null) return null;
        return {
          id: p.id || `places_${plat}_${plng}`,
          name: p.displayName?.text || "未命名店家",
          address: p.formattedAddress || "",
          category: categoryFromPlaceTypes(p.types || [], p.primaryType),
          priceLevel: p.priceLevel || null,
          lat: plat,
          lng: plng,
          distance: haversine(lat, lng, plat, plng),
          source: "places",
        };
      })
      .filter(Boolean);
  } finally {
    clearTimeout(timeout);
  }
}

async function fromOverpass(lat, lng) {
  const filter = OSM_TAGS.map(
    (t) =>
      `nwr(around:${RADIUS_M},${lat},${lng})[shop=${t}];nwr(around:${RADIUS_M},${lat},${lng})[amenity=${t}];`
  ).join("");
  const query = `[out:json][timeout:10];(${filter});out center 40;`;

  let json = null;
  let lastErr = null;
  for (const url of OVERPASS_URLS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      json = JSON.parse(text); // 忙碌時會回 HTML，丟給 catch
      break;
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!json) throw lastErr || new Error("overpass unavailable");

  return (json.elements || [])
    .map((el) => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (elLat == null || elLng == null) return null;
        const tag = el.tags?.shop || el.tags?.amenity;
        return {
          id: `osm_${el.type}_${el.id}`,
          name: el.tags?.name || "未命名店家",
          address: el.tags?.["addr:full"] || el.tags?.["addr:street"] || "",
          category: categoryFromOsmTag(tag),
          priceLevel: null,
          lat: elLat,
          lng: elLng,
          distance: haversine(lat, lng, elLat, elLng),
          source: "overpass",
        };
      })
    .filter(Boolean);
}

function mockNearby(lat, lng, reason) {
  const seed = [
    { name: "巷口早餐店", category: "food", offsetM: 120 },
    { name: "全家便利商店", category: "housing", offsetM: 260 },
    { name: "社區圖書館", category: "education", offsetM: 470 },
    { name: "轉角咖啡", category: "food", offsetM: 610 },
    { name: "屈臣氏", category: "housing", offsetM: 730 },
    { name: "運動中心", category: "entertainment", offsetM: 880 },
  ];
  return seed.map((s, i) => ({
    id: `mock_${i}`,
    name: s.name,
    address: "",
    category: s.category,
    priceLevel: null,
    lat: lat + s.offsetM / 111000,
    lng,
    distance: s.offsetM,
    source: "mock",
    mockReason: reason,
  }));
}

// 主入口：Places → Overpass → mock，取第一個成功且有結果的。
async function fetchNearbyStores(lat, lng) {
  try {
    const places = await fromGooglePlaces(lat, lng);
    if (places.length) return places;
    throw new Error("places-empty");
  } catch (placesErr) {
    console.warn("[nearby] Google Places 不可用，改用 fallback：", placesErr.message.slice(0, 200));
    try {
      const osm = await fromOverpass(lat, lng);
      if (osm.length) return osm;
      return mockNearby(lat, lng, `places:${placesErr.message}; overpass:empty`);
    } catch (osmErr) {
      console.warn("[nearby] Overpass 也不可用，回傳示範資料：", osmErr.message.slice(0, 200));
      return mockNearby(lat, lng, `places:${placesErr.message}; overpass:${osmErr.message}`);
    }
  }
}

module.exports = { fetchNearbyStores, haversine, RADIUS_M };
