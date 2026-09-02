import { TACTICS, getTacticById } from "./data.js";
import { mountCourt, tacticThumbSVG } from "./court.js";
import { mountCalendar } from "./calendar.js";
import { mountEditor } from "./editor.js";
import { mountTeamBuilder } from "./team-shuffle.js";
import { mountBoard } from "./board.js";
import { mountStatsPage } from "./statspage.js";
import { ROSTER } from "./roster.js";
import { jerseyHTML } from "./jersey.js";
import { GLOSSARY, GLOSSARY_GROUPS } from "./glossary.js";
import { getUpcomingEvents } from "./events.js";
import {
  getOverride,
  saveOverride,
  clearOverride,
  getFavorites,
  toggleFavorite,
  getNewTacticDraft,
  saveNewTacticDraft,
  clearNewTacticDraft,
  clearTeamBuilderDraft,
  getTacticSimAssignment,
  saveTacticSimAssignment,
  clearTacticSimAssignment,
  saveTheme,
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
  { icon: "✍️", title: "작전판", desc: "풀코트 위에서 선수와 공을 끌어 옮기며 즉석에서 이야기해보세요.", href: "#/board" },
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
        ${tacticThumbSVG(t)}
        <span class="tactic-card-text">
          <span class="badge ${badgeClassFor(t.category)}">${t.category}</span>
          <h2>${escapeHtml(t.name)}</h2>
          <p>${escapeHtml(t.summary)}</p>
        </span>
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

// 홈 카드에서는 한 줄에 다 들어가야 해서 날짜를 짧게 쓴다.
// 올해 일정이면 MM-DD만, 해가 넘어가는 일정이면 연도까지 보여준다.
function shortDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return y === String(new Date().getFullYear()) ? `${m}-${d}` : `${y}-${m}-${d}`;
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
            <span class="home-upcoming-date">${shortDateLabel(e.date)}</span>
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

      ${installGuideHTML()}
    </section>
  `;
}

// 이미 홈 화면에 추가해서 앱처럼 열고 있는 중인가.
// iOS Safari 는 display-mode 를 지원한 지 얼마 안 돼서 예전 navigator.standalone 도 같이 본다.
function isInstalled() {
  try {
    if (window.navigator.standalone === true) return true;
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch (e) {
    return false;
  }
}

// 홈 화면 추가 안내.
//
// 한 번 따라 하면 끝나는 내용인데 늘 펼쳐져 있어서 홈 전체 1891px 중 442px(23%)을 먹고 있었다.
// 두 가지를 바꿨다:
//   - 이미 앱으로 열고 있으면 아예 안 그린다 (그 사람에게는 할 말이 없는 안내다)
//   - 아니면 접어서 내놓는다. 궁금한 사람만 펴 보면 된다
function installGuideHTML() {
  if (isInstalled()) return "";
  return `
    <details class="home-appendix">
      <summary class="home-appendix-summary">
        <span class="home-appendix-label">별첨</span>
        <span class="home-appendix-title">📲 홈 화면에 앱처럼 추가하기</span>
      </summary>
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
    </details>
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
      // 검색창 안내대로 상세 설명까지 뒤진다. 용어 사전처럼 설명에만 있는 내용도 찾아야 한다.
      const inQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q);
      return inCategory && inQuery;
    });
    const favTactics = filtered.filter((t) => favorites.has(t.id));
    const restTactics = filtered.filter((t) => !favorites.has(t.id));

    app.innerHTML = `
      <section class="list-view">
        <a class="back-link tap-wide" href="#/">← 홈으로</a>
        <div class="list-header">
          <h1>전술 목록</h1>
          <div class="list-header-actions">
            <a href="#/glossary" class="btn">📖 용어 사전</a>
            <a href="#/new-tactic" class="btn btn-primary">+ 전술 추가</a>
          </div>
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

// 로스터 정렬 기준. key 가 null 이면 명단 순서(가나다) 그대로다.
// 승률은 카드에 원래 안 나오던 값이라, 이걸로 정렬할 때만 한 칸 더 붙여 보여준다 —
// 무엇으로 줄을 세웠는지 눈에 안 보이면 순서가 그냥 뒤죽박죽으로 읽힌다.
const ROSTER_SORTS = [
  { label: "이름순", key: null },
  { label: "득점", key: "ppg" },
  { label: "리바운드", key: "rpg" },
  { label: "어시스트", key: "apg" },
  { label: "승률", key: "winRate" },
];

function sortRoster(players, key) {
  if (!key) return [...players];
  // 기록이 없는 선수는 값을 지어낼 수 없으니 언제나 맨 뒤로 보낸다.
  return [...players].sort((a, b) => {
    const av = typeof a.games === "number" ? a[key] : null;
    const bv = typeof b.games === "number" ? b[key] : null;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || a.name.localeCompare(b.name, "ko");
  });
}

function rosterCardHTML(p, sortKey) {
  const hasStats = typeof p.games === "number";
  const cell = (key, text) =>
    `<span${key === sortKey ? ' class="is-sorted"' : ""}>${text}</span>`;
  return `
    <a class="roster-card" href="#/player/${encodeURIComponent(p.name)}">
      ${jerseyHTML(p)}
      <div class="roster-info">
        <div class="roster-name">
          ${escapeHtml(p.name)}${p.captain ? ` <span class="captain-tag">(C)</span>` : ""}
          ${p.position ? `<span class="roster-position">${escapeHtml(p.position)}</span>` : ""}
        </div>
        ${
          hasStats
            ? `<div class="roster-stats">
                <span>${p.games}경기</span>
                ${cell("ppg", `${p.ppg.toFixed(1)} PPG`)}
                ${cell("rpg", `${p.rpg.toFixed(1)} RPG`)}
                ${cell("apg", `${p.apg.toFixed(1)} APG`)}
                ${sortKey === "winRate" ? cell("winRate", `승률 ${Math.round(p.winRate * 100)}%`) : ""}
              </div>`
            : `<div class="roster-stats">기록 데이터 없음</div>`
        }
      </div>
      <span class="roster-more" aria-hidden="true">›</span>
    </a>
  `;
}


// 선수 상세 — 팀 안에서 이 선수가 어느 위치인지 보여주는 게 목적이다.
// 기록이 있는 선수(games 있음)끼리만 비교한다. 아직 기록이 없는 선수는 계산에서 빠진다.
const PLAYER_STATS = [
  { key: "ppg", label: "득점", unit: "점", digits: 1 },
  { key: "rpg", label: "리바운드", unit: "개", digits: 1 },
  { key: "apg", label: "어시스트", unit: "개", digits: 1 },
  { key: "spg", label: "스틸", unit: "개", digits: 1 },
  { key: "fgPct", label: "야투 성공률", percent: true },
  { key: "ts", label: "TS% (슛 효율)", percent: true },
  { key: "topg", label: "턴오버", unit: "개", digits: 1, lowerIsBetter: true },
  { key: "winRate", label: "승률", percent: true },
];

// 표본이 이보다 적으면 순위·비교를 곧이곧대로 읽기 어렵다.
const SMALL_SAMPLE_GAMES = 10;

function statLineHTML(p, stat, pool) {
  const v = p[stat.key];
  if (typeof v !== "number") return "";
  const values = pool.map((q) => q[stat.key]).filter((x) => typeof x === "number");
  if (!values.length) return "";

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  // 턴오버는 적을수록 좋으니 순위와 막대를 뒤집는다.
  const rank = stat.lowerIsBetter
    ? values.filter((x) => x < v).length + 1
    : values.filter((x) => x > v).length + 1;
  const span = max - min || 1;
  const pos = stat.lowerIsBetter ? (max - v) / span : (v - min) / span;
  const avgPos = stat.lowerIsBetter ? (max - avg) / span : (avg - min) / span;
  const fmt = (x) => (stat.percent ? `${(x * 100).toFixed(1)}%` : `${x.toFixed(stat.digits ?? 1)}${stat.unit || ""}`);
  const betterThanAvg = stat.lowerIsBetter ? v < avg : v > avg;

  return `
    <div class="stat-row">
      <div class="stat-top">
        <span class="stat-label">${stat.label}${stat.lowerIsBetter ? ` <em>낮을수록 좋음</em>` : ""}</span>
        <span class="stat-value ${betterThanAvg ? "is-above" : ""}">${fmt(v)}</span>
      </div>
      <div class="stat-bar">
        <span class="stat-fill ${betterThanAvg ? "is-above" : ""}" style="width:${Math.round(Math.max(0, Math.min(1, pos)) * 100)}%"></span>
        <span class="stat-avg-mark" style="left:${Math.round(Math.max(0, Math.min(1, avgPos)) * 100)}%" title="팀 평균"></span>
      </div>
      <div class="stat-foot">
        <span>팀 평균 ${fmt(avg)}</span>
        <span>${values.length}명 중 <strong>${rank}위</strong></span>
      </div>
    </div>
  `;
}

function renderPlayer(name) {
  const p = ROSTER.find((x) => x.name === name);
  if (!p) {
    app.innerHTML = `
      <section class="detail-view">
        <a class="back-link tap-wide" href="#/roster">← 로스터로</a>
        <h1>선수를 찾을 수 없어요</h1>
        <p class="hint">이름이 바뀌었거나 명단에서 빠진 선수일 수 있어요.</p>
      </section>`;
    return;
  }

  const pool = ROSTER.filter((x) => typeof x.games === "number");
  const hasStats = typeof p.games === "number";
  const strengths = hasStats
    ? PLAYER_STATS.filter((st) => {
        const vals = pool.map((q) => q[st.key]).filter((x) => typeof x === "number");
        if (typeof p[st.key] !== "number" || !vals.length) return false;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return st.lowerIsBetter ? p[st.key] < avg : p[st.key] > avg;
      }).map((st) => st.label)
    : [];

  app.innerHTML = `
    <section class="player-view">
      <a class="back-link tap-wide" href="#/roster">← 로스터로</a>
      <div class="player-head">
        ${jerseyHTML(p, "is-lg")}
        <h1>${escapeHtml(p.name)}${p.captain ? ` <span class="captain-tag">(C)</span>` : ""}</h1>
      </div>
      ${
        hasStats
          ? `<p class="hint">${p.games}경기 · 2026년 상반기(1~6월) 기록 기준 평균이에요.</p>
             ${
               p.games < SMALL_SAMPLE_GAMES
                 ? `<p class="hint player-caution">⚠️ 경기 수가 적어서(${p.games}경기) 순위나 평균 비교는 참고만 해주세요.</p>`
                 : ""
             }
             ${
               strengths.length
                 ? `<div class="player-strengths">
                      <span class="player-strengths-label">팀 평균보다 좋은 항목</span>
                      <div class="player-strength-chips">${strengths
                        .map((t) => `<span class="strength-chip">${t}</span>`)
                        .join("")}</div>
                    </div>`
                 : `<p class="hint">아직 팀 평균을 넘는 항목이 없어요.</p>`
             }
             <div class="stat-list">${PLAYER_STATS.map((st) => statLineHTML(p, st, pool)).join("")}</div>
             <p class="hint stat-legend">막대는 기록이 있는 ${pool.length}명 안에서의 위치이고, 세로선은 팀 평균이에요.</p>`
          : `<p class="hint">아직 기록지에 올라온 경기가 없어요. 기록이 쌓이면 여기에 나옵니다.</p>`
      }
    </section>
  `;
}

function renderRoster() {
  const highlights = computeHighlights();
  let sortIndex = 0;

  function render() {
    const sort = ROSTER_SORTS[sortIndex];
    const players = sortRoster(ROSTER, sort.key);

    app.innerHTML = `
      <section class="roster-view">
        <a class="back-link tap-wide" href="#/">← 홈으로</a>
        <h1>팀 로스터</h1>
        <p class="hint">혼(Spirit) 소속 선수 명단입니다. 스탯은 2026년 상반기(1~6월) 팀 기록 기준 평균이에요.</p>

        <div class="highlight-grid">
          ${highlights
            .map(
              (h, i) => `
              <div class="highlight-card"${i === STATS_DOOR_INDEX ? ` data-stats-door="1"` : ""}>
                <span class="highlight-label">${h.label}</span>
                <strong>${escapeHtml(h.player.name)}</strong>
                <span class="highlight-value">${h.value(h.player)}</span>
              </div>`
            )
            .join("")}
        </div>

        <div class="roster-sort">
          <span class="roster-sort-label">정렬</span>
          <div class="category-filter">
            ${ROSTER_SORTS.map(
              (o, i) =>
                `<button type="button" class="chip ${i === sortIndex ? "chip-active" : ""}" data-sort="${i}">${o.label}</button>`
            ).join("")}
          </div>
        </div>
        ${
          sort.key
            ? `<p class="hint roster-sort-note">위 ‘왕’ 카드는 ${HIGHLIGHT_MIN_GAMES}경기 이상 뛴 선수 중에서만 뽑아요. 아래 순서는 경기 수와 상관없이 ${sort.label} 평균이 높은 차례입니다.</p>`
            : ""
        }

        ${
          players.length
            ? `<div class="roster-grid">${players.map((p) => rosterCardHTML(p, sort.key)).join("")}</div>`
            : `<p class="hint">아직 등록된 선수 정보가 없어요.</p>`
        }
      </section>
    `;

    bindStatsDoor(app.querySelector("[data-stats-door]"));
    app.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sortIndex = Number(btn.dataset.sort);
        render();
      });
    });
  }

  render();
}

// 기록 정리 화면으로 가는 문. 승률왕 카드를 누르면 열린다.
// 메뉴에 내놓지 않은 건 기록 정리가 한 사람이 경기 뒤에 하는 일이라서다.
// 이름(김성훈)이 아니라 '승률왕 자리'에 건 이유는, 그 자리의 주인이 기록에 따라
// 바뀔 수 있기 때문이다 — 이름으로 걸면 어느 날 문이 사라진다.
const STATS_DOOR_INDEX = 3; // computeHighlights()의 🏆 승률왕

function bindStatsDoor(card) {
  if (!card) return;
  card.addEventListener("click", () => {
    location.hash = "#/stats";
  });
}

function renderStats() {
  app.innerHTML = `
    <section class="stats-view">
      <a class="back-link tap-wide" href="#/roster">← 로스터로</a>
      <h1>경기 기록 정리</h1>
      <p class="hint">기록지 사진을 올리면 <b>오늘 경기 결과</b>와 <b>누적 기록</b> 두 가지를 만들어줍니다.</p>
      <div id="stats-container"></div>
    </section>
  `;
  mountStatsPage(document.getElementById("stats-container"));
}

function renderTeamShuffle() {
  app.innerHTML = `
    <section class="shuffle-view">
      <a class="back-link tap-wide" href="#/">← 홈으로</a>
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
      <a class="back-link tap-wide" href="#/">← 홈으로</a>
      <h1>일정</h1>
      <p class="hint">날짜를 클릭하면 그 날의 일정을 볼 수 있어요.</p>
      <div id="calendar-container"></div>
    </section>
  `;
  mountCalendar(document.getElementById("calendar-container"));
}


function glossaryCardHTML(g) {
  const tactic = g.tactic ? getTacticById(g.tactic) : null;
  return `
    <article class="term-card">
      <div class="term-head">
        <h3>${escapeHtml(g.term)}</h3>
        ${g.en ? `<span class="term-en">${escapeHtml(g.en)}</span>` : ""}
      </div>
      ${g.when ? `<p class="term-when"><span>언제</span>${escapeHtml(g.when)}</p>` : ""}
      <p class="term-idea">${escapeHtml(g.idea)}</p>
      ${
        tactic
          ? `<a class="term-link" href="#/tactic/${tactic.id}">🏀 코트에서 보기 — ${escapeHtml(tactic.name)}</a>`
          : ""
      }
    </article>
  `;
}

function renderGlossary() {
  let query = "";
  let group = "전체";

  function render() {
    const q = query.trim().toLowerCase();
    const hit = (g) =>
      (group === "전체" || g.group === group) &&
      (!q || [g.term, g.en, g.when, g.idea, g.group].some((v) => (v || "").toLowerCase().includes(q)));
    const found = GLOSSARY.filter(hit);
    // 한 묶음만 골라 놓은 상태에서는 칩이 이미 그 이름을 말하고 있으니 제목을 또 쓰지 않는다.
    const showHeadings = group === "전체";

    app.innerHTML = `
      <section class="glossary-view">
        <a class="back-link tap-wide" href="#/">← 홈으로</a>
        <h1>용어 사전</h1>
        <p class="hint">경기 중에 나오는 콜과 용어를 모아뒀어요. 용어를 누르면 실제로 그 움직임이 나오는 전술로 갈 수 있어요.</p>
        <div class="list-controls">
          <input type="text" id="glossary-search" class="search-input" placeholder="용어 검색 (예: 블리츠, switch)" value="${escapeHtml(query)}" />
          <div class="category-filter">
            ${["전체", ...GLOSSARY_GROUPS]
              .map(
                (c) =>
                  `<button type="button" class="chip ${group === c ? "chip-active" : ""}" data-group="${escapeHtml(c)}">${escapeHtml(c)}</button>`
              )
              .join("")}
          </div>
        </div>
        ${
          found.length
            ? GLOSSARY_GROUPS.map((name) => {
                const list = found.filter((g) => g.group === name);
                if (!list.length) return "";
                return `
          ${showHeadings ? `<h2 class="section-title">${escapeHtml(name)}</h2>` : ""}
          <div class="term-grid">${list.map(glossaryCardHTML).join("")}</div>`;
              }).join("")
            : `<p class="hint">찾는 용어가 없어요. 팀에서 쓰는 말인데 여기 없으면 알려주세요.</p>`
        }
        <p class="hint glossary-footnote">
          픽앤롤 수비 콜과 매치업 용어는 <a href="#/tactic/man-to-man-defense">[규철] 맨투맨 디팬스</a>에 정리된 내용을 옮긴 거예요.
          뜻이 팀에서 쓰는 것과 다르면 알려주시면 고칠게요.
        </p>
      </section>
    `;

    const input = document.getElementById("glossary-search");
    input.addEventListener("input", (e) => {
      query = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const next = document.getElementById("glossary-search");
      next.focus();
      next.setSelectionRange(pos, pos);
    });

    app.querySelectorAll("[data-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        group = btn.dataset.group;
        render();
      });
    });
  }

  render();
}


function renderBoard() {
  app.innerHTML = `
    <section class="board-view">
      <a class="back-link tap-wide" href="#/">← 홈으로</a>
      <h1>작전판</h1>
      <p class="hint">저장된 전술과 별개로 즉석에서 배치를 옮겨보는 판이에요. 고친 내용은 이 브라우저에 그대로 남습니다.</p>
      <div id="board-root"></div>
    </section>
  `;
  mountBoard(document.getElementById("board-root"));
}

function renderNotFound() {
  app.innerHTML = `
    <section class="detail-view">
      <a class="back-link tap-wide" href="#/tactics">← 목록으로</a>
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
        <a class="back-link tap-wide" href="#/tactics">← 전술 목록으로</a>
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
        <button type="button" class="link-btn tap-wide" id="nt-clear-draft">이 초안 전체 삭제</button>
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
               <button type="button" class="link-btn tap-wide" id="scenario-delete">🗑 이 시나리오 삭제</button>
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

  // 이 브라우저에만 저장된 수정본을 원본 위에 얹는다.
  //
  // players 만 조건 없이 덮어쓰고 있었다. 그래서 저장된 수정본에 players 가 없으면
  // (예전 판에서 저장했거나, 저장소가 어긋났거나) tactic.players 가 undefined 가 되고
  // 곧바로 forEach 에서 터진다. 그러면 **화면이 통째로 안 그려지고**, 하필 그 화면에
  // 있는 「초기화」 단추까지 같이 사라져서 사용자가 빠져나올 방법이 없어진다.
  // 브라우저 저장소를 직접 지우는 것 말고는 답이 없는 막다른 길이다.
  //
  // 그래서 나머지 항목처럼 조건을 달고, 그러고도 모양이 이상하면 수정본을 통째로
  // 버리고 원본을 보여준다. 수정본 하나 잃는 것이 화면을 잃는 것보다 낫다.
  const override = getOverride(id);
  const tactic = cloneTactic(base);
  let brokenOverride = false;
  if (override) {
    if (Array.isArray(override.players)) tactic.players = override.players;
    else if (override.players !== undefined) brokenOverride = true;
    if (override.ball) tactic.ball = override.ball;
    if (Array.isArray(override.scenarios)) tactic.scenarios = override.scenarios;
    if (override.name) tactic.name = override.name;
    if (override.summary != null) tactic.summary = override.summary;
    if (override.description != null) tactic.description = override.description;
    if (!Array.isArray(tactic.players)) brokenOverride = true;
  }
  if (brokenOverride) {
    clearOverride(id);
    Object.assign(tactic, cloneTactic(base));
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
    hintEl.innerHTML = `이 브라우저에만 저장된 수정사항이 적용 중이에요. <button type="button" class="link-btn tap-wide" id="reset-btn">초기화</button>`;
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
    const allNames = ROSTER.map((p) => p.name);
    // 이름 시뮬레이션은 선택 기능인데 펼쳐두면 360px을 차지해서, 정작 보러 온 코트가
    // 항상 첫 화면 밖으로 밀렸다. 기본은 한 줄로 접어두고 필요할 때만 펼친다.
    // 이미 배정한 이름이 있으면 열어둬야 지금 적용 중인 걸 놓치지 않는다.
    const assignedCount = Object.values(simAssignment).filter(Boolean).length;
    return `
      <details class="tactic-sim-panel" ${assignedCount ? "open" : ""}>
        <summary class="tactic-sim-summary">
          <span>👤 선수 이름 넣어보기</span>
          ${assignedCount ? `<span class="tactic-sim-count">${assignedCount}명 배정됨</span>` : ""}
        </summary>
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
        <button type="button" class="link-btn tap-wide" id="sim-clear">배정 초기화</button>
      </details>
    `;
  }

  // 용어 사전처럼 설명이 긴 전술은 화면 두 개를 넘길 만큼 길어진다.
  // 넘칠 때만 접고, 짧으면 버튼도 만들지 않는다.
  function setupDescriptionToggle() {
    const el = document.getElementById("tactic-description-display");
    if (!el) return;
    document.querySelector(".description-toggle")?.remove();
    // 먼저 접어본 뒤 실제로 잘리는지 본다. 펼친 상태에서는 scrollHeight 와 clientHeight 가 같아서
    // 길이를 알 수 없다.
    el.classList.add("is-clamped");
    if (el.scrollHeight <= el.clientHeight + 4) {
      el.classList.remove("is-clamped");
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "description-toggle";
    btn.textContent = "▾ 설명 더 보기";
    btn.addEventListener("click", () => {
      const clamped = el.classList.toggle("is-clamped");
      btn.textContent = clamped ? "▾ 설명 더 보기" : "▴ 설명 접기";
      if (clamped) el.scrollIntoView({ block: "nearest" });
    });
    el.after(btn);
  }

  function renderShell() {
    app.innerHTML = `
      <section class="detail-view">
        <a class="back-link tap-wide" href="#/">← 목록으로</a>
        <div class="detail-top-row">
          <span class="badge ${badgeClassFor(tactic.category)}">${tactic.category}</span>
          <button type="button" class="link-btn tap-wide" id="copy-link-btn">🔗 링크 복사</button>
        </div>
        <h1 id="tactic-name-display">${escapeHtml(tactic.name)}</h1>
        <p class="summary" id="tactic-summary-display">${escapeHtml(tactic.summary)}</p>
        ${
          getOverride(id)
            ? `<p class="hint override-hint">이 브라우저에만 저장된 수정사항이 적용 중이에요. <button type="button" class="link-btn tap-wide" id="reset-btn">초기화</button></p>`
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

    setupDescriptionToggle();

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
               <button type="button" class="link-btn tap-wide" id="scenario-delete">🗑 이 시나리오 삭제</button>
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
      setupDescriptionToggle();
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
  } else if (hash === "#/roster" || hash === "#/stats") {
    active = "roster";
  } else if (hash === "#/team-shuffle") {
    active = "team-shuffle";
  } else if (hash === "#/schedule") {
    active = "schedule";
  } else if (hash === "#/board") {
    active = "board";
  }

  document.querySelectorAll(".utility-bar a[data-nav]").forEach((a) => {
    a.classList.toggle("is-active", a.dataset.nav === active);
  });
}

// 테마별 브라우저 상단바 색 (모바일에서 주소창까지 같이 물든다)
const THEME_BAR_COLOR = { dark: "#14102b", light: "#fff3dd" };

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_BAR_COLOR[theme]);
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    // 버튼에는 '지금 누르면 갈 곳'을 보여준다.
    btn.textContent = theme === "light" ? "🌙" : "☀️";
    btn.setAttribute("aria-label", theme === "light" ? "어두운 화면으로 전환" : "밝은 화면으로 전환");
  }
}

function initTheme() {
  applyTheme(currentTheme());
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = currentTheme() === "light" ? "dark" : "light";
    saveTheme(next);
    applyTheme(next);
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
  } else if (hash === "#/glossary") {
    renderGlossary();
  } else if (hash === "#/board") {
    renderBoard();
  } else if (hash.startsWith("#/player/")) {
    renderPlayer(decodeURIComponent(hash.slice("#/player/".length)));
  } else if (hash === "#/team-shuffle") {
    renderTeamShuffle();
  } else if (hash === "#/stats") {
    renderStats();
  } else {
    renderHome();
  }
}

// 화면 맨 아래 배포판 번호. 배포 워크플로가 <meta name="app-rev"> 에 값을 넣어 두면
// 그걸 그대로 보여준다. 값이 그대로 "dev" 면 로컬에서 직접 연 것이다.
//
// 화면마다 그리지 않고 #app 바깥의 <footer> 를 한 번만 채운다 — 어느 화면에서도
// 맨 아래에 있어야 하는데, 라우터가 #app 안을 통째로 갈아 끼우기 때문이다.
function showAppRev() {
  const slot = document.getElementById("app-rev");
  if (!slot) return;
  const rev = document.querySelector('meta[name="app-rev"]')?.content?.trim();
  slot.textContent = !rev || rev === "dev" ? "개발판" : `rev ${rev}`;
}

initTheme();
showAppRev();
window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", router);
