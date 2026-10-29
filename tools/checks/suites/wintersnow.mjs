// 겨울 홈 화면의 눈(js/winter.js) — 언제 · 어디서 · 누구에게 보이는가.
//
// 1) 12/1 ~ 2월 말에만(11/30 · 3/1 에는 없음). 2028 년 2/29 도 겨울.
// 2) 홈에서만 — 일정 · 기록 화면으로 가면 사라진다.
// 3) 눌리지 않는다 — 눈이 덮은 자리의 단추가 그대로 눌린다.
// 4) '동작 줄이기' 를 켠 폰에서는 안 보인다.
// 5) 두 테마에서 눈 색이 바탕과 다르다(밝은 테마의 크림 바탕에 흰 눈이면 안 보인다).
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 열기(시각, { 길 = "#/", theme = "dark", motion = "no-preference" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul", reducedMotion: motion });
  await ctx.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } }, theme);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(시각) });
  await p.goto(`${URL}/index.html${길}`); await p.waitForTimeout(500);
  return { p, ctx };
}
const 눈 = (p) => p.evaluate(() => {
  const s = document.querySelector(".home-snow");
  if (!s) return { 있음: false };
  const i = s.querySelector("i");
  return { 있음: true, 개수: s.querySelectorAll("i").length, 보임: getComputedStyle(s).display !== "none",
    눌림: getComputedStyle(s).pointerEvents, 움직임: getComputedStyle(i).animationName, 색: getComputedStyle(i).backgroundColor,
    바탕: getComputedStyle(document.body).backgroundColor };
});

for (const [시각, 기대] of [["2026-11-30T12:00:00+09:00", false], ["2026-12-01T09:00:00+09:00", true], ["2027-01-15T12:00:00+09:00", true],
  ["2027-02-28T22:00:00+09:00", true], ["2027-03-01T09:00:00+09:00", false], ["2028-02-29T12:00:00+09:00", true]]) {
  const { p, ctx } = await 열기(시각);
  const r = await 눈(p);
  확인(r.있음 === 기대 && (!기대 || (r.개수 === 18 && r.움직임 === "home-snow-fall")),
    `${시각.slice(0, 10)} 홈 — 눈 ${r.있음 ? `있음(${r.개수}개)` : "없음"}`);
  await ctx.close();
}

{
  const { p, ctx } = await 열기("2026-12-10T12:00:00+09:00");
  const r = await 눈(p);
  확인(r.눌림 === "none", `눈은 눌리지 않음(pointer-events ${r.눌림})`);
  // 눈이 덮은 자리의 단추 — 홈의 '팀 짜기' 를 눌러 화면이 바뀌나
  const 단추 = p.locator(".home-next-btns a").first();
  await 단추.click(); await p.waitForTimeout(400);
  const 길 = await p.evaluate(() => location.hash);
  확인(길 === "#/team-shuffle", `눈 너머 단추가 눌림 → ${길}`);
  확인(!(await 눈(p)).있음, "다른 화면(팀 편성)으로 가면 눈 없음");
  await p.evaluate(() => { location.hash = "#/record"; }); await p.waitForTimeout(400);
  확인(!(await 눈(p)).있음, "기록 화면에도 눈 없음");
  await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(400);
  확인((await 눈(p)).있음, "홈으로 돌아오면 다시 눈");
  await ctx.close();
}

{
  const { p, ctx } = await 열기("2026-12-10T12:00:00+09:00", { motion: "reduce" });
  const r = await 눈(p);
  확인(r.있음 && !r.보임, "'동작 줄이기' 를 켜면 눈이 안 보임(display none)");
  await ctx.close();
}

for (const theme of ["dark", "light"]) {
  const { p, ctx } = await 열기("2026-12-10T12:00:00+09:00", { theme });
  const r = await 눈(p);
  // 밝은 테마에서는 흰 눈이 크림 바탕에 묻히므로 흰색이 아니어야 한다.
  확인(r.색 !== r.바탕 && (theme === "dark" || !r.색.startsWith("rgba(255, 255, 255")), `${theme} 눈 색 ${r.색} · 바탕 ${r.바탕}`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
