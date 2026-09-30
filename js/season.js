// 시즌 합치기 — 기록 탭에서 받은 경기 엑셀 여러 개를 한꺼번에 올려 선수별 누적을 본다.
//
// 기록 탭의 보관함은 이 기기에 최근 20경기까지만 남는다. 여러 사람이 각자 폰으로
// 기록하거나 한 시즌이 스무 경기를 넘으면, 시즌 전체를 보는 길은 받아 둔 엑셀뿐이다.
// 엑셀 안에 필요한 것이 다 있다(js/record-export.js):
//   - 선수기록 시트: 선수별 경기 합계와 +/-  → 누적 표
//   - 팀효율 시트:   팀별 승패              → 선수별 승률
//   - 이벤트원본 시트: 슛 좌표(X · Y)        → 누적 샷 차트
// 그래서 합계는 선수기록 시트의 숫자를 그대로 더한다. 이벤트원본에서 다시 세지 않는 것은,
// 교체 기록이 원본 시트에서 "누구 나감" 글로만 남아 +/- 를 되살릴 수 없기 때문이다.
//
// 모든 일은 이 기기 안에서 끝난다. 파일은 밖으로 나가지 않는다.
import { openWorkbook, readSheet, createWorkbookSheets } from "./xlsx-lite.js";
import { escapeHtml as esc } from "./util.js";
import { 효율, 구역집계, 구역들, pct1, 부호, 내려주기 } from "./record-stats.js";
import { CHART_VIEW, 차트속, 구역말 } from "./record-chart.js";

// 선수기록 시트 머리글 → 합계 열쇠(record.js 의 boxScore 와 같은 이름).
const 더할칸 = {
  "득점": "pts", "2점성공": "p2m", "2점시도": "p2a", "3점성공": "p3m", "3점시도": "p3a",
  "자유투성공": "ftm", "자유투시도": "fta", "리바운드": "reb", "공격리바": "rebO", "수비리바": "rebD",
  "어시스트": "ast", "스틸": "stl", "블락": "blk", "턴오버": "to", "파울": "pf",
};

/** 머리글 이름으로 칸을 찾는다. 칸 순서가 바뀌어도(옛 파일) 읽히게. */
function 표로(rows) {
  const 머리 = (rows[0] || []).map((h) => String(h ?? "").trim());
  return rows.slice(1).filter((r) => r.some((c) => String(c ?? "").trim()))
    .map((r) => Object.fromEntries(머리.map((h, i) => [h, r[i] ?? ""])));
}
const 수 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
/** 원본 시트의 슛 "점수" 칸 — 들어간 슛은 얻은 점수, 빗나간 슛은 노린 점수(2 · 3)가 적혀 있다. */
const 슛점수 = (v) => (Number(v) === 3 ? 3 : 2);

/**
 * 경기 엑셀 하나 → { 날짜, 팀들, 선수들, 승패, 슛들, 서명 }
 * 기록 탭 엑셀이 아니면(선수기록 시트가 없으면) 알아볼 수 있는 말로 던진다.
 */
export async function 경기엑셀읽기(buffer) {
  const wb = await openWorkbook(buffer);
  const 있는시트 = wb.sheets.map((s) => s.name);
  if (!있는시트.includes("선수기록")) {
    throw new Error("기록 탭에서 받은 경기 엑셀이 아니에요 ('선수기록' 시트가 없음)");
  }
  const 선수줄 = 표로(await readSheet(wb, "선수기록")).filter((r) => String(r["선수"]).trim());
  if (!선수줄.length) throw new Error("선수기록 시트가 비어 있어요");
  const 날짜 = String(선수줄[0]["날짜"] || "").trim();
  const 팀들 = [...new Set(선수줄.map((r) => String(r["팀"]).trim()))];

  const 승패 = {};
  if (있는시트.includes("팀효율")) {
    for (const r of 표로(await readSheet(wb, "팀효율"))) 승패[String(r["팀"]).trim()] = String(r["승패"] || "").trim();
  }

  const 슛들 = [];
  if (있는시트.includes("이벤트원본")) {
    for (const r of 표로(await readSheet(wb, "이벤트원본"))) {
      if (String(r["종류"]).trim() !== "슛") continue;
      const x = Number(r["X"]), y = Number(r["Y"]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || String(r["X"]).trim() === "") continue;
      슛들.push({ type: "shot", x, y, made: String(r["결과"]).trim() === "성공",
        pts: 슛점수(r["점수"]), 선수: String(r["선수"]).trim(), 팀: String(r["팀"]).trim() });
    }
  }

  const 선수들 = 선수줄.map((r) => {
    const a = { name: String(r["선수"]).trim(), 팀: String(r["팀"]).trim(), 번호: String(r["등번호"] ?? "").trim() };
    for (const [h, k] of Object.entries(더할칸)) a[k] = 수(r[h]);
    // +/- 가 빈 칸이면(교류전) 셀 수 없는 경기다 — 0 으로 두면 "재 봤더니 0" 이 된다.
    a.pm = String(r["+/-"] ?? "").trim() === "" ? null : 수(r["+/-"]);
    return a;
  });
  // 같은 경기를 두 번 올리면 한 번만 센다. 날짜 · 팀 · 선수별 숫자가 모두 같으면 같은 경기다.
  const 서명 = JSON.stringify([날짜, 팀들, 선수들.map((p) => [p.name, p.팀, ...Object.values(더할칸).map((k) => p[k])])]);
  return { 날짜, 팀들, 선수들, 승패, 슛들, 서명 };
}

