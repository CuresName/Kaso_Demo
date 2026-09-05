// 後端 API 的薄封裝。前端跟後端同源（Express 同時吐靜態檔與 /api），不用處理 CORS。

async function request(path, options) {
  const res = await fetch(path, {
    headers: options?.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // 非 JSON 回應（例如 502 HTML）
  }
  if (!res.ok) {
    const err = new Error(data?.message || `請求失敗（${res.status}）`);
    err.status = res.status;
    err.code = data?.error || "http-error";
    throw err;
  }
  return data;
}

export function searchProducts(query) {
  return request(`/api/products/search?q=${encodeURIComponent(query)}`);
}

export function fetchNearbyOffers({ lat, lng, safe }) {
  return request("/api/offers/nearby", {
    method: "POST",
    body: JSON.stringify({ lat, lng, safe }),
  });
}

export function askAssistant({ message, history, context }) {
  return request("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ message, history, context }),
  });
}

export function getConfig() {
  return request("/api/config");
}
