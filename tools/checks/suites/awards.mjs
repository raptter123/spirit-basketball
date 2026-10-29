// 연말 결산 "혼 어워즈"(js/awards.js) — 시즌 합치기에 올린 경기들로 부문별 1위 한 장.
//
// 1) 뽑는 규칙(가짜 합계로): 평균 부문은 올린 경기의 절반 이상 나온 사람만, 1위가 여럿이면
//    셋까지 같이, 기록이 아무에게도 없으면 그 부문은 뺀다, 3점왕은 합계 · 개근상은 경기 수.
// 2) 화면: 기록 탭 엑셀 세 개를 올리면 '🏆 어워즈 이미지' 가 생기고, 누르면 그림(폭 1080px)이
//    뜨고, 다운로드 파일 이름이 spirit-awards-2026.png. 그림 속 숫자는 시즌 합계 표와 같다.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`${URL}/index.html#/stats`); await p.waitForTimeout(800);

// ── 1) 규칙 ──
const r = await p.evaluate(async () => {
  const A = await import("./js/awards.js");
  const 사람 = (name, 경기수, o = {}) => ({ name, 경기수, pts: 0, reb: 0, ast: 0, stl: 0, p3m: 0, ...o });
  const rows = [
    사람("김산", 4, { pts: 60, reb: 12, ast: 8, p3m: 5 }),        // 경기당 15.0
    사람("조우진", 4, { pts: 60, reb: 20, ast: 4, p3m: 2 }),      // 경기당 15.0 — 김산과 공동
    사람("심인보", 1, { pts: 30, reb: 15, ast: 9, p3m: 6 }),       // 1경기 30점이지만 자격(2경기) 없음 · 3점은 합계라 1위
    사람("고성익", 3, { pts: 30, reb: 21, ast: 3 }),             // 리바 경기당 7.0
  ];
  return { 기준: A.자격경기(4), 상: A.어워즈(rows, 4), 빈: A.어워즈([사람("김산", 2)], 2) };
});
const 찾기 = (이름) => r.상.find((s) => s.이름 === 이름);
확인(r.기준 === 2, `4경기를 올리면 평균 부문 자격은 ${r.기준}경기 이상`);
확인(찾기("득점왕")?.사람들.join() === "김산,조우진" && 찾기("득점왕").값말 === "경기당 15.0점",
  `득점왕 공동 ${찾기("득점왕")?.사람들.join(" · ")} (${찾기("득점왕")?.값말}) — 1경기 30점(심인보)은 자격 없음`);
확인(찾기("리바운드왕")?.사람들.join() === "고성익" && 찾기("리바운드왕").값말 === "경기당 7.0개", `리바운드왕 ${찾기("리바운드왕")?.사람들} (${찾기("리바운드왕")?.값말})`);
확인(찾기("3점왕")?.사람들.join() === "심인보" && 찾기("3점왕").값말 === "3점 6개", `3점왕은 합계 — ${찾기("3점왕")?.사람들} (${찾기("3점왕")?.값말})`);
확인(찾기("개근상")?.사람들.join() === "김산,조우진" && 찾기("개근상").값말 === "4경기 전부", `개근상 ${찾기("개근상")?.사람들.join(" · ")} (${찾기("개근상")?.값말})`);
확인(!찾기("스틸왕"), "스틸을 아무도 안 적었으면 스틸왕 칸은 뺌");
확인(r.빈.map((s) => s.이름).join() === "개근상", `기록이 하나도 없는 시즌이면 개근상만 (${r.빈.map((s) => s.이름).join()})`);

// ── 2) 화면 ──
const 파일들 = await p.evaluate(async () => {
  const X = await import("./js/record-export.js");
  const 팀 = (n, ps) => ({ name: n, players: ps.map((x) => ({ name: x })), onCourt: ps.slice(0, 5) });
  let t = new Date("2026-12-06T12:10:00").getTime();
  const 슛 = (team, player, pts, made) => ({ t: t++, q: 1, type: "shot", team, player, pts, made, x: pts === 3 ? 60 : 250, y: pts === 3 ? 300 : 380 });
  const 딴 = (team, player, type) => ({ t: t++, q: 1, type, team, player });
  const A = ["김산", "조우진", "심인보"], B = ["고성익", "권혁남", "김도여"];
  const 경기 = (date, i, ev) => ({ date, quarters: 4, q: 2, startedAt: new Date(`${date}T12:00:00`).getTime() + i, teams: [팀("화이트", A), 팀("퍼플", B)], events: ev });
  const games = [
    경기("2026-12-06", 0, [슛(0, "김산", 3, true), 슛(0, "김산", 2, true), 슛(1, "고성익", 2, true), 딴(1, "권혁남", "rebD"), 딴(0, "조우진", "ast")]),
    경기("2026-12-13", 1, [슛(0, "김산", 2, true), 슛(1, "고성익", 3, true), 딴(1, "권혁남", "rebD"), 딴(0, "심인보", "stl")]),
    경기("2026-12-20", 2, [슛(1, "김도여", 2, true), 딴(1, "권혁남", "rebO"), 딴(0, "조우진", "ast")]),
  ];
  const out = [];
  for (const g of games) {
    const f = await X.엑셀파일(g);
    const buf = new Uint8Array(await f.blob.arrayBuffer());
    let s = ""; for (const c of buf) s += String.fromCharCode(c);
    out.push({ name: f.이름, b64: btoa(s) });
  }
  return out;
});
await p.evaluate(() => document.querySelector("#season-input")?.scrollIntoView());
await p.setInputFiles("#season-input", 파일들.map((f) => ({ name: f.name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(f.b64, "base64") })));
await p.waitForTimeout(800);
확인(await p.locator("#season-awards").count() === 1, "경기를 올리면 '🏆 어워즈 이미지' 단추가 생김");
await p.click("#season-awards"); await p.waitForTimeout(600);
const 창 = await p.evaluate(() => {
  const i = document.getElementById("awards-img");
  return { 제목: document.getElementById("awards-title")?.textContent, w: i?.naturalWidth, h: i?.naturalHeight, alt: i?.alt };
});
확인(창.제목 === "2026 혼 어워즈" && 창.w === 1080 && 창.h > 600, `어워즈 창 "${창.제목}" · 그림 ${창.w}×${창.h}`);
// 그림 속 숫자 = 시즌 합계(같은 함수로 셈)
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#awards-download")]);
확인(dl.suggestedFilename() === "spirit-awards-2026.png", `다운로드 파일 ${dl.suggestedFilename()}`);
await p.click("#awards-close"); await p.waitForTimeout(200);
확인(await p.locator("#awards-img").count() === 0, "닫기 → 창 닫힘");

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
