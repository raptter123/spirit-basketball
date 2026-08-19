// 경기 기록 입력 → 검토 → 내보내기 화면.
//
// 지금은 종이 기록지를 보며 사람이 옮겨 적는다. 나중에 기록지 사진 판독이 붙으면
// 그 결과가 이 화면의 입력값을 채워주는 식으로 들어온다 — 그래서 입력·검토·내보내기를
// 한 화면에 두었다. 판독이 붙어도 사람이 마지막으로 눈으로 확인하는 자리는 여기다.
//
// 내보내기는 세 가지다.
//   글    — 밴드에 붙여넣을 최종 점수와 짚어볼 점
//   이미지 — 밴드에 올리는 경기 결과표
//   엑셀  — 누적 기록. 기존 파일을 올리면 그 아래에 덧붙이고, 안 올리면 새로 만든다.

import { ROSTER } from "./roster.js";
import { getNextEventDate } from "./events.js";
import { getGameStatsDraft, saveGameStatsDraft, clearGameStatsDraft } from "./storage.js";
import {
  emptyGame, emptyPlayer, derive, teamTotals, usScore, themScore, result,
  perQuarterToCumulative, cumulativeToPerQuarter, validate,
  CUMULATIVE_HEADERS, cumulativeRows, sheetDateKey, summaryText,
} from "./gamestats.js";
import { drawGameImage } from "./gameimage.js";
import { openWorkbook, readSheet, appendRows, saveWorkbook, createWorkbook, zipSupported } from "./xlsx-lite.js";

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
function cleanGame(saved) {
  const g = emptyGame();
  if (!saved) return g;
  const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  g.date = typeof saved.date === "string" ? saved.date : g.date;
  g.gameNo = num(saved.gameNo, 1);
  g.gameType = typeof saved.gameType === "string" ? saved.gameType : g.gameType;
  g.us = typeof saved.us === "string" ? saved.us : g.us;
  g.them = typeof saved.them === "string" ? saved.them : g.them;
  const q = (arr) => (Array.isArray(arr) && arr.length === 4 ? arr.map((v) => num(v)) : [0, 0, 0, 0]);
  g.usQ = q(saved.usQ);
  g.themQ = q(saved.themQ);
  g.players = (Array.isArray(saved.players) ? saved.players : []).map((p) => {
    const np = emptyPlayer(typeof p?.no === "number" ? p.no : null, String(p?.name ?? ""));
    np.quarters = Array.isArray(p?.quarters) ? p.quarters.filter((n) => [1, 2, 3, 4].includes(n)) : [];
    for (const f of STAT_FIELDS) np[f.key] = num(p?.[f.key]);
    np.memo = typeof p?.memo === "string" ? p.memo : "";
    return np;
  });
  return g;
}

