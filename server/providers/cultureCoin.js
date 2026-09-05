// 文化幣（文化成長券）可用店家 — 手動維護的清單。
// 文化幣官網沒有帶座標、可查詢的商家 API，這裡先人工整理一份台北常見的實體店家，
// 之後若有官方開放資料，換掉 STORES 陣列即可，其餘（依距離篩選）不用動。
//
// 座標為概略值（約略到路口）。category 沿用六大類。type 一律 "culture_coin"。

const STORES = [
  // 書店
  { name: "誠品信義店", category: "education", area: "信義區", lat: 25.0398, lng: 121.5665 },
  { name: "誠品南西店", category: "education", area: "中山區", lat: 25.0522, lng: 121.5205 },
  { name: "誠品松菸店", category: "education", area: "信義區", lat: 25.0438, lng: 121.5605 },
  { name: "金石堂城中店", category: "education", area: "中正區", lat: 25.0432, lng: 121.5130 },
  { name: "政大書城台大店", category: "education", area: "大安區", lat: 25.0175, lng: 121.5340 },
  { name: "茉莉二手書店台大店", category: "education", area: "大安區", lat: 25.0166, lng: 121.5330 },
  { name: "唐山書店", category: "education", area: "大安區", lat: 25.0175, lng: 121.5327 },
  { name: "亞典藝術書店", category: "education", area: "大安區", lat: 25.0375, lng: 121.5548 },
  { name: "田園城市生活風格書店", category: "education", area: "中山區", lat: 25.0605, lng: 121.5245 },
  { name: "朋 丁 pon ding", category: "education", area: "中山區", lat: 25.0575, lng: 121.5210 },

  // 展演 / 電影 / 藝文空間
  { name: "台北當代藝術館 MOCA", category: "entertainment", area: "大同區", lat: 25.0508, lng: 121.5195 },
  { name: "光點台北 SPOT", category: "entertainment", area: "中山區", lat: 25.0560, lng: 121.5230 },
  { name: "華山1914文創園區", category: "entertainment", area: "中正區", lat: 25.0440, lng: 121.5290 },
  { name: "松山文創園區", category: "entertainment", area: "信義區", lat: 25.0435, lng: 121.5605 },
  { name: "Legacy Taipei", category: "entertainment", area: "中正區", lat: 25.0442, lng: 121.5300 },
  { name: "The Wall 公館", category: "entertainment", area: "中正區", lat: 25.0155, lng: 121.5340 },
  { name: "女巫店", category: "entertainment", area: "大安區", lat: 25.0243, lng: 121.5340 },
  { name: "河岸留言西門紅樓展演館", category: "entertainment", area: "萬華區", lat: 25.0423, lng: 121.5070 },

  // 唱片行
  { name: "佳佳唱片行", category: "entertainment", area: "中正區", lat: 25.0455, lng: 121.5175 },
  { name: "個體戶唱片行", category: "entertainment", area: "大同區", lat: 25.0570, lng: 121.5140 },
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

function nearbyCultureCoinStores(lat, lng, radiusM = 1500, limit = 12) {
  return STORES.map((s) => ({
    id: `cc_${s.name}`,
    name: s.name,
    category: s.category,
    area: s.area,
    type: "culture_coin",
    lat: s.lat,
    lng: s.lng,
    distance: haversine(lat, lng, s.lat, s.lng),
  }))
    .filter((s) => s.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

module.exports = { nearbyCultureCoinStores };
