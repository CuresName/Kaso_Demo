// 極簡記憶體版 rate limit。Railway 單一 instance、重啟即清空，對「認真的 demo」夠用。
// 不引第三方套件，避免多一個相依。

function clientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// 每個 IP 一個滑動視窗計數器。
function perIp({ limit, windowMs }) {
  const hits = new Map(); // ip -> number[] (timestamps)
  return function (req, res, next) {
    const now = Date.now();
    const ip = clientIp(req);
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= limit) {
      const retryMs = windowMs - (now - arr[0]);
      res.set("Retry-After", String(Math.ceil(retryMs / 1000)));
      return res.status(429).json({
        error: "rate-limited",
        message: `太頻繁了，請 ${Math.ceil(retryMs / 1000)} 秒後再試。`,
      });
    }
    arr.push(now);
    hits.set(ip, arr);
    // 偶爾清掉沒人用的 key
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }
    next();
  };
}

// 全站每日總量上限（跨所有使用者）。用來保護 API 額度 / 帳單。
function dailyCap({ limit, label = "endpoint" }) {
  let day = new Date().toISOString().slice(0, 10);
  let count = 0;
  return function (req, res, next) {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      count = 0;
    }
    if (count >= limit) {
      return res.status(429).json({
        error: "daily-limit",
        message: `今天 ${label} 的用量已達上限（${limit}），明天再試，或調高 ASSISTANT_DAILY_LIMIT。`,
      });
    }
    count += 1;
    next();
  };
}

module.exports = { perIp, dailyCap, clientIp };
