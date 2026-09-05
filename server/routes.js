const express = require("express");
const router = express.Router();

const biggo = require("./providers/biggo");
const places = require("./providers/places");
const offerPool = require("./providers/offerPool");
const claude = require("./providers/claude");
const { perIp, dailyCap } = require("./rateLimit");

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

// 一般端點：寬鬆的 per-IP 限制，擋暴力刷。
const lightLimit = perIp({ limit: 40, windowMs: 60_000 });

// ---- /api/config：前端地圖用的 Google key ----
// Maps JavaScript API 的 key 設計上就是給瀏覽器用的（靠 HTTP referrer 限制，不是靠保密），
// 跟 Claude / Places 那種必須留後端的 key 不同，回傳給前端沒問題。
router.get("/config", (req, res) => {
  res.json({
    googleMapsApiKey:
      process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_API_KEY || null,
  });
});

// ---- /api/products/search：BigGo 比價 ----
router.get("/products/search", lightLimit, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json({ items: [], lowPrice: 0, highPrice: 0, total: 0, source: "biggo", error: null });
  }
  const result = await biggo.searchProducts(q);
  res.json(result);
});

// ---- /api/offers/nearby：Google Places 附近店家 + 政府/文化幣優惠 pool ----
// body: { lat, lng, safe? }
//   safe（安心可花）帶進來時，每個付費優惠會標記 affordable = value <= safe。
router.post("/offers/nearby", lightLimit, async (req, res) => {
  const lat = num(req.body.lat);
  const lng = num(req.body.lng);
  const safe = num(req.body.safe);
  if (lat == null || lng == null) {
    return res.status(400).json({ error: "bad-request", message: "需要 lat / lng 座標。" });
  }

  const stores = (await places.fetchNearbyStores(lat, lng)).sort((a, b) => a.distance - b.distance);
  const allOffers = offerPool.fetchOffers();
  const sourceUsed = stores[0]?.source || "mock";

  const storesWithOffers = stores.map((store) => {
    const matched = allOffers
      .filter((o) => o.category === store.category)
      .map((o) => ({
        ...o,
        affordable: o.type === "free" || safe == null || o.value <= safe,
      }));
    return {
      ...store,
      categoryLabel: offerPool.CATEGORY_LABEL[store.category] || "日常",
      offers: matched,
    };
  });

  res.json({
    center: { lat, lng },
    radius: places.RADIUS_M,
    source: sourceUsed,
    stores: storesWithOffers,
  });
});

// ---- /api/assistant/chat：Claude ----
// body: { message, history: [{role,text}], context: { mode, finance, transactions } }
const assistantIpLimit = perIp({
  limit: num(process.env.ASSISTANT_IP_LIMIT) || 12,
  windowMs: num(process.env.ASSISTANT_WINDOW_MS) || 600_000,
});
const assistantDailyCap = dailyCap({
  limit: num(process.env.ASSISTANT_DAILY_LIMIT) || 200,
  label: "KASO AI",
});

router.post("/assistant/chat", assistantIpLimit, assistantDailyCap, async (req, res) => {
  const message = String(req.body.message || "").trim();
  if (!message) return res.status(400).json({ error: "bad-request", message: "訊息不能空白。" });

  try {
    const reply = await claude.chat({
      message,
      history: req.body.history,
      context: req.body.context || {},
    });
    res.json({ reply });
  } catch (err) {
    const status = err.code === "NO_API_KEY" ? 501 : 502;
    res.status(status).json({
      error: err.code || "assistant-error",
      message:
        err.code === "NO_API_KEY"
          ? "KASO AI 暫時連不上（後端未設定金鑰）。"
          : "KASO AI 暫時連不上，請稍後再試。",
    });
  }
});

module.exports = router;
