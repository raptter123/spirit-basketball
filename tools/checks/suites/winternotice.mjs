// 팀 공지 이미지 — 12 ~ 2월 경기에는 겨울 색(❄️ 눈꽃 · 🎄 성탄 · 🌙 겨울밤)을 고르게 한다.
//
// 1) 경기 날짜로 철을 고른다: 11/29 가을 · 12/6 겨울 · 1월 · 2/28 겨울 · 3/7 가을.
//    오늘이 아니라 경기 날짜다(11월 말에 12월 경기 공지를 만들 수 있다).
// 2) 겨울 색 셋 × 2팀 · 3팀 그림이 오류 없이 나오고, 첫 색(눈꽃)이 골라져 있다.
// 3) 겨울 색의 제목 · 이름 글씨 명암비(종이 · 칸 바탕 기준) 4.5 이상.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 공지(날짜, 팀수 = 2, n = 12) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(300);
  await p.evaluate(async ([날짜, 팀수, n]) => {
    const { ROSTER } = await import("./js/roster.js");
    const sel = ROSTER.slice(0, n).map((x) => x.name);
    const asg = {}; sel.forEach((x, i) => (asg[x] = i % 팀수));
    localStorage.setItem("spirit-team-builder-draft", JSON.stringify({ teamCount: 팀수, gameDate: 날짜, selected: sel, assignments: asg }));
  }, [날짜, 팀수, n]);
  await p.goto(`${URL}/index.html?s=${Math.random()}#/team-shuffle`); await p.waitForTimeout(600);
  await p.click("#ts-image-btn"); await p.waitForTimeout(400);
  return { p, ctx };
}
const 칩 = (p) => p.evaluate(() => [...document.querySelectorAll(".ts-color-chip")].map((c) => `${c.textContent.trim()}${c.classList.contains("chip-active") ? "*" : ""}`));

for (const [날짜, 철] of [["2026-11-29", "가을"], ["2026-12-06", "겨울"], ["2027-01-17", "겨울"], ["2027-02-28", "겨울"], ["2027-03-07", "가을"]]) {
  const { p, ctx } = await 공지(날짜);
  const c = await 칩(p);
  const 기대 = 철 === "겨울" ? ["❄️ 눈꽃*", "🎄 성탄", "🌙 겨울밤"] : ["🍁 단풍*", "🍂 낙엽", "🌾 은행"];
  확인(c.join() === 기대.join(), `${날짜} 경기 → ${철} 색 (${c.join(" · ")})`);
  await ctx.close();
}

for (const 팀수 of [2, 3]) {
  const { p, ctx } = await 공지("2026-12-20", 팀수, 팀수 * 6);
  for (const 색 of ["snow", "xmas", "night"]) {
    await p.click(`.ts-color-chip[data-color="${색}"]`); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { const i = document.querySelector(".ts-image-preview img"); return { w: i.naturalWidth, h: i.naturalHeight, 켜짐: document.querySelector(".ts-color-chip.chip-active")?.dataset.color }; });
    확인(r.w > 300 && r.h > 300 && r.켜짐 === 색, `${팀수}팀 ${색} 그림 ${r.w}×${r.h}`);
  }
  await ctx.close();
}

// 명암비
{
  const { p, ctx } = await 공지("2026-12-20");
  const r = await p.evaluate(async () => {
    const { 공지색 } = await import("./js/team-shuffle.js");
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cr = (a, b) => { const [x, y] = [L(rgb(a)), L(rgb(b))].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
    return ["snow", "xmas", "night"].map((k) => { const P = 공지색(k); return [k, cr(P.title, P.paper), cr(P.ink, P.card), cr(P.ink, P.paper)]; });
  });
  for (const [k, 제목, 이름, 이름종이] of r) 확인(제목 >= 4.5 && 이름 >= 4.5 && 이름종이 >= 4.5, `${k} 명암비 제목 ${제목} · 이름(칸) ${이름} · 이름(종이) ${이름종이}`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
