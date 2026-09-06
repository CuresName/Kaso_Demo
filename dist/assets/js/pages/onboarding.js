import {
  PERSONA_QUESTIONS,
  PERSONA_QUESTION_IDS,
  derivedQualityWeights,
  personaDescription,
  personaModeLabel,
  recommendedPersonaMode,
} from "../services/persona.js";
import {
  resetQuizState,
  saveProfile,
  state,
} from "../store.js";
import {
  $,
  $$,
  icon,
  money,
  valuesToPercentages,
} from "../utils.js";

// YYYY-MM 相關小工具
function ymOffset(monthsAhead) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsAhead);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthsUntil(ym) {
  if (!ym) return 0;
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return 0;
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
}

function formatYm(ym) {
  if (!ym) return "—";
  const [y, m] = ym.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

function daysInThisMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function questionMarkup(question, index) {
  return `
    <article class="persona-question${index === 0 ? " active" : ""}" data-question="${question.id}">
      <h3><span>QUESTION ${question.number}</span>${question.question}</h3>
      <div class="persona-answer-pair" role="radiogroup" aria-label="${question.ariaLabel}">
        ${question.answers.map((answer) => `
          <button
            class="persona-answer"
            type="button"
            data-question-id="${question.id}"
            data-answer="${answer.value}"
            data-persona="${answer.persona}"
            aria-pressed="false"
          >${answer.label}</button>
        `).join("")}
      </div>
    </article>
  `;
}

function render() {
  return `
    <section id="onboarding" class="onboarding stage-quiz">
      <div class="onboarding-brand brand" aria-label="卡搜 KASO">
        <span class="brand-mark">${icon("grid")}</span>
        <span class="brand-copy"><strong>卡搜 KASO</strong></span>
      </div>

      <main class="onboarding-flow">
        <section id="quizStage" class="onboarding-stage quiz-stage" aria-label="KASO 初次使用問題">
          <div class="persona-quiz">
            <div class="persona-question-list">
              ${PERSONA_QUESTIONS.map(questionMarkup).join("")}
            </div>
            <button id="personaQuizBack" class="quiz-back" type="button" disabled>← 上一題</button>
          </div>
        </section>

        <section id="resultStage" class="onboarding-stage result-stage" aria-labelledby="resultTitle" hidden>
          <div class="result-stage-content">
            <p class="stage-kicker">PROFILE RESULT</p>
            <h1 id="resultTitle">你可能是<br><strong id="personaRecommendationLabel">月光族</strong></h1>
            <p id="resultDescription" class="result-description">你比較重視當下感受，KASO 會先幫你守住固定支出與存款。</p>
            <div class="result-choice-grid">
              <div class="result-persona-card">
                <small>你的省錢模式</small>
                <strong id="resultPersonaCard">月光族</strong>
                <span>已依 5 題答案自動判定</span>
              </div>
              <div class="result-quality-card">
                <div><span>節省時間</span><i><b id="resultTimeBar"></b></i><strong id="resultTime">25%</strong></div>
                <div><span>飲食品質</span><i><b id="resultFoodBar"></b></i><strong id="resultFood">25%</strong></div>
                <div><span>舒適便利</span><i><b id="resultComfortBar"></b></i><strong id="resultComfort">25%</strong></div>
                <div><span>娛樂體驗</span><i><b id="resultFunBar"></b></i><strong id="resultFun">25%</strong></div>
              </div>
            </div>
            <div class="stage-actions">
              <button id="resultRestart" class="secondary-btn" type="button">重新作答</button>
              <button id="continueToBudget" class="primary-btn" type="button">設定我的預算 ${icon("arrow")}</button>
            </div>
          </div>
        </section>

        <section id="budgetStage" class="onboarding-stage budget-stage" aria-labelledby="financeTitle" hidden>
          <div class="budget-stage-card">
            <div class="budget-stage-heading">
              <p class="stage-kicker">FINAL SETUP · <span id="budgetPersonaLabel">月光族</span></p>
              <h1 id="financeTitle">把現在的數字<br>告訴 KASO</h1>
              <p>我們已依回答排好生活比重；填完收入與支出，就能開始使用。</p>
            </div>
            <div class="budget-stage-form">
              <section class="quality-card" aria-labelledby="qualityTitle">
                <div class="quality-head">
                  <div><h2 id="qualityTitle">建議生活品質比重</h2><p id="qualityIntro">你仍可拖曳微調。</p></div>
                  <span class="quality-total">合計 <b id="qualityTotal">100%</b></span>
                </div>
                <div class="quality-grid">
                  <div class="quality-item"><label>節省時間 <output id="qTimeOut">25%</output></label><input id="qTime" type="range" min="1" max="5" value="1"></div>
                  <div class="quality-item"><label>飲食品質 <output id="qFoodOut">25%</output></label><input id="qFood" type="range" min="1" max="5" value="1"></div>
                  <div class="quality-item"><label>舒適便利 <output id="qComfortOut">25%</output></label><input id="qComfort" type="range" min="1" max="5" value="1"></div>
                  <div class="quality-item"><label>娛樂體驗 <output id="qFunOut">25%</output></label><input id="qFun" type="range" min="1" max="5" value="1"></div>
                </div>
              </section>
              <div class="finance-grid">
                <label class="field">目前餘額<input id="currentBalance" type="number" min="0" step="100" placeholder="例如：6800"></label>
                <label class="field">每月固定收入<input id="monthlyIncome" type="number" min="1" step="1000" placeholder="例如：30000"></label>
                <label class="field">每月固定支出<input id="fixedExpense" type="number" min="0" step="1000" placeholder="例如：24000"></label>
                <label class="field">想存到多少<input id="savingTarget" type="number" min="1" step="1000" value="12000"></label>
                <label class="field">希望哪個月完成<input id="savingTargetMonth" type="month"></label>
              </div>
              <div class="finance-preview" aria-live="polite">
                <span><small>每月先存</small><strong id="previewSave">NT$2,000</strong></span>
                <span><small>每日可安排</small><strong id="previewFlexible">填完後計算</strong></span>
                <span><small>預計完成</small><strong id="previewDate">—</strong></span>
              </div>
              <p id="setupError" class="setup-error" role="alert" hidden></p>
              <div class="stage-actions budget-actions">
                <button id="budgetBack" class="secondary-btn" type="button">返回結果</button>
                <button id="completeSetup" class="primary-btn" type="button">進入 KASO ${icon("arrow")}</button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </section>
  `;
}

function mount({ navigate, showToast }) {
  const abortController = new AbortController();
  const listenerOptions = { signal: abortController.signal };

  const safeNumber = (selector, fallback = 0) => (
    Math.max(0, Number($(selector)?.value) || fallback)
  );
  const hasInput = (selector) => {
    const input = $(selector);
    return Boolean(
      input
      && input.value.trim() !== ""
      && Number.isFinite(Number(input.value)),
    );
  };

  function showStage(stage) {
    const stages = {
      quiz: "#quizStage",
      result: "#resultStage",
      budget: "#budgetStage",
    };
    Object.entries(stages).forEach(([key, selector]) => {
      $(selector).hidden = key !== stage;
    });
    const onboarding = $("#onboarding");
    onboarding.classList.remove("stage-quiz", "stage-result", "stage-budget");
    onboarding.classList.add(`stage-${stage}`);
    window.scrollTo(0, 0);
  }

  function syncQuestion(focusAnswer = false) {
    $$(".persona-question").forEach((question, index) => {
      question.classList.toggle("active", index === state.quizIndex);
    });
    $("#personaQuizBack").disabled = state.quizIndex === 0;
    if (focusAnswer) $(".persona-question.active .persona-answer")?.focus();
  }

  function showQuestion(index, focusAnswer = false) {
    state.quizIndex = Math.max(
      0,
      Math.min(PERSONA_QUESTION_IDS.length - 1, index),
    );
    syncQuestion(focusAnswer);
  }

  function applyPersona(mode) {
    state.mode = mode === "goal" ? "goal" : "moonlight";
    const label = personaModeLabel(state.mode);
    $("#personaRecommendationLabel").textContent = label;
    $("#resultPersonaCard").textContent = label;
    $("#budgetPersonaLabel").textContent = label;
    $("#resultDescription").textContent = personaDescription(state.mode);
    $("#qualityIntro").textContent = `依五題答案為「${label}」產生；你仍可拖曳微調，推薦會跟著重新分配。`;
  }

  function updatePreview() {
    const income = safeNumber("#monthlyIncome");
    const fixed = safeNumber("#fixedExpense");
    const target = safeNumber("#savingTarget");
    const targetMonth = $("#savingTargetMonth")?.value || "";
    const months = Math.max(1, monthsUntil(targetMonth));
    const monthlySave = Math.ceil(target / months);
    const dailyFlexible = Math.floor(
      Math.max(0, income - fixed - monthlySave) / daysInThisMonth(),
    );

    $("#previewSave").textContent = money(monthlySave);
    $("#previewFlexible").textContent = (
      hasInput("#monthlyIncome") && hasInput("#fixedExpense")
        ? money(dailyFlexible)
        : "填完後計算"
    );
    $("#previewDate").textContent = targetMonth ? formatYm(targetMonth) : "—";

    const rangeIds = ["qTime", "qFood", "qComfort", "qFun"];
    const percentages = valuesToPercentages(
      rangeIds.map((id) => $(`#${id}`).value),
    );
    rangeIds.forEach((id, index) => {
      const output = $(`#${id}Out`);
      output.value = `${percentages[index]}%`;
      output.textContent = `${percentages[index]}%`;
    });

    ["Time", "Food", "Comfort", "Fun"].forEach((key, index) => {
      $(`#result${key}`).textContent = `${percentages[index]}%`;
      $(`#result${key}Bar`).style.width = `${percentages[index]}%`;
    });
    $("#qualityTotal").textContent = "100%";
    $("#setupError").hidden = true;
  }

  function applySuggestedQuality() {
    const weights = derivedQualityWeights(state.personaAnswers);
    $("#qTime").value = weights.time;
    $("#qFood").value = weights.food;
    $("#qComfort").value = weights.comfort;
    $("#qFun").value = weights.fun;
    updatePreview();
  }

  function chooseAnswer(button) {
    const questionId = button.dataset.questionId;
    state.personaAnswers[questionId] = {
      answer: button.dataset.answer,
      persona: button.dataset.persona,
    };
    $$(
      `.persona-answer[data-question-id="${questionId}"]`,
    ).forEach((choice) => {
      const selected = choice === button;
      choice.classList.toggle("selected", selected);
      choice.setAttribute("aria-pressed", String(selected));
    });

    const complete = PERSONA_QUESTION_IDS.every(
      (id) => Boolean(state.personaAnswers[id]),
    );
    if (complete) {
      applyPersona(recommendedPersonaMode(state.personaAnswers));
      applySuggestedQuality();
    }

    window.clearTimeout(state.quizTimer);
    if (state.quizIndex < PERSONA_QUESTION_IDS.length - 1) {
      state.quizTimer = window.setTimeout(
        () => showQuestion(state.quizIndex + 1, true),
        280,
      );
    } else if (complete) {
      state.quizTimer = window.setTimeout(() => {
        showStage("result");
        showToast(`已依回答套用「${personaModeLabel(state.mode)}」`);
      }, 360);
    }
  }

  function restart(clearFinance = false) {
    resetQuizState();
    $$(".persona-answer").forEach((choice) => {
      choice.classList.remove("selected");
      choice.setAttribute("aria-pressed", "false");
    });
    ["qTime", "qFood", "qComfort", "qFun"].forEach((id) => {
      $(`#${id}`).value = 1;
    });
    if (clearFinance) {
      $("#currentBalance").value = "";
      $("#monthlyIncome").value = "";
      $("#fixedExpense").value = "";
      $("#savingTarget").value = "12000";
      const monthInput = $("#savingTargetMonth");
      monthInput.min = ymOffset(1);
      monthInput.value = ymOffset(6);
    }
    applyPersona("moonlight");
    showQuestion(0);
    updatePreview();
    showStage("quiz");
  }

  function validateFinanceSetup() {
    const required = [
      "#currentBalance",
      "#monthlyIncome",
      "#fixedExpense",
      "#savingTarget",
    ];
    const missing = required.find((selector) => !hasInput(selector));
    const targetMonth = $("#savingTargetMonth")?.value || "";
    let message = "";
    let field = missing ? $(missing) : null;

    if (missing) {
      message = "請先填完目前餘額、收入、支出與存款目標。";
    } else if (safeNumber("#monthlyIncome") <= 0) {
      message = "每月固定收入需要大於 0。";
      field = $("#monthlyIncome");
    } else if (safeNumber("#fixedExpense") >= safeNumber("#monthlyIncome")) {
      message = "固定支出需要低於固定收入，才能計算可安排金額。";
      field = $("#fixedExpense");
    } else if (safeNumber("#savingTarget") <= 0) {
      message = "請填入有效的存款目標。";
      field = $("#savingTarget");
    } else if (!targetMonth || monthsUntil(targetMonth) < 1) {
      message = "請選擇一個未來的完成月份。";
      field = $("#savingTargetMonth");
    }

    if (!message) return true;
    $("#setupError").textContent = message;
    $("#setupError").hidden = false;
    field?.focus();
    return false;
  }

  function completeSetup() {
    const completeQuiz = PERSONA_QUESTION_IDS.every(
      (id) => Boolean(state.personaAnswers[id]),
    );
    if (!completeQuiz) {
      showStage("quiz");
      return;
    }
    if (!validateFinanceSetup()) return;

    const mode = recommendedPersonaMode(state.personaAnswers);
    saveProfile({
      mode,
      personaAnswers: { ...state.personaAnswers },
      currentBalance: safeNumber("#currentBalance"),
      income: safeNumber("#monthlyIncome"),
      fixed: safeNumber("#fixedExpense"),
      target: safeNumber("#savingTarget"),
      months: Math.max(1, monthsUntil($("#savingTargetMonth")?.value)),
      quality: {
        time: Number($("#qTime").value),
        food: Number($("#qFood").value),
        comfort: Number($("#qComfort").value),
        fun: Number($("#qFun").value),
      },
    });
    navigate("/home");
  }

  $$(".persona-answer").forEach((button) => {
    button.addEventListener("click", () => chooseAnswer(button), listenerOptions);
  });
  $("#personaQuizBack").addEventListener(
    "click",
    () => showQuestion(state.quizIndex - 1, true),
    listenerOptions,
  );
  $$("#onboarding input").forEach((input) => {
    input.addEventListener("input", updatePreview, listenerOptions);
  });
  $("#savingTargetMonth")?.addEventListener("change", updatePreview, listenerOptions);
  $("#continueToBudget").addEventListener(
    "click",
    () => showStage("budget"),
    listenerOptions,
  );
  $("#resultRestart").addEventListener(
    "click",
    () => restart(false),
    listenerOptions,
  );
  $("#budgetBack").addEventListener(
    "click",
    () => showStage("result"),
    listenerOptions,
  );
  $("#completeSetup").addEventListener(
    "click",
    completeSetup,
    listenerOptions,
  );

  restart(true);

  return () => {
    abortController.abort();
    window.clearTimeout(state.quizTimer);
  };
}

export default {
  render,
  mount,
};
