// 경기 기록 정리 화면.
//
// 이 화면의 목적은 하나다: **기록지 사진을 넣으면 결과 두 개가 나온다.**
//   1) 오늘 경기 결과 — 밴드에 올릴 이미지 + 붙여넣을 글
//   2) 누적 기록      — 쓰던 엑셀에 이어 붙인 파일
//
// 그래서 화면 순서도 사진 → 결과 → 누적이다. 숫자를 손으로 만지는 자리는 맨 아래에
// 접어 두었다 — 판독이 틀렸을 때만 여는 곳이지, 여기가 주인공이 아니다.
//

import { ROSTER } from "./roster.js";
import { getNextEventDate } from "./events.js";
import { getGameStatsDraft, saveGameStatsDraft, clearGameStatsDraft, allSheetRosters } from "./storage.js";
import {
  emptyGame, emptyTeam, emptyPlayer, derive, teamTotals, teamScore, teamResult,
  perQuarterToCumulative, cumulativeToPerQuarter, validate, gameScore, momOf,
  CUMULATIVE_HEADERS, PERCENT_COLUMNS, COL_DATE, COL_TEAM,
  cumulativeRows, sheetDateKey, summaryText,
} from "./gamestats.js";
import { drawGameImage } from "./gameimage.js";
import { sheetHTML, measureSheet, SHEET_CSS, PLAYER_ROWS, CODE_BITS } from "./sheetform.js";
import {
  detectFiducials, readBubbles, readingsToTeam, debugOverlay, judgeReading,
  matchSheetCode, readSheetRoster,
} from "./sheetread.js";
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

const MAX_SHEETS = 8;

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
function asciiName(preferred, fallback) {
  return /^[\x20-\x7E]+$/.test(preferred) ? preferred : fallback;
}

