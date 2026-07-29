import { TACTICS, getTacticById } from "./data.js";
import { mountCourt } from "./court.js";
import { mountCalendar } from "./calendar.js";
import { mountEditor } from "./editor.js";
import { mountShuffle, mountTeamHistory } from "./team-shuffle.js";
import { ROSTER } from "./roster.js";
import {
  getOverride,
  saveOverride,
  clearOverride,
  getFavorites,
  toggleFavorite,
  getCustomRoster,
  addCustomRosterEntry,
  removeCustomRosterEntry,
} from "./storage.js";

const app = document.getElementById("app");
const CATEGORIES = ["전체", "오펜스", "디펜스"];
const HIGHLIGHT_MIN_GAMES = 25;

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tacticCardHTML(t, isFav) {
  return `
    <div class="tactic-card-wrap">
      <a class="tactic-card" href="#/tactic/${t.id}">
        <span class="badge badge-${t.category === "디펜스" ? "defense" : "offense"}">${t.category}</span>
        <h2>${t.name}</h2>
        <p>${t.summary}</p>
      </a>
      <button type="button" class="fav-btn ${isFav ? "is-fav" : ""}" data-id="${t.id}" aria-label="즐겨찾기">${
    isFav ? "★" : "☆"
  }</button>
    </div>
  `;
}

function renderList() {
  let query = "";
  let category = "전체";

  function render() {
    const favorites = new Set(getFavorites());
    const q = query.trim().toLowerCase();
    const filtered = TACTICS.filter((t) => {
      const inCategory = category === "전체" || t.category === category;
      const inQuery = !q || t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q);
      return inCategory && inQuery;
    });
    const favTactics = filtered.filter((t) => favorites.has(t.id));
    const restTactics = filtered.filter((t) => !favorites.has(t.id));

    app.innerHTML = `
      <section class="list-view">
        <h1>전술 목록</h1>
        <p class="hint">전술을 클릭하면 코트 위에서 움직임을 애니메이션으로 볼 수 있어요.</p>
        <div class="list-controls">
          <input type="text" id="tactic-search" class="search-input" placeholder="전술 이름/설명 검색" value="${query}" />
          <div class="category-filter">
            ${CATEGORIES.map(
              (c) => `<button type="button" class="chip ${category === c ? "chip-active" : ""}" data-category="${c}">${c}</button>`
            ).join("")}
          </div>
        </div>
        ${
          favTactics.length
            ? `<h2 class="section-title">⭐ 즐겨찾기</h2><div class="card-grid">${favTactics
                .map((t) => tacticCardHTML(t, true))
                .join("")}</div>`
            : ""
        }
        ${favTactics.length && restTactics.length ? `<h2 class="section-title">전체 전술</h2>` : ""}
        ${
          restTactics.length
            ? `<div class="card-grid">${restTactics.map((t) => tacticCardHTML(t, false)).join("")}</div>`
            : filtered.length === 0
            ? `<p class="hint">검색 결과가 없어요.</p>`
            : ""
        }
      </section>
    `;

    const searchInput = document.getElementById("tactic-search");
    searchInput.addEventListener("input", (e) => {
      query = e.target.value;
      const caret = e.target.selectionStart;
      render();
      const newInput = document.getElementById("tactic-search");
      newInput.focus();
      newInput.setSelectionRange(caret, caret);
    });

    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        category = chip.dataset.category;
        render();
      });
    });

    document.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        toggleFavorite(btn.dataset.id);
        render();
      });
    });
  }

  render();
}

function computeHighlights() {
  const qualified = ROSTER.filter((p) => p.games >= HIGHLIGHT_MIN_GAMES);
  const pool = qualified.length ? qualified : ROSTER;
  const topBy = (key) => [...pool].sort((a, b) => b[key] - a[key])[0];
  return [
    { label: "🏀 득점왕", player: topBy("ppg"), value: (p) => `${p.ppg.toFixed(1)} PPG` },
    { label: "🧱 리바운드왕", player: topBy("rpg"), value: (p) => `${p.rpg.toFixed(1)} RPG` },
    { label: "🎯 어시스트왕", player: topBy("apg"), value: (p) => `${p.apg.toFixed(1)} APG` },
    { label: "🏆 승률왕", player: topBy("winRate"), value: (p) => `${Math.round(p.winRate * 100)}%` },
  ];
}

