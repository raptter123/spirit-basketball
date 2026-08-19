// 경기 기록 입력 → 검토 → 내보내기 화면.
//
// 지금은 종이 기록지를 보며 사람이 옮겨 적는다. 나중에 기록지 사진 판독이 붙으면
// 그 결과가 이 화면의 입력값을 채워주는 식으로 들어온다 — 그래서 입력·검토·내보내기를
// 한 화면에 두었다. 판독이 붙어도 사람이 마지막으로 눈으로 확인하는 자리는 여기다.
//
// 한 경기 = 두 팀이다. 두 팀을 같이 넣어야 MOM 을 이긴 팀에서 뽑을 수 있다.
//
// 내보내기는 세 가지다.
//   글    — 밴드에 붙여넣을 최종 점수와 짚어볼 점
//   이미지 — 밴드에 올리는 경기 결과표 (두 팀)
//   엑셀  — 누적 기록. 기존 파일을 올리면 그 아래에 덧붙이고, 안 올리면 새로 만든다.
//           이미 들어 있는 경기면 붙이지 않고 그 자리에서 고쳐 넣는다.

import { ROSTER } from "./roster.js";
import { getNextEventDate } from "./events.js";
import { getGameStatsDraft, saveGameStatsDraft, clearGameStatsDraft } from "./storage.js";
import {
  emptyGame, emptyTeam, emptyPlayer, derive, teamTotals, teamScore, teamResult, winnerIndex,
  perQuarterToCumulative, cumulativeToPerQuarter, validate, gameScore, momOf,
  CUMULATIVE_HEADERS, PERCENT_COLUMNS, COL_DATE, COL_TEAM,
  cumulativeRows, sheetDateKey, summaryText,
} from "./gamestats.js";
import { drawGameImage } from "./gameimage.js";
import {
  openWorkbook, readSheet, readSheetRows, appendRows, overwriteRows,
  saveWorkbook, createWorkbook, zipSupported, formatPercentColumns,
} from "./xlsx-lite.js";

const STAT_FIELDS = [
  { key: "p2m", label: "2점 성공", short: "2P성" },
  { key: "p2a", label: "2점 시도", short: "2P시" },
  { key: "p3m", label: "3점 성공", short: "3P성" },
  { key: "p3a", label: "3점 시도", short: "3P시" },
  { key: "ftm", label: "자유투 성공", short: "FT성" },
  { key: "fta", label: "자유투 시도", short: "FT시" },
  { key: "reb", label: "리바운드", short: "리바" },
  { key: "ast", label: "어시스트", short: "어시" },
  { key: "stl", label: "스틸", short: "스틸" },
  { key: "blk", label: "블락", short: "블락" },
  { key: "to", label: "턴오버", short: "턴오버" },
  { key: "pf", label: "파울", short: "파울" },
];

function escapeHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 크로미움은 a[download]에 한글이 섞이면 이름을 통째로 버리고 확장자 없는 "download"로
// 내려받는다 — 더블클릭해도 안 열리는 파일이 된다. 그래서 파일명은 아스키만 쓴다.
// 사람이 올린 파일 이름이 아스키면 그대로 살리고, 아니면 우리 기본 이름으로 간다.
function asciiName(preferred, fallback) {
  return /^[\x20-\x7E]+$/.test(preferred) ? preferred : fallback;
}