function download(blobOrBytes, filename, type) {
  const blob = blobOrBytes instanceof Blob ? blobOrBytes : new Blob([blobOrBytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

  // 올린 기록지 사진. 새로고침하면 사라진다 (브라우저 밖으로 나가지 않는 대신 안 남는다).
  // 항목: { name, url, file, state, corners, rows, team, note }
  //   state: "wait" | "reading" | "read" | "needCorners" | "error"
  //   rows:  판독한 9줄 (readingsToTeam 결과). 누가 몇 번째 줄인지는 사람이 골라준다.
  const sheets = [];

  // 종이 좌표는 한 번만 재면 된다 — 화면 밖에 기록지를 한 장 그려 놓고 잰다.
  let geometry = null;
  function sheetGeometry() {
    if (geometry) return geometry;
    if (!document.getElementById("sheet-css")) {
      const st = document.createElement("style");
      st.id = "sheet-css";
      st.textContent = SHEET_CSS;
      document.head.appendChild(st);
    }
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;left:-99999px;top:0;pointer-events:none";
    host.innerHTML = sheetHTML({ roster: [] });
    document.body.appendChild(host);
    geometry = measureSheet(host.querySelector(".sheet"));
    host.remove();
    return geometry;
  }

  // 누적 엑셀. 원본 바이트를 들고 있다가 내려받을 때마다 새로 열어 손본다
  // — 한 번 열어둔 걸 계속 쓰면 버튼을 두 번 누를 때 같은 줄이 두 번 붙는다.
  const excel = {
    buffer: null, fileName: "", sheets: [], sheetName: "",
    header: null, lastRow: 0, error: "", existing: [],
  };

  container.innerHTML = `
    <div class="stats-page">

      <section class="stats-block">
        <h2>1. 기록지 사진</h2>
        <p class="hint">경기가 끝난 기록지를 찍어서 올려주세요. <b>두 팀 것을 한 번에</b> 같이 올려도 됩니다.</p>
        <label class="sheet-drop" id="sh-drop">
          <input type="file" id="sh-input" accept="image/*" multiple hidden />
          <span class="sheet-drop-icon">📄</span>
          <span class="sheet-drop-main">사진 고르기 · 여러 장 한 번에</span>
          <span class="sheet-drop-sub">여기로 끌어다 놓아도 됩니다</span>
        </label>
        <div class="sheet-thumbs" id="sh-thumbs"></div>
        <div id="sh-assign"></div>
        <div class="stats-actions">
          <button type="button" class="btn btn-primary" id="sh-apply" hidden>읽은 기록 넣기</button>
          <span class="stats-note" id="sh-apply-msg"></span>
        </div>
        <div id="sh-status"></div>
      </section>

      <section class="stats-block">
        <h2>2. 오늘 경기 결과</h2>
        <div class="stats-image-preview" id="st-image"></div>
        <div class="stats-actions">
          <button type="button" class="btn btn-primary" id="st-image-download">이미지 다운로드</button>
          <button type="button" class="btn" id="st-image-copy">클립보드에 복사</button>
          <button type="button" class="btn" id="st-copy-text">글 복사</button>
        </div>
        <details class="stats-fold">
          <summary>글로 보기</summary>
          <pre class="stats-summary" id="st-summary"></pre>
        </details>
      </section>

      <section class="stats-block">
        <h2>3. 누적 기록</h2>
        <p class="hint">쓰던 누적 파일을 올리면 <b>맨 아래에 이어서</b> 붙입니다. 셀 서식과 다른 시트는 그대로 둡니다.
          같은 경기가 이미 있으면 붙이지 않고 그 자리에서 고쳐 넣습니다.
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

      <details class="stats-block stats-fold" id="st-edit">
        <summary>숫자 고치기 <span class="stats-note" id="st-edit-tag"></span></summary>
        <div class="stats-edit-body">
          <div class="stats-meta" id="st-meta"></div>
          <h3 class="stats-h3">쿼터 점수 <span class="stats-note">기록지에 적힌 <b>누적</b> 점수를 그대로</span></h3>
          <div class="stats-quarters" id="st-quarters"></div>
          <div id="st-teams"></div>
          <h3 class="stats-h3">검토</h3>
          <div id="st-issues"></div>
          <div class="stats-actions">
            <button type="button" class="btn btn-danger" id="st-reset">새 경기 (입력 내용 지우기)</button>
          </div>
        </div>
      </details>

    </div>
  `;

  const $ = (sel) => container.querySelector(sel);

  // ── 1. 기록지 사진 ──────────────────────────────────────
  // 사진을 넣으면 바로 읽어본다. 네 귀퉁이 표식을 못 찾으면(잘려 찍혔거나 그늘)
  // 사람이 네 귀퉁이를 찍어 주는 쪽으로 넘어간다 — 그 뒤 과정은 똑같다.

  async function imageDataOf(file) {
    const bmp = await createImageBitmap(file);
    // 너무 큰 사진은 줄인다. 다만 너무 줄이면 안 된다 — 버블 세로 반지름이 1.27mm 라
    // 가로 1600px 에서는 6.8px 밖에 안 되고, 그러면 반 칸만 밀려도 이웃 칸을 읽는다.
    // 2200px 이면 9.4px 이라 여유가 생긴다(실제 사진으로 잰 값이다).
    const scale = Math.min(1, 2200 / bmp.width);
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    return ctx.getImageData(0, 0, w, h);
  }

  async function readOne(sheet) {
    sheet.state = "reading";
    sheet.note = "";
    renderSheets();
    try {
      const idata = await imageDataOf(sheet.file);
      sheet.imageData = idata;
      const corners = sheet.corners || detectFiducials(idata, sheetGeometry());
      if (!corners) {
        sheet.state = "needCorners";
        sheet.note = "네 귀퉁이의 검은 표식을 못 찾았습니다.";
        renderSheets();
        return;
      }
      sheet.corners = corners;
      const readings = readBubbles(idata, corners, sheetGeometry());
      const res = readingsToTeam(readings, Array.from({ length: PLAYER_ROWS }, () => [null, ""]));
      sheet.rows = res.players;
      sheet.filled = res.filled;
      sheet.quarterPoints = res.quarterPoints;
      sheet.readings = readings;
      sheet.state = "read";
      sheet.names = sheet.names || res.players.map(() => "");
      fillNames(sheet);
      // 이름 칸 홀짝 검사 결과까지 보고 나서 판정한다 — fillNames 가 그걸 채운다.
      sheet.judge = judgeReading(res, res.filled, readings, sheet.rosterRead);
    } catch (err) {
      sheet.state = "error";
      sheet.note = err?.message || "읽지 못했습니다.";
    }
    renderSheets();
  }

  // 기록지를 사이트에서 뽑았다면 그때 적어둔 명단이 있다. 줄 번호로 이름을 되찾는다.
  // (판독기는 인쇄된 글자를 못 읽는다 — 그래서 뽑을 때 적어두는 쪽을 택했다.)
  //
  // 다만 **어느 종이인지 확인하고 나서** 채워야 한다. 예전에는 마지막으로 뽑은 명단을
  // 줄 번호만 보고 그대로 덮어썼다. 그래서 8월 23일에 찍은 사진에 전혀 다른 팀 이름이
  // 그럴듯하게 붙어 나왔다 — 종이에는 조보규·김창범·황규철이 인쇄되어 있는데 화면에는
  // 고성익·김산·박준수가 떴다. 숫자가 맞아도 이름이 틀리면 기록은 통째로 쓸모없다.
  //
  // 이제는 종이 아래쪽에 버블로 찍어 둔 코드를 읽어 16비트가 **전부** 맞을 때만 채운다.
  // 못 가리면 비워 두고 사람에게 고르게 한다 — 틀리게 채우느니 안 채우는 게 낫다.
  function fillNames(sheet) {
    sheet.nameSource = null;
    if (!sheet.readings) return false;

    // ① 종이가 들고 온 명단이 먼저다. 이름 칸 일곱 개에 로스터 번호가 찍혀 있으므로
    //    사진을 올리는 사람이 누구든, 어느 기기든 이름이 나온다.
    const paper = readSheetRoster(sheet.readings, ROSTER);
    sheet.rosterRead = paper;
    let hit = 0;
    if (paper.read) {
      paper.rows.forEach((who, i) => {
        if (who && !sheet.names[i]) { sheet.names[i] = who.name; hit++; }
      });
    }

    // ② 기록지 코드로 어느 날 어느 팀 것인지까지 알아낸다. 이건 뽑은 기기에서만 되지만
    //    (메모가 그 기기에 있다) 안 돼도 이름은 이미 ①에서 채워졌다.
    const saved = allSheetRosters();
    const m = saved.length
      ? matchSheetCode(sheet.readings, saved.map((s) => ({ key: s.key, roster: s.roster })))
      : { match: null, score: 0 };
    sheet.codeScore = m.score;
    if (m.match) {
      const teamName = m.match.key.split("|")[1];
      const ti = game.teams.findIndex((t) => t.name === teamName);
      if (ti >= 0) sheet.team = ti;
      // 종이가 말하는 이름과 이 기기의 메모가 다르면 둘 중 하나가 틀린 것이다.
      // 로스터 순서가 바뀐 뒤에 예전 기록지를 올리면 이렇게 된다 — 조용히 넘어가면
      // 엉뚱한 사람 기록이 된다.
      const clash = m.match.roster.some(([, name], i) =>
        paper.rows[i] && name && paper.rows[i].name !== name);
      sheet.nameSource = clash
        ? { ok: false, why: `종이에 찍힌 이름과 이 기기에 적어둔 명단이 다릅니다 — 이름을 직접 확인해주세요.` }
        : { ok: true, why: `${teamName} 기록지 · 종이에서 ${paper.read}명 읽음` };
      return hit > 0;
    }

    sheet.nameSource = paper.read
      ? { ok: true, why: `종이에 찍힌 명단에서 ${paper.read}명 읽었습니다` }
      : paper.bad
        ? { ok: false, why: `이름 칸 ${paper.bad}줄을 잘못 읽었습니다 — 판독 위치가 어긋났습니다.` }
        : { ok: false, why: "이 기록지에는 이름 칸이 없습니다 — 예전 양식입니다." };
    return hit > 0;
  }

  function rowHasMarks(r) {
    return r.quarters.length || r.p2a || r.p3a || r.fta || r.reb || r.ast || r.stl || r.blk || r.to || r.pf;
  }

  // ── 건별 판독 리포트 ────────────────────────────────────
  //
  // "안 맞는다"는 말만으로는 어디가 안 맞는지 알 수가 없다. 그래서 판독기가 **칸 하나
  // 하나에 대해** 무엇을 보고 그렇게 판단했는지 그대로 적어 내려준다. 종이를 옆에 두고
  // 줄 단위로 대조하면 어느 칸이 어떻게 틀렸는지 바로 짚인다.
  //
  // 애매한 칸(문턱값 근처)을 따로 모아 준다 — 판독이 틀린다면 십중팔구 여기서 틀린다.
  const STAT_LABEL = { reb: "리바운드", ast: "어시스트", stl: "스틸", blk: "블락", to: "턴오버", pf: "파울" };
  const SHOT_LABEL = { p2: "2점", p3: "3점", ft: "자유투" };

  function readingReport(sheet) {
    const g = sheetGeometry();
    const r = sheet.readings;
    if (!r) return "";
    const cut = r.threshold;
    const name = (pi) => sheet.names?.[pi] || `${pi + 1}번째 줄`;
    const lines = [];

    lines.push(`# 판독 리포트 — ${sheet.name}`);
    lines.push(`사진 ${sheet.imageData.width}×${sheet.imageData.height}px`);
    lines.push(`눈금 표식 ${r.tickHits}/${r.tickTotal} 찾음 · ${r.corrected ? "밀림 보정 함" : "밀림 보정 못 함(옛 양식)"}`);
    lines.push(sheet.nameSource
      ? `선수 이름 — ${sheet.nameSource.why}`
      : `선수 이름 — 확인 못 함`);
    if (sheet.rosterRead) {
      lines.push(`이름 칸 ${sheet.rosterRead.read}줄 읽음` +
        (sheet.rosterRead.bad ? ` · ${sheet.rosterRead.bad}줄 홀짝 검사 실패` : ""));
    }
    lines.push(`어둡기 문턱값 ${cut.toFixed(3)} (이보다 어두우면 칠한 것으로 봄)`);
    lines.push(`칠한 것으로 읽은 칸 ${sheet.filled}개`);
    lines.push("");

    // 줄마다 무엇을 읽었는지
    lines.push("## 줄별로 읽은 것");
    sheet.rows.forEach((row, pi) => {
      if (!rowHasMarks(row)) return;
      const pts = row.p2m * 2 + row.p3m * 3 + row.ftm;
      lines.push(`- ${name(pi)} — ${pts}점 · 출전 ${row.quarters.join(",") || "없음"} · ` +
        `2점 ${row.p2m}/${row.p2a} · 3점 ${row.p3m}/${row.p3a} · 자유투 ${row.ftm}/${row.fta} · ` +
        `리바 ${row.reb} 어시 ${row.ast} 스틸 ${row.stl} 블락 ${row.blk} 턴오버 ${row.to} 파울 ${row.pf}`);
    });
    lines.push("");

    // 칠한 것으로 본 칸 전부 — 종이와 하나씩 대조하라고
    lines.push("## 칠한 것으로 본 칸 (종이와 하나씩 대조해보세요)");
    const marks = [];
    for (const [id, v] of r) {
      if (v.v === "blank" || id[0] === "k") continue;
      marks.push({ id, ...v });
    }
    marks.sort((a, b) => a.id.localeCompare(b.id));
    for (const m of marks) {
      lines.push(`- ${describeBubble(m.id, name)} → ${m.v === "red" ? "빨강" : "검정"} (어둡기 ${m.ratio.toFixed(2)})`);
    }
    lines.push("");

    // 애매한 칸 — 여기가 틀릴 곳이다
    const near = [];
    for (const [id, v] of r) {
      if (id[0] === "k" || v.ratio == null) continue;
      if (v.ratio > cut * 0.88 && v.ratio < cut * 1.12) near.push({ id, ...v });
    }
    near.sort((a, b) => a.ratio - b.ratio);
    lines.push(`## 애매한 칸 ${near.length}개 — 문턱값 ${cut.toFixed(3)} 언저리`);
    lines.push("판독이 틀린다면 거의 이 칸들입니다. 종이를 보고 확인해주세요.");
    for (const m of near.slice(0, 120)) {
      lines.push(`- ${describeBubble(m.id, name)} → ${m.v === "blank" ? "빈 칸" : m.v === "red" ? "빨강" : "검정"}` +
        ` (어둡기 ${m.ratio.toFixed(3)})`);
    }
    if (near.length > 120) lines.push(`- … 그 밖에 ${near.length - 120}개`);
    lines.push("");
    lines.push(`전체 칸 ${g.bubbles.length}개 중 위에 적은 것 말고는 모두 뚜렷한 빈 칸이었습니다.`);
    return lines.join("\n");
  }

  // 버블 id 를 사람 말로. "s:0:p2:1:3:m" → "조보규 2점 전반 4번째 시도 넣음"
  function describeBubble(id, name) {
    const t = id.split(":");
    const who = name(+t[1]);
    if (t[0] === "q") return `${who} 출전 ${t[2]}쿼터`;
    if (t[0] === "s") {
      return `${who} ${SHOT_LABEL[t[2]]} ${t[3] === "1" ? "전반" : "후반"} ` +
        `${+t[4] + 1}번째 시도 ${t[5] === "m" ? "넣음" : "놓침"}`;
    }
    if (t[0] === "c") return `${who} ${STAT_LABEL[t[2]] || t[2]} ${+t[3] + 1}번째 칸`;
    return id;
  }

  function statusHTML(sheet, i) {
    if (sheet.state === "reading") return `<span class="sheet-state">읽는 중…</span>`;
    if (sheet.state === "read") {
      const live = sheet.rows.filter(rowHasMarks).length;
      const bad = sheet.judge && !sheet.judge.ok;
      const r = sheet.readings;
      // 눈금 표식을 못 쓴 종이는 안쪽이 밀린 채로 읽힌다 — 조용히 넘어가면 안 된다.
      const old = r && !r.corrected
        ? `<span class="sheet-state is-warn">눈금 표식 없는 옛 양식</span>` : "";
      return `<span class="sheet-state ${bad ? "is-bad" : "is-ok"}">${
        bad ? "판독 실패" : `${sheet.filled}칸 읽음 · ${live}명`}</span>
        ${old}
        <button type="button" class="btn btn-sm" data-check="${i}">판독 확인</button>
        <button type="button" class="btn btn-sm" data-report="${i}">건별 리포트</button>
        <button type="button" class="btn btn-sm" data-corners="${i}">귀퉁이 다시</button>`;
    }
    if (sheet.state === "needCorners") {
      return `<span class="sheet-state is-warn">귀퉁이 못 찾음</span>
        <button type="button" class="btn btn-sm" data-corners="${i}">네 귀퉁이 찍기</button>`;
    }
    if (sheet.state === "error") return `<span class="sheet-state is-bad">${escapeHtml(sheet.note)}</span>`;
    return "";
  }

  // 판독한 줄을 어느 팀 누구에게 붙일지 고르는 표
  function assignHTML(sheet, i) {
    if (sheet.state !== "read") return "";
    const live = sheet.rows.map((r, ri) => ({ r, ri })).filter(({ r }) => rowHasMarks(r));
    if (!live.length) return `<p class="stats-note">칠해진 칸이 없습니다.</p>`;

    // 판독이 어긋나면 숫자가 안 나오는 게 아니라 그럴듯한 헛것이 나온다.
    // 그대로 보여주면 사람이 믿고 엑셀에 넣는다 — 못 믿겠으면 대놓고 말한다.
    if (sheet.judge && !sheet.judge.ok) {
      return `
        <div class="sheet-assign is-bad">
          <ul class="stats-issues">
            <li class="is-error"><span class="stats-issue-tag">${escapeHtml(sheet.name)}</span><span>
              <b>이 판독은 믿을 수 없습니다.</b> 아래 숫자를 그대로 넣지 마세요.</span></li>
            ${sheet.judge.problems.map((m) => `<li class="is-error"><span>${escapeHtml(m)}</span></li>`).join("")}
            <li class="is-warn"><span class="stats-issue-tag">해볼 것</span><span>
              <b>판독 확인</b>으로 어디가 어긋났는지 보고, <b>귀퉁이 다시</b>로 표식을 직접 찍어보세요.
              그래도 안 맞으면 <b>숫자 고치기</b>에서 손으로 넣는 게 빠릅니다.</span></li>
          </ul>
          <details class="stats-fold">
            <summary>그래도 읽은 값 보기</summary>
            ${assignRowsHTML(sheet, i, live)}
          </details>
        </div>`;
    }
    return `
      <div class="sheet-assign">
        <label class="stats-field"><span>이 기록지는</span>
          <select data-team="${i}">
            ${game.teams.map((t, ti) => `<option value="${ti}"${sheet.team === ti ? " selected" : ""}>${escapeHtml(t.name || `${ti + 1}팀`)}</option>`).join("")}
          </select></label>
        ${assignRowsHTML(sheet, i, live)}
      </div>`;
  }

  function assignRowsHTML(sheet, i, live) {
    const opts = (sel) => `<option value="">선수…</option>` + ROSTER.map((p) =>
      `<option value="${escapeHtml(p.name)}"${sel === p.name ? " selected" : ""}>${escapeHtml(p.name)}${
        typeof p.number === "number" ? ` (#${p.number})` : ""}</option>`).join("");
    return `<div class="sheet-rows">
      ${live.map(({ r, ri }) => `
        <div class="sheet-row">
          <span class="sheet-row-no">${ri + 1}줄</span>
          <select data-sheet="${i}" data-row="${ri}">${opts(sheet.names[ri])}</select>
          <span class="sheet-row-stat">${r.quarters.length ? `${r.quarters.join("·")}Q` : "출전 없음"} ·
            ${r.p2m * 2 + r.p3m * 3 + r.ftm}점 · 리바 ${r.reb}</span>
        </div>`).join("")}
    </div>`;
  }

  function renderSheets() {
    $("#sh-thumbs").innerHTML = sheets.map((s2, i) => `
      <figure class="sheet-thumb">
        <img src="${s2.url}" alt="기록지 ${i + 1}" />
        <figcaption>${escapeHtml(s2.name)}</figcaption>
        <div class="sheet-thumb-foot">${statusHTML(s2, i)}</div>
        <button type="button" class="sheet-thumb-del" data-del="${i}" aria-label="${escapeHtml(s2.name)} 빼기">✕</button>
      </figure>`).join("");

    $("#sh-assign").innerHTML = sheets.map((s2, i) => assignHTML(s2, i)).join("");

    $("#sh-thumbs").querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [gone] = sheets.splice(+btn.dataset.del, 1);
        URL.revokeObjectURL(gone.url);
        renderSheets();
      });
    });
    $("#sh-thumbs").querySelectorAll("[data-corners]").forEach((btn) => {
      btn.addEventListener("click", () => pickCorners(sheets[+btn.dataset.corners]));
    });
    $("#sh-thumbs").querySelectorAll("[data-check]").forEach((btn) => {
      btn.addEventListener("click", () => showCheck(sheets[+btn.dataset.check]));
    });
    $("#sh-thumbs").querySelectorAll("[data-report]").forEach((btn) => {
      btn.addEventListener("click", () => showReport(sheets[+btn.dataset.report]));
    });
    $("#sh-assign").querySelectorAll("select[data-team]").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const sh = sheets[+e.target.dataset.team];
        sh.team = +e.target.value;
        sh.names = sh.rows.map(() => "");
        fillNames(sh);
        renderSheets();
      });
    });
    $("#sh-assign").querySelectorAll("select[data-sheet]").forEach((sel) => {
      sel.addEventListener("change", (e) => {
        sheets[+e.target.dataset.sheet].names[+e.target.dataset.row] = e.target.value;
      });
    });

    const anyRead = sheets.some((s2) => s2.state === "read");
    $("#sh-apply").hidden = !anyRead;
    $("#sh-status").innerHTML = !sheets.length
      ? `<p class="hint">사진은 이 기기 밖으로 나가지 않습니다. 새로고침하면 사라지니 한 번에 올려주세요.</p>`
      : `<ul class="stats-issues">
           <li class="is-ok"><span class="stats-issue-tag">사진 찍을 때</span><span>
             기록지 <b>네 귀퉁이의 검은 사각형</b>이 모두 나오게, 그늘 없이 위에서 찍어주세요.
             판독기는 그 사각형으로 종이의 기울기를 바로잡습니다. 못 찾으면 직접 찍어줄 수도 있습니다.</span></li>
         </ul>`;
  }

  // 판독이 어디를 봤는지 사진 위에 겹쳐 보여준다. 안 맞을 때 원인을 눈으로 찾는 자리다.
  function showCheck(sheet) {
    if (!sheet.imageData || !sheet.corners || !sheet.readings) return;
    const cv = debugOverlay(sheet.imageData, sheet.corners, sheet.readings);
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <div class="modal sheet-corner-modal">
        <h3>판독 확인</h3>
        <p class="hint">노란 테두리가 판독기가 잡은 종이입니다. 이게 실제 종이와 어긋나 있으면
          <b>귀퉁이 다시</b>로 네 점을 직접 찍어주세요.
          동그라미가 각 칸을 본 자리 — <b>파랑</b>은 검정 마킹, <b>빨강</b>은 빨강 마킹으로 읽은 것입니다.
          <b>초록 동그라미가 인쇄된 칸 위에 얹혀 있어야</b> 제대로 읽은 것입니다. 한쪽으로 밀려 있으면 그만큼 틀리게 읽습니다.
          ${sheet.readings.corrected
            ? `네 변의 눈금 표식 ${sheet.readings.tickHits}/${sheet.readings.tickTotal}개를 찾아 종이 안쪽 밀림까지 잡았습니다(하늘색 동그라미).`
            : "이 종이에는 <b>눈금 표식이 없습니다</b> — 예전 양식입니다. 귀퉁이 네 점만으로 폈기 때문에 종이 안쪽이 1~2mm 밀린 채로 읽힙니다. 팀 편성에서 <b>다시 인쇄</b>해주세요."}</p>
        <div class="sheet-corner-wrap"><img alt="판독 확인" id="ck-img" /></div>
        <div class="modal-actions"><button type="button" class="btn" id="ck-close">닫기</button></div>
      </div>`;
    document.body.appendChild(back);
    back.querySelector("#ck-img").src = cv.toDataURL("image/png");
    const close = () => back.remove();
    back.querySelector("#ck-close").addEventListener("click", close);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
  }

  // 칸 하나하나에 대해 무엇을 보고 그렇게 읽었는지 그대로 내려준다.
  // 종이를 옆에 두고 줄 단위로 대조하라고 만든 것이다.
  function showReport(sheet) {
    if (!sheet.readings) return;
    const text = readingReport(sheet);
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <div class="modal sheet-report-modal">
        <h3>건별 판독 리포트</h3>
        <p class="hint">판독기가 <b>칸마다</b> 무엇을 보고 그렇게 판단했는지 전부 적어둔 것입니다.
          종이를 옆에 두고 <b>애매한 칸</b> 목록부터 확인해주세요 — 틀린다면 거의 거기서 틀립니다.</p>
        <pre class="stats-summary sheet-report" id="rp-text"></pre>
        <div class="modal-actions">
          <button type="button" class="btn" id="rp-copy">글 복사</button>
          <button type="button" class="btn" id="rp-save">파일로 저장</button>
          <button type="button" class="btn" id="rp-close">닫기</button>
        </div>
      </div>`;
    document.body.appendChild(back);
    back.querySelector("#rp-text").textContent = text;
    const close = () => back.remove();
    back.querySelector("#rp-close").addEventListener("click", close);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    back.querySelector("#rp-copy").addEventListener("click", async (e) => {
      try {
        await navigator.clipboard.writeText(text);
        e.target.textContent = "복사됨";
      } catch { e.target.textContent = "복사 실패"; }
    });
    back.querySelector("#rp-save").addEventListener("click", () => {
      download(new Blob([text], { type: "text/plain;charset=utf-8" }),
        asciiName(`판독리포트-${sheet.name}.txt`, `spirit-reading-report.txt`));
    });
  }

  // 귀퉁이를 사람이 찍는 화면. 왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래 순서.
  function pickCorners(sheet) {
    // 가운데 위·아래까지 여섯 점을 받는다 — 접힌 기록지는 이 두 점이 있어야 제대로 펴진다.
    const order = ["tl", "tr", "br", "bl", "tm", "bm"];
    const labels = ["왼쪽 위", "오른쪽 위", "오른쪽 아래", "왼쪽 아래", "위쪽 가운데", "아래쪽 가운데"];
    const picked = [];
    const back = document.createElement("div");
    back.className = "modal-backdrop";
    back.innerHTML = `
      <div class="modal sheet-corner-modal">
        <h3>네 귀퉁이를 순서대로 눌러주세요</h3>
        <p class="hint" id="cn-hint">① ${labels[0]} 검은 사각형의 <b>가운데</b></p>
        <div class="sheet-corner-wrap"><img src="${sheet.url}" alt="기록지" id="cn-img" /><div id="cn-dots"></div></div>
        <div class="modal-actions">
          <button type="button" class="btn" id="cn-cancel">취소</button>
          <button type="button" class="btn" id="cn-undo">되돌리기</button>
          <button type="button" class="btn" id="cn-skip">네 귀퉁이만 쓰고 건너뛰기</button>
        </div>
      </div>`;
    document.body.appendChild(back);

    const img = back.querySelector("#cn-img");
    const dots = back.querySelector("#cn-dots");
    const hint = back.querySelector("#cn-hint");
    const redraw = () => {
      dots.innerHTML = picked.map((p, i) =>
        `<span class="cn-dot" style="left:${p.rx * 100}%;top:${p.ry * 100}%">${i + 1}</span>`).join("");
      hint.innerHTML = picked.length < order.length
        ? `${"①②③④⑤⑥"[picked.length]} ${labels[picked.length]} 검은 표식의 <b>가운데</b>` +
          (picked.length >= 4 ? ` <span class="stats-note">(예전 기록지엔 없을 수 있어요 — 없으면 <b>건너뛰기</b>)</span>` : "")
        : `다 찍었습니다 — 읽는 중…`;
    };
    img.addEventListener("click", async (e) => {
      if (picked.length >= order.length) return;
      const r = img.getBoundingClientRect();
      picked.push({ rx: (e.clientX - r.left) / r.width, ry: (e.clientY - r.top) / r.height });
      redraw();
      if (picked.length === order.length) apply();
    });

    // 네 귀퉁이만 찍고 끝낼 수 있게 — 가운데 표식이 없는 예전 기록지용.
    async function apply() {
      {
        // 화면 비율 → 판독에 쓰는 사진 픽셀로 옮긴다.
        const idata = sheet.imageData || (sheet.imageData = await imageDataOf(sheet.file));
        sheet.corners = {};
        picked.forEach((p, i) => {
          sheet.corners[order[i]] = { x: p.rx * idata.width, y: p.ry * idata.height };
        });
        back.remove();
        readOne(sheet);
      }
    }
    back.querySelector("#cn-undo").addEventListener("click", () => { picked.pop(); redraw(); });
    back.querySelector("#cn-skip").addEventListener("click", () => { if (picked.length >= 4) apply(); });
    back.querySelector("#cn-cancel").addEventListener("click", () => back.remove());
    back.addEventListener("click", (e) => { if (e.target === back) back.remove(); });
  }

  // 판독 결과를 경기 기록으로 옮긴다. 이름을 고른 줄만 넣는다.
  function applySheets() {
    let moved = 0;
    let skipped = 0;
    const scored = [];
    for (const sh of sheets) {
      if (sh.state !== "read") continue;
      if (sh.judge && !sh.judge.ok) { skipped++; continue; }
      const ti = sh.team ?? 0;
      const team = game.teams[ti];
      // 쿼터 점수는 넣은 슛에서 바로 나온다 — 색이 쿼터를 알려주니까.
      // 손글씨 표를 읽을 필요가 없다.
      if (sh.quarterPoints && sh.quarterPoints.some((v) => v)) {
        team.q = [...sh.quarterPoints];
        scored.push(team.name || `${ti + 1}팀`);
      }
      sh.rows.forEach((r, ri) => {
        const name = sh.names[ri];
        if (!name || !rowHasMarks(r)) return;
        const known = ROSTER.find((p) => p.name === name);
        const p = emptyPlayer(typeof known?.number === "number" ? known.number : null, name);
        for (const f of STAT_FIELDS) p[f.key] = r[f.key] || 0;
        p.quarters = [...r.quarters];
        const at = team.players.findIndex((x) => x.name === name);
        if (at >= 0) team.players[at] = p;
        else team.players.push(p);
        moved++;
      });
    }
    touch();
    const skipNote = skipped ? ` 판독 실패한 기록지 ${skipped}장은 넣지 않았습니다.` : "";
    $("#sh-apply-msg").textContent = (moved
      ? `${moved}명을 넣었습니다.` + (scored.length ? ` 쿼터 점수도 계산했습니다 (${scored.join(", ")}).` : "")
      : "넣을 줄이 없습니다 — 줄마다 선수를 골라주세요.") + skipNote;
  }

  // 사진인지 가리는 기준을 type 하나에만 걸면 안 된다. 안드로이드 공유나 일부 파일
  // 관리자는 사진을 application/octet-stream 이나 빈 문자열로 넘긴다. 그러면 조용히
  // 걸러져서 **아무 일도 안 일어난 것처럼** 보인다 — 실제로 그렇게 한 번 막혔다.
  // 그래서 확장자로도 한 번 더 본다.
  const IMAGE_EXT = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i;
  const looksLikeImage = (f) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name || "");

  async function addFiles(fileList) {
    const all = [...fileList];
    const imgs = all.filter(looksLikeImage);
    const added = [];
    let full = false;
    for (const f of imgs) {
      if (sheets.length >= MAX_SHEETS) { full = true; break; }
      const item = { name: f.name, url: URL.createObjectURL(f), file: f, state: "wait", team: added.length % 2 };
      sheets.push(item);
      added.push(item);
    }
    // 아무것도 못 받았으면 반드시 말한다. 조용히 넘어가면 사람은 앱이 멈춘 줄 안다.
    const msg = $("#sh-apply-msg");
    if (msg) {
      if (!all.length) msg.textContent = "";
      else if (!imgs.length) msg.textContent = `사진이 아닌 파일이라 못 읽었습니다 (${all.map((f) => f.name).join(", ")}).`;
      else if (full) msg.textContent = `기록지는 한 번에 ${MAX_SHEETS}장까지만 올릴 수 있습니다.`;
      else msg.textContent = "";
    }
    renderSheets();
    for (const item of added) await readOne(item);
  }

  $("#sh-input").addEventListener("change", (e) => {
    addFiles(e.target.files || []);
    e.target.value = ""; // 같은 파일을 다시 골라도 change가 뜨게
  });

  const drop = $("#sh-drop");
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
  drop.addEventListener("drop", (e) => addFiles(e.dataTransfer?.files || []));

  $("#sh-apply").addEventListener("click", applySheets);

  // ── 2. 오늘 경기 결과 ───────────────────────────────────
  let previewCanvas = null;
  function renderResult() {
    previewCanvas = drawGameImage(game);
    const img = new Image();
    img.src = previewCanvas.toDataURL("image/png");
    img.alt = "경기 결과 이미지";
    $("#st-image").replaceChildren(img);
    $("#st-summary").textContent = summaryText(game);
  }

  // ── 3. 누적 엑셀 ────────────────────────────────────────
  // 이 경기가 이미 시트에 들어 있는지 본다. 있으면 붙이지 않고 그 줄을 고친다.
  // 짝은 (팀, 이름)으로 맞춘다 — 사람이 고치는 건 보통 숫자이지 이름이 아니다.
  function planExcel() {
    const rows = cumulativeRows(game);
    const byKey = new Map(excel.existing.map((e) => [`${e.team} ${e.name}`, e.r]));
    const used = new Set();
    const update = [];
    const insert = [];
    for (const values of rows) {
      const key = `${values[COL_TEAM]} ${values[5]}`;
      const at = byKey.get(key);
      if (at != null && !used.has(at)) {
        used.add(at);
        update.push({ r: at, values });
      } else {
        insert.push(values);
      }
    }
    const stale = excel.existing.filter((e) => !used.has(e.r));
    return { update, insert, stale };
  }

  function renderExcelDetail() {
    const el = $("#st-xlsx-detail");
    if (excel.error) {
      el.innerHTML = `<ul class="stats-issues"><li class="is-error"><span>${escapeHtml(excel.error)}</span></li></ul>`;
      return;
    }
    if (!excel.buffer) { el.innerHTML = ""; return; }

    const header = excel.header || [];
    const mismatch = [];
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
          ${update.length ? `<li class="is-ok"><span class="stats-issue-tag">고쳐 넣기</span><span>
            ${update.length}줄을 그 자리에서 고칩니다 (${rowList(update)}행).</span></li>` : ""}
          ${insert.length ? `<li class="is-ok"><span class="stats-issue-tag">새로 붙이기</span><span>
            ${insert.length}줄을 ${excel.lastRow + 1}행부터 붙입니다.</span></li>` : ""}
          ${stale.length ? `<li class="is-warn"><span class="stats-issue-tag">남는 줄</span><span>
            이 경기에 있었지만 지금 기록에는 없는 줄이 ${stale.length}개입니다 (${rowList(stale)}행:
            ${escapeHtml(stale.map((e) => `${e.team} ${e.name}`).join(", "))}).
            줄을 지우면 뒷줄 번호가 밀려 수식이 어긋날 수 있어 저희가 지우지는 않습니다 —
            엑셀에서 직접 지워주세요.</span></li>` : ""}
          ${mismatch.length ? `<li class="is-warn"><span class="stats-issue-tag">열 이름</span><span>
               이 시트의 열 이름이 우리 형식과 다릅니다. 다른 시트인지 확인해주세요.</span></li>
             ${mismatch.slice(0, 5).map((m) => `<li class="is-warn"><span>${escapeHtml(m)}</span></li>`).join("")}
             ${mismatch.length > 5 ? `<li class="is-warn"><span>…외 ${mismatch.length - 5}개</span></li>` : ""}` : ""}
        </ul>
      </div>`;

    $("#st-xlsx-sheet").addEventListener("change", async (e) => {
      excel.sheetName = e.target.value;
      await inspectSheet();
      renderExcelDetail();
    });
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
    $("#st-xlsx-name").textContent = `${file.name} 읽는 중…`;
    try {
      excel.buffer = await file.arrayBuffer();
      excel.fileName = file.name;
      const wb = await openWorkbook(excel.buffer.slice(0));
      excel.sheets = wb.sheets.map((s) => s.name);
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
      download(bytes, name, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    } catch (err) {
      msg.textContent = err?.message || "엑셀을 만들지 못했습니다.";
    }
  }

  // ── 4. 숫자 고치기 (접힌 칸) ────────────────────────────
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

  function renderTeams() {
    const mom = momOf(game);
    $("#st-teams").innerHTML = game.teams.map((team, ti) => {
      const res = teamResult(game, ti);
      const taken = new Set(game.teams.flatMap((t) => t.players.map((p) => p.name)));
      const options = ROSTER.filter((p) => !taken.has(p.name))
        .map((p) => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}${
          typeof p.number === "number" ? ` (#${p.number})` : ""}</option>`).join("");

      return `
        <div class="stats-team${res === "승" ? " is-winner" : ""}">
          <h3 class="stats-h3">${escapeHtml(team.name || `${ti + 1}팀`)}
            <span class="stats-team-tag">${res} · ${teamScore(team)}점</span>
            <span class="stats-note">${team.players.length}명</span></h3>
          <div class="stats-add">
            <select data-pick="${ti}"><option value="">선수 선택…</option>${options}</select>
            <button type="button" class="btn btn-sm" data-add="${ti}">추가</button>
            <button type="button" class="btn btn-sm" data-guest="${ti}">게스트</button>
          </div>
          <div class="stats-table-wrap"><table class="stats-table" id="st-table-${ti}"></table></div>
        </div>`;
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
        <th>득점</th><th title="GameScore">GS</th><th>비고</th><th></th>
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
    // 접힌 칸 제목에도 요약을 띄운다 — 펴 보지 않아도 뭔가 어긋난 걸 알 수 있게.
    const errs = issues.filter((i) => i.level === "error").length;
    $("#st-edit-tag").textContent = !hasPlayers
      ? "아직 비어 있음"
      : errs ? `확인할 것 ${errs}개` : "숫자는 맞습니다";
    $("#st-edit-tag").className = `stats-note${errs ? " is-bad" : ""}`;

    if (!issues.length) {
      $("#st-issues").innerHTML = hasPlayers
        ? `<p class="stats-ok">숫자가 서로 맞습니다.</p>`
        : `<p class="hint">선수 기록을 넣으면 여기서 맞는지 검사합니다.</p>`;
      return;
    }
    $("#st-issues").innerHTML = `<ul class="stats-issues">${issues.map((it) =>
      `<li class="is-${it.level}"><span class="stats-issue-tag">${escapeHtml(it.where)}</span><span>${escapeHtml(it.message)}</span></li>`
    ).join("")}</ul>`;
  }

  // 화면을 다시 그리고 저장한다. 입력 중인 칸을 다시 그리면 커서가 튀므로 건너뛸 수 있게 했다.
  function touch(opts = {}) {
    saveGameStatsDraft(game);
    if (!opts.skipMeta && !opts.skipTeams) renderMeta();
    if (!opts.skipQuarters) renderQuarters();
    if (opts.skipTeams) renderTotals();
    else renderTeams();
    renderIssues();
    renderResult();
    if (excel.buffer) renderExcelDetail();
  }

  // ── 붙이기 ─────────────────────────────────────────────
  renderSheets();
  renderMeta();
  renderQuarters();
  renderTeams();
  renderIssues();
  renderResult();

  $("#st-image-download").addEventListener("click", () => {
    renderResult();
    previewCanvas.toBlob((blob) => {
      if (blob) download(blob, `spirit-game-${sheetDateKey(game)}.png`);
    }, "image/png");
  });

  $("#st-image-copy").addEventListener("click", async (e) => {
    renderResult();
    try {
      await copyCanvas(previewCanvas);
      e.target.textContent = "복사됨!";
    } catch {
      e.target.textContent = "복사 실패, 다운로드를 이용해주세요";
    }
    setTimeout(() => { e.target.textContent = "클립보드에 복사"; }, 1800);
  });

  $("#st-copy-text").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(summaryText(game));
      e.target.textContent = "복사됨!";
    } catch {
      e.target.textContent = "복사 실패";
    }
    setTimeout(() => { e.target.textContent = "글 복사"; }, 1600);
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
