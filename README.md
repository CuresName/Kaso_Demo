## 問題與目標

**目標使用者**：月薪固定、每月存不下錢的年輕上班族與學生。

**問題**：

- 月底才發現錢不知道花去哪裡了
- 想買東西，不知道哪裡買比較便宜
- 看到優惠，也算不出自己到底省了多少
- 想開始存錢，卻不知道該從哪裡下手

這四件事看起來各自獨立，其實是同一個問題的四個面向——**使用者沒有一個「當下能用的數
字」**。記帳 App 給的是事後總結，比價網站給的是絕對價格，優惠資訊給的是折扣百分比，三
者都沒有回答那個真正該問的問題：**「以我現在的狀況，這筆到底花不花得起？」**

決策發生在花之前——站在店裡、滑到結帳頁的那三秒。而這三秒裡，資訊分散在記帳 App、銀行
App、比價網站，沒有人會為了買一樣東西開三個 App 交叉比對。所以絕大多數消費決策實際上
是憑感覺做的，記帳只是在事後記錄後悔。

**KASO 的解法**：先用 5 題情境問卷把使用者分成「月光族」與「目標計畫族」，兩種身分套用
不同策略。接著由收入、固定支出與存款目標推出唯一基準「**安心可花**」，所有功能都以它為
上限——比價結果標示買不買得起、附近優惠換算「花完還剩多少」、想買的東西超出預算時當場
提醒，幫使用者擋掉衝動消費。記帳與規劃在同一個平台完成，數字即時回饋到那個唯一基準上。

**為什麼現在才做得到**：難處不在算錢，在於使用者是用自然語言問的（「這個我買得起嗎」
「這個月還能出去玩嗎」），而回答必須同時吃進他當下的財務狀況與消費身分。規則引擎窮舉不
完這些組合，得靠模型當場理解與判斷。

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
`ANTHROPIC_API_KEY`。
沒設定時 KASO AI 會回「暫時連不上」，其他功能不受影響。
**建議在 Anthropic console 設每月消費上限**，`/api/assistant/chat` 是公開端點。

### Google（附近優惠）— 選配
在同一個 GCP 專案裡：
1. 啟用 **Places API (New)**（後端附近搜尋用）← 目前這把 key 還沒開，所以附近優惠會退到 OpenStreetMap / 假資料
2. 啟用 **Maps JavaScript API**（前端地圖底圖）
3. 開 billing（有免費額度）

### BigGo（比價）— 不需要 key

## 濫用防護
`server/rateLimit.js`：`/api/assistant/chat` 有 per-IP（預設 12 次 / 10 分）與全站每日上限
（`ASSISTANT_DAILY_LIMIT`，預設 200），其他端點 40 次 / 分。都是記憶體版，重啟即清空。

## 授權

MIT，見 [LICENSE](LICENSE)。
