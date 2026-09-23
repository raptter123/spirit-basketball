// 경기 기록 — 코트를 눌러 이벤트로 쌓는다.
//
// 왜 이렇게 만드나
//   종이 기록지는 항목마다 칸이 따로 있어서, 한 장에 1,728칸이 생긴다. 사람이 느린 건
//   칠하는 일이 아니라 그 중에서 "김성훈 / 2점 / 후반 / 놓침" 칸을 **찾는** 일이다.
//   항목을 늘리면 칸이 수백 개 늘고 찾는 시간도 같이 는다.
//
//   여기서는 사건 하나를 그대로 적는다. "황규철이 저 자리에서 쏨, 안 들어감,
//   김성훈이 리바운드" 한 줄이면 시도·성공률·득점·리바운드가 동시에 채워진다.
//   항목을 늘려도 누르는 횟수가 안 는다. 그리고 좌표와 쿼터가 붙어 있으니
//   샷 차트와 쿼터별 기록은 따로 받지 않아도 공짜로 나온다.
//
// 화면 배치의 근거
//   자체전은 교체가 거의 없다. 코트 위 5명이 그대로 가므로 선수 버튼을 화면에
//   상주시킬 수 있고, 자리가 안 변하니 눈으로 찾지 않고 손이 기억한다. 그래서
//   "누가 쐈어?" 같은 단계 전환이 필요 없다 — 코트·선수·결과가 한 화면에 있다.
//   그 자리를 벌려고 코트는 백코트를 잘라냈다(아래 COURT_VIEW).
//
// 저장
//   이벤트 원본을 그대로 둔다. 합계만 저장하면 나중에 "3쿼터만" "골밑만" 을
//   영원히 못 뽑는다. 원본이 있으면 무엇이든 다시 계산된다.
import { ROSTER } from "./roster.js";
import { hasNumber } from "./jersey.js";
import {
  getRecordGame, saveRecordGame, clearRecordGame, getTeamBuilderDraft,
  getRecordArchive, archiveRecordGame, removeArchivedGame, clearRecordArchive,
} from "./storage.js";
import {
  효율, plusMinus, 팀지표, 경기요약, 밴드글, pct1, num1, 부호, MIN_POSS,
  슛모음, 슛쏜사람, 구역집계, 구역들,
} from "./record-stats.js";
import { CHART_VIEW, 차트속, 구역말 } from "./record-chart.js";

// 코트에서 슛이 일어나는 구역만 남긴다. 백코트는 비어 있어 자리만 차지한다.
const COURT_VIEW = "0 185 500 285";
// 골대와 3점 라인. courtMarkingsSVG 의 좌표와 같은 값이다 —
// 아크 "M 30 310 A 257 257" 의 중심을 풀면 (250, 442.8) 로 골대와 같은 자리다.
const RIM = { x: 250, y: 442 };
const THREE_R = 257;
const CORNER_X = 30;

export const TEAM_COLOR = ["#f97316", "#22c55e"];

/** 탭한 자리가 2점인가 3점인가. 코너는 아크가 아니라 직선이라 따로 본다. */
export function zoneOf(x, y) {
  if (y >= 310 && (x <= CORNER_X || x >= 500 - CORNER_X)) return 3;
  return Math.hypot(x - RIM.x, y - RIM.y) > THREE_R ? 3 : 2;
}

// 선수에게 붙는 이벤트. 코트를 안 눌러도 바로 찍을 수 있는 것들이다.
const SPOT_EVENTS = [
  { key: "ast", label: "어시" },
  // 공격·수비를 따로 둔다. 한 번은 규칙으로 자동으로 갈라 봤지만(직전 빗나간 슛이
  // 누구 것인지로), 기록자가 슛을 놓치면 물음이 뜨고 그동안 다른 걸 못 찍어서
  // 오히려 느려졌다. 두 번 누르던 것이 세 번이 되기도 했다. 버튼 둘이 제일 빠르다.
  { key: "rebO", label: "공격리바" },
  { key: "rebD", label: "수비리바" },
  { key: "stl", label: "스틸" },
  { key: "blk", label: "블락" },
  { key: "to", label: "턴오버" },
  { key: "pf", label: "파울" },
  { key: "ftm", label: "자유투○" },
  { key: "fta", label: "자유투✗" },
];

const EVENT_LABEL = {
  ast: "어시스트", reb: "리바운드", stl: "스틸", blk: "블락",
  to: "턴오버", pf: "파울", ftm: "자유투 ✓", fta: "자유투 ✗",
  rebO: "공격 리바운드", rebD: "수비 리바운드",
};

/** 직전에 빗나간 슛을 쏜 팀. 그 팀이 잡으면 공격 리바운드, 상대가 잡으면 수비다.
 *  고르는 것은 사람이 하고, 이 값은 안내줄에 곁들여 보여 주기만 한다 — 버튼을
 *  잘못 눌렀을 때 바로 알아채라고 두는 것이지 대신 정해 주는 것이 아니다.
 *
 *  null 이면 알 수 없다 — 직전 슛이 들어갔거나, 기록자가 슛을 놓쳤다. */
export function 직전슛팀(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "shot") return e.made ? null : e.team;
    if (e.type === "ftm") return null;
    if (e.type === "fta") return e.team;
  }
  return null;
}

// 선수 기록이 아니라 경기 진행을 적어 둔 줄. 합계에는 안 들어간다.
// 이벤트로 남기는 이유는 되돌리기로 취소할 수 있게 하기 위해서다.
const FLOW_TYPES = ["quarter", "sub"];

/** 쿼터 이름. 정규 쿼터를 넘어가면 연장으로 이어 센다. */
export function qLabel(q, quarters = 4) {
  return q > quarters ? `연장${q - quarters}` : `${q}쿼터`;
}

