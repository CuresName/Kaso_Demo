export const $ = (selector, root = document) => root.querySelector(selector);

export const $$ = (selector, root = document) => [
  ...root.querySelectorAll(selector),
];

export function money(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

export function futureMonth(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + Number(months || 0));
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

export function icon(name) {
  return `<svg aria-hidden="true"><use href="#i-${escapeAttr(name)}"></use></svg>`;
}

export function pageTitle(title, detail, label, { demo = false } = {}) {
  return `
    <div class="page-title">
      <div>
        <p class="eyebrow">${icon("grid")} ${escapeHtml(label)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(detail)}</p>
      </div>
      ${demo ? '<span class="demo-pill" hidden>尚未接後端</span>' : ""}
    </div>
  `;
}

export function valuesToPercentages(values) {
  const numericValues = values.map((value) => Math.max(0, Number(value) || 0));
  const total = numericValues.reduce((sum, value) => sum + value, 0) || 1;
  const percentages = numericValues.map((value, index) => (
    index < numericValues.length - 1 ? Math.round((value / total) * 100) : 0
  ));
  percentages[percentages.length - 1] = 100
    - percentages.slice(0, -1).reduce((sum, value) => sum + value, 0);
  return percentages;
}

export function nextFrame(callback) {
  return window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
}
