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
