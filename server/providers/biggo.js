// 商品比價 — 真的打 BigGo 的搜尋 API。
// 沒有官方文件，端點取自 BigGo 官方的 MCP Server 原始碼，基本搜尋不需要 API key：
// https://github.com/Funmula-Corp/BigGo-MCP-Server/blob/master/src/biggo_mcp_server/services/product_search.py
//
// 回來的每一筆是「某平台上的一個商品刊登」，不是「同一款商品在多個平台的價格」，
// 所以一次查詢就是一份跨平台候選清單，直接依價格排序即可，不做同品項比對。

const BASE_URL = "https://api.biggo.com/api/v1/spa/search";
const SITE = "biggo.com.tw";
const REGION = "tw";
const TIMEOUT_MS = 15000;

async function fetchBiggo(url) {
  // BigGo 的非官方端點對突發流量會回 429，遇到就退避重試一次。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", site: SITE, region: REGION },
        signal: controller.signal,
      });
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1800));
        continue;
      }
      if (!res.ok) throw new Error(`biggo api ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("biggo api 429");
}

async function searchProducts(keyword, limit = 18) {
  const url = `${BASE_URL}/${encodeURIComponent(keyword)}/product`;
  try {
    const json = await fetchBiggo(url);
    const items = (json.list || [])
      .filter((item) => item.price > 0)
      .map((item) => ({
        id: String(item.item_id ?? item.oid ?? item.purl ?? Math.random()),
        title: item.title || "",
        price: Number(item.price) || 0,
        currency: item.currency || "TWD",
        platform: item.store?.name || item.nindex || "未知平台",
        image: item.image || null,
        url: item.affurl ? `https://${SITE}${item.affurl}` : item.purl || null,
        isAd: Boolean(item.is_ad),
      }))
      .sort((a, b) => a.price - b.price)
      .slice(0, limit);

    return {
      items,
      lowPrice: Number(json.low_price) || (items[0] ? items[0].price : 0),
      highPrice: Number(json.high_price) || (items.length ? items[items.length - 1].price : 0),
      total: Number(json.total) || items.length,
      source: "biggo",
      error: null,
    };
  } catch (err) {
    const msg = /429/.test(err.message)
      ? "BigGo 目前限流，請稍後再按重試。"
      : err.message;
    return { items: [], lowPrice: 0, highPrice: 0, total: 0, source: "biggo", error: msg };
  }
}

module.exports = { searchProducts };
