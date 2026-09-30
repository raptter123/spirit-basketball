// 홈 — '다음 일정' 카드와 두 칸 메뉴.
//
// 카드는 오늘 날짜에 따라 말이 바뀐다(D-day, 참불 마감). 날짜마다 시계를 박아 두고 본다.
// 2026-10-04 는 일요일 자체전, 마감은 그 주 수요일(9/30).
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 열기({ 시각, w = 390, h = 844, 테마 = "dark", 보관함 = null }) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 테마 });
  await ctx.addInitScript(([t, g]) => {
    try {
      localStorage.setItem("spirit-theme", t);
      if (g) localStorage.setItem("spirit-record-games", JSON.stringify(g));
    } catch (e) { /* */ }
  }, [테마, 보관함]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(시각) });
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(600);
  return { p, ctx };
}
const 카드 = (p) => p.evaluate(() => {
  const q = (s) => document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim() ?? null;
  return { dday: q(".home-next-dday"), 제목: q(".home-next-what"), 둘째: q(".home-next-sub"), 마감: q(".home-next-due"),
    버튼: [...document.querySelectorAll(".home-next-btns a")].map((a) => `${a.textContent.trim()}→${a.getAttribute("href")}`),
    겹침: document.querySelector("#app").innerText.includes("자체전 자체전") };
});

// ── 날짜마다 카드 말 ──
for (const [시각, dday, 마감] of [
  ["2026-09-28T10:00", "D-6", "참불 마감 9월 30일(수)까지 · 18명 넘으면 게스트 없음"],
  ["2026-09-29T10:00", "D-5", "참불 마감 내일(수)까지 · 18명 넘으면 게스트 없음"],
  ["2026-09-30T10:00", "D-4", "참불 마감 오늘(수)까지 · 18명 넘으면 게스트 없음"],
  ["2026-10-01T10:00", "D-3", "참불 마감 수요일에 마감됐어요 · 18명 넘으면 게스트 없음"],
  ["2026-10-04T10:00", "D-Day", null],
]) {
  const { p, ctx } = await 열기({ 시각 });
  const r = await 카드(p);
  const 제목맞음 = r.제목 === "자체전 · 10월 4일(일)";
  확인(r.dday === dday && 제목맞음 && r.마감 === 마감 && !r.겹침,
    `${시각.slice(5, 10)} — ${r.dday} "${r.제목}" · ${r.마감 ?? "(마감 줄 없음)"}${r.겹침 ? " · '자체전 자체전' 겹침" : ""}`);
  if (시각.startsWith("2026-09-30")) {
    확인(r.둘째 === "12:00–15:00 · 신당초등학교 · 후문 입장", `둘째 줄 "${r.둘째}"`);
    확인(r.버튼.join(" ") === "팀 짜기→#/team-shuffle 기록 시작→#/record", `버튼 ${r.버튼.join(" · ")}`);
  }
  await ctx.close();
}

// ── 대회가 먼저 오면: 제목에 종류, 팀 짜기 없음 ──
{
  const { p, ctx } = await 열기({ 시각: "2026-08-05T10:00" });
  const r = await 카드(p);
  확인(r.제목 === "대회 · 스타터스 리그 대회 · 8월 8일(토)" && r.버튼.join() === "기록 시작→#/record" && r.마감 === null,
    `대회 카드 — "${r.제목}" · 버튼 ${r.버튼.join(" · ")} · 마감 줄 ${r.마감 ?? "없음"}`);
  await ctx.close();
}

// ── 폭 · 테마마다: 넘침 · 두 칸 · 누를 곳 · 명암비 ──
function 명암(fg, bg) {
  const L = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const [a, c] = [L(fg), L(bg)].sort((x, y) => y - x); return (a + 0.05) / (c + 0.05);
}
for (const 테마 of ["dark", "light"]) for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024]]) {
  const { p, ctx } = await 열기({ 시각: "2026-09-30T10:00", w, h, 테마 });
  const r = await p.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 4).map(Number);
    const 바탕 = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c[3] !== 0 && c.length === 3 || c[3] === 1) return c.slice(0, 3); } return rgb(getComputedStyle(document.body).backgroundColor).slice(0, 3); };
    const 글씨들 = [...document.querySelectorAll(".home-next *, .home-card h2, .home-card p")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !e.closest(".btn"));
    const 명암들 = 글씨들.map((e) => ({ 글: e.textContent.trim().slice(0, 12), fg: rgb(getComputedStyle(e).color).slice(0, 3), bg: 바탕(e) }));
    const 누름 = [...document.querySelectorAll(".home-next a, .home-card, .home-last")].map((a) => {
      a.scrollIntoView({ block: "center" }); const r = a.getBoundingClientRect(); return { 글: a.textContent.trim().slice(0, 8), h: Math.round(r.height), w: Math.round(r.width) };
    });
    const 칸x = new Set([...document.querySelectorAll(".home-card")].map((c) => Math.round(c.getBoundingClientRect().left)));
    const m = document.querySelector(".home-menu").getBoundingClientRect();
    return { 넘침: document.documentElement.scrollWidth - innerWidth, 명암들, 누름, 열: 칸x.size, 메뉴높이: Math.round(m.height) };
  });
  const 낮은것 = r.명암들.map((x) => ({ ...x, v: 명암(x.fg, x.bg) })).filter((x) => x.v < 4.5);
  const 작은것 = r.누름.filter((x) => x.h < 44 || x.w < 44);
  const 기대열 = w < 720 ? 2 : null;
  확인(r.넘침 === 0 && !낮은것.length && !작은것.length && (기대열 === null || r.열 === 기대열) && (w >= 720 || r.메뉴높이 <= 400),
    `${테마} ${w}px — 가로 넘침 ${r.넘침} · 메뉴 ${r.열}칸 ${r.메뉴높이}px · 명암 4.5 미만 ${낮은것.length}${낮은것.length ? " (" + 낮은것.map((x) => `${x.글} ${x.v.toFixed(2)}`).join(", ") + ")" : ""} · 44px 미만 ${작은것.length}${작은것.length ? " (" + 작은것.map((x) => `${x.글} ${x.w}×${x.h}`).join(", ") + ")" : ""}`);
  await ctx.close();
}

// ── 지난 경기 칸: 보관함이 있으면 점수와 함께, 없으면 없음 ──
{
  const ev = (team, pts) => ({ t: 1, q: 1, type: "shot", team, player: "x", made: true, pts });
  const 경기 = [{ date: "2026-09-27", quarters: 4, q: 4, startedAt: 1790000000000,
    teams: [{ name: "A팀", players: [] }, { name: "B팀", players: [] }],
    events: [ev(0, 2), ev(0, 3), ev(1, 2)] }];
  const { p, ctx } = await 열기({ 시각: "2026-09-30T10:00", 보관함: 경기 });
  const 글 = await p.evaluate(() => document.querySelector(".home-last")?.textContent.replace(/\s+/g, " ").trim());
  확인(글 === "지난 경기 · 9/27 A팀 5 : 2 B팀 보관함 →", `지난 경기 칸 "${글}"`);
  await ctx.close();
  const { p: p2, ctx: c2 } = await 열기({ 시각: "2026-09-30T10:00" });
  확인(!(await p2.$(".home-last")), "보관함이 비면 지난 경기 칸 없음");
  await c2.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
