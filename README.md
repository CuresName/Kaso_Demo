# 卡搜 KASO — 模組化前端 + Express 後端

模組化 Vanilla JS 前端（Hash Router、每個功能頁一個 ES Module），後端是一支 Express，
同時提供 `/api/*` 與靜態前端，一個 process 就能跑，適合部署到 Railway。

## 快速開始

```bash
npm install
cp .env.example .env   # 填入你的 key
npm start
```

開 http://localhost:3000 。第一次會進 `#/onboarding`，做完測驗與預算設定後進 `#/home`。

## 架構

```
dist/           前端靜態檔（HTML / CSS / ES Modules），Express 直接吐這個目錄
server/
  index.js      Express：/api 路由 + 靜態前端 + SPA fallback
  routes.js     4 支 API
  rateLimit.js  記憶體版 per-IP / 每日上限
  providers/
    biggo.js       BigGo 商品搜尋（無需 key）
    places.js      Google Places (New) 附近搜尋 → Overpass → 假資料 三層 fallback
    offerPool.js   政府活動 / 文化幣優惠 pool + 分類對應表
    claude.js      Claude API，system prompt 用前端傳來的即時預算快照
```

### 資料不再有伺服器狀態

預算計算、profile、記帳全部留在前端（`dist/assets/js/services/finance.js`、
`localStorage`）。後端是無狀態代理，只做三件事：打外部 API、組 prompt、擋濫用。
所以 Railway 不需要資料庫或 volume；重啟不會掉資料（資料本來就在使用者瀏覽器）。

## API

| 端點 | 說明 |
|---|---|
| `GET /api/products/search?q=` | BigGo 跨平台比價 |
| `POST /api/offers/nearby` `{lat,lng,safe?}` | 附近店家 + 配對的優惠 chip |
| `POST /api/assistant/chat` `{message,history,context}` | KASO AI（Claude） |
| `GET /api/config` | 回傳前端地圖用的 Google key |
| `GET /api/health` | 健康檢查 |

`/api/offers/nearby` 回傳三塊：
- `stores` — Google Places 附近店家（Places 掛掉 → OpenStreetMap → 假資料）
- `activities` — 文化部「藝文活動」開放資料裡的**免費**活動，記憶體快取 6 小時，依距離 + 縣市地址雙重過濾（來源座標常有誤）
- `cultureStores` — 文化幣可用店家，`server/providers/cultureCoin.js` 的人工清單（目前為台北市），沒有官方 API

## 資料來源

| 功能 | 來源 | 端點 / 資料集 | 認證 | 授權 / 出處 |
|---|---|---|---|---|
| 商品比價 | **BigGo** | `https://api.biggo.com/api/v1/spa/search/{關鍵字}/product`（headers `site: biggo.com.tw`、`region: tw`） | 無 | 非官方端點，取自 BigGo 官方的 [BigGo-MCP-Server](https://github.com/Funmula-Corp/BigGo-MCP-Server)（`services/product_search.py`）。沒有正式文件、會限流（429），BigGo 可隨時變更。要穩定請改用 [BigGo 開發者 API](https://biggo.com/api)。 |
| 附近店家（主） | **Google Places API (New)** | `POST https://places.googleapis.com/v1/places:searchNearby` | GCP API key + billing | [Google Maps Platform 服務條款](https://cloud.google.com/maps-platform/terms)。key 需啟用「Places API (New)」。 |
| 附近地圖底圖 | **Google Maps JavaScript API** | `maps.googleapis.com/maps/api/js` | GCP API key（前端，靠 HTTP referrer 限制） | 同上。 |
| 附近店家（備援） | **OpenStreetMap / Overpass API** | `overpass-api.de` 等公開鏡像 | 無 | 地圖資料 © OpenStreetMap 貢獻者，[ODbL](https://www.openstreetmap.org/copyright)。僅在 Google Places 不可用時啟用。 |
| 附近免費活動 | **文化部 藝文活動開放資料** | `https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category={1..16}`（[data.gov.tw 資料集 6478](https://data.gov.tw/dataset/6478)） | 無 | [政府資料開放授權條款](https://data.gov.tw/license)。每日更新；`category=all` 上游故障，改逐類抓；來源經緯度常有誤，已用「活動地址縣市」二次過濾。 |
| 文化幣可用店家 | **人工清單** | `server/providers/cultureCoin.js` 的 `STORES` 陣列 | — | 手動整理的台北市常見店家（書店 / 展演空間 / 唱片行），座標為概略值。文化幣官方無帶座標的開放 API。 |
| KASO AI 助手 | **Anthropic Claude API** | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` | 使用者的即時財務數字（餘額 / 安心可花 / 記帳）由前端算好後放進 request body 當 context，不落地儲存。 |
| 政府活動 / 消費券優惠 chip | **示範資料** | `server/providers/offerPool.js` 的 `OFFER_POOL` | — | 目前是範例資料，非真實優惠。之後接真實來源只需替換 `fetchOffers()`。 |

前端頁面上（附近優惠頁尾、比價結果下方）也各有一行來源標註。

## 需要的 key

### Claude（KASO AI）— 必須
`ANTHROPIC_API_KEY`，到 https://console.anthropic.com/settings/keys 拿。
沒設定時 KASO AI 會回「暫時連不上」，其他功能不受影響。
**建議在 Anthropic console 設每月消費上限**，`/api/assistant/chat` 是公開端點。

### Google（附近優惠）— 選配
在同一個 GCP 專案裡：
1. 啟用 **Places API (New)**（後端附近搜尋用）← 目前這把 key 還沒開，所以附近優惠會退到 OpenStreetMap / 假資料
2. 啟用 **Maps JavaScript API**（前端地圖底圖）
3. 開 billing（有免費額度）

建議拆兩把 key（見 `.env.example`）：後端 `GOOGLE_PLACES_KEY`、前端 `GOOGLE_MAPS_BROWSER_KEY`（加 HTTP referrer 限制到你的網域）。只給一把 `GOOGLE_MAPS_API_KEY` 也能跑。

### BigGo（比價）— 不需要 key

## 部署到 Railway

1. `railway init` → 連這個 repo
2. Variables 裡填 `ANTHROPIC_API_KEY`、`GOOGLE_PLACES_KEY`、`GOOGLE_MAPS_BROWSER_KEY`（或 `GOOGLE_MAPS_API_KEY`），**不要**上傳 `.env`
3. Railway 自動偵測 `npm start`、注入 `PORT`
4. 上線後回 GCP 把前端 key 的 referrer 限制設成你的 Railway 網域

## 濫用防護

`server/rateLimit.js`：`/api/assistant/chat` 有 per-IP（預設 12 次 / 10 分）與全站每日上限
（`ASSISTANT_DAILY_LIMIT`，預設 200），其他端點 40 次 / 分。都是記憶體版，重啟即清空。

## 尚未接後端的頁面

旅遊規劃 / 保險保障 / 訂閱比較維持靜態展示，頁面上有「尚未接後端」標記。海外刷卡試算已移除。

## 授權

MIT，見 [LICENSE](LICENSE)。
