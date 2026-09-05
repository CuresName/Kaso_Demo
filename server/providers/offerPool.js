// 優惠資料來源 — 依架構定案：先做「政府活動」+「文化幣」，信用卡官網之後再擴充。
// 目前是靜態 pool；之後要接真實來源時，只要換掉 fetchOffers() 的實作、回傳同樣結構即可，
// 其餘（分類配對、預算比對）完全不用改。
//
// category 用六大類 key（food/clothing/housing/transport/education/entertainment），
// 跟前端記帳分類、附近店家分類一致。

const OFFER_POOL = [
  { id: "o1", title: "夜市消費券折抵 100 元", source: "government", category: "food", type: "paid", value: 100 },
  { id: "o2", title: "文化幣：獨立書店買書折抵", source: "culture_voucher", category: "education", type: "paid", value: 200 },
  { id: "o3", title: "市府節電家電補助", source: "government", category: "housing", type: "paid", value: 1000 },
  { id: "o4", title: "社區公園免費瑜珈課", source: "government", category: "entertainment", type: "free", value: 0 },
  { id: "o5", title: "文化幣：獨立電影院優惠票", source: "culture_voucher", category: "entertainment", type: "paid", value: 280 },
  { id: "o6", title: "市集在地小吃買一送一", source: "government", category: "food", type: "paid", value: 150 },
  { id: "o7", title: "圖書館免費借閱活動", source: "government", category: "education", type: "free", value: 0 },
  { id: "o8", title: "公共自行車首 30 分免費", source: "government", category: "transport", type: "free", value: 0 },
  { id: "o9", title: "在地服飾工作室折扣日", source: "government", category: "clothing", type: "paid", value: 300 },
  { id: "o10", title: "社區免費健檢日", source: "government", category: "housing", type: "free", value: 0 },
];

// Google Places（New）的 primaryType / types → 六大分類。
// 找不到對應時歸到 housing（日常）。
const PLACE_TYPE_TO_CATEGORY = {
  restaurant: "food", cafe: "food", bakery: "food", bar: "food",
  meal_takeaway: "food", meal_delivery: "food", food_court: "food", fast_food_restaurant: "food",
  clothing_store: "clothing", shoe_store: "clothing", jewelry_store: "clothing",
  supermarket: "housing", convenience_store: "housing", pharmacy: "housing",
  drugstore: "housing", home_goods_store: "housing", department_store: "housing", grocery_store: "housing",
  gas_station: "transport", bicycle_store: "transport", car_repair: "transport", transit_station: "transport",
  book_store: "education", library: "education", school: "education", university: "education",
  movie_theater: "entertainment", gym: "entertainment", fitness_center: "entertainment",
  park: "entertainment", tourist_attraction: "entertainment", amusement_park: "entertainment",
};

// OpenStreetMap（Overpass fallback 用）的 shop/amenity tag → 六大分類。
const OSM_TAG_TO_CATEGORY = {
  restaurant: "food", cafe: "food", fast_food: "food", bar: "food", food_court: "food",
  clothes: "clothing", shoes: "clothing", boutique: "clothing",
  supermarket: "housing", convenience: "housing", pharmacy: "housing", chemist: "housing", department_store: "housing",
  fuel: "transport", bicycle: "transport", car_repair: "transport",
  books: "education", stationery: "education", library: "education",
  cinema: "entertainment", theatre: "entertainment", nightclub: "entertainment",
};

function fetchOffers() {
  return OFFER_POOL;
}

// Google Places (New) 會回很細的型別（taiwanese_restaurant / hot_pot_restaurant /
// chinese_noodle_restaurant …），查不到精確對應時再用關鍵字兜底。
function keywordCategory(type = "") {
  if (/restaurant|cafe|coffee|bakery|food|bar|meal|breakfast|dessert|ice_cream|tea_house/.test(type)) return "food";
  if (/clothing|shoe|apparel|boutique|jewelry/.test(type)) return "clothing";
  if (/book|library|school|university|student/.test(type)) return "education";
  if (/movie|cinema|gym|fitness|park|tourist|amusement|bowling|karaoke|night_club/.test(type)) return "entertainment";
  if (/gas_station|bicycle|car_repair|transit|parking|train_station|subway/.test(type)) return "transport";
  if (/store|supermarket|market|grocery|convenience|pharmacy|drugstore|shopping/.test(type)) return "housing";
  return null;
}

function categoryFromPlaceTypes(types = [], primaryType = null) {
  const all = [primaryType, ...types].filter(Boolean);
  for (const t of all) {
    if (PLACE_TYPE_TO_CATEGORY[t]) return PLACE_TYPE_TO_CATEGORY[t];
  }
  for (const t of all) {
    const hit = keywordCategory(t);
    if (hit) return hit;
  }
  return "housing";
}

function categoryFromOsmTag(tag) {
  return OSM_TAG_TO_CATEGORY[tag] || "housing";
}

const CATEGORY_LABEL = {
  food: "飲食", clothing: "服飾", housing: "日常",
  transport: "交通", education: "學習", entertainment: "娛樂",
};

module.exports = {
  fetchOffers,
  categoryFromPlaceTypes,
  categoryFromOsmTag,
  CATEGORY_LABEL,
  PLACE_TYPE_TO_CATEGORY,
  OSM_TAG_TO_CATEGORY,
};
