import { state } from "../store.js";

const DEFAULT_PROFILE = {
  currentBalance: 6800,
  income: 30000,
  fixed: 24000,
  target: 12000,
  months: 6,
  quality: { time: 1, food: 1, comfort: 1, fun: 1 },
};

export function getFinance() {
  const profile = state.profile || DEFAULT_PROFILE;
  // 每月要存的 = (還差多少 ÷ 剩幾個月)，已有的餘額算進去，不是從 0 開始存
  const monthlySave = Math.ceil(
    Math.max(0, profile.target - profile.currentBalance) / Math.max(1, profile.months),
  );
  const flexible = Math.max(0, profile.income - profile.fixed - monthlySave);
  const spent = state.transactions.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0,
  );
  const safe = Math.max(
    0,
    Math.min(profile.currentBalance - monthlySave, flexible) - spent,
  );

  return {
    ...profile,
    monthlySave,
    flexible,
    spent,
    safe,
    reserve: profile.fixed + monthlySave,
  };
}

export function shoppingBudgetFor(finance = getFinance()) {
  const quality = finance.quality || DEFAULT_PROFILE.quality;
  const rawTotal = (
    quality.time * 1.35
    + quality.food * 1.15
    + quality.comfort
    + quality.fun * 0.75
  );
  const foodPercent = rawTotal > 0
    ? ((quality.food * 1.15) / rawTotal) * 0.62
    : 0.18;
  const foodBudget = Math.max(0, Math.round(finance.safe * foodPercent));
  return {
    foodBudget,
    available: Math.max(0, finance.safe - foodBudget),
  };
}

// 當月剩餘天數（含今天）。用來把「安心可花」攤成每日配額。
export function daysLeftInMonth(date = new Date()) {
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate();
  return Math.max(1, daysInMonth - date.getDate() + 1);
}

// 每日可用配額 = 安心可花 ÷ 當月剩餘天數。
export function dailyQuota(finance = getFinance()) {
  return Math.max(0, Math.floor(finance.safe / daysLeftInMonth()));
}
