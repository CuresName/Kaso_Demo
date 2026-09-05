import { askAssistant } from "../services/api.js";
import { getFinance } from "../services/finance.js";
import { addMessage, state } from "../store.js";
import { $, escapeHtml, icon, money } from "../utils.js";

export function assistantMarkup() {
  return `
    <button id="assistantFab" class="assistant-fab" type="button">
      ${icon("bot")} 問 KASO AI
    </button>
    <aside id="assistantPanel" class="assistant-panel" hidden aria-label="KASO AI 助手">
      <div class="assistant-head">
        <span>
          ${icon("bot")}
          <span>
            <strong>KASO AI 助手</strong>
            <small id="assistantContext">依你目前的預算即時回答</small>
          </span>
        </span>
        <button id="assistantClose" type="button" aria-label="關閉">${icon("x")}</button>
      </div>
      <div id="chatLog" class="chat-log" aria-live="polite"></div>
      <form id="assistantForm" class="assistant-form">
        <input id="assistantInput" autocomplete="off" placeholder="問預算、商品、旅遊或保險…" aria-label="輸入問題">
        <button type="submit" aria-label="送出">${icon("send")}</button>
      </form>
    </aside>
  `;
}

// 極簡 markdown：先跳脫，再把 **粗體** 與 `code` 轉成標籤
function renderText(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function renderMessages() {
  const log = $("#chatLog");
  if (!log) return;
  log.innerHTML = state.messages
    .map((message) => `<div class="bubble ${message.role}">${
      message.role === "ai" ? renderText(message.text) : escapeHtml(message.text)
    }</div>`)
    .join("");
  log.scrollTop = log.scrollHeight;
}

function assistantContext() {
  const finance = getFinance();
  return {
    mode: state.profile?.mode || "moonlight",
    finance: {
      currentBalance: finance.currentBalance,
      fixed: finance.fixed,
      monthlySave: finance.monthlySave,
      target: finance.target,
      months: finance.months,
      spent: finance.spent,
      safe: finance.safe,
    },
    transactions: state.transactions.slice(0, 20).map((t) => ({
      merchant: t.merchant,
      amount: t.amount,
      category: t.category,
    })),
  };
}

let pending = false;

async function send(text) {
  if (pending || !text.trim()) return;
  pending = true;
  addMessage({ role: "user", text });
  renderMessages();

  const form = $("#assistantForm");
  form?.querySelector("button")?.setAttribute("disabled", "true");
  addMessage({ role: "ai", text: "…" });
  renderMessages();

  try {
    const history = state.messages.slice(0, -2); // 去掉剛加的 user 與佔位 ai
    const { reply } = await askAssistant({
      message: text,
      history,
      context: assistantContext(),
    });
    state.messages[state.messages.length - 1].text = reply || "（沒有收到回覆）";
  } catch (err) {
    state.messages[state.messages.length - 1].text = err.message || "KASO AI 暫時連不上，請稍後再試。";
  } finally {
    pending = false;
    form?.querySelector("button")?.removeAttribute("disabled");
    renderMessages();
  }
}

export function openAssistant(prefill = "") {
  const panel = $("#assistantPanel");
  const launcher = $("#assistantFab");
  if (!panel || !launcher) return;

  panel.hidden = false;
  launcher.hidden = true;
  renderMessages();
  if (prefill) {
    const input = $("#assistantInput");
    input.value = prefill;
    input.focus();
  }
}

export function askProduct(detail) {
  openAssistant();
  const [title, platform, rawPrice] = detail.split("｜");
  const price = Number(rawPrice || 0);
  const parts = [title];
  if (platform) parts.push(platform);
  if (price) parts.push(money(price));
  send(`幫我判斷這個商品要不要買：${parts.join("，")}`);
}

export function updateAssistantContext(label) {
  const context = $("#assistantContext");
  if (context) context.textContent = `${label} · 依你目前的預算即時回答`;
}

export function setAssistantEnabled(enabled) {
  const launcher = $("#assistantFab");
  const panel = $("#assistantPanel");
  if (!launcher || !panel) return;
  if (!enabled) {
    launcher.hidden = true;
    panel.hidden = true;
    return;
  }
  if (panel.hidden) launcher.hidden = false;
}

export function mountAssistant() {
  $("#assistantFab")?.addEventListener("click", () => openAssistant());
  $("#assistantClose")?.addEventListener("click", () => {
    $("#assistantPanel").hidden = true;
    $("#assistantFab").hidden = false;
  });
  $("#assistantForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#assistantInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    send(text);
  });
  renderMessages();
}