function rosterCardHTML(p, isCustom) {
  const hasStats = typeof p.games === "number";
  return `
    <div class="roster-card">
      <div class="roster-info">
        <div class="roster-name">
          ${escapeHtml(p.name)}
          ${p.position ? `<span class="roster-position">${escapeHtml(p.position)}</span>` : ""}
        </div>
        ${
          hasStats
            ? `<div class="roster-stats">
                <span>${p.games}경기</span>
                <span>${p.ppg.toFixed(1)} PPG</span>
                <span>${p.rpg.toFixed(1)} RPG</span>
                <span>${p.apg.toFixed(1)} APG</span>
              </div>`
            : `<div class="roster-stats hint">기록 데이터 없음 (직접 추가됨)</div>`
        }
      </div>
      ${isCustom ? `<button type="button" class="btn-icon roster-remove-btn" data-id="${p.id}" aria-label="삭제">×</button>` : ""}
    </div>
  `;
}

function renderRoster() {
  function render() {
    const custom = getCustomRoster();
    const highlights = computeHighlights();

    app.innerHTML = `
      <section class="roster-view">
        <a class="back-link" href="#/">← 전술 목록으로</a>
        <h1>팀 로스터</h1>
        <p class="hint">혼(Spirit) 소속 선수 명단입니다. 스탯은 2026년 상반기(1~6월) 팀 기록 기준 평균이에요.</p>

        <div class="highlight-grid">
          ${highlights
            .map(
              (h) => `
              <div class="highlight-card">
                <span class="highlight-label">${h.label}</span>
                <strong>${escapeHtml(h.player.name)}</strong>
                <span class="highlight-value">${h.value(h.player)}</span>
              </div>`
            )
            .join("")}
        </div>

        ${
          ROSTER.length || custom.length
            ? `<div class="roster-grid">
                ${ROSTER.map((p) => rosterCardHTML(p, false)).join("")}
                ${custom.map((p) => rosterCardHTML(p, true)).join("")}
              </div>`
            : `<p class="hint">아직 등록된 선수 정보가 없어요.</p>`
        }

        <div class="roster-add">
          <h2 class="section-title">+ 선수 추가</h2>
          <p class="hint">위 목록에 없는 선수는 이름만 입력해도 추가할 수 있어요 (이 브라우저에만 저장돼요).</p>
          <form id="add-player-form" class="add-player-form">
            <input type="text" id="new-player-name" placeholder="이름" required />
            <input type="text" id="new-player-position" placeholder="포지션 (선택)" />
            <button type="submit" class="btn btn-primary">추가</button>
          </form>
        </div>
      </section>
    `;

    document.getElementById("add-player-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("new-player-name");
      const positionInput = document.getElementById("new-player-position");
      const name = nameInput.value.trim();
      if (!name) return;
      addCustomRosterEntry({ name, position: positionInput.value.trim() });
      render();
    });

    document.querySelectorAll(".roster-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeCustomRosterEntry(btn.dataset.id);
        render();
      });
    });
  }

  render();
}

function renderTeamShuffle() {
  app.innerHTML = `
    <section class="shuffle-view">
      <a class="back-link" href="#/">← 전술 목록으로</a>
      <h1>자체전 팀 편성</h1>
      <p class="hint">참석자 이름을 입력하고 팀 나누기를 누르면 랜덤으로 팀을 나눠줘요.</p>

      <h2 class="section-title">🔀 랜덤 팀 나누기</h2>
      <div id="shuffle-container"></div>

      <h2 class="section-title">📋 팀 편성 기록</h2>
      <p class="hint">실제로 자체전 날 팀이 어떻게 짜였는지 날짜별로 남겨두면 나중에 찾아볼 수 있어요. 대회 일정 달력에서 그 날짜를 클릭해도 같이 보여요.</p>
      <div id="history-container"></div>
    </section>
  `;
  mountShuffle(document.getElementById("shuffle-container"));
  mountTeamHistory(document.getElementById("history-container"));
}

function renderSchedule() {
  app.innerHTML = `
    <section class="schedule-view">
      <a class="back-link" href="#/">← 전술 목록으로</a>
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
  } else if (hash === "#/roster") {
    renderRoster();
  } else if (hash === "#/team-shuffle") {
    renderTeamShuffle();
  } else {
    renderList();
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
