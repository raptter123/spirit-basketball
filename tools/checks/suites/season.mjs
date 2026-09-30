// 시즌 합치기 — 경기 엑셀 여러 개를 올리면 선수별 누적 · 누적 샷 차트가 맞게 나오는가.
//
// 올리는 엑셀은 기록 탭과 같은 코드(record-export.js 의 엑셀파일)로 브라우저 안에서 만든다.
// 기대값은 엑셀을 거치지 않고 경기 원본(record.js 의 boxScore · plusMinus · 이긴팀)에서
// 따로 센다 — 엑셀로 썼다가 다시 읽는 길에서 숫자가 새는지를 보는 시험이다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dlseason");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
await p.goto(`${URL}/index.html#/stats`); await p.waitForTimeout(800);

// ── 경기 넷(2팀 셋 + 교류전 하나)을 만들고 엑셀로 ──
const 만든것 = await p.evaluate(async () => {
  const X = await import("./js/record-export.js");
  const xl = await import("./js/xlsx-lite.js");
  const 팀 = (n, ps) => ({ name: n, players: ps.map((x) => ({ name: x })), onCourt: ps.slice(0, 5) });
  let t = new Date("2026-09-06T12:10:00").getTime();
  const 슛 = (team, player, pts, made, x = 250, y = 380) => ({ t: t++, q: 1, type: "shot", team, player, pts, made, x, y });
  const 딴 = (team, player, type) => ({ t: t++, q: 1, type, team, player });
  const A = ["김산", "조우진", "심인보"], B = ["고성익", "권혁남", "김도여"];
  const 경기 = (date, i, a, b2, ev) => ({ date, quarters: 4, q: 2, startedAt: new Date(`${date}T12:00:00`).getTime() + i, teams: [a, b2], events: ev });
  const games = [
    경기("2026-09-06", 0, 팀("A팀", A), 팀("B팀", B), [슛(0, "김산", 3, true, 60, 300), 슛(1, "고성익", 2, true), 딴(0, "조우진", "ast"), 딴(1, "권혁남", "rebD"), 슛(0, "심인보", 2, false, 240, 420)]),
    경기("2026-09-13", 1, 팀("A팀", A), 팀("B팀", B), [슛(1, "고성익", 3, true, 440, 300), 슛(1, "김도여", 2, true), 슛(0, "김산", 2, true), 딴(0, "김산", "rebO"), 딴(1, "고성익", "stl")]),
    경기("2026-09-20", 2, 팀("B팀", ["김산", "고성익"]), 팀("C팀", ["조우진", "권혁남"]), [슛(0, "김산", 2, true), 슛(1, "조우진", 3, false, 250, 170), 딴(1, "권혁남", "blk")]),
  ];
  const ex = 경기("2026-09-27", 3, 팀("혼", ["김산", "조우진", "심인보"]), { name: "불사조", players: [], opp: true, final: 5 }, [슛(0, "김산", 2, true), 슛(0, "심인보", 3, true, 60, 300)]);
  ex.no = 1;
  games.push(ex);
  const 파일들 = [];
  for (const g of games) {
    const f = await X.엑셀파일(g);
    const buf = new Uint8Array(await f.blob.arrayBuffer());
    let s = ""; for (const c of buf) s += String.fromCharCode(c);
    파일들.push({ name: f.이름, b64: btoa(s) });
  }
  // 기록 탭 엑셀이 아닌 것 하나
  const 딴파일 = await xl.createWorkbook("Sheet1", [["이름", "점수"], ["홍길동", 3]]);
  let s = ""; for (const c of new Uint8Array(딴파일)) s += String.fromCharCode(c);
  파일들.push({ name: "other.xlsx", b64: btoa(s) });
  // 기대값 — 원본에서 따로
  const R = await import("./js/record.js"); const S = await import("./js/record-stats.js");
  const 합 = {};
  for (const g of games) {
    const pm = R.교류전(g) ? null : S.plusMinus(g);
    const 누가 = R.이긴팀(g);
    for (const r of R.boxScore(g)) {
      if (!R.기록팀(g).includes(r.team)) continue;
      const a = (합[r.name] ||= { 경기: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, 승: 0, 판: 0, pm: null });
      a.경기 += 1; a.pts += r.pts; a.reb += r.reb; a.ast += r.ast; a.stl += r.stl; a.blk += r.blk;
      if (누가 != null) { a.판 += 1; if (누가 === r.team) a.승 += 1; }
      if (pm) a.pm = (a.pm ?? 0) + (pm[`${r.team}|${r.name}`] ?? 0);
    }
  }
  const 슛수 = games.reduce((n, g) => n + g.events.filter((e) => e.type === "shot").length, 0);
  return { 파일들, 합, 슛수 };
});
const 넣기 = (목록) => p.setInputFiles("#season-input", 목록.map((f) => ({ name: f.name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(f.b64, "base64") })));

await 넣기(만든것.파일들); await p.waitForTimeout(1200);
const 화면 = () => p.evaluate(() => {
  const t = document.querySelector(".season-table");
  const 머리 = t ? [...t.querySelectorAll("thead th")].map((x) => x.textContent.trim()) : [];
  return {
    알림: [...document.querySelectorAll(".season-notes li")].map((l) => l.textContent.trim()),
    범위: document.querySelector(".season-range")?.textContent.trim(),
    머리,
    줄: t ? [...t.querySelectorAll("tbody tr")].map((tr) => Object.fromEntries([...tr.children].map((td, i) => [머리[i], td.textContent.replace(/\s+/g, " ").trim()]))) : [],
    점: document.querySelectorAll("#season-chart-svg .shot-made, #season-chart-svg .shot-miss").length,
    가로: document.documentElement.scrollWidth - innerWidth,
  };
});
let r = await 화면();
확인(r.알림[0] === "4경기를 더했어요" && r.알림.some((m) => m.startsWith("other.xlsx — 기록 탭에서 받은 경기 엑셀이 아니에요")),
  `올리기 — ${r.알림.join(" / ")}`);
