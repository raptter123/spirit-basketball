import { TACTICS, getTacticById } from "./data.js";
import { mountCourt } from "./court.js";
import { mountCalendar } from "./calendar.js";
import { mountEditor } from "./editor.js";
import { mountTeamBuilder } from "./team-shuffle.js";
import { ROSTER } from "./roster.js";
import { getUpcomingEvents } from "./events.js";
import {
  getOverride,
  saveOverride,
  clearOverride,
  getFavorites,
  toggleFavorite,
  getCustomRoster,
  addCustomRosterEntry,
  removeCustomRosterEntry,
  getNewTacticDraft,
  saveNewTacticDraft,
  clearNewTacticDraft,
  clearTeamBuilderDraft,
  getTacticSimAssignment,
  saveTacticSimAssignment,
  clearTacticSimAssignment,
} from "./storage.js";

const app = document.getElementById("app");
const CATEGORIES = ["전체", "패턴", "세트 오펜스", "디펜스"];
const HIGHLIGHT_MIN_GAMES = 25;

function badgeClassFor(category) {
  if (category === "디펜스") return "badge-defense";
  if (category === "세트 오펜스") return "badge-set";
  return "badge-offense";
}

const HOME_MENU = [
  { icon: "🏀", title: "전술", desc: "저장된 전술을 코트 위에서 보고, 직접 편집하거나 새로 만들어보세요.", href: "#/tactics" },
  { icon: "🔀", title: "팀 편성", desc: "참석자를 선택해서 팀을 나누고, 공지 이미지까지 만들어보세요.", href: "#/team-shuffle" },
  { icon: "👥", title: "로스터", desc: "선수 명단과 이번 시즌 기록을 확인하세요.", href: "#/roster" },
  { icon: "📚", title: "기록 보관실", desc: "예전 활동 기록을 모아둔 보관실이에요.", href: "https://kimjunseok.github.io/Spirit/", external: true },
  { icon: "✅", title: "출석체크", desc: "자체전 출석체크는 여기서 해주세요.", href: "https://band.us/band/47755703", external: true },
];

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tacticCardHTML(t, isFav) {
  return `
    <div class="tactic-card-wrap">
      <a class="tactic-card" href="#/tactic/${t.id}">
        <span class="badge ${badgeClassFor(t.category)}">${t.category}</span>
        <h2>${t.name}</h2>
        <p>${t.summary}</p>
      </a>
      <button type="button" class="fav-btn ${isFav ? "is-fav" : ""}" data-id="${t.id}" aria-label="즐겨찾기">${
    isFav ? "★" : "☆"
  }</button>
    </div>
  `;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dDayLabel(dateStr) {
  const today = new Date(`${todayStr()}T00:00:00`);
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return "D-Day";
  if (diff > 0) return `D-${diff}`;
  return `D+${-diff}`;
}

function homeUpcomingHTML() {
  const upcoming = getUpcomingEvents(todayStr(), 60).slice(0, 3);
  if (!upcoming.length) return "";
  return `
    <a class="home-upcoming" href="#/schedule">
      <div class="home-upcoming-head">
        <span class="home-upcoming-label">📅 다가오는 일정</span>
        <span class="home-upcoming-more">전체 일정 보기 →</span>
      </div>
      <div class="home-upcoming-list">
        ${upcoming
          .map(
            (e) => `
          <div class="home-upcoming-item">
            <span class="home-upcoming-dday">${dDayLabel(e.date)}</span>
            <span class="badge ${e.type === "대회" ? "badge-defense" : "badge-offense"}">${e.type}</span>
            <span class="home-upcoming-title">${escapeHtml(e.title)}</span>
            <span class="home-upcoming-date">${e.date}</span>
          </div>`
          )
          .join("")}
      </div>
    </a>
  `;
}

function homeCardHTML(item) {
  const attrs = item.external ? `target="_blank" rel="noopener"` : "";
  return `
    <a class="home-card" href="${item.href}" ${attrs}>
      <span class="home-card-icon">${item.icon}</span>
      <h2>${item.title}${item.external ? " ↗" : ""}</h2>
      <p>${item.desc}</p>
    </a>
  `;
}

function renderHome() {
  app.innerHTML = `
    <section class="home-view">
      <h1>혼(Spirit)</h1>
      <p class="home-tagline">한 팀, 한 코트, 하나의 혼(Spirit)</p>
      <p class="hint">여기는 혼(Spirit)의 혼페이지예요. 전술부터 팀 편성, 일정까지 — 필요한 건 아래에서 다 찾을 수 있어요.</p>
      ${homeUpcomingHTML()}
      <div class="home-menu">
        ${HOME_MENU.map(homeCardHTML).join("")}
      </div>

      <div class="home-appendix">
        <span class="home-appendix-label">별첨</span>
        <h2 class="home-appendix-title">📲 홈 화면에 앱처럼 추가하기</h2>
        <p class="hint">한 번만 아래대로 추가해두면, 다음부터는 브라우저 없이 아이콘만 눌러서 바로 열 수 있어요.</p>
        <div class="install-guide-grid">
          <div class="install-guide-card">
            <h3>🍎 아이폰 (Safari)</h3>
            <ol>
              <li>이 페이지를 <strong>Safari</strong>로 열기</li>
              <li>하단 공유 버튼(⬆️) 탭</li>
              <li>"홈 화면에 추가" 선택</li>
            </ol>
          </div>
          <div class="install-guide-card">
            <h3>🤖 안드로이드 (Chrome)</h3>
            <ol>
              <li>이 페이지를 <strong>Chrome</strong>으로 열기</li>
              <li>오른쪽 위 점 3개(⋮) 메뉴 탭</li>
              <li>"앱 설치" 또는 "홈 화면에 추가" 선택</li>
            </ol>
          </div>
        </div>
      </div>
    </section>
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
        <a class="back-link" href="#/">← 홈으로</a>
        <div class="list-header">
          <h1>전술 목록</h1>
          <a href="#/new-tactic" class="btn btn-primary">+ 전술 추가</a>
        </div>
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
          ${escapeHtml(p.name)}${p.captain ? ` <span class="captain-tag">(C)</span>` : ""}
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
        <a class="back-link" href="#/">← 홈으로</a>
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
      <a class="back-link" href="#/">← 홈으로</a>
      <h1>자체전 팀 편성</h1>
      <p class="hint">참석자를 로스터에서 선택하고, 이름 옆 팀 글자를 눌러 배정해주세요.</p>
      <div id="team-builder-container"></div>
    </section>
  `;
  mountTeamBuilder(document.getElementById("team-builder-container"));
}

function renderSchedule() {
  app.innerHTML = `
    <section class="schedule-view">
      <a class="back-link" href="#/">← 홈으로</a>
      <h1>일정</h1>
      <p class="hint">날짜를 클릭하면 그 날의 일정을 볼 수 있어요.</p>
      <div id="calendar-container"></div>
    </section>
  `;
  mountCalendar(document.getElementById("calendar-container"));
}

function renderNotFound() {
  app.innerHTML = `
    <section class="detail-view">
      <a class="back-link" href="#/tactics">← 목록으로</a>
      <p>존재하지 않는 전술입니다.</p>
    </section>
  `;
}

function cloneTactic(t) {
  return JSON.parse(JSON.stringify(t));
}

// 시나리오: 같은 시작 배치에서 갈라지는 여러 흐름(예: 트리플 쓰렛에서 돌파/1번패스/2번패스).
// scenarios[0]은 항상 "기본" 시나리오이며 tactic.players/ball 그 자체다.
function scenariosOf(tactic) {
  return [{ name: "기본", players: tactic.players, ball: tactic.ball }, ...(tactic.scenarios || [])];
}

function newScenarioFrom(baseScenario, name) {
  const cloned = cloneTactic({ players: baseScenario.players, ...(baseScenario.ball ? { ball: baseScenario.ball } : {}) });
  return { name, players: cloned.players, ...(cloned.ball ? { ball: cloned.ball } : {}) };
}

function scenarioChipsHTML(scenarios, activeIndex) {
  return `
    <div class="scenario-chips">
      ${scenarios
        .map(
          (s, i) =>
            `<button type="button" class="chip ${i === activeIndex ? "chip-active" : ""}" data-scenario="${i}">${escapeHtml(
              s.name
            )}</button>`
        )
        .join("")}
      <button type="button" class="chip chip-add" id="scenario-add">+ 시나리오 추가</button>
    </div>
  `;
}

function closeModal() {
  const modal = document.querySelector(".modal-backdrop");
  if (modal) modal.remove();
}

function showExportModal(payload) {
  const text = JSON.stringify(payload, null, 2);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>내보내기</h3>
      <p class="hint">아래 내용을 복사해서 <strong>황규철</strong>에게 보내주세요. 확인 후 실제 사이트에 반영할게요.</p>
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

function showNewTacticExportModal(payload) {
  const text = JSON.stringify(payload, null, 2);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>새 전술 내보내기</h3>
      <p class="hint">아래 내용을 복사해서 <strong>황규철</strong>에게 보내주세요. 확인 후 실제 사이트에 새 전술로 반영할게요.</p>
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

function defaultNewTacticPlayers(team) {
  return [
    { number: 1, team, path: [[250, 300]] },
    { number: 2, team, path: [[400, 340]] },
    { number: 3, team, path: [[100, 340]] },
    { number: 4, team, path: [[350, 250]] },
    { number: 5, team, path: [[170, 400]] },
  ];
}

function renderNewTactic() {
  const draft = getNewTacticDraft();
  let name = draft?.name || "";
  let category = draft?.category || "패턴";
  let summary = draft?.summary || "";
  let description = draft?.description || "";
  let activeScenario = 0;
  const tactic = {
    name: name || "이름 없는 전술",
    players: draft?.players || defaultNewTacticPlayers(category === "디펜스" ? "defense" : "offense"),
    ...(draft?.ball ? { ball: draft.ball } : {}),
    ...(draft?.scenarios && draft.scenarios.length ? { scenarios: draft.scenarios } : {}),
  };

  function activeTarget() {
    return activeScenario === 0 ? tactic : tactic.scenarios[activeScenario - 1];
  }

  function persistDraft() {
    saveNewTacticDraft({
      name,
      category,
      summary,
      description,
      players: tactic.players,
      ...(tactic.ball ? { ball: tactic.ball } : {}),
      ...(tactic.scenarios && tactic.scenarios.length ? { scenarios: tactic.scenarios } : {}),
    });
  }

  function renderShell() {
    tactic.name = name || "이름 없는 전술";
    app.innerHTML = `
      <section class="detail-view new-tactic-view">
        <a class="back-link" href="#/tactics">← 전술 목록으로</a>
        <h1>+ 새 전술 추가</h1>
        <p class="hint editor-local-notice">✎ 여기서 만드는 전술은 <strong>이 브라우저에만</strong> 저장돼요. 다 만들었으면 아래 코트의 "내보내기"로 나온 내용을 황규철에게 전달해주세요.</p>
        <form class="new-tactic-form" id="new-tactic-form">
          <label>전술명
            <input type="text" id="nt-name" value="${escapeHtml(name)}" placeholder="예: 픽앤롤" />
          </label>
          <label>카테고리
            <select id="nt-category">
              <option value="패턴" ${category === "패턴" ? "selected" : ""}>패턴</option>
              <option value="세트 오펜스" ${category === "세트 오펜스" ? "selected" : ""}>세트 오펜스</option>
              <option value="디펜스" ${category === "디펜스" ? "selected" : ""}>디펜스</option>
            </select>
          </label>
          <label>한줄 설명
            <input type="text" id="nt-summary" value="${escapeHtml(summary)}" placeholder="목록에 보일 짧은 설명" />
          </label>
          <label>상세 설명
            <textarea id="nt-description" rows="4" placeholder="전술 흐름을 자세히 설명해주세요">${escapeHtml(description)}</textarea>
          </label>
        </form>
        <button type="button" class="link-btn" id="nt-clear-draft">이 초안 전체 삭제</button>
        <p class="hint">한 전술 안에서 여러 상황(예: 돌파 / 1번 패스 / 2번 패스)을 각각 만들고 싶으면 아래 "+ 시나리오 추가"를 눌러주세요. 같은 시작 배치에서 시작해서, 각 시나리오의 흐름만 따로 그리면 돼요.</p>
        <div id="scenario-toolbar"></div>
        <div class="court-wrap" id="new-tactic-court"></div>
      </section>
    `;

    document.getElementById("nt-name").addEventListener("input", (e) => {
      name = e.target.value;
      tactic.name = name || "이름 없는 전술";
      persistDraft();
    });
    document.getElementById("nt-summary").addEventListener("input", (e) => {
      summary = e.target.value;
      persistDraft();
    });
    document.getElementById("nt-description").addEventListener("input", (e) => {
      description = e.target.value;
      persistDraft();
    });
    document.getElementById("nt-category").addEventListener("change", (e) => {
      category = e.target.value;
      const team = category === "디펜스" ? "defense" : "offense";
      scenariosOf(tactic).forEach((scenario) => scenario.players.forEach((p) => (p.team = team)));
      persistDraft();
      renderMain();
    });
    document.getElementById("nt-clear-draft").addEventListener("click", () => {
      clearNewTacticDraft();
      renderNewTactic();
    });

    renderMain();
  }

  function renderScenarioToolbar() {
    const toolbar = document.getElementById("scenario-toolbar");
    const scenarios = scenariosOf(tactic);
    toolbar.innerHTML = `
      ${scenarioChipsHTML(scenarios, activeScenario)}
      ${
        activeScenario > 0
          ? `<div class="scenario-edit-row">
               <input type="text" id="scenario-name-input" value="${escapeHtml(scenarios[activeScenario].name)}" placeholder="시나리오 이름" />
               <button type="button" class="link-btn" id="scenario-delete">🗑 이 시나리오 삭제</button>
             </div>`
          : ""
      }
    `;

    toolbar.querySelectorAll("[data-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeScenario = Number(btn.dataset.scenario);
        renderMain();
      });
    });

    toolbar.querySelector("#scenario-add").addEventListener("click", () => {
      const current = scenariosOf(tactic);
      const newScenario = newScenarioFrom(current[activeScenario], `시나리오 ${current.length}`);
      if (!tactic.scenarios) tactic.scenarios = [];
      tactic.scenarios.push(newScenario);
      activeScenario = scenariosOf(tactic).length - 1;
      persistDraft();
      renderMain();
    });

    const nameInput = toolbar.querySelector("#scenario-name-input");
    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        const value = e.target.value || `시나리오 ${activeScenario + 1}`;
        tactic.scenarios[activeScenario - 1].name = value;
        persistDraft();
        const chip = toolbar.querySelector(`[data-scenario="${activeScenario}"]`);
        if (chip) chip.textContent = value;
      });
    }

    const deleteBtn = toolbar.querySelector("#scenario-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        tactic.scenarios.splice(activeScenario - 1, 1);
        activeScenario = 0;
        persistDraft();
        renderMain();
      });
    }
  }

  function renderMain() {
    renderScenarioToolbar();
    const courtWrap = document.getElementById("new-tactic-court");
    mountEditor(courtWrap, activeTarget(), {
      onChange() {
        persistDraft();
      },
      onReset() {
        tactic.players = defaultNewTacticPlayers(category === "디펜스" ? "defense" : "offense");
        delete tactic.ball;
        delete tactic.scenarios;
        activeScenario = 0;
        persistDraft();
        renderShell();
      },
      onPreview() {
        renderPreview();
      },
      onExport() {
        showNewTacticExportModal({
          name: name.trim() || "이름 없는 전술",
          category,
          summary: summary.trim(),
          description: description.trim(),
          players: tactic.players,
          ...(tactic.ball ? { ball: tactic.ball } : {}),
          ...(tactic.scenarios && tactic.scenarios.length ? { scenarios: tactic.scenarios } : {}),
        });
      },
      hideLocalNotice: true,
    });
  }

  function renderPreview() {
    const courtWrap = document.getElementById("new-tactic-court");
    courtWrap.innerHTML = `
      <div class="preview-controls">
        <button type="button" class="btn" id="back-to-edit">✎ 편집으로 돌아가기</button>
      </div>
      <div id="new-tactic-preview"></div>
    `;
    const controller = mountCourt(document.getElementById("new-tactic-preview"), activeTarget());
    controller.play();
    document.getElementById("back-to-edit").addEventListener("click", renderMain);
  }

  renderShell();
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
    if (override.scenarios) tactic.scenarios = override.scenarios;
    if (override.name) tactic.name = override.name;
    if (override.summary != null) tactic.summary = override.summary;
    if (override.description != null) tactic.description = override.description;
  }

  let editing = false;
  let activeScenario = 0;
  let controller = null;
  let simAssignment = getTacticSimAssignment();

  function activeTarget() {
    return activeScenario === 0 ? tactic : tactic.scenarios[activeScenario - 1];
  }

  function ensureOverrideHintVisible() {
    if (document.querySelector(".override-hint")) return;
    const anchor = document.getElementById("tactic-summary-display");
    const hintEl = document.createElement("p");
    hintEl.className = "hint override-hint";
    hintEl.innerHTML = `이 브라우저에만 저장된 수정사항이 적용 중이에요. <button type="button" class="link-btn" id="reset-btn">초기화</button>`;
    anchor.insertAdjacentElement("afterend", hintEl);
    document.getElementById("reset-btn").addEventListener("click", () => {
      clearOverride(id);
      renderDetail(id);
    });
  }

  function persistOverride() {
    saveOverride(id, {
      players: tactic.players,
      ball: tactic.ball,
      name: tactic.name,
      summary: tactic.summary,
      description: tactic.description,
      ...(tactic.scenarios && tactic.scenarios.length ? { scenarios: tactic.scenarios } : {}),
    });
  }

  function applySimNames() {
    scenariosOf(tactic).forEach((scenario) => {
      scenario.players.forEach((p) => {
        const name = simAssignment[p.number];
        if (name) {
          p.displayName = name;
        } else {
          delete p.displayName;
        }
      });
    });
  }
  applySimNames();

  function simPanelHTML() {
    const allNames = [...ROSTER, ...getCustomRoster()].map((p) => p.name);
    return `
      <div class="tactic-sim-panel">
        <p class="hint editor-local-notice">✎ 아래에서 로스터 인원을 번호에 넣어 시뮬레이션해볼 수 있어요. <strong>이 화면에 있는 동안만</strong> 적용되고, 페이지를 나가면 자동으로 초기화돼요.</p>
        <div class="tactic-sim-grid">
          ${tactic.players
            .filter((p) => !p.opponent)
            .map((p) => {
              const usedElsewhere = new Set(
                Object.entries(simAssignment)
                  .filter(([num]) => Number(num) !== p.number)
                  .map(([, name]) => name)
              );
              const options = allNames.filter((n) => !usedElsewhere.has(n));
              return `
            <label class="tactic-sim-row">
              <span class="tactic-sim-number">${p.number}번</span>
              <select data-number="${p.number}">
                <option value="">이름 선택 안 함</option>
                ${options
                  .map(
                    (n) =>
                      `<option value="${escapeHtml(n)}" ${simAssignment[p.number] === n ? "selected" : ""}>${escapeHtml(n)}</option>`
                  )
                  .join("")}
              </select>
            </label>`;
            })
            .join("")}
        </div>
        <button type="button" class="link-btn" id="sim-clear">배정 초기화</button>
      </div>
    `;
  }

  function renderShell() {
    app.innerHTML = `
      <section class="detail-view">
        <a class="back-link" href="#/">← 목록으로</a>
        <div class="detail-top-row">
          <span class="badge ${badgeClassFor(tactic.category)}">${tactic.category}</span>
          <button type="button" class="link-btn" id="copy-link-btn">🔗 링크 복사</button>
        </div>
        <h1 id="tactic-name-display">${tactic.name}</h1>
        <p class="summary" id="tactic-summary-display">${tactic.summary}</p>
        ${
          getOverride(id)
            ? `<p class="hint override-hint">이 브라우저에만 저장된 수정사항이 적용 중이에요. <button type="button" class="link-btn" id="reset-btn">초기화</button></p>`
            : ""
        }
        ${simPanelHTML()}
        <div id="scenario-toolbar"></div>
        <div id="meta-editor"></div>
        <div class="court-wrap" id="court-wrap"></div>
        <div class="controls">
          <button id="play-btn" class="btn btn-primary">▶ 재생</button>
          <button id="replay-btn" class="btn">⟲ 다시보기</button>
          <button id="edit-btn" class="btn">✎ 편집</button>
        </div>
        <p class="description" id="tactic-description-display">${tactic.description}</p>
      </section>
    `;

    const resetBtn = document.getElementById("reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        clearOverride(id);
        renderDetail(id);
      });
    }

    document.getElementById("copy-link-btn").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const url = `${location.origin}${location.pathname}#/tactic/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        btn.textContent = "복사됨!";
      } catch {
        btn.textContent = "복사 실패";
      }
      setTimeout(() => {
        btn.textContent = "🔗 링크 복사";
      }, 1500);
    });

    document.querySelectorAll(".tactic-sim-grid select").forEach((select) => {
      select.addEventListener("change", (e) => {
        const number = Number(e.target.dataset.number);
        if (e.target.value) {
          simAssignment[number] = e.target.value;
        } else {
          delete simAssignment[number];
        }
        saveTacticSimAssignment(simAssignment);
        applySimNames();
        renderShell();
      });
    });

    document.getElementById("sim-clear").addEventListener("click", () => {
      simAssignment = {};
      saveTacticSimAssignment(simAssignment);
      applySimNames();
      renderShell();
    });

    document.getElementById("edit-btn").addEventListener("click", () => {
      editing = !editing;
      renderMain();
    });

    renderMain();
  }

  function renderScenarioToolbar() {
    const toolbar = document.getElementById("scenario-toolbar");
    const scenarios = scenariosOf(tactic);
    toolbar.innerHTML = `
      ${scenarioChipsHTML(scenarios, activeScenario)}
      ${
        editing && activeScenario > 0
          ? `<div class="scenario-edit-row">
               <input type="text" id="scenario-name-input" value="${escapeHtml(scenarios[activeScenario].name)}" placeholder="시나리오 이름" />
               <button type="button" class="link-btn" id="scenario-delete">🗑 이 시나리오 삭제</button>
             </div>`
          : ""
      }
    `;

    toolbar.querySelectorAll("[data-scenario]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeScenario = Number(btn.dataset.scenario);
        renderMain();
      });
    });

    toolbar.querySelector("#scenario-add").addEventListener("click", () => {
      const current = scenariosOf(tactic);
      const newScenario = newScenarioFrom(current[activeScenario], `시나리오 ${current.length}`);
      if (!tactic.scenarios) tactic.scenarios = [];
      tactic.scenarios.push(newScenario);
      activeScenario = scenariosOf(tactic).length - 1;
      editing = true;
      applySimNames();
      persistOverride();
      renderShell();
    });

    const nameInput = toolbar.querySelector("#scenario-name-input");
    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        const value = e.target.value || `시나리오 ${activeScenario + 1}`;
        tactic.scenarios[activeScenario - 1].name = value;
        persistOverride();
        const chip = toolbar.querySelector(`[data-scenario="${activeScenario}"]`);
        if (chip) chip.textContent = value;
      });
    }

    const deleteBtn = toolbar.querySelector("#scenario-delete");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        tactic.scenarios.splice(activeScenario - 1, 1);
        activeScenario = 0;
        editing = false;
        persistOverride();
        renderShell();
      });
    }
  }

  function renderMetaEditor() {
    const metaEditor = document.getElementById("meta-editor");
    if (!editing) {
      metaEditor.innerHTML = "";
      return;
    }
    metaEditor.innerHTML = `
      <div class="new-tactic-form meta-edit-form">
        <label>전술명
          <input type="text" id="meta-name" value="${escapeHtml(tactic.name)}" />
        </label>
        <label>한줄 설명
          <input type="text" id="meta-summary" value="${escapeHtml(tactic.summary || "")}" />
        </label>
        <label>상세 설명
          <textarea id="meta-description" rows="4">${escapeHtml(tactic.description || "")}</textarea>
        </label>
      </div>
    `;

    document.getElementById("meta-name").addEventListener("input", (e) => {
      tactic.name = e.target.value || "이름 없는 전술";
      document.getElementById("tactic-name-display").textContent = tactic.name;
      persistOverride();
      ensureOverrideHintVisible();
    });
    document.getElementById("meta-summary").addEventListener("input", (e) => {
      tactic.summary = e.target.value;
      document.getElementById("tactic-summary-display").textContent = tactic.summary;
      persistOverride();
      ensureOverrideHintVisible();
    });
    document.getElementById("meta-description").addEventListener("input", (e) => {
      tactic.description = e.target.value;
      document.getElementById("tactic-description-display").textContent = tactic.description;
      persistOverride();
      ensureOverrideHintVisible();
    });
  }

  function renderMain() {
    renderScenarioToolbar();
    renderMetaEditor();
    const courtWrap = document.getElementById("court-wrap");
    const playBtn = document.getElementById("play-btn");
    const replayBtn = document.getElementById("replay-btn");
    const editBtn = document.getElementById("edit-btn");

    if (editing) {
      playBtn.disabled = true;
      replayBtn.disabled = true;
      editBtn.textContent = "✕ 편집 종료";
      mountEditor(courtWrap, activeTarget(), {
        onChange() {
          persistOverride();
          const hint = document.querySelector(".override-hint");
          if (!hint) {
            renderShell();
          }
        },
        onReset() {
          const freshBase = cloneTactic(base);
          tactic.players = freshBase.players;
          tactic.ball = freshBase.ball;
          tactic.scenarios = freshBase.scenarios;
          tactic.name = freshBase.name;
          tactic.summary = freshBase.summary;
          tactic.description = freshBase.description;
          clearOverride(id);
          activeScenario = 0;
          editing = false;
          applySimNames();
          renderShell();
          const hint = document.querySelector(".override-hint");
          if (hint) hint.remove();
        },
        onPreview() {
          editing = false;
          renderMain();
          controller.play();
          playBtn.textContent = "⏸ 일시정지";
        },
        onExport() {
          showExportModal({
            id: tactic.id,
            name: tactic.name,
            summary: tactic.summary,
            description: tactic.description,
            players: tactic.players,
            ...(tactic.ball ? { ball: tactic.ball } : {}),
            ...(tactic.scenarios && tactic.scenarios.length ? { scenarios: tactic.scenarios } : {}),
          });
        },
      });
      return;
    }

    playBtn.disabled = false;
    replayBtn.disabled = false;
    editBtn.textContent = "✎ 편집";
    controller = mountCourt(courtWrap, activeTarget());

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

function updateNavActive() {
  const hash = location.hash;
  let active = null;
  if (hash.startsWith("#/tactic/") || hash === "#/tactics" || hash === "#/new-tactic") {
    active = "tactics";
  } else if (hash === "#/roster") {
    active = "roster";
  } else if (hash === "#/team-shuffle") {
    active = "team-shuffle";
  } else if (hash === "#/schedule") {
    active = "schedule";
  }

  document.querySelectorAll(".utility-bar a[data-nav]").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.nav === active);
  });
}

let previousHash = null;

function router() {
  const hash = location.hash;
  if (previousHash === "#/team-shuffle" && hash !== "#/team-shuffle") {
    clearTeamBuilderDraft();
  }
  if (previousHash && previousHash.startsWith("#/tactic/") && previousHash !== hash) {
    clearTacticSimAssignment();
  }
  previousHash = hash;
  updateNavActive();
  if (hash.startsWith("#/tactic/")) {
    renderDetail(decodeURIComponent(hash.slice("#/tactic/".length)));
  } else if (hash === "#/new-tactic") {
    renderNewTactic();
  } else if (hash === "#/tactics") {
    renderList();
  } else if (hash === "#/schedule") {
    renderSchedule();
  } else if (hash === "#/roster") {
    renderRoster();
  } else if (hash === "#/team-shuffle") {
    renderTeamShuffle();
  } else {
    renderHome();
  }
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
