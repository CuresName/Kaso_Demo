// KASO AI — 串 Claude API。API key 只在後端讀取，前端拿不到、也不會經過前端的網路請求。
//
// 跟舊版不同：後端不再自己算預算。前端（finance.js）算好的即時財務快照透過 request body
// 傳進來，這裡只負責組 system prompt、轉發給 Claude、把回覆吐回去。

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";
const MAX_HISTORY = 12;
const MAX_TOKENS = 1024;

function nt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "未提供";
  return `NT$${Math.round(n).toLocaleString("en-US")}`;
}

// context 由前端送來，結構對應 finance.js 的 getFinance() + state。
function buildSystemPrompt(context = {}) {
  const {
    mode,
    finance = {},
    transactions = [],
  } = context;

  const modeLabel = mode === "goal" ? "目標計畫族" : "月光族";

  let situation = "使用者還沒有完成 KASO 的入口設定，沒有預算資料。";
  if (finance && (finance.currentBalance != null || finance.safe != null)) {
    const txLines = (Array.isArray(transactions) ? transactions : [])
      .slice(0, 20)
      .map((t) => `${t.category || "其他"}｜${t.merchant || ""}｜${nt(t.amount)}`)
      .join("；");
    situation = [
      `身分：${modeLabel}`,
      `目前餘額：${nt(finance.currentBalance)}`,
      `每月固定支出：${nt(finance.fixed)}`,
      `每月先存：${nt(finance.monthlySave)}`,
      finance.target != null ? `存款目標：${nt(finance.target)}（預計 ${finance.months || "?"} 個月）` : null,
      `本月已記帳：${nt(finance.spent)}`,
      `安心可花：${nt(finance.safe)}`,
      txLines ? `近期交易：${txLines}` : "近期沒有記帳紀錄。",
    ].filter(Boolean).join("\n");
  }

  return `你是「KASO AI」，卡搜 KASO 這個記帳／消費決策 App 裡的助手。KASO 的核心規則：
- 使用者身分只有兩種：月光族、目標計畫族。身分只改「怎麼呈現建議」，不改「數字從哪來」。
- 「安心可花」是唯一的判定基準：目前餘額扣掉固定支出、每月先存、本月已花之後，剩下能安心花的錢。
- 月光族：超出安心可花時，建議延後購買、列出買得起的替代品。
- 目標計畫族：不擋，只換算「維持這筆開支會 delay 幾個月」或「想準時達成要砍幾 % 支出」。

使用者目前的即時財務狀況（由 App 前端即時算好後傳入，請直接採用，不要自己重算或編造）：
${situation}

請用繁體中文回答，語氣像貼身理財助理。預設精簡（2-4 句）；若情境需要列出多個方案或分項比較（例如「delay 幾個月」vs「砍幾 % 支出」），用條列式把每一項講完整，不要中途截斷。不要幫使用者做投資建議或信用卡核卡承諾，也不要編造上面沒有提到的具體數字。回覆可用簡單 markdown（**粗體**、\`code\`）。`;
}

async function chat({ message, history = [], context = {} }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("後端尚未設定 ANTHROPIC_API_KEY。");
    err.code = "NO_API_KEY";
    throw err;
  }

  const historyMsgs = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === "user" || m.role === "ai") && m.text)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: String(m.text) }));
  // Claude 要求對話第一則必須是 user，砍掉開頭的 assistant（例如前端的問候語）
  while (historyMsgs.length && historyMsgs[0].role === "assistant") historyMsgs.shift();

  const messages = [...historyMsgs, { role: "user", content: String(message) }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(context),
        messages,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
      err.code = "ANTHROPIC_ERROR";
      throw err;
    }

    const data = await res.json();
    return data.content?.map((c) => c.text).join("") || "";
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { chat, buildSystemPrompt };
