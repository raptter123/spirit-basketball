import { TACTICS, getTacticById } from "./data.js";
import { mountCourt } from "./court.js";
import { mountCalendar } from "./calendar.js";

const app = document.getElementById("app");

function renderList() {
  app.innerHTML = `
    <section class="list-view">
      <h1>전술 목록</h1>
      <p class="hint">전술을 클릭하면 코트 위에서 움직임을 애니메이션으로 볼 수 있어요.</p>
      <div class="card-grid">
        ${TACTICS.map(
          (t) => `
          <a class="tactic-card" href="#/tactic/${t.id}">
            <span class="badge badge-${t.category === "디펜스" ? "defense" : "offense"}">${t.category}</span>
            <h2>${t.name}</h2>
            <p>${t.summary}</p>
          </a>`
        ).join("")}
      </div>
    </section>
  `;
}

function renderSchedule() {
  app.innerHTML = `
    <section class="schedule-view">
      <h1>대회 일정</h1>
      <p class="hint">날짜를 클릭하면 그 날의 일정을 볼 수 있어요.</p>
      <div id="calendar-container"></div>
    </section>
  `;
  mountCalendar(document.getElementById("calendar-container"));
}

function renderNotFound() {
  app.innerHTML = `
    <section class="detail-view">
      <a class="back-link" href="#/">← 목록으로</a>
      <p>존재하지 않는 전술입니다.</p>
    </section>
  `;
}

function renderDetail(id) {
  const tactic = getTacticById(id);
  if (!tactic) {
    renderNotFound();
    return;
  }

  app.innerHTML = `
    <section class="detail-view">
      <a class="back-link" href="#/">← 목록으로</a>
      <span class="badge badge-${tactic.category === "디펜스" ? "defense" : "offense"}">${tactic.category}</span>
      <h1>${tactic.name}</h1>
      <p class="summary">${tactic.summary}</p>
      <div class="court-wrap"><div id="court-container"></div></div>
      <div class="controls">
        <button id="play-btn" class="btn btn-primary">▶ 재생</button>
        <button id="replay-btn" class="btn">⟲ 다시보기</button>
      </div>
      <p class="description">${tactic.description}</p>
    </section>
  `;

  const courtContainer = document.getElementById("court-container");
  const controller = mountCourt(courtContainer, tactic);

  const playBtn = document.getElementById("play-btn");
  const replayBtn = document.getElementById("replay-btn");

  playBtn.addEventListener("click", () => {
    if (controller.isPlaying()) {
      controller.pause();
      playBtn.textContent = "▶ 재생";
    } else {
      controller.play();
      playBtn.textContent = "⏸ 일시정지";
    }
  });

  replayBtn.addEventListener("click", () => {
    controller.replay();
    playBtn.textContent = "⏸ 일시정지";
  });

  controller.play();
  playBtn.textContent = "⏸ 일시정지";
}

function router() {
  const hash = location.hash;
  if (hash.startsWith("#/tactic/")) {
    renderDetail(decodeURIComponent(hash.slice("#/tactic/".length)));
  } else if (hash === "#/schedule") {
    renderSchedule();
  } else {
    renderList();
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