/**
 * 여러 경기 → 선수별 누적. 한 사람은 이름으로 묶는다.
 * 돌아오는 값: [{ name, 번호, 경기수, 승, 패, 무, pts, …, pm, pm경기 }] — 경기당 득점 순.
 */
export function 시즌합계(경기들) {
  const 사람 = new Map();
  for (const g of 경기들) {
    for (const p of g.선수들) {
      let a = 사람.get(p.name);
      if (!a) {
        a = { name: p.name, 번호: p.번호, 경기수: 0, 승: 0, 패: 0, 무: 0, pm: null, pm경기: 0 };
        for (const k of Object.values(더할칸)) a[k] = 0;
        사람.set(p.name, a);
      }
      a.경기수 += 1;
      if (p.번호) a.번호 = p.번호;
      for (const k of Object.values(더할칸)) a[k] += p[k];
      const 결과 = g.승패[p.팀];
      if (결과 === "승") a.승 += 1; else if (결과 === "패") a.패 += 1; else if (결과 === "무") a.무 += 1;
      if (p.pm != null) { a.pm = (a.pm ?? 0) + p.pm; a.pm경기 += 1; }
    }
  }
  return [...사람.values()].sort((x, y) => y.pts / y.경기수 - x.pts / x.경기수 || y.경기수 - x.경기수
    || x.name.localeCompare(y.name, "ko"));
}

const 평균 = (v, n) => (n ? (v / n).toFixed(1) : "–");
const 승률 = (a) => (a.승 + a.패 + a.무 ? a.승 / (a.승 + a.패 + a.무) : null);

/** 시즌합계 시트 행. 비율은 분수(0.562)로 — 엑셀에서 0.0% 로 보인다. */
export function 시즌시트(경기들) {
  const 머리 = ["선수", "등번호", "경기수", "승", "패", "무", "승률", "득점", "경기당득점", "리바운드", "경기당리바",
    "어시스트", "경기당어시", "스틸", "블락", "턴오버", "파울", "2점성공", "2점시도", "3점성공", "3점시도",
    "자유투성공", "자유투시도", "공격리바", "수비리바", "eFG%", "TS%", "+/-", "+/-센경기"];
  return [머리, ...시즌합계(경기들).map((a) => {
    const e = 효율(a);
    const 율 = 승률(a);
    return [a.name, a.번호, a.경기수, a.승, a.패, a.무, 율 == null ? "" : 율, a.pts, Number(평균(a.pts, a.경기수)),
      a.reb, Number(평균(a.reb, a.경기수)), a.ast, Number(평균(a.ast, a.경기수)), a.stl, a.blk, a.to, a.pf,
      a.p2m, a.p2a, a.p3m, a.p3a, a.ftm, a.fta, a.rebO, a.rebD, e.efg ?? "", e.ts ?? "", a.pm ?? "", a.pm경기];
  })];
}