확인(r.범위 === "4경기 · 2026-09-06 ~ 2026-09-27", `범위 "${r.범위}"`);
const 틀림 = r.줄.filter((row) => {
  const a = 만든것.합[row["선수"]]; if (!a) return true;
  const 평 = (v) => (v / a.경기).toFixed(1);
  return row["경기"] !== String(a.경기) || row["득점"] !== `${평(a.pts)} (${a.pts})` || row["리바"] !== 평(a.reb) || row["어시"] !== 평(a.ast)
    || row["스틸"] !== String(a.stl) || row["블락"] !== String(a.blk)
    || row["승률"] !== (a.판 ? `${(a.승 / a.판 * 100).toFixed(1)}%` : "–")
    || row["+/-"] !== (a.pm == null ? "–" : a.pm > 0 ? `+${a.pm}` : `${a.pm}`);
});
확인(r.줄.length === Object.keys(만든것.합).length && !틀림.length,
  `선수 ${r.줄.length}명 경기 · 득점 · 리바 · 어시 · 스틸 · 블락 · 승률 · +/- 가 경기 원본에서 따로 센 값과 같음${틀림.length ? " — 틀림: " + 틀림.map((x) => JSON.stringify(x)).join(" ") : ""}`);
const 김산 = r.줄.find((x) => x["선수"] === "김산");
확인(김산?.["경기"] === "4" && 김산?.["+/-"] === `${만든것.합["김산"].pm > 0 ? "+" : ""}${만든것.합["김산"].pm}`,
  `김산 — 4경기(3파전처럼 팀이 바뀌어도 이름으로 묶임) · +/- 는 교류전 빼고 ${김산?.["+/-"]}`);
확인(r.점 === 만든것.슛수, `누적 샷 차트 점 ${r.점}개 = 네 경기 슛 ${만든것.슛수}개`);
확인(r.가로 === 0, `390px 가로 넘침 ${r.가로}px`);

// 선수 하나 고르기
await p.click('#season-chart [data-who="김산"]'); await p.waitForTimeout(200);
const 김산점 = await p.evaluate(() => document.querySelectorAll("#season-chart-svg .shot-made, #season-chart-svg .shot-miss").length);
확인(김산점 === 4, `김산만 보기 — 점 ${김산점}개 (네 경기 슛 4개)`);

// 같은 파일을 또 올리면
await 넣기(만든것.파일들.slice(0, 2)); await p.waitForTimeout(800);
r = await 화면();
확인(r.범위.startsWith("4경기") && r.알림.filter((m) => m.includes("이미 올린 경기")).length === 2, `같은 두 파일 다시 올리기 — ${r.범위} · ${r.알림.join(" / ")}`);

// 합친 엑셀
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#season-xlsx")]);
const 파일 = `${DL}/${dl.suggestedFilename()}`; await dl.saveAs(파일);
const 엑셀 = JSON.parse(execFileSync("python3", ["-c", `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(파일)}, data_only=True)
ws = wb["시즌합계"]; rows = [list(r) for r in ws.iter_rows(values_only=True)]; h = rows[0]
표 = {r[h.index("선수")]: [r[h.index("경기수")], r[h.index("득점")], r[h.index("리바운드")], r[h.index("+/-")]] for r in rows[1:] if r[0] and not str(r[0]).startswith("■")}
print(json.dumps({"시트": wb.sheetnames, "표": 표, "목록": wb["경기목록"].max_row - 1}, ensure_ascii=False))
`], { encoding: "utf8" }));
const 엑셀틀림 = Object.entries(만든것.합).filter(([n, a]) => { const e = 엑셀.표[n]; return !e || e[0] !== a.경기 || e[1] !== a.pts || e[2] !== a.reb || (e[3] ?? null) !== (a.pm ?? null) && !(a.pm == null && e[3] === ""); });
확인(엑셀.시트.join() === "시즌합계,경기목록" && 엑셀.목록 === 4 && !엑셀틀림.length,
  `합친 엑셀 ${dl.suggestedFilename()} — 시트 [${엑셀.시트}] · 경기목록 ${엑셀.목록}줄 · 선수 숫자 같음${엑셀틀림.length ? " — 틀림: " + 엑셀틀림.map(([n]) => n).join(", ") : ""}`);

// 빼기
await p.click(".season-list summary");
await p.click('.season-del[data-del="3"]'); await p.waitForTimeout(300);
r = await 화면();
확인(r.범위.startsWith("3경기"), `한 경기 빼기 → "${r.범위}"`);
const 누름 = await p.evaluate(() => [...document.querySelectorAll("#season-root button, #season-root .sheet-drop")].map((x) => { x.scrollIntoView({ block: "center" }); return Math.round(x.getBoundingClientRect().height); }));
확인(누름.every((h) => h >= 44), `누를 곳 ${누름.length}개 높이 최소 ${Math.min(...누름)}px`);

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
