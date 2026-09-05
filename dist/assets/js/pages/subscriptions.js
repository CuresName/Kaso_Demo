import { SUBSCRIPTIONS } from "../data.js";
import {
  escapeAttr,
  pageTitle,
} from "../utils.js";

function render() {
  return `
    <main class="shell main-content">
      <section class="view">
        ${pageTitle(
          "訂閱比較",
          "依使用人數與資格比較月費，不再只看表面價格。",
          "訂閱比較",
          { demo: true },
        )}
        <div class="subscription-grid">
          ${SUBSCRIPTIONS.map((subscription) => `
            <article class="subscription">
              <small>${subscription[1]}</small>
              <h3>${subscription[0]}</h3>
              <p>${subscription[2]}</p>
              <button class="secondary-btn" type="button" data-ask-product="${escapeAttr(`${subscription[0]} 訂閱比較`)}">問 AI 比較</button>
            </article>
          `).join("")}
        </div>
      </section>
    </main>
  `;
}

export default {
  render,
};