/** 선수 기록으로 센 이벤트 수. 쿼터 넘김·교체는 빼야 "몇 개를 적었나"가 맞는다. */
export function playCount(events) {
  return events.filter((e) => !FLOW_TYPES.includes(e.type)).length;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 이벤트 한 줄이 그 선수에게 몇 점인가. 점수는 슛과 자유투에서만 나온다. */
export function pointsOf(ev) {
  if (ev.type === "shot") return ev.made ? ev.pts : 0;
  if (ev.type === "ftm") return 1;
  return 0;
}

/** 이벤트 목록 → 팀 점수 [A, B]. */
export function scoreOf(events) {
  const s = [0, 0];
  for (const ev of events) s[ev.team] += pointsOf(ev);
  return s;
}

/** 이벤트 목록 → 선수별 합계. 종이 기록지가 받던 항목을 전부 되살린다.
 *  events 를 따로 주면 그 범위만 센다 — 쿼터별 표가 이걸로 나온다. */
export function boxScore(game, events = game.events) {
  const rows = [];
  game.teams.forEach((team, ti) => {
    for (const p of team.players) {
      const mine = events.filter((e) => e.team === ti && e.player === p.name);
      const shots = mine.filter((e) => e.type === "shot");
      const n = (t) => mine.filter((e) => e.type === t).length;
      const p2 = shots.filter((e) => e.pts === 2);
      const p3 = shots.filter((e) => e.pts === 3);
      rows.push({
        team: ti, name: p.name, number: p.number,
        pts: mine.reduce((a, e) => a + pointsOf(e), 0),
        p2m: p2.filter((e) => e.made).length, p2a: p2.length,
        p3m: p3.filter((e) => e.made).length, p3a: p3.length,
        ftm: n("ftm"), fta: n("ftm") + n("fta"),
        rebO: n("rebO"), rebD: n("rebD"),
        // 공수를 안 가른 옛 기록("reb")도 합계에는 그대로 들어간다.
        // 보관함에 이미 들어 있는 경기의 숫자가 이 변경으로 줄어들면 안 된다.
        reb: n("reb") + n("rebO") + n("rebD"),
        ast: n("ast"), stl: n("stl"), blk: n("blk"), to: n("to"), pf: n("pf"),
      });
    }
  });
  return rows;
}

/** 보관함 목록에 한 줄로 적을 말. */
export function 한줄요약(game) {
  const [a, b] = scoreOf(game.events);
  return `${game.date} · ${game.teams[0]?.name || "A팀"} ${a} : ${b} ${game.teams[1]?.name || "B팀"} · 기록 ${playCount(game.events)}개`;
}

/** 내보내기 코드는 버튼을 누를 때만 불러온다. 정적으로 import 하면 기록 화면이
 *  app.js 에 실려 있는 탓에 엑셀을 안 받는 사람까지 같이 내려받는다.
 *  재 보니 첫 화면에서 빠지고, 누르면 그때 6.1KB 를 받는다. */
async function 엑셀내려받기(game, btn) {
  const 원래 = btn.textContent;
  btn.disabled = true;
  btn.textContent = "만드는 중…";
  try {
    const { 엑셀받기 } = await import("./record-export.js");
    await 엑셀받기(game);
    btn.textContent = "받았어요 ✓";
  } catch (err) {
    btn.textContent = "엑셀 받기";
    alert(`엑셀을 만들지 못했어요.\n${err?.message || err}`);
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = 원래; }, 2500);
  }
}

/** 팀 편성 초안({assignments:{이름:팀번호}, gameDate})에서 두 팀을 꺼낸다.
 *  3팀으로 짰으면 앞의 두 팀만 쓴다 — 한 경기는 두 팀이 뛴다. */
export function teamsFromDraft(draft) {
  if (!draft?.assignments) return null;
  const teams = [[], []];
  for (const [name, ti] of Object.entries(draft.assignments)) {
    if (ti === 0 || ti === 1) teams[ti].push(name);
  }
  if (!teams[0].length || !teams[1].length) return null;
  return {
    gameDate: draft.gameDate,
    teams: teams.map((names, i) => ({
      name: `${"AB"[i]}팀`,
      players: names.sort().map((n) => ROSTER.find((r) => r.name === n) || { name: n }),
    })),
  };
}

function newGame(src) {
  const teams = [0, 1].map((i) => {
    const players = src?.teams?.[i]?.players || [];
    return {
      name: src?.teams?.[i]?.name || `${"AB"[i]}팀`,
      players,
      // 교체가 드무니 앞 5명을 코트에 올려 두고 시작한다. 5명 미만이면 전원.
      onCourt: players.slice(0, 5).map((p) => p.name),
    };
  });
  return { date: src?.gameDate || todayStr(), quarters: 4, q: 1, teams, events: [], startedAt: Date.now() };
}

// 경기 중에는 로고·메뉴·제목을 접는다.
//
// 기록 UI 자체는 390px 화면에 705px 로 들어가는데, 그 위아래 껍데기가 332px
// (헤더 72 + 메뉴줄 140 + 제목 87 + 홈으로 33) 을 먹어 스크롤이 생겼다. 경기를
// 보면서 누르는 중에 스크롤이 생기면 그때마다 코트에서 눈을 떼야 한다.
// 메뉴는 경기 중에 쓸 일이 없고, 오히려 잘못 눌러 화면이 날아갈 위험만 있다.
function setFocus(on) {
  document.body.classList.toggle("rec-focus", !!on);
}

