// 12/24 · 25 에만 헤더 로고에 산타 모자(js/winter.js 성탄모자).
//
// 1) 12/23 · 12/26 에는 없고, 12/24 · 12/25 에만 있다(서울 날짜).
// 2) 모자는 장식이다 — 화면 낭독기에 안 읽히고, 눌리지 않아 로고 링크가 그대로 눌린다.
// 3) 페이지를 연 채 자정을 넘기면 화면을 옮길 때 모자가 벗겨진다.
// 4) 모자가 로고 칸 위쪽에 얹혀 있다(폰 40px · PC 54px 로고). 비스듬히 돌려서 왼쪽으로
//    로고보다 10px 쯤 나간다 — 14px 까지 둔다.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 열기(시각, w = 390, h = 844, 길 = "#/schedule") {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, timezoneId: "Asia/Seoul" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(시각) });
  await p.goto(`${URL}/index.html${길}`); await p.waitForTimeout(500);
  return { p, ctx };
}
// 로고는 테마마다 한 벌씩이라 보이는 로고 안의 모자를 잰다.
const 모자 = (p) => p.evaluate(() => {
  const 로고 = [...document.querySelectorAll(".brand-logo")].find((x) => getComputedStyle(x).display !== "none");
  const h = 로고?.querySelector(".brand-hat");
  if (!h) return null;
  const r = h.getBoundingClientRect(), lr = 로고.getBoundingClientRect();
  return { 눌림: getComputedStyle(h).pointerEvents, 숨김: h.querySelector("svg").getAttribute("aria-hidden"),
    모자위: Math.round(r.top), 모자아래: Math.round(r.bottom), 로고위: Math.round(lr.top), 로고아래: Math.round(lr.bottom),
    모자왼: Math.round(r.left), 로고왼: Math.round(lr.left), 로고오: Math.round(lr.right), 이름: document.querySelector(".brand").textContent.replace(/\s+/g, " ").trim() };
});

for (const [시각, 기대] of [["2026-12-23T23:00:00+09:00", false], ["2026-12-24T00:10:00+09:00", true], ["2026-12-25T21:00:00+09:00", true], ["2026-12-26T09:00:00+09:00", false]]) {
  const { p, ctx } = await 열기(시각);
  const r = await 모자(p);
  확인(!!r === 기대, `${시각.slice(0, 16)} — 모자 ${r ? "있음" : "없음"}`);
  await ctx.close();
}

for (const [w, h] of [[390, 844], [1024, 768]]) {
  const { p, ctx } = await 열기("2026-12-24T12:00:00+09:00", w, h);
  const r = await 모자(p);
  확인(r.눌림 === "none" && r.숨김 === "true" && r.이름.startsWith("혼(Spirit)"),
    `${w}px 모자는 장식(눌리지 않음 · aria-hidden) · 로고 링크 이름 "${r.이름.slice(0, 9)}" 그대로`);
  확인(r.모자위 >= r.로고위 - 12 && r.모자아래 <= r.로고위 + (r.로고아래 - r.로고위) * 0.7 && r.모자왼 >= r.로고왼 - 14 && r.모자왼 < r.로고오,
    `${w}px 모자가 로고 위쪽에 얹힘 (모자 ${r.모자위}~${r.모자아래} · 로고 ${r.로고위}~${r.로고아래})`);
  // 모자 자리를 눌러도 로고 링크(홈)로 간다
  const box = await p.evaluate(() => {
    const 로고 = [...document.querySelectorAll(".brand-logo")].find((x) => getComputedStyle(x).display !== "none");
    const r = 로고.querySelector(".brand-hat").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await p.mouse.click(...box); await p.waitForTimeout(300);
  const 길 = await p.evaluate(() => location.hash);
  확인(길 === "#/", `${w}px 모자 자리를 누르면 로고 링크로 홈(${길})`);
  await ctx.close();
}

{
  const { p, ctx } = await 열기("2026-12-25T23:59:50+09:00");
  확인(!!(await 모자(p)), "12/25 23:59:50 — 모자 있음");
  await p.clock.runFor(20000);
  await p.evaluate(() => { location.hash = "#/glossary"; }); await p.waitForTimeout(300);
  확인(!(await 모자(p)), "자정을 넘겨 화면을 옮기면 모자 벗겨짐");
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
