require("dotenv").config();
const path = require("path");
const express = require("express");
const apiRoutes = require("./routes");

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "..", "dist");

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// API
app.use("/api", apiRoutes);
app.get("/api/health", (req, res) => res.json({ ok: true }));

// 靜態前端。dist/ 只有前端資產（HTML / CSS / JS），沒有原始碼或 .env，
// 整個目錄丟出去是安全的。
app.use(express.static(DIST_DIR, { extensions: ["html"] }));

// Hash router 的 SPA，非 /api 的路徑一律回 index.html。
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`KASO 卡搜 已啟動： http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("  ⚠ 未設定 ANTHROPIC_API_KEY，KASO AI 會回報連不上。");
  if (!process.env.GOOGLE_PLACES_KEY && !process.env.GOOGLE_MAPS_API_KEY) {
    console.warn("  ⚠ 未設定 Google key，附近優惠會退回 OpenStreetMap / 假資料。");
  }
});