export function mountStatsPage(container) {
  const game = cleanGame(getGameStatsDraft());
  if (!game.date) game.date = getNextEventDate("자체전", todayStr()) || todayStr();

  // 엑셀 쪽 상태. 원본 바이트를 들고 있다가 내려받을 때마다 새로 열어 덧붙인다
  // (한 번 열어둔 걸 계속 쓰면 버튼을 두 번 누를 때 같은 줄이 두 번 붙는다).
  const excel = { buffer: null, fileName: "", sheets: [], sheetName: "", header: null, lastRow: 0, error: "" };

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

      <section class="stats-block">
        <h2>선수 기록</h2>
        <div class="stats-add" id="st-add"></div>
        <div class="stats-table-wrap"><table class="stats-table" id="st-table"></table></div>
        <p class="stats-note stats-scroll-hint">표를 옆으로 밀면 나머지 칸이 나옵니다. 선수 이름은 왼쪽에 붙어 따라옵니다.</p>
      </section>

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
          아무것도 올리지 않으면 이번 경기만 담은 새 파일을 만듭니다.</p>
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

  const $ = (id) => container.querySelector(id);

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
      <label class="stats-field"><span>우리 팀</span>
        <input type="text" id="m-us" value="${escapeHtml(game.us)}" /></label>
      <label class="stats-field"><span>상대</span>
        <input type="text" id="m-them" value="${escapeHtml(game.them)}" /></label>
    `;
    $("#m-date").addEventListener("change", (e) => { game.date = e.target.value; touch(); });
    $("#m-no").addEventListener("input", (e) => { game.gameNo = Math.max(1, +e.target.value || 1); touch(); });
    $("#m-type").addEventListener("change", (e) => { game.gameType = e.target.value; touch(); });
    $("#m-us").addEventListener("input", (e) => { game.us = e.target.value; touch(); });
    $("#m-them").addEventListener("input", (e) => { game.them = e.target.value; touch(); });
  }

  function renderQuarters() {
    const usCum = perQuarterToCumulative(game.usQ);
    const themCum = perQuarterToCumulative(game.themQ);
    const row = (label, cum, side) => `
      <div class="stats-qrow">
        <span class="stats-qteam">${escapeHtml(label)}</span>
        ${cum.map((v, i) =>
          `<input type="number" inputmode="numeric" min="0" data-side="${side}" data-q="${i}" value="${v}" />`).join("")}
        <span class="stats-qtotal">${cum[3]}점</span>
      </div>`;
    $("#st-quarters").innerHTML = `
      <div class="stats-qhead"><span></span><span>1Q</span><span>2Q</span><span>3Q</span><span>4Q</span><span></span></div>
      ${row(game.us || "우리", usCum, "us")}
      ${row(game.them || "상대", themCum, "them")}
    `;
    $("#st-quarters").querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const side = e.target.dataset.side === "us" ? "usQ" : "themQ";
        const cum = perQuarterToCumulative(game[side]);
        cum[+e.target.dataset.q] = Math.max(0, +e.target.value || 0);
        game[side] = cumulativeToPerQuarter(cum);
        touch({ skipQuarters: true });
        e.target.closest(".stats-qrow").querySelector(".stats-qtotal").textContent = `${cum[3]}점`;
      });
    });
  }

  function renderAdd() {
    const taken = new Set(game.players.map((p) => p.name));
    const options = ROSTER.filter((p) => !taken.has(p.name))
      .map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${
        typeof p.number === "number" ? ` (#${p.number})` : ""}</option>`).join("");
    $("#st-add").innerHTML = `
      <select id="st-add-pick"><option value="">선수 선택…</option>${options}</select>
      <button type="button" class="btn" id="st-add-btn">추가</button>
      <button type="button" class="btn" id="st-add-guest">게스트 추가</button>
      <span class="stats-note">${game.players.length}명</span>
    `;
    const add = (name, no) => {
      game.players.push(emptyPlayer(no, name));
      touch();
    };
    $("#st-add-btn").addEventListener("click", () => {
      const name = $("#st-add-pick").value;
      if (!name) return;
      const p = ROSTER.find((r) => r.name === name);
      add(name, typeof p?.number === "number" ? p.number : null);
    });
    $("#st-add-guest").addEventListener("click", () => {
      const name = prompt("게스트 이름을 적어주세요");
      if (name && name.trim()) add(name.trim(), null);
    });
  }

  // TEAM 줄만 따로 만든다. 숫자를 치는 동안에는 표 전체를 다시 그리지 않는데(커서가 튄다),
  // 그때도 합계는 따라 움직여야 한다 — tfoot만 갈아끼우면 입력 칸은 건드리지 않는다.
  function totalsRowHTML() {
    const t = teamTotals(game);
    return `<tr>
      <th class="stats-sticky">TEAM</th><th></th>
      ${STAT_FIELDS.map((f) => `<td>${t[f.key]}</td>`).join("")}
      <td class="stats-pts">${t.pts}</td><td></td><td></td>
    </tr>`;
  }

  function renderTotals() {
    const foot = $("#st-table").querySelector("tfoot");
    if (foot) foot.innerHTML = totalsRowHTML();
  }

  function renderTable() {
    if (!game.players.length) {
      $("#st-table").innerHTML = `<tbody><tr><td class="stats-empty">위에서 선수를 추가해주세요.</td></tr></tbody>`;
      return;
    }
    const head = `
      <thead><tr>
        <th class="stats-sticky">선수</th><th>출전 쿼터</th>
        ${STAT_FIELDS.map((f) => `<th title="${f.label}">${f.short}</th>`).join("")}
        <th>득점</th><th>비고</th><th></th>
      </tr></thead>`;
    const body = game.players.map((p, i) => {
      const d = derive(p);
      return `<tr>
        <td class="stats-sticky">
          <b>${escapeHtml(p.name)}</b>${p.no == null ? "" : `<span class="stats-no">#${p.no}</span>`}
        </td>
        <td class="stats-qpick">${[1, 2, 3, 4].map((q) =>
          `<button type="button" class="stats-qchip${p.quarters.includes(q) ? " is-on" : ""}"
             data-row="${i}" data-q="${q}">${q}</button>`).join("")}</td>
        ${STAT_FIELDS.map((f) =>
          `<td><input type="number" inputmode="numeric" min="0" data-row="${i}" data-key="${f.key}" value="${p[f.key]}" /></td>`).join("")}
        <td class="stats-pts">${d.pts}</td>
        <td><input type="text" class="stats-memo" data-row="${i}" data-key="memo" value="${escapeHtml(p.memo)}"
              placeholder="칸이 모자랐던 것 등" /></td>
        <td><button type="button" class="stats-del" data-del="${i}" aria-label="${escapeHtml(p.name)} 삭제">✕</button></td>
      </tr>`;
    }).join("");

    $("#st-table").innerHTML = head + `<tbody>${body}</tbody><tfoot>${totalsRowHTML()}</tfoot>`;

    $("#st-table").querySelectorAll(".stats-qchip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = game.players[+btn.dataset.row];
        const q = +btn.dataset.q;
        p.quarters = p.quarters.includes(q) ? p.quarters.filter((n) => n !== q) : [...p.quarters, q].sort();
        touch();
      });
    });
    $("#st-table").querySelectorAll("input[data-key]").forEach((input) => {
      input.addEventListener("input", (e) => {
        const p = game.players[+e.target.dataset.row];
        const key = e.target.dataset.key;
        p[key] = key === "memo" ? e.target.value : Math.max(0, +e.target.value || 0);
        // 입력 중에 표를 다시 그리면 커서가 튄다 — 표 밖의 것만 갱신한다.
        touch({ skipTable: true });
        const tr = e.target.closest("tr");
        if (tr) tr.querySelector(".stats-pts").textContent = derive(p).pts;
      });
    });
    $("#st-table").querySelectorAll(".stats-del").forEach((btn) => {
      btn.addEventListener("click", () => {
        game.players.splice(+btn.dataset.del, 1);
        touch();
      });
    });
  }

  function renderIssues() {
    const issues = validate(game);
    if (!issues.length) {
      $("#st-issues").innerHTML = game.players.length
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

  function renderExcelDetail() {
    const el = $("#st-xlsx-detail");
    if (excel.error) {
      el.innerHTML = `<p class="stats-issues"><li class="is-error">${escapeHtml(excel.error)}</li></p>`;
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

    el.innerHTML = `
      <div class="stats-excel-detail">
        <label class="stats-field"><span>붙일 시트</span>
          <select id="st-xlsx-sheet">${excel.sheets.map((s) =>
            `<option value="${escapeHtml(s)}"${s === excel.sheetName ? " selected" : ""}>${escapeHtml(s)}</option>`).join("")}
          </select></label>
        <p class="stats-note">지금 ${excel.lastRow}줄 · 이번에 ${game.players.length}줄이 ${excel.lastRow + 1}번째 줄부터 붙습니다.</p>
        ${mismatch.length
          ? `<ul class="stats-issues"><li class="is-warn"><span class="stats-issue-tag">열 이름</span>
               이 시트의 열 이름이 우리 형식과 다릅니다. 다른 시트인지 확인해주세요.</li>
             ${mismatch.slice(0, 5).map((m) => `<li class="is-warn">${escapeHtml(m)}</li>`).join("")}
             ${mismatch.length > 5 ? `<li class="is-warn">…외 ${mismatch.length - 5}개</li>` : ""}</ul>`
          : `<p class="stats-ok">열 이름이 우리 형식과 같습니다.</p>`}
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
    if (!opts.skipQuarters) renderQuarters();
    if (opts.skipTable) renderTotals();
    else { renderAdd(); renderTable(); }
    renderIssues();
    renderSummary();
    if (excel.buffer) renderExcelDetail();
  }

  // ── 엑셀 ───────────────────────────────────────────────
  async function inspectSheet() {
    const wb = await openWorkbook(excel.buffer.slice(0));
    const rows = await readSheet(wb, excel.sheetName);
    excel.header = rows[0] || [];
    excel.lastRow = rows.length;
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
      excel.error = err?.message || "엑셀 파일을 읽지 못했습니다.";
    }
    $("#st-xlsx-name").textContent = excel.buffer
      ? `${excel.fileName} — 아래에 이어 붙입니다`
      : "선택 안 함 — 새 파일로 만듭니다";
    renderExcelDetail();
  }

  async function downloadExcel() {
    const msg = $("#st-xlsx-msg");
    if (!game.players.length) { msg.textContent = "선수 기록이 없습니다."; return; }
    if (!zipSupported()) { msg.textContent = "이 브라우저에서는 엑셀 내보내기가 안 됩니다. 크롬에서 열어주세요."; return; }
    msg.textContent = "만드는 중…";
    try {
      const rows = cumulativeRows(game);
      let bytes, name;
      if (excel.buffer) {
        // 항상 원본에서 새로 열어 덧붙인다 — 버튼을 두 번 눌러도 두 번 붙지 않는다.
        const wb = await openWorkbook(excel.buffer.slice(0));
        const where = await appendRows(wb, excel.sheetName, rows);
        bytes = await saveWorkbook(wb);
        const stem = excel.fileName.replace(/\.xlsx$/i, "");
        name = asciiName(`${stem}_${sheetDateKey(game)}.xlsx`, `spirit-stats-${sheetDateKey(game)}.xlsx`);
        msg.textContent = `${where.firstRow}~${where.lastRow}번째 줄에 붙였습니다.`;
      } else {
        bytes = await createWorkbook("누적기록", [CUMULATIVE_HEADERS, ...rows]);
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
  renderAdd();
  renderTable();
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
