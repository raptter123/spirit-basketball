// 정기 일정 쉬는 날(js/events.js SKIP_DAYS) — 홈 · 달력 · 팀 편성 기본 날짜가 건너뛰는가.
//
// 지금까지는 자체전이 "매주 일요일" 고정이라, 설날(2027-02-07 일요일)에도 홈 '다음 일정' 이
// 그날 자체전을 띄웠다. SKIP_DAYS 는 실제 쉬는 날이 정해지면 채운다 — 이 시험은 모듈에
// 쉬는 날을 넣어 보고 화면을 다시 그려서 잰다.
//
// 1) 쉬는 날이 없으면 지금과 같다(2/3 에 보면 2/7 자체전).
// 2) 2/7 을 쉬면: 홈은 2/14 를 다음 일정으로, "02-07 자체전은 쉬어요 (설날)" 한 줄.
// 3) 연말 두 주(12/27 · 1/3)를 잇달아 쉬어도 팀 편성 기본 날짜가 1/10 으로 잡힌다(4주를 본다).
// 4) 달력: 쉬는 날 칸은 빈 고리 점 + 풍선 글, 그 날을 누르면 "자체전 — 쉬어요".
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 열기(시각, 쉼 = []) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(시각) });
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(500);
  if (쉼.length) {
    await p.evaluate(async (쉼) => { const m = await import("./js/events.js"); m.SKIP_DAYS.push(...쉼); }, 쉼);
    await p.evaluate(() => { location.hash = "#/glossary"; }); await p.waitForTimeout(200);
    await p.evaluate(() => { location.hash = "#/"; }); await p.waitForTimeout(300);
  }
  return { p, ctx };
}
const 홈 = (p) => p.evaluate(() => ({
  다음: document.querySelector("#home-next-title")?.textContent.trim(),
  디데이: document.querySelector(".home-next-dday")?.textContent.trim(),
  쉼: document.querySelector(".home-next-off")?.innerText.trim() || "",
}));

{
  const { p, ctx } = await 열기("2027-02-03T10:00:00+09:00");
  const r = await 홈(p);
  확인(r.다음?.includes("2월 7일") && !r.쉼, `쉬는 날 없음 → 지금과 같음: "${r.다음}" ${r.디데이}`);
  await ctx.close();
}
{
  const { p, ctx } = await 열기("2027-02-03T10:00:00+09:00", [{ date: "2027-02-07", title: "자체전", reason: "설날" }]);
  let r = await 홈(p);
  확인(r.다음?.includes("2월 14일") && r.디데이 === "D-11", `2/7 쉼 → 다음 일정 "${r.다음}" ${r.디데이}`);
  확인(r.쉼 === "02-07 자체전은 쉬어요 (설날)", `홈 안내 "${r.쉼}"`);
  // 팀 편성 기본 날짜
  await p.evaluate(() => localStorage.removeItem("spirit-team-builder-draft"));
  await p.evaluate(() => { location.hash = "#/team-shuffle"; }); await p.waitForTimeout(400);
  const 날 = await p.evaluate(() => document.getElementById("ts-date").value);
  확인(날 === "2027-02-14", `팀 편성 기본 날짜 ${날}`);
  // 달력
  await p.evaluate(() => { location.hash = "#/schedule"; }); await p.waitForTimeout(400);
  const 칸 = await p.evaluate(() => {
    const c = document.querySelector('.calendar-day[data-date="2027-02-07"]');
    return { 고리: c.querySelectorAll(".event-dot.is-off").length, 점: c.querySelectorAll(".event-dot:not(.is-off)").length, 풍선: c.title, 범례: !!document.querySelector(".legend-dot.is-off") };
  });
  확인(칸.고리 === 1 && 칸.점 === 0 && 칸.풍선 === "설날 · 자체전 쉼(설날)" && 칸.범례, `달력 2/7: 고리 ${칸.고리} · 색 점 ${칸.점} · 풍선 "${칸.풍선}" · 범례 '쉼'`);
  await p.click('.calendar-day[data-date="2027-02-07"]'); await p.waitForTimeout(200);
  const 카드 = await p.evaluate(() => document.querySelector(".day-detail .event-card")?.innerText.replace(/\s+/g, " ").trim());
  확인(카드 === "자체전 자체전 — 쉬어요 2027-02-07 · 설날", `2/7 을 누르면 "${카드}"`);
  const 다가옴 = await p.evaluate(() => document.querySelector(".upcoming-list .event-card .event-meta")?.textContent.trim());
  확인(다가옴?.startsWith("2027-02-14"), `다가오는 일정 첫 칸 ${다가옴}`);
  await ctx.close();
}
{
  const { p, ctx } = await 열기("2026-12-23T10:00:00+09:00", [
    { date: "2026-12-27", title: "자체전", reason: "연말" }, { date: "2027-01-03", title: "자체전", reason: "신정 연휴" }]);
  const r = await 홈(p);
  확인(r.다음?.includes("1월 10일") && r.쉼 === "12-27 자체전은 쉬어요 (연말)\n2027-01-03 자체전은 쉬어요 (신정 연휴)",
    `연말 두 주 쉼 → "${r.다음}" · 안내 "${r.쉼.replace(/\n/g, " / ")}"`);
  await p.evaluate(() => localStorage.removeItem("spirit-team-builder-draft"));
  await p.evaluate(() => { location.hash = "#/team-shuffle"; }); await p.waitForTimeout(400);
  const 날 = await p.evaluate(() => document.getElementById("ts-date").value);
  확인(날 === "2027-01-10", `팀 편성 기본 날짜 ${날} (두 주 건너뜀)`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