function downloadBytes(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

async function copyCanvas(canvas) {
  if (!navigator.clipboard || !window.ClipboardItem) throw new Error("unsupported");
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

// 저장해둔 초안은 예전 버전이 남긴 것일 수도 있다. 모양이 맞는 것만 살려 쓴다.
// 한 팀만 담던 시절(us/them/players)의 초안도 두 팀 구조로 옮겨 준다.
function cleanGame(saved) {
  const g = emptyGame();
  if (!saved || typeof saved !== "object") return g;
  const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const str = (v, d) => (typeof v === "string" ? v : d);

  g.date = str(saved.date, g.date);
  g.gameNo = num(saved.gameNo, 1);
  g.gameType = str(saved.gameType, g.gameType);

  const cleanPlayers = (arr) =>
    (Array.isArray(arr) ? arr : []).map((p) => {
      const np = emptyPlayer(typeof p?.no === "number" ? p.no : null, str(p?.name, ""));
      np.quarters = Array.isArray(p?.quarters) ? p.quarters.filter((n) => [1, 2, 3, 4].includes(n)) : [];
      for (const f of STAT_FIELDS) np[f.key] = num(p?.[f.key]);
      np.memo = str(p?.memo, "");
      return np;
    });
  const cleanQ = (arr) => (Array.isArray(arr) && arr.length === 4 ? arr.map((v) => num(v)) : [0, 0, 0, 0]);

  if (Array.isArray(saved.teams)) {
    g.teams = [0, 1].map((i) => {
      const t = emptyTeam(str(saved.teams[i]?.name, i === 0 ? "혼 A" : "혼 B"));
      t.q = cleanQ(saved.teams[i]?.q);
      t.players = cleanPlayers(saved.teams[i]?.players);
      return t;
    });
  } else if (saved.us || saved.players) {
    // 예전 초안 — 우리 팀만 있던 것을 첫 번째 팀으로 옮긴다.
    g.teams[0].name = str(saved.us, "혼 A");
    g.teams[0].q = cleanQ(saved.usQ);
    g.teams[0].players = cleanPlayers(saved.players);
    g.teams[1].name = str(saved.them, "혼 B");
    g.teams[1].q = cleanQ(saved.themQ);
  }
  return g;
}

export function mountStatsPage(container) {
  const game = cleanGame(getGameStatsDraft());
  if (!game.date) game.date = getNextEventDate("자체전", todayStr()) || todayStr();

  // 엑셀 쪽 상태. 원본 바이트를 들고 있다가 내려받을 때마다 새로 열어 손본다
  // (한 번 열어둔 걸 계속 쓰면 버튼을 두 번 누를 때 같은 줄이 두 번 붙는다).
  const excel = {
    buffer: null, fileName: "", sheets: [], sheetName: "",
    header: null, lastRow: 0, error: "", existing: [],
  };

  container.innerHTML = `
    <div class="stats-page">
      <section class="stats-block">
        <h2>경기 정보</h2>
        <div class="stats-meta" id="st-meta"></div>
      </section>

      <section class="stats-block">
        <h2>쿼터 점수 <span class="stats-note">기록지에 적힌 <b>누적</b> 점수를 그대로</span></h2>
        <div class="stats-quarters" id="st-quarters"></div>
      </section>

      <div id="st-teams"></div>

      <section class="stats-block">
        <h2>검토</h2>
        <div id="st-issues"></div>
      </section>

      <section class="stats-block">
        <h2>글로 남기기</h2>
        <pre class="stats-summary" id="st-summary"></pre>
        <div class="stats-actions">
          <button type="button" class="btn" id="st-copy-text">글 복사</button>
        </div>
      </section>

      <section class="stats-block">
        <h2>밴드용 이미지</h2>
        <div class="stats-image-preview" id="st-image"></div>
        <div class="stats-actions">
          <button type="button" class="btn" id="st-image-refresh">미리보기 새로 그리기</button>
          <button type="button" class="btn" id="st-image-copy">클립보드에 복사</button>
          <button type="button" class="btn btn-primary" id="st-image-download">이미지 다운로드</button>
        </div>
      </section>

      <section class="stats-block">
        <h2>누적 엑셀</h2>
        <p class="hint">쓰던 누적 파일을 올리면 <b>맨 아래에 이어서</b> 붙입니다. 셀 서식과 다른 시트는 그대로 둡니다.
          같은 경기가 이미 들어 있으면 붙이지 않고 <b>그 자리에서 고쳐 넣습니다</b> — 숫자를 잘못 옮겼을 때
          여기서 고치고 다시 받으면 됩니다. 아무것도 올리지 않으면 이번 경기만 담은 새 파일을 만듭니다.</p>
        <div class="stats-excel">
          <label class="btn" for="st-xlsx">엑셀 파일 선택</label>
          <input type="file" id="st-xlsx" accept=".xlsx" hidden />
          <span id="st-xlsx-name" class="stats-note">선택 안 함 — 새 파일로 만듭니다</span>
        </div>
        <div id="st-xlsx-detail"></div>
        <div class="stats-actions">
          <button type="button" class="btn btn-primary" id="st-xlsx-download">엑셀 다운로드</button>
          <span id="st-xlsx-msg" class="stats-note"></span>
        </div>
      </section>

      <section class="stats-block">
        <div class="stats-actions">
          <button type="button" class="btn btn-danger" id="st-reset">새 경기 (입력 내용 지우기)</button>
        </div>
      </section>
    </div>
  `;

  const $ = (sel) => container.querySelector(sel);

  // ── 그리기 ─────────────────────────────────────────────
  function renderMeta() {
    $("#st-meta").innerHTML = `
      <label class="stats-field"><span>날짜</span>
        <input type="date" id="m-date" value="${escapeHtml(game.date)}" /></label>
      <label class="stats-field"><span>경기</span>
        <input type="number" id="m-no" min="1" max="20" value="${game.gameNo}" /></label>
      <label class="stats-field"><span>유형</span>
        <select id="m-type">
          ${["자체전", "대회", "친선전"].map((t) =>
            `<option value="${t}"${game.gameType === t ? " selected" : ""}>${t}</option>`).join("")}
        </select></label>
      ${game.teams.map((t, i) => `
        <label class="stats-field"><span>${i === 0 ? "팀 1" : "팀 2"}</span>
          <input type="text" data-team-name="${i}" value="${escapeHtml(t.name)}" /></label>`).join("")}
    `;
    $("#m-date").addEventListener("change", (e) => { game.date = e.target.value; touch(); });
    $("#m-no").addEventListener("input", (e) => { game.gameNo = Math.max(1, +e.target.value || 1); touch(); });
    $("#m-type").addEventListener("change", (e) => { game.gameType = e.target.value; touch(); });
    $("#st-meta").querySelectorAll("[data-team-name]").forEach((input) => {
      input.addEventListener("input", (e) => {
        game.teams[+e.target.dataset.teamName].name = e.target.value;
        touch({ skipMeta: true });
      });
    });
  }

  function renderQuarters() {
    const row = (team, i) => {
      const cum = perQuarterToCumulative(team.q);
      return `
        <div class="stats-qrow">
          <span class="stats-qteam">${escapeHtml(team.name || `${i + 1}팀`)}</span>
          ${cum.map((v, q) =>
            `<input type="number" inputmode="numeric" min="0" data-team="${i}" data-q="${q}" value="${v}" />`).join("")}
          <span class="stats-qtotal">${cum[3]}점</span>
        </div>`;
    };
    $("#st-quarters").innerHTML = `
      <div class="stats-qhead"><span></span><span>1Q</span><span>2Q</span><span>3Q</span><span>4Q</span><span></span></div>
      ${game.teams.map(row).join("")}
    `;
    $("#st-quarters").querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const team = game.teams[+e.target.dataset.team];
        const cum = perQuarterToCumulative(team.q);
        cum[+e.target.dataset.q] = Math.max(0, +e.target.value || 0);
        team.q = cumulativeToPerQuarter(cum);
        touch({ skipQuarters: true });
        e.target.closest(".stats-qrow").querySelector(".stats-qtotal").textContent = `${cum[3]}점`;
      });
    });
  }

  // TEAM 줄만 따로 만든다. 숫자를 치는 동안에는 표 전체를 다시 그리지 않는데(커서가 튄다),
  // 그때도 합계는 따라 움직여야 한다 — tfoot만 갈아끼우면 입력 칸은 건드리지 않는다.
  function totalsRowHTML(team) {
    const t = teamTotals(team);
    return `<tr>
      <th class="stats-sticky">TEAM</th><th></th>
      ${STAT_FIELDS.map((f) => `<td>${t[f.key]}</td>`).join("")}
      <td class="stats-pts">${t.pts}</td><td></td><td></td><td></td>
    </tr>`;
  }

  function renderTotals() {
    game.teams.forEach((team, ti) => {
      const foot = $(`#st-table-${ti}`)?.querySelector("tfoot");
      if (foot) foot.innerHTML = totalsRowHTML(team);
    });
  }

  // 두 팀을 같은 모양의 블록으로 하나씩 그린다.
  function renderTeams() {
    const mom = momOf(game);
    $("#st-teams").innerHTML = game.teams.map((team, ti) => {
      const res = teamResult(game, ti);
      const taken = new Set(game.teams.flatMap((t) => t.players.map((p) => p.name)));
      const options = ROSTER.filter((p) => !taken.has(p.name))
        .map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${
          typeof p.number === "number" ? ` (#${p.number})` : ""}</option>`).join("");

      return `
        <section class="stats-block stats-team${res === "승" ? " is-winner" : ""}">
          <h2>${escapeHtml(team.name || `${ti + 1}팀`)}
            <span class="stats-team-tag">${res} · ${teamScore(team)}점</span>
            <span class="stats-note">${team.players.length}명</span></h2>
          <div class="stats-add">
            <select data-pick="${ti}"><option value="">선수 선택…</option>${options}</select>
            <button type="button" class="btn btn-sm" data-add="${ti}">추가</button>
            <button type="button" class="btn btn-sm" data-guest="${ti}">게스트 추가</button>
          </div>
          <div class="stats-table-wrap"><table class="stats-table" id="st-table-${ti}"></table></div>
        </section>`;
    }).join("");

    game.teams.forEach((team, ti) => renderTable(team, ti, mom));

    $("#st-teams").querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ti = +btn.dataset.add;
        const name = $(`select[data-pick="${ti}"]`).value;
        if (!name) return;
        const p = ROSTER.find((r) => r.name === name);
        game.teams[ti].players.push(emptyPlayer(typeof p?.number === "number" ? p.number : null, name));
        touch();
      });
    });
    $("#st-teams").querySelectorAll("[data-guest]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = prompt("게스트 이름을 적어주세요");
        if (name && name.trim()) {
          game.teams[+btn.dataset.guest].players.push(emptyPlayer(null, name.trim()));
          touch();
        }
      });
    });
  }

  function renderTable(team, ti, mom) {
    const table = $(`#st-table-${ti}`);
    if (!team.players.length) {
      table.innerHTML = `<tbody><tr><td class="stats-empty">위에서 선수를 추가해주세요.</td></tr></tbody>`;
      return;
    }
    const head = `
      <thead><tr>
        <th class="stats-sticky">선수</th><th>출전 쿼터</th>
        ${STAT_FIELDS.map((f) => `<th title="${f.label}">${f.short}</th>`).join("")}
        <th>득점</th><th title="GameScore — 활약을 한 숫자로">GS</th><th>비고</th><th></th>
      </tr></thead>`;

    const body = team.players.map((p, i) => {
      const d = derive(p);
      const isMom = !!mom && mom.team === team && mom.p.name === p.name;
      return `<tr${isMom ? ' class="is-mom"' : ""}>
        <td class="stats-sticky">
          ${isMom ? '<span class="stats-mom-star" title="MOM">★</span>' : ""}
          <b>${escapeHtml(p.name)}</b>${p.no == null ? "" : `<span class="stats-no">#${p.no}</span>`}
        </td>
        <td class="stats-qpick">${[1, 2, 3, 4].map((q) =>
          `<button type="button" class="stats-qchip${p.quarters.includes(q) ? " is-on" : ""}"
             data-team="${ti}" data-row="${i}" data-q="${q}">${q}</button>`).join("")}</td>
        ${STAT_FIELDS.map((f) =>
          `<td><input type="number" inputmode="numeric" min="0" data-team="${ti}" data-row="${i}" data-key="${f.key}" value="${p[f.key]}" /></td>`).join("")}
        <td class="stats-pts">${d.pts}</td>
        <td class="stats-gs">${gameScore(p).toFixed(1)}</td>
        <td><input type="text" class="stats-memo" data-team="${ti}" data-row="${i}" data-key="memo" value="${escapeHtml(p.memo)}"
              placeholder="칸이 모자랐던 것 등" /></td>
        <td><button type="button" class="stats-del" data-team="${ti}" data-del="${i}" aria-label="${escapeHtml(p.name)} 삭제">✕</button></td>
      </tr>`;
    }).join("");

    table.innerHTML = head + `<tbody>${body}</tbody><tfoot>${totalsRowHTML(team)}</tfoot>`;

    table.querySelectorAll(".stats-qchip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = game.teams[+btn.dataset.team].players[+btn.dataset.row];
        const q = +btn.dataset.q;
        p.quarters = p.quarters.includes(q) ? p.quarters.filter((n) => n !== q) : [...p.quarters, q].sort();
        touch();
      });
    });
    table.querySelectorAll("input[data-key]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const p = game.teams[+e.target.dataset.team].players[+e.target.dataset.row];
        const key = e.target.dataset.key;
        p[key] = key === "memo" ? e.target.value : Math.max(0, +e.target.value || 0);
        // 입력 중에 표를 다시 그리면 커서가 튄다 — 표 밖의 것만 갱신한다.
        touch({ skipTeams: true });
        const tr = e.target.closest("tr");
        if (tr) {
          tr.querySelector(".stats-pts").textContent = derive(p).pts;
          tr.querySelector(".stats-gs").textContent = gameScore(p).toFixed(1);
        }
      });
    });
    table.querySelectorAll(".stats-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        game.teams[+btn.dataset.team].players.splice(+btn.dataset.del, 1);
        touch();
      });
    });
  }

  function renderIssues() {
    const issues = validate(game);
    const hasPlayers = game.teams.some((t) => t.players.length);
    if (!issues.length) {
      $("#st-issues").innerHTML = hasPlayers
        ? `<p class="stats-ok">숫자가 서로 맞습니다.</p>`
        : `<p class="hint">선수 기록을 넣으면 여기서 맞는지 검사합니다.</p>`;
      return;
    }
    $("#st-issues").innerHTML = `<ul class="stats-issues">${issues.map((it) =>
      `<li class="is-${it.level}"><span class="stats-issue-tag">${escapeHtml(it.where)}</span>${escapeHtml(it.message)}</li>`
    ).join("")}</ul>`;
  }

  function renderSummary() {
    $("#st-summary").textContent = summaryText(game);
  }

  let previewCanvas = null;
  function renderImage() {
    previewCanvas = drawGameImage(game);
    $("#st-image").innerHTML = "";
    const img = new Image();
    img.src = previewCanvas.toDataURL("image/png");
    img.alt = "경기 결과 이미지 미리보기";
    $("#st-image").appendChild(img);
  }

  // ── 엑셀 ───────────────────────────────────────────────
  // 이 경기가 이미 시트에 들어 있는지 본다. 있으면 붙이지 않고 그 줄을 고친다.
  // 짝은 (팀, 이름)으로 맞춘다 — 사람이 고치는 건 보통 숫자이지 이름이 아니다.
  function planExcel() {
    const rows = cumulativeRows(game);
    const byKey = new Map(excel.existing.map((e) => [`${e.team} ${e.name}`, e.r]));
    const used = new Set();
    const update = [];
    const insert = [];
    for (const values of rows) {
      const key = `${values[COL_TEAM]} ${values[5]}`;
      const at = byKey.get(key);
      if (at != null && !used.has(at)) {
        used.add(at);
        update.push({ r: at, values });
      } else {
        insert.push(values);
      }
    }
    // 이제 우리 기록에 없는데 시트에는 남아 있는 줄 (선수를 뺐거나 이름을 고친 경우)
    const stale = excel.existing.filter((e) => !used.has(e.r));
    return { update, insert, stale };
  }

  function renderExcelDetail() {
    const el = $("#st-xlsx-detail");
    if (excel.error) {
      el.innerHTML = `<ul class="stats-issues"><li class="is-error">${escapeHtml(excel.error)}</li></ul>`;
      return;
    }
    if (!excel.buffer) { el.innerHTML = ""; return; }

    // 헤더가 다르면 열이 어긋난 채로 붙는다 — 붙이기 전에 사람에게 보여준다.
    const mismatch = [];
    const header = excel.header || [];
    CUMULATIVE_HEADERS.forEach((want, i) => {
      const got = (header[i] || "").trim();
      if (got !== want) mismatch.push(`${i + 1}번째 열: 파일은 "${got || "(빈칸)"}", 우리는 "${want}"`);
    });

    const { update, insert, stale } = planExcel();
    const rowList = (arr) => arr.map((e) => e.r).sort((a, b) => a - b).join(", ");

    el.innerHTML = `
      <div class="stats-excel-detail">
        <label class="stats-field"><span>붙일 시트</span>
          <select id="st-xlsx-sheet">${excel.sheets.map((s) =>
            `<option value="${escapeHtml(s)}"${s === excel.sheetName ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}
          </select></label>
        <p class="stats-note">지금 ${excel.lastRow}줄 · 이 경기(${escapeHtml(sheetDateKey(game))})는
          ${excel.existing.length ? `이미 ${excel.existing.length}줄 들어 있습니다` : "아직 없습니다"}.</p>
        <ul class="stats-issues">
          ${update.length ? `<li class="is-ok"><span class="stats-issue-tag">고쳐 넣기</span>
            ${update.length}줄을 그 자리에서 고칩니다 (${rowList(update)}행).</li>` : ""}
          ${insert.length ? `<li class="is-ok"><span class="stats-issue-tag">새로 붙이기</span>
            ${insert.length}줄을 ${excel.lastRow + 1}행부터 붙입니다.</li>` : ""}
          ${stale.length ? `<li class="is-warn"><span class="stats-issue-tag">남는 줄</span>
            이 경기에 있었지만 지금 기록에는 없는 줄이 ${stale.length}개입니다 (${rowList(stale)}행:
            ${escapeHtml(stale.map((e) => `${e.team} ${e.name}`).join(", "))}).
            줄을 지우면 뒷줄 번호가 밀려 수식이 어긋날 수 있어 저희가 지우지는 않습니다 —
            엑셀에서 직접 지워주세요.</li>` : ""}
          ${mismatch.length ? `<li class="is-warn"><span class="stats-issue-tag">열 이름</span>
               이 시트의 열 이름이 우리 형식과 다릅니다. 다른 시트인지 확인해주세요.</li>
             ${mismatch.slice(0, 5).map((m) => `<li class="is-warn">${escapeHtml(m)}</li>`).join("")}
             ${mismatch.length > 5 ? `<li class="is-warn">…외 ${mismatch.length - 5}개</li>` : ""}` : ""}
        </ul>
        ${mismatch.length ? "" : `<p class="stats-ok">열 이름이 우리 형식과 같습니다.</p>`}
      </div>`;

    $("#st-xlsx-sheet").addEventListener("change", async (e) => {
      excel.sheetName = e.target.value;
      await inspectSheet();
      renderExcelDetail();
    });
  }

  // 화면을 다시 그리고 저장한다. 입력 중인 칸을 다시 그리면 커서가 튀므로 건너뛸 수 있게 했다.
  function touch(opts = {}) {
    saveGameStatsDraft(game);
    if (!opts.skipMeta && !opts.skipTeams) renderMeta();
    if (!opts.skipQuarters) renderQuarters();
    if (opts.skipTeams) renderTotals();
    else renderTeams();
    renderIssues();
    renderSummary();
    if (excel.buffer) renderExcelDetail();
  }

  async function inspectSheet() {
    const wb = await openWorkbook(excel.buffer.slice(0));
    const rows = await readSheetRows(wb, excel.sheetName);
    excel.header = rows[0]?.cells || [];
    excel.lastRow = rows.length ? rows[rows.length - 1].r : 0;
    const key = sheetDateKey(game);
    excel.existing = rows
      .slice(1)
      .filter((row) => (row.cells[COL_DATE] || "").trim() === key)
      .map((row) => ({ r: row.r, team: (row.cells[COL_TEAM] || "").trim(), name: (row.cells[5] || "").trim() }));
  }

  async function loadExcel(file) {
    excel.error = "";
    // 시트가 수십 개인 파일은 훑는 데 몇 초 걸린다 — 멈춘 게 아니라고 알려준다.
    $("#st-xlsx-name").textContent = `${file.name} 읽는 중…`;
    try {
      excel.buffer = await file.arrayBuffer();
      excel.fileName = file.name;
      const wb = await openWorkbook(excel.buffer.slice(0));
      excel.sheets = wb.sheets.map((s) => s.name);
      // 우리 형식의 시트를 스스로 찾아본다. 못 찾으면 첫 시트를 고르고 사람이 바꾸게 둔다.
      let picked = null;
      for (const s of wb.sheets) {
        const rows = await readSheet(wb, s.name, 1);
        const h = (rows[0] || []).map((v) => (v || "").trim());
        if (h[0] === CUMULATIVE_HEADERS[0] && h.includes("이름")) { picked = s.name; break; }
      }
      excel.sheetName = picked || excel.sheets[0];
      await inspectSheet();
    } catch (err) {
      excel.buffer = null;
      excel.sheets = [];
      excel.existing = [];
      excel.error = err?.message || "엑셀 파일을 읽지 못했습니다.";
    }
    $("#st-xlsx-name").textContent = excel.buffer
      ? `${excel.fileName} — 아래에 이어 붙입니다`
      : "선택 안 함 — 새 파일로 만듭니다";
    renderExcelDetail();
  }

  async function downloadExcel() {
    const msg = $("#st-xlsx-msg");
    const rows = cumulativeRows(game);
    if (!rows.length) { msg.textContent = "선수 기록이 없습니다."; return; }
    if (!zipSupported()) { msg.textContent = "이 브라우저에서는 엑셀 내보내기가 안 됩니다. 크롬에서 열어주세요."; return; }
    msg.textContent = "만드는 중…";
    try {
      let bytes, name;
      if (excel.buffer) {
        // 항상 원본에서 새로 열어 손본다 — 버튼을 두 번 눌러도 두 번 붙지 않는다.
        const wb = await openWorkbook(excel.buffer.slice(0));
        const { update, insert, stale } = planExcel();
        const done = [];
        if (update.length) {
          const res = await overwriteRows(wb, excel.sheetName, update, PERCENT_COLUMNS);
          done.push(`${update.length}줄 고쳐 넣음`);
          if (res.keptFormulas.length) done.push(`수식 칸 ${res.keptFormulas.length}개는 그대로 둠`);
        }
        if (insert.length) {
          const where = await appendRows(wb, excel.sheetName, insert, PERCENT_COLUMNS);
          done.push(`${where.firstRow}~${where.lastRow}행에 ${insert.length}줄 붙임`);
        }
        // 새 줄만 퍼센트로 보이면 한 열이 두 가지 모양으로 갈린다. 원래 있던 줄도 같이 맞춘다
        // (값은 그대로, 보이는 모양만).
        await formatPercentColumns(wb, excel.sheetName, PERCENT_COLUMNS);
        bytes = await saveWorkbook(wb);
        const stem = excel.fileName.replace(/\.xlsx$/i, "");
        name = asciiName(`${stem}_${sheetDateKey(game)}.xlsx`, `spirit-stats-${sheetDateKey(game)}.xlsx`);
        if (stale.length) done.push(`남는 ${stale.length}줄은 엑셀에서 직접 지워주세요`);
        msg.textContent = done.join(" · ");
      } else {
        bytes = await createWorkbook("누적기록", [CUMULATIVE_HEADERS, ...rows], PERCENT_COLUMNS);
        name = `spirit-stats-${sheetDateKey(game)}.xlsx`;
        msg.textContent = `새 파일 ${rows.length}줄을 만들었습니다.`;
      }
      downloadBytes(bytes, name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (err) {
      msg.textContent = err?.message || "엑셀을 만들지 못했습니다.";
    }
  }

  // ── 붙이기 ─────────────────────────────────────────────
  renderMeta();
  renderQuarters();
  renderTeams();
  renderIssues();
  renderSummary();
  renderImage();

  $("#st-copy-text").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(summaryText(game));
      e.target.textContent = "복사됨!";
    } catch {
      e.target.textContent = "복사 실패";
    }
    setTimeout(() => { e.target.textContent = "글 복사"; }, 1600);
  });

  $("#st-image-refresh").addEventListener("click", renderImage);
  $("#st-image-download").addEventListener("click", () => {
    renderImage();
    downloadCanvas(previewCanvas, `spirit-game-${sheetDateKey(game)}.png`);
  });
  $("#st-image-copy").addEventListener("click", async (e) => {
    renderImage();
    try {
      await copyCanvas(previewCanvas);
      e.target.textContent = "복사됨!";
    } catch {
      e.target.textContent = "복사 실패, 다운로드를 이용해주세요";
    }
    setTimeout(() => { e.target.textContent = "클립보드에 복사"; }, 1800);
  });

  $("#st-xlsx").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) loadExcel(file);
  });
  $("#st-xlsx-download").addEventListener("click", downloadExcel);

  $("#st-reset").addEventListener("click", () => {
    if (!confirm("입력한 기록을 지우고 새로 시작할까요?")) return;
    clearGameStatsDraft();
    location.reload();
  });
}