export function mountRecord(container) {
  let game = getRecordGame();
  // 고르는 중인 것 — 코트를 눌렀거나 선수를 눌렀거나. 둘 다 차면 결과를 묻는다.
  let pending = null;   // { x, y, pts } | null
  let armed = null;     // { team, player } | null  (선수를 먼저 눌렀을 때)
  let spot = null;      // SPOT_EVENTS 의 key — 다음에 누르는 선수에게 붙는다
  let subIn = null;     // { team, name } | null   — 교체로 들어올 사람
  let screen = game ? "live" : "setup";

  function save() {
    if (game) saveRecordGame(game);
  }

  // ── 설정 화면 ────────────────────────────────────────────

  /** 지난 경기 한 줄. 목록에서 찾는 단서는 "언제 · 몇 대 몇 · 누가 잘했나" 셋이라
   *  그 셋을 먼저 두고, 누르는 것들은 아래 줄로 내린다. */
  function 경기줄(g) {
    const s = 경기요약(g);
    const 결과 = s.이긴팀 === -1 ? "무" : `${s.이름[s.이긴팀]} 승`;
    return `
      <div class="rec-arch-row">
        <div class="rec-arch-when">${esc(s.날짜)}</div>
        <div class="rec-arch-mid">
          <div class="rec-arch-score">
            ${[0, 1].map((i) => `
              <span class="rec-arch-side${s.이긴팀 === i ? " win" : ""}" data-t="${i}">
                <span class="nm">${esc(s.이름[i])}</span><b>${s.점수[i]}</b>
              </span>`).join(`<span class="rec-arch-colon">:</span>`)}
          </div>
          <div class="rec-arch-sub">
            <span>${qLabel(s.마지막쿼터, g.quarters)}까지 · 기록 ${s.기록수}개</span>${
              s.최다 ? ` <span>· 최다 <b>${esc(s.최다.name)} ${s.최다.pts}점</b></span>` : ""}
          </div>
        </div>
        <div class="rec-arch-badge ${s.이긴팀 === -1 ? "tie" : ""}">${esc(결과)}</div>
        <div class="rec-arch-btns">
          <button type="button" class="btn-sm" data-arch-open="${g.startedAt}">열기</button>
          <button type="button" class="btn-sm" data-arch-xlsx="${g.startedAt}">엑셀</button>
          <button type="button" class="btn-sm rec-arch-del" data-arch-del="${g.startedAt}">지우기</button>
        </div>
      </div>`;
  }

  function renderSetup() {
    const fromDraft = teamsFromDraft(getTeamBuilderDraft());
    const 있음 = !!fromDraft;
    const 보관함 = getRecordArchive();
    container.innerHTML = `
      <div class="rec-setup">
        <p class="hint">경기 시작 전에 뛰는 사람을 정해주세요. 팀 편성 화면에서 팀을 짰다면 그대로 가져옵니다.</p>
        ${있음
          ? `<div class="rec-from-draft">
               <b>방금 짠 팀이 있어요</b>
               <div class="rec-draft-teams">${fromDraft.teams.map((t, i) =>
                 `<span class="rec-draft-team" data-t="${i}">${esc(t.name)} ${t.players.length}명</span>`).join("")}</div>
               <button type="button" class="btn btn-primary" id="rec-use-draft">이 팀으로 시작</button>
             </div>`
          : `<p class="hint rec-nodraft">팀 편성 화면에서 팀을 먼저 짜면 여기로 바로 넘어옵니다.</p>`}
        <div class="rec-manual">
          <h3>직접 고르기</h3>
          <p class="hint">A팀과 B팀을 번갈아 채웁니다. 이름을 누르면 다음 팀으로 들어갑니다.</p>
          <div class="rec-pick-teams">
            ${[0, 1].map((i) => `
              <div class="rec-pick-col" data-t="${i}">
                <b>${i ? "B팀" : "A팀"}</b>
                <div class="rec-pick-list" data-team="${i}"></div>
              </div>`).join("")}
          </div>
          <div class="rec-roster">
            ${ROSTER.map((p) => `
              <button type="button" class="rec-rchip" data-name="${esc(p.name)}">
                ${hasNumber(p) ? `<span class="no">${p.number}</span>` : ""}${esc(p.name)}
              </button>`).join("")}
          </div>
          <button type="button" class="btn btn-primary" id="rec-start" disabled>경기 시작</button>
        </div>
        ${보관함.length ? `
          <div class="rec-archive">
            <div class="rec-arch-head">
              <h3>지난 경기 ${보관함.length}개</h3>
              <button type="button" class="btn-sm rec-arch-del" id="rec-arch-clear">전부 지우기</button>
            </div>
            <p class="hint">기록 ${보관함.reduce((a, g) => a + playCount(g.events), 0)}개가 쌓였어요.
              이 기기에만 남아 있고, 최근 20경기까지 보관해요 — 오래된 것부터 지워지니
              남길 경기는 엑셀로 받아 두세요.</p>
            ${보관함.map((g) => 경기줄(g)).join("")}
          </div>` : ""}
      </div>
    `;

    const picked = [[], []];
    let next = 0;
    const 다시그리기 = () => {
      for (const i of [0, 1]) {
        container.querySelector(`.rec-pick-list[data-team="${i}"]`).innerHTML =
          picked[i].map((n) => `<button type="button" class="rec-picked" data-drop="${esc(n)}">${esc(n)} ✕</button>`).join("")
          || `<span class="rec-empty">아직 없음</span>`;
      }
      for (const el of container.querySelectorAll(".rec-rchip")) {
        el.classList.toggle("is-used", picked.some((t) => t.includes(el.dataset.name)));
      }
      const btn = container.querySelector("#rec-start");
      btn.disabled = picked[0].length < 1 || picked[1].length < 1;
      btn.textContent = btn.disabled ? "양 팀을 채워주세요" : `경기 시작 (${picked[0].length} vs ${picked[1].length})`;
    };

    // 위임 핸들러는 container 가 아니라 방금 만든 .rec-setup 에 건다.
    // container 는 화면을 다시 그려도 그대로라, 거기에 걸면 renderSetup 이 불릴 때마다
    // 핸들러가 한 겹씩 쌓인다. 그러면 옛 핸들러가 옛 picked 배열을 새 화면에 써서
    // 고른 사람이 되살아난다. 새로 만든 요소에 걸면 옛 것은 요소와 함께 사라진다.
    container.querySelector(".rec-setup").addEventListener("click", (e) => {
      const chip = e.target.closest(".rec-rchip");
      if (chip) {
        const n = chip.dataset.name;
        if (picked.some((t) => t.includes(n))) return;
        picked[next].push(n);
        next = next ? 0 : 1;
        다시그리기();
        return;
      }
      const drop = e.target.closest("[data-drop]");
      if (drop) {
        for (const t of picked) {
          const i = t.indexOf(drop.dataset.drop);
          if (i >= 0) t.splice(i, 1);
        }
        다시그리기();
        return;
      }

      const 찾기 = (el, key) => 보관함.find((g) => String(g.startedAt) === el.dataset[key]);
      const 열기 = e.target.closest("[data-arch-open]");
      if (열기) {
        // 보관함에서 꺼내 온 것도 기록 중인 경기와 같은 자리에 올린다.
        // 그래야 '계속 기록하기' 로 이어서 적을 수 있다.
        game = 찾기(열기, "archOpen");
        if (!game) return;
        save();
        screen = "done";
        render();
        return;
      }
      const 엑셀 = e.target.closest("[data-arch-xlsx]");
      if (엑셀) {
        const g = 찾기(엑셀, "archXlsx");
        if (g) 엑셀내려받기(g, 엑셀);
        return;
      }
      if (e.target.closest("#rec-arch-clear")) {
        // 되돌릴 수 없으므로 몇 개가 사라지는지 숫자로 못박아 묻는다.
        const 말 = `지난 경기 ${보관함.length}개를 전부 지울까요?\n되돌릴 수 없어요.\n\n`
          + `남길 경기가 있으면 먼저 엑셀로 받아 두세요.`;
        if (!confirm(말)) return;
        clearRecordArchive();
        render();
        return;
      }
      const 지우기 = e.target.closest("[data-arch-del]");
      if (지우기) {
        const g = 찾기(지우기, "archDel");
        if (!g || !confirm(`${한줄요약(g)}\n\n이 경기를 보관함에서 지울까요? 되돌릴 수 없어요.`)) return;
        removeArchivedGame(g.startedAt);
        render();
      }
    });

    container.querySelector("#rec-start").addEventListener("click", () => {
      game = newGame({ teams: picked.map((names, i) => ({
        name: i ? "B팀" : "A팀",
        players: names.map((n) => ROSTER.find((r) => r.name === n) || { name: n }),
      })) });
      save();
      screen = "live";
      render();
    });

    const use = container.querySelector("#rec-use-draft");
    if (use) use.addEventListener("click", () => {
      game = newGame(fromDraft);
      save();
      screen = "live";
      render();
    });

    다시그리기();
  }

  // ── 입력 화면 ────────────────────────────────────────────
  function playerChip(ti, p) {
    const on = armed && armed.team === ti && armed.player === p.name;
    return `<button type="button" class="rec-pchip${on ? " is-armed" : ""}" data-team="${ti}" data-player="${esc(p.name)}">
      <span class="no">${hasNumber(p) ? p.number : "–"}</span><span class="nm">${esc(p.name)}</span>
    </button>`;
  }

  function shotsSVG() {
    return game.events.filter((e) => e.type === "shot").map((e) =>
      e.made
        ? `<circle class="rec-shot-made" cx="${e.x}" cy="${e.y}" r="7" data-t="${e.team}" />`
        : `<path class="rec-shot-miss" d="M ${e.x - 6} ${e.y - 6} L ${e.x + 6} ${e.y + 6} M ${e.x + 6} ${e.y - 6} L ${e.x - 6} ${e.y + 6}" data-t="${e.team}" />`
    ).join("");
  }

  function 안내글() {
    if (subIn) return `${subIn.name} 넣기 — 누가 나가?`;
    if (spot === "rebO" || spot === "rebD") {
      // 직전에 빗나간 슛이 누구 것인지 곁들여 준다. 버튼을 잘못 골랐으면 여기서 보인다.
      const 쏜팀 = 직전슛팀(game.events);
      const 곁 = 쏜팀 == null ? "" : ` (직전 슛은 ${game.teams[쏜팀].name})`;
      return `${EVENT_LABEL[spot]} — 누구?${곁}`;
    }
    if (spot) return `${EVENT_LABEL[spot]} — 누구?`;
    if (pending && armed) return "들어갔어?";
    if (pending) return `${pending.pts}점 자리 — 누가 쐈어?`;
    if (armed) return "슛한 자리를 누르거나, 아래에서 골라";
    return "슛한 자리를 눌러";
  }

  function 최근글() {
    const last = game.events.slice(-2).reverse();
    if (!last.length) return `<span class="rec-none">아직 기록이 없어요</span>`;
    return last.map((e, i) => {
      const 머리 = i ? "그 앞 " : "방금 ";
      // 쿼터 넘김·교체는 선수 기록이 아니라 진행이라 문장이 다르다.
      if (e.type === "quarter") return `${머리}<b>${qLabel(e.to, game.quarters)} 시작</b>`;
      if (e.type === "sub") {
        return `${머리}<b>${esc(e.player)} 들어감${e.out ? ` · ${esc(e.out)} 나감` : ""}</b>`;
      }
      const 말 = e.type === "shot" ? `${e.pts}점 ${e.made ? "✓" : "✗"}` : EVENT_LABEL[e.type];
      return `${머리}<b>${esc(e.player)} ${말}</b>`;
    }).join("<br />");
  }

  function renderLive() {
    const [sa, sb] = scoreOf(game.events);
    const onCourt = game.teams.map((t) =>
      t.players.filter((p) => t.onCourt.includes(p.name)));
    const bench = game.teams.map((t) =>
      t.players.filter((p) => !t.onCourt.includes(p.name)));

    container.innerHTML = `
      <div class="rec-live">
        <div class="rec-top">
          <span class="rec-score">
            <span data-t="0">${esc(game.teams[0].name)}</span>
            <b data-t="0">${sa}</b><span class="rec-colon">:</span>
            <b data-t="1">${sb}</b>
            <span data-t="1">${esc(game.teams[1].name)}</span>
          </span>
          <button type="button" class="rec-qbtn" id="rec-q">
            <b>${qLabel(game.q, game.quarters)}</b>
            <span>▸ ${qLabel(game.q + 1, game.quarters)}로</span>
          </button>
          <a class="rec-exit" href="#/" title="홈으로">✕</a>
        </div>

        <div class="rec-court">
          <svg viewBox="${COURT_VIEW}" id="rec-court-svg">
            <rect class="court-boundary" x="10" y="185" width="480" height="275" rx="14" />
            <rect class="paint-fill" x="170" y="270" width="160" height="190" />
            <rect class="court-line" x="170" y="270" width="160" height="190" fill="none" />
            <circle class="court-line" cx="250" cy="270" r="60" />
            <path class="court-line" d="M 210 442 A 40 40 0 0 1 290 442" />
            <path class="court-line" d="M 30 310 L 30 460" />
            <path class="court-line" d="M 470 310 L 470 460" />
            <path class="court-line" d="M 30 310 A 257 257 0 0 1 470 310" />
            <line class="court-line" x1="215" y1="428" x2="285" y2="428" />
            <circle class="rim" cx="250" cy="442" r="9" />
            ${shotsSVG()}
            ${pending ? `<circle class="rec-shot-live" cx="${pending.x}" cy="${pending.y}" r="11" />
              <text class="rec-zone" x="${Math.min(Math.max(pending.x, 60), 440)}" y="${pending.y - 24}">${pending.pts}점</text>` : ""}
          </svg>
          <div class="rec-tip">${안내글()}</div>
        </div>

        <div class="rec-side">
          ${game.teams.map((t, ti) => `
            <div class="rec-team-row" data-t="${ti}">
              <span class="rec-team-tag">${esc(t.name)}</span>
              ${onCourt[ti].map((p) => playerChip(ti, p)).join("")}
            </div>`).join("")}

          ${bench.some((b) => b.length) ? `
            <details class="rec-bench">
              <summary>벤치 ${bench.flat().length}명 · 교체</summary>
              <div class="rec-bench-body">
                ${game.teams.map((t, ti) => bench[ti].length ? `
                  <div class="rec-bench-team" data-t="${ti}">
                    <b>${esc(t.name)}</b>
                    ${bench[ti].map((p) => `<button type="button" class="rec-sub" data-team="${ti}" data-in="${esc(p.name)}">${esc(p.name)} 넣기</button>`).join("")}
                  </div>` : "").join("")}
                <p class="hint">넣을 사람을 누른 뒤, 뺄 사람을 위에서 누르세요.</p>
              </div>
            </details>` : ""}

          <div class="rec-act">
            <button type="button" class="rec-rbtn made" id="rec-made" ${pending && armed ? "" : "disabled"}>✓ 성공</button>
            <button type="button" class="rec-rbtn miss" id="rec-miss" ${pending && armed ? "" : "disabled"}>✗ 실패</button>
          </div>

          <div class="rec-events">
            ${SPOT_EVENTS.map((e) =>
              `<button type="button" class="rec-ebtn${spot === e.key ? " is-armed" : ""}" data-spot="${e.key}">${e.label}</button>`).join("")}
          </div>
        </div>

        <div class="rec-log">
          <button type="button" class="rec-undo" id="rec-undo" ${game.events.length ? "" : "disabled"}>↩ 되돌리기</button>
          <div class="rec-last">${최근글()}</div>
          <div class="rec-n">이번 경기<br /><b>${playCount(game.events)}</b>번</div>
        </div>

        <div class="rec-bottom">
          <button type="button" class="btn" id="rec-finish">결과 보기</button>
          <button type="button" class="btn btn-danger" id="rec-scrap">기록 버리기</button>
        </div>
      </div>
    `;
    wireLive();
  }

  function 코트좌표(svg, ev) {
    const r = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = COURT_VIEW.split(" ").map(Number);
    const x = vx + ((ev.clientX - r.left) / r.width) * vw;
    const y = vy + ((ev.clientY - r.top) / r.height) * vh;
    return { x: Math.round(Math.min(Math.max(x, 14), 486)), y: Math.round(Math.min(Math.max(y, 190), 456)) };
  }

  function 이벤트추가(ev) {
    game.events.push({ t: Date.now(), q: game.q, ...ev });
    save();
  }

  function wireLive() {
    const svg = container.querySelector("#rec-court-svg");
    svg.addEventListener("click", (e) => {
      const { x, y } = 코트좌표(svg, e);
      pending = { x, y, pts: zoneOf(x, y) };
      spot = null;
      renderLive();
    });

    for (const el of container.querySelectorAll(".rec-pchip")) {
      el.addEventListener("click", () => {
        const team = Number(el.dataset.team);
        const player = el.dataset.player;
        if (subIn) {
          if (subIn.team !== team) return;   // 다른 팀 사람과는 안 바꾼다
          const t = game.teams[team];
          t.onCourt = t.onCourt.map((n) => (n === player ? subIn.name : n));
          이벤트추가({ type: "sub", team, player: subIn.name, out: player });
          subIn = null;
          renderLive();
          return;
        }
        if (spot) {
          이벤트추가({ type: spot, team, player });
          spot = null;
          armed = null;
          renderLive();
          return;
        }
        armed = armed && armed.team === team && armed.player === player ? null : { team, player };
        renderLive();
      });
    }

    for (const el of container.querySelectorAll("[data-spot]")) {
      el.addEventListener("click", () => {
        spot = spot === el.dataset.spot ? null : el.dataset.spot;
        renderLive();
      });
    }

    const 슛기록 = (made) => {
      if (!pending || !armed) return;
      이벤트추가({ type: "shot", team: armed.team, player: armed.player,
        x: pending.x, y: pending.y, pts: pending.pts, made });
      pending = null;
      armed = null;
      renderLive();
    };
    const 짝 = [["#rec-made", () => 슛기록(true)], ["#rec-miss", () => 슛기록(false)]];
    for (const [sel, fn] of 짝) {
      const el = container.querySelector(sel);
      if (el) el.addEventListener("click", fn);
    }

    container.querySelector("#rec-undo").addEventListener("click", () => {
      const 지운것 = game.events.pop();
      // 진행 이벤트는 화면 상태까지 같이 되돌려야 한다. 줄만 지우면
      // 쿼터와 코트 위 명단이 취소한 뒤의 값으로 남는다.
      if (지운것?.type === "quarter") {
        game.q = 지운것.from;
      } else if (지운것?.type === "sub") {
        const t = game.teams[지운것.team];
        if (지운것.out) t.onCourt = t.onCourt.map((n) => (n === 지운것.player ? 지운것.out : n));
        else t.onCourt = t.onCourt.filter((n) => n !== 지운것.player);
      }
      pending = null; armed = null; spot = null; subIn = null;
      save();
      renderLive();
    });

    container.querySelector("#rec-q").addEventListener("click", () => {
      // 4쿼터에서 1쿼터로 되돌아가면, 그 뒤에 찍는 기록이 1쿼터에 섞여 들어가
      // 쿼터별 집계가 조용히 망가진다. 그래서 되돌아가지 않고 연장으로 이어 센다.
      // 잘못 눌렀으면 되돌리기로 취소한다.
      이벤트추가({ type: "quarter", from: game.q, to: game.q + 1 });
      game.q += 1;
      pending = null; armed = null; spot = null; subIn = null;
      save();
      renderLive();
    });

    for (const el of container.querySelectorAll(".rec-sub")) {
      el.addEventListener("click", () => {
        const ti = Number(el.dataset.team);
        const 넣을사람 = el.dataset.in;
        const t = game.teams[ti];
        // 코트 위가 5명 미만이면 그냥 넣고, 아니면 뺄 사람을 고르게 한다.
        if (t.onCourt.length < 5) {
          t.onCourt.push(넣을사람);
          이벤트추가({ type: "sub", team: ti, player: 넣을사람, inOut: "in" });
          save();
        } else {
          // 자리가 없으면 뺄 사람을 고르게 한다. 다음에 누르는 그 팀 선수가 나간다.
          subIn = { team: ti, name: 넣을사람 };
          armed = null; pending = null; spot = null;
        }
        renderLive();
      });
    }

    container.querySelector("#rec-finish").addEventListener("click", () => {
      // 결과 화면에 들어오는 순간 보관함에 넣는다. 엑셀을 못 받고 화면을 닫거나
      // '새 경기' 를 눌러도 기록이 남아 있어야 한다.
      archiveRecordGame(game);
      screen = "done";
      render();
    });
    container.querySelector("#rec-scrap").addEventListener("click", () => {
      if (!confirm("이번 경기 기록을 전부 지울까요? 되돌릴 수 없어요.")) return;
      // 버리기는 보관함에서도 뺀다. 지웠는데 목록에 남아 있으면 지운 게 아니다.
      removeArchivedGame(game.startedAt);
      clearRecordGame();
      game = null;
      screen = "setup";
      render();
    });
  }

  /** 밴드용 결과 이미지. 표를 그림으로 그리는 코드라 무거우므로 누를 때만 불러온다. */
  async function 결과이미지받기버튼(btn) {
    const 원래 = btn.textContent;
    btn.disabled = true;
    btn.textContent = "만드는 중…";
    try {
      const { 결과이미지받기 } = await import("./record-image.js");
      // 샷 차트는 화면에서 고른 범위를 그대로 따른다 — 누적으로 보고 있었으면 누적으로 뽑힌다.
      await 결과이미지받기(game, 차트경기들());
      btn.textContent = "받았어요 ✓";
    } catch (err) {
      alert(`이미지를 만들지 못했어요.\n${err?.message || err}`);
      btn.textContent = 원래;
    } finally {
      btn.disabled = false;
      setTimeout(() => { btn.textContent = 원래; }, 2500);
    }
  }

  // ── 결과 화면 ────────────────────────────────────────────
  /** 실제로 기록이 찍힌 마지막 쿼터. 4쿼터를 다 안 했는데 "4쿼터" 라고 쓰면 거짓말이 된다. */
  function 마지막쿼터() {
    return game.events.reduce((m, e) => Math.max(m, e.q || 1), game.q);
  }

  // ── 샷 차트 ──────────────────────────────────────────────
  // 화면 전체를 다시 그리지 않고 이 칸만 갈아 끼운다. 선수를 바꿀 때마다 결과 표까지
  // 다시 그리면 보던 자리에서 화면이 튄다.
  let 차트대상 = null;   // null = 전체, 아니면 선수 이름
  let 차트누적 = false;  // 보관함에 쌓인 경기를 같이 볼 것인가

  /** 차트가 볼 경기 목록. 누적이면 보관함을 얹되, 지금 경기가 이미 보관함에
   *  들어가 있으면(결과 화면에 들어오는 순간 들어간다) 두 번 세지 않는다. */
  function 차트경기들() {
    if (!차트누적) return [game];
    const 보관 = getRecordArchive().filter((g) => g.startedAt !== game.startedAt);
    return [game, ...보관];
  }

  /** 차트 밑에 붙는 한 문장. 조각을 템플릿 안에서 이으면 빈 조각 자리에 줄바꿈이
   *  남아 "슛 13/22 ." 처럼 마침표가 떠 버리므로 여기서 미리 이어 둔다. */
  function 안내문(들어간것, 총시도, 경기수) {
    const 누구 = 차트대상 ? `<b>${esc(차트대상)}</b>` : "양 팀 전부";
    const 범위 = 차트누적 ? ` · ${경기수}경기 누적` : "";
    const 적음 = 총시도 && 총시도 < 20
      ? ` 슛이 ${총시도}개뿐이라 "여기서 잘 들어간다" 를 말하기엔 일러요 — 경기가 쌓이면 뚜렷해져요.`
      : "";
    return `● 들어간 슛 · ✕ 빗나간 슛. ${누구} — 슛 ${들어간것}/${총시도}${범위}.${적음}`;
  }

  function renderChart() {
    const 칸 = container.querySelector("#rec-chart");
    if (!칸) return;
    const 경기들 = 차트경기들();
    const 사람들 = 슛쏜사람(경기들);
    // 고르고 있던 사람이 이 범위에 슛이 없으면 전체로 되돌린다.
    if (차트대상 && !사람들.some((p) => p.name === 차트대상)) 차트대상 = null;

    const shots = 슛모음(경기들, 차트대상);
    const z = 구역집계(shots);
    const 총시도 = 구역들.reduce((a, k) => a + z[k].a, 0);
    const 들어간것 = shots.filter((s) => s.made).length;
    const 누적가능 = getRecordArchive().some((g) => g.startedAt !== game.startedAt);

    칸.innerHTML = `
      <div class="rec-chart">
        ${누적가능 ? `
          <div class="rec-chart-scope">
            <button type="button" class="rec-chip${차트누적 ? "" : " on"}" data-scope="one">이 경기</button>
            <button type="button" class="rec-chip${차트누적 ? " on" : ""}" data-scope="all">지난 경기까지 전부 (${경기들.length}경기)</button>
          </div>` : ""}

        <div class="rec-chart-who">
          <button type="button" class="rec-chip${차트대상 ? "" : " on"}" data-who="">전체</button>
          ${사람들.map((p) => `
            <button type="button" class="rec-chip${차트대상 === p.name ? " on" : ""}" data-who="${esc(p.name)}">
              ${esc(p.name)} <span>${p.m}/${p.a}</span>
            </button>`).join("")}
        </div>

        <div class="rec-chart-court">
          <svg viewBox="${CHART_VIEW.x} ${CHART_VIEW.y} ${CHART_VIEW.w} ${CHART_VIEW.h}"
               id="rec-chart-svg" role="img"
               aria-label="${esc(차트대상 || "전체")} 슛 ${들어간것}/${총시도}">
            ${차트속(shots)}
          </svg>
          ${총시도 ? "" : `<p class="rec-chart-none">아직 슛 기록이 없어요</p>`}
        </div>

        <div class="rec-chart-zones">
          ${구역들.map((k) => {
            const m = 구역말(z[k]);
            const 몫 = 총시도 ? Math.round((z[k].a / 총시도) * 100) : 0;
            // 몫을 같은 줄에 붙이면 390px 에서 "시도의 45%" 가 접혀 칸 높이가 들쭉날쭉해진다.
            return `
              <div class="rec-chart-zone">
                <b>${m.율}</b>
                <span class="nm">${k}</span>
                <span class="sub">${m.몫}</span>
                <span class="share">${z[k].a ? `시도 ${몫}%` : "&nbsp;"}</span>
                <i style="width:${몫}%"></i>
              </div>`;
          }).join("")}
        </div>

        <p class="hint">${안내문(들어간것, 총시도, 경기들.length)}</p>

      </div>`;

    for (const el of 칸.querySelectorAll("[data-scope]")) {
      el.addEventListener("click", () => { 차트누적 = el.dataset.scope === "all"; renderChart(); });
    }
    for (const el of 칸.querySelectorAll("[data-who]")) {
      el.addEventListener("click", () => { 차트대상 = el.dataset.who || null; renderChart(); });
    }
  }

  function renderDone() {
    const rows = boxScore(game);
    const [sa, sb] = scoreOf(game.events);
    const pm = plusMinus(game);
    const 팀 = 팀지표(game);
    const col = (r) => {
      const e = 효율(r);
      const p = pm[`${r.team}|${r.name}`] ?? 0;
      return `
      <tr>
        <td class="rec-bs-name">${esc(r.name)}</td>
        <td><b>${r.pts}</b></td>
        <td>${r.p2m}/${r.p2a}</td><td>${r.p3m}/${r.p3a}</td><td>${r.ftm}/${r.fta}</td>
        <td>${r.reb}${r.rebO + r.rebD ? ` <span class="rec-bs-sub">(${r.rebO}/${r.rebD})</span>` : ""}</td>
        <td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${r.to}</td><td>${r.pf}</td>
        <td class="rec-bs-adv">${pct1(e.efg)}</td>
        <td class="rec-bs-adv">${pct1(e.ts)}</td>
        <td class="rec-bs-adv">${e.astTo == null ? "–" : num1(e.astTo)}</td>
        <td class="rec-bs-adv ${p > 0 ? "up" : p < 0 ? "down" : ""}">${부호(p)}</td>
      </tr>`;
    };

    // 100 포제션당 득점·실점. 박스스코어가 "무엇을 했나" 라면 이쪽은 "얼마나 잘했나" 다.
    const 팀카드 = (ti) => {
      const t = 팀[ti];
      return `
        <div class="rec-adv-card" data-t="${ti}">
          <div class="rec-adv-head">
            <span class="rec-adv-team">${esc(game.teams[ti].name)}</span>
            <span class="rec-adv-score">${[sa, sb][ti]}점 · ${t.poss.toFixed(1)}포제션</span>
          </div>
          <div class="rec-adv-rtg">
            <div><b>${num1(t.ortg)}</b><span>공격 ORtg</span></div>
            <div><b>${num1(t.drtg)}</b><span>수비 DRtg</span></div>
          </div>
          <div class="rec-adv-net ${t.net > 0 ? "up" : t.net < 0 ? "down" : ""}">
            ${t.net == null ? "–" : `${t.net > 0 ? "▲ +" : t.net < 0 ? "▼ " : ""}${t.net.toFixed(1)}`}
            <span>Net Rating</span>
          </div>
          <div class="rec-adv-grid">
            <div><b>${pct1(t.efg)}</b><span>eFG%</span></div>
            <div><b>${pct1(t.ts)}</b><span>TS%</span></div>
            <div><b>${t.tov == null ? "–" : `${t.tov.toFixed(1)}%`}</b><span>턴오버율</span></div>
            <div><b>${pct1(t.orbPct)}</b><span>공격리바%</span></div>
          </div>
        </div>`;
    };
    container.innerHTML = `
      <div class="rec-done">
        <h2 class="rec-final">${esc(game.teams[0].name)} <b>${sa}</b> : <b>${sb}</b> ${esc(game.teams[1].name)}</h2>
        <p class="hint">${game.date} · 기록 ${playCount(game.events)}개 · ${qLabel(마지막쿼터(), game.quarters)}까지</p>

        <h3 class="rec-adv-title">팀 효율</h3>
        <div class="rec-adv">${[0, 1].map(팀카드).join("")}</div>
        <p class="hint rec-adv-note">100 포제션당 낸 점수(ORtg)와 내준 점수(DRtg)예요.
          경기가 빠르든 느리든 같은 자로 잴 수 있어요 — 같은 20점도 공격 기회 40번에서 낸 것과
          80번에서 낸 것은 다르니까요.
          포제션은 <b>슛 시도 − 공격리바 + 턴오버 + 0.44 × 자유투시도</b> 로 셉니다.
          ${팀[0].넉넉 ? "" :
            `<br /><b>포제션이 ${MIN_POSS}개도 안 돼서 ORtg·DRtg 는 안 보여줘요.</b>
             한 번의 공격에서 2점이 나면 계산상 200이 되는데, 그건 잘했다는 뜻이 아니라
             잴 거리가 없다는 뜻이거든요. 한 쿼터쯤 쌓이면 나와요.`}</p>

        <h3 class="rec-adv-title">샷 차트</h3>
        <div id="rec-chart"></div>

        ${game.teams.map((t, ti) => `
          <h3 class="rec-bs-team" data-t="${ti}">${esc(t.name)}</h3>
          <div class="table-scroll">
            <table class="rec-bs">
              <thead><tr><th>선수</th><th>득점</th><th>2점</th><th>3점</th><th>자유투</th>
                <th>리바 <span class="rec-bs-sub">(공/수)</span></th>
                <th>어시</th><th>스틸</th><th>블락</th><th>턴오버</th><th>파울</th>
                <th class="rec-bs-adv">eFG%</th><th class="rec-bs-adv">TS%</th>
                <th class="rec-bs-adv">AST/TO</th><th class="rec-bs-adv">+/-</th></tr></thead>
              <tbody>${rows.filter((r) => r.team === ti).map(col).join("")}</tbody>
            </table>
          </div>`).join("")}
        <div class="rec-save">
          <button type="button" class="btn btn-primary" id="rec-band-img">밴드용 결과 이미지 받기</button>
          <p class="hint">결과 · 팀 효율 · 선수 기록 · <b>팀과 선수 전원의 샷 차트</b>를 한 장에 담아요.
            표는 글로 올리면 칸이 어긋나서 읽기 힘든데, 그림은 어느 기기에서나 같은 모양으로 보여요.</p>
          <details class="rec-band-more">
            <summary>글로도 복사하기</summary>
            <button type="button" class="btn" id="rec-band">밴드용 글 복사</button>
            <p class="hint">검색되는 글이 필요할 때 쓰세요. (복사가 안 되면 아래 칸에서 직접 골라도 돼요)</p>
            <textarea class="rec-band-text" id="rec-band-text" readonly rows="8">${esc(밴드글(game))}</textarea>
          </details>
        </div>

        <div class="rec-save">
          <button type="button" class="btn btn-primary" id="rec-xlsx">엑셀 받기</button>
          <p class="hint">시트 세 장이 들어 있어요 — <b>선수기록</b>(경기 합계) · <b>쿼터별</b> ·
            <b>이벤트원본</b>(누른 순서 그대로, 슛 좌표까지). 원본이 있으면 나중에 무엇이든 다시 계산돼요.</p>
          <p class="hint">이 경기는 보관함에 들어갔어요. 기록 화면 첫 장의 <b>지난 경기</b> 목록에서
            다시 열거나 엑셀을 또 받을 수 있어요.</p>
        </div>
        <div class="rec-bottom">
          <button type="button" class="btn" id="rec-back">계속 기록하기</button>
          <button type="button" class="btn btn-danger" id="rec-new">새 경기</button>
        </div>
      </div>
    `;
    renderChart();
    container.querySelector("#rec-band-img").addEventListener("click", (e) => 결과이미지받기버튼(e.currentTarget));
    container.querySelector("#rec-band").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const 칸 = container.querySelector("#rec-band-text");
      try {
        await navigator.clipboard.writeText(칸.value);
        btn.textContent = "복사됨! 밴드에 붙여넣으세요";
      } catch {
        // 클립보드를 막아 둔 브라우저도 있다. 그때는 글을 골라 주고 사람이 복사한다.
        칸.focus();
        칸.select();
        btn.textContent = "복사 실패 — 아래 글을 직접 복사하세요";
      }
      setTimeout(() => { btn.textContent = "밴드용 글 복사"; }, 2500);
    });
    container.querySelector("#rec-xlsx").addEventListener("click", (e) => 엑셀내려받기(game, e.currentTarget));
    container.querySelector("#rec-back").addEventListener("click", () => { screen = "live"; render(); });
    container.querySelector("#rec-new").addEventListener("click", () => {
      if (!confirm("이번 경기를 닫고 새로 시작할까요?\n기록은 보관함에 남아서 나중에 다시 열 수 있어요.")) return;
      clearRecordGame();
      game = null;
      screen = "setup";
      render();
    });
  }

  function render() {
    setFocus(screen === "live" && !!game);
    if (screen === "setup" || !game) renderSetup();
    else if (screen === "done") renderDone();
    else renderLive();
  }

  render();
}
