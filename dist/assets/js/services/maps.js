// Google Maps JavaScript API 載入器。key 從後端 /api/config 拿（前端專用、靠 referrer 限制）。

import { getConfig } from "./api.js";

let loadPromise = null;
let cachedKey; // undefined = 還沒問過；"" = 沒有 key

async function resolveKey() {
  if (cachedKey !== undefined) return cachedKey;
  try {
    const cfg = await getConfig();
    cachedKey = cfg.googleMapsApiKey || "";
  } catch {
    cachedKey = "";
  }
  return cachedKey;
}

// 回傳 window.google.maps，失敗時 throw。
export async function loadGoogleMaps() {
  if (window.google?.maps) return window.google.maps;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const key = await resolveKey();
    if (!key) throw new Error("沒有 Google Maps API key");
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&language=zh-TW&region=TW&loading=async&libraries=maps,marker`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Google Maps 腳本載入失敗"));
      document.head.appendChild(script);
    });
    if (!window.google?.maps?.importLibrary) throw new Error("Google Maps 載入後找不到 google.maps");
    // loading=async 模式下，類別要透過 importLibrary 才會掛上來
    await window.google.maps.importLibrary("maps");
    return window.google.maps;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null; // 允許之後重試
    throw err;
  }
}
