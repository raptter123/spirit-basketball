import { TACTICS, getTacticById } from "./data.js";
import { mountCourt } from "./court.js";
import { mountCalendar } from "./calendar.js";
import { mountEditor } from "./editor.js";
import { getOverride, saveOverride, clearOverride } from "./storage.js";

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

function cloneTactic(t) {
  return JSON.parse(JSON.stringify(t));
}

function closeModal() {
  const modal = document.querySelector(".modal-backdrop");
  if (modal) modal.remove();
}

function showExportModal(tactic) {
  const payload = {
    players: tactic.players,
    ...(tactic.ball ? { ball: tactic.ball } : {}),
  };
  const text = JSON.stringify(payload, null, 2);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>내보내기</h3>
      <p class="hint">아래 내용을 복사해서 채팅으로 보내주시면 실제 사이트에 반영해드릴게요.</p>
      <textarea class="export-textarea" readonly>${text}</textarea>
      <div class="modal-actions">
        <button type="button" class="btn" id="modal-close">닫기</button>
        <button type="button" class="btn btn-primary" id="modal-copy">복사하기</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-copy").addEventListener("click", async () => {
    const copyBtn = document.getElementById("modal-copy");
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "복사됨!";
    } catch {
      copyBtn.textContent = "복사 실패, 직접 선택해주세요";
    }
    setTimeout(() => {
      copyBtn.textContent = "복사하기";
    }, 1500);
  });
}

function renderDetail(id) {
  const base = getTacticById(id);
  if (!base) {
    renderNotFound();
    return;
  }

  const override = getOverride(id);
  const tactic = cloneTactic(base);
  if (override) {
    tactic.players = override.players;
    if (override.ball) tactic.ball = override.ball;
  }

  let editing = false;
  let controller = null;

  function renderShell() {
    app.innerHTML = `
      <section class="detail-view">
        <a class="back-link" href="#/">← 목록으로</a>
        <span class="badge badge-${tactic.category === "디펜스" ? "defense" : "offense"}">${tactic.category}</span>
        <h1>${tactic.name}</h1>
        <p class="summary">${tactic.summary}</p>
        ${
          getOverride(id)
            ? `<p class="hint override-hint">이 브라우저에만 저장된 수정사항이 적용 중이에요. <button type="button" class="link-btn" id="reset-btn">초기화</button></p>`
            : ""
        }
        <div class="court-wrap" id="court-wrap"></div>
        <div class="controls">
          <button id="play-btn" class="btn btn-primary">▶ 재생</button>
          <button id="replay-btn" class="btn">⟲ 다시보기</button>
          <button id="edit-btn" class="btn">✎ 편집</button>
        </div>
        <p class="description">${tactic.description}</p>
      </section>
    `;

    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        clearOverride(id);
        renderDetail(id);
      });
    }

    document.getElementById("edit-btn").addEventListener("click", () => {
      editing = !editing;
      renderMain();
    });

    renderMain();
  }

  function renderMain() {
    const courtWrap = document.getElementById("court-wrap");
    const playBtn = document.getElementById("play-btn");
    const replayBtn = document.getElementById("replay-btn");
    const editBtn = document.getElementById("edit-btn");

    if (editing) {
      playBtn.disabled = true;
      replayBtn.disabled = true;
      editBtn.textContent = "✕ 편집 종료";
      mountEditor(courtWrap, tactic, {
        onChange(updated) {
          saveOverride(id, { players: updated.players, ball: updated.ball });
          const hint = document.querySelector(".override-hint");
          if (!hint) {
            renderShell();
          }
        },
        onReset() {
          tactic.players = cloneTactic(base).players;
          tactic.ball = cloneTactic(base).ball;
          clearOverride(id);
          renderMain();
          const hint = document.querySelector(".override-hint");
          if (hint) hint.remove();
        },
        onPreview() {
          editing = false;
          renderMain();
          controller.play();
          playBtn.textContent = "⏸ 일시정지";
        },
        onExport(current) {
          showExportModal(current);
        },
      });
      return;
    }

    playBtn.disabled = false;
    replayBtn.disabled = false;
    editBtn.textContent = "✎ 편집";
    controller = mountCourt(courtWrap, tactic);

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

  renderShell();
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