export async function 시즌엑셀파일(경기들) {
  const rows = 시즌시트(경기들);
  const 날짜들 = 경기들.map((g) => g.날짜).filter(Boolean).sort();
  const 목록 = [["날짜", "대진", "승패"], ...[...경기들].sort((a, b) => a.날짜.localeCompare(b.날짜)).map((g) => [
    g.날짜, g.팀들.join(" vs "), g.팀들.map((t) => `${t} ${g.승패[t] || "–"}`).join(" · ")])];
  const bytes = await createWorkbookSheets([
    { name: "시즌합계", rows, percentCols: ["승률", "eFG%", "TS%"].map((h) => rows[0].indexOf(h)),
      꼬리말: [`■ ${날짜들[0] || "?"} ~ ${날짜들[날짜들.length - 1] || "?"} · ${경기들.length}경기를 합쳤습니다.`] },
    { name: "경기목록", rows: 목록 },
  ]);
  const 끝 = (날짜들[날짜들.length - 1] || "season").replace(/[^0-9-]/g, "");
  return { blob: new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    이름: `spirit-season-${날짜들[0] || ""}-to-${끝}-${경기들.length}games.xlsx` };
}

/** 화면. 통계 화면(statspage.js)의 한 칸에 붙는다. */
export function mountSeason(root) {
  let 경기들 = [];
  let 알림 = [];
  let 차트대상 = null;

  function 표HTML() {
    const rows = 시즌합계(경기들);
    const 플마 = rows.some((a) => a.pm != null);
    return `
      <div class="table-scroll">
        <table class="rec-bs season-table">
          <thead><tr><th class="rec-bs-name">선수</th><th>경기</th><th>승률</th><th>득점</th><th>리바</th><th>어시</th>
            <th>스틸</th><th>블락</th><th>3점</th><th class="rec-bs-adv">eFG%</th><th class="rec-bs-adv">TS%</th>
            ${플마 ? `<th class="rec-bs-adv">+/-</th>` : ""}</tr></thead>
          <tbody>${rows.map((a) => {
            const e = 효율(a);
            return `<tr>
              <td class="rec-bs-name">${esc(a.name)}</td><td>${a.경기수}</td><td>${pct1(승률(a))}</td>
              <td><b>${평균(a.pts, a.경기수)}</b> <span class="rec-bs-sub">(${a.pts})</span></td>
              <td>${평균(a.reb, a.경기수)}</td><td>${평균(a.ast, a.경기수)}</td>
              <td>${a.stl}</td><td>${a.blk}</td><td>${a.p3m}/${a.p3a}</td>
              <td class="rec-bs-adv">${pct1(e.efg)}</td><td class="rec-bs-adv">${pct1(e.ts)}</td>
              ${플마 ? `<td class="rec-bs-adv ${a.pm > 0 ? "up" : a.pm < 0 ? "down" : ""}">${a.pm == null ? "–" : 부호(a.pm)}</td>` : ""}
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
      <p class="hint">득점 · 리바 · 어시는 <b>경기당 평균</b>(괄호는 합계), 경기당 득점 순이에요.
        ${플마 ? "+/- 는 셀 수 있는 경기만 더했어요 — 교류전은 상대가 언제 넣었는지 안 적어서 빠져요." : ""}</p>`;
  }

  function 차트HTML() {
    const 모든슛 = 경기들.flatMap((g) => g.슛들);
    const 쏜사람 = [...new Set(모든슛.map((s) => s.선수))].map((n) => {
      const 내것 = 모든슛.filter((s) => s.선수 === n);
      return { name: n, m: 내것.filter((s) => s.made).length, a: 내것.length };
    }).sort((x, y) => y.a - x.a);
    if (차트대상 && !쏜사람.some((p) => p.name === 차트대상)) 차트대상 = null;
    const shots = 차트대상 ? 모든슛.filter((s) => s.선수 === 차트대상) : 모든슛;
    const z = 구역집계(shots);
    const 들어간것 = shots.filter((s) => s.made).length;
    if (!모든슛.length) return `<p class="hint">올린 파일에 슛 좌표(이벤트원본 시트)가 없어서 샷 차트는 못 그려요.</p>`;
    return `
      <div class="rec-chart">
        <div class="rec-chart-who">
          <button type="button" class="rec-chip${차트대상 ? "" : " on"}" data-who="">전체</button>
          ${쏜사람.map((p) => `<button type="button" class="rec-chip${차트대상 === p.name ? " on" : ""}" data-who="${esc(p.name)}">
            ${esc(p.name)} <span>${p.m}/${p.a}</span></button>`).join("")}
        </div>
        <div class="rec-chart-court">
          <svg viewBox="${CHART_VIEW.x} ${CHART_VIEW.y} ${CHART_VIEW.w} ${CHART_VIEW.h}" id="season-chart-svg" role="img"
               aria-label="${esc(차트대상 || "전체")} 누적 슛 ${들어간것}/${shots.length}">${차트속(shots)}</svg>
        </div>
        <div class="rec-chart-zones">
          ${구역들.map((k) => {
            const m = 구역말(z[k]);
            const 몫 = shots.length ? Math.round((z[k].a / shots.length) * 100) : 0;
            return `<div class="rec-chart-zone"><b>${m.율}</b><span class="nm">${k}</span><span class="sub">${m.몫}</span>
              <span class="share">${z[k].a ? `시도 ${몫}%` : "&nbsp;"}</span><i style="width:${몫}%"></i></div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function render() {
    const 날짜들 = 경기들.map((g) => g.날짜).filter(Boolean).sort();
    root.innerHTML = `
      <label class="sheet-drop" id="season-drop">
        <input type="file" id="season-input" accept=".xlsx" multiple hidden />
        <span class="sheet-drop-icon">📊</span>
        <span class="sheet-drop-main">경기 엑셀 고르기 · 여러 개 한 번에</span>
        <span class="sheet-drop-sub">기록 탭에서 받은 spirit-game-….xlsx</span>
      </label>
      ${알림.length ? `<ul class="season-notes" role="status">${알림.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : ""}
      ${경기들.length ? `
        <p class="season-range"><b>${경기들.length}경기</b> · ${esc(날짜들[0])} ~ ${esc(날짜들[날짜들.length - 1])}</p>
        <details class="stats-fold season-list">
          <summary>올린 경기 보기</summary>
          <ul>${[...경기들].sort((a, b) => a.날짜.localeCompare(b.날짜)).map((g) => `
            <li>${esc(g.날짜)} · ${esc(g.팀들.join(" vs "))}
              <button type="button" class="btn-sm season-del" data-del="${경기들.indexOf(g)}" aria-label="${esc(g.날짜)} ${esc(g.팀들.join(" "))} 빼기">빼기</button></li>`).join("")}</ul>
        </details>
        <h3 class="stats-h3">선수별 누적</h3>
        ${표HTML()}
        <h3 class="stats-h3">누적 샷 차트</h3>
        <div id="season-chart">${차트HTML()}</div>
        <div class="stats-actions">
          <button type="button" class="btn btn-primary" id="season-xlsx">합친 엑셀 받기</button>
          <button type="button" class="btn" id="season-clear">모두 비우기</button>
        </div>` : ""}
    `;
    root.querySelector("#season-input").addEventListener("change", (e) => 올리기(e.target.files));
    const drop = root.querySelector("#season-drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); });
    drop.addEventListener("drop", (e) => { e.preventDefault(); 올리기(e.dataTransfer.files); });
    for (const el of root.querySelectorAll("[data-who]")) {
      el.addEventListener("click", () => { 차트대상 = el.dataset.who || null; render(); });
    }
    for (const el of root.querySelectorAll("[data-del]")) {
      el.addEventListener("click", () => { 경기들.splice(Number(el.dataset.del), 1); 알림 = []; render(); });
    }
    root.querySelector("#season-clear")?.addEventListener("click", () => { 경기들 = []; 알림 = []; 차트대상 = null; render(); });
    root.querySelector("#season-xlsx")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      try { const f = await 시즌엑셀파일(경기들); 내려주기(f.blob, f.이름); }
      catch (err) { 알림 = [`엑셀을 만들지 못했어요: ${err?.message || err}`]; render(); }
      finally { btn.disabled = false; }
    });
  }

  async function 올리기(files) {
    알림 = [];
    let 새것 = 0;
    for (const f of [...(files || [])]) {
      try {
        const g = await 경기엑셀읽기(await f.arrayBuffer());
        if (경기들.some((x) => x.서명 === g.서명)) { 알림.push(`${f.name} — 이미 올린 경기라 한 번만 셉니다`); continue; }
        경기들.push(g); 새것 += 1;
      } catch (err) {
        알림.push(`${f.name} — ${err?.message || err}`);
      }
    }
    if (새것) 알림.unshift(`${새것}경기를 더했어요`);
    render();
  }

  render();
}
