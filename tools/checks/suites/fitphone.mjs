// 경기 중 기록 화면이 폰 한 화면에 들어가는가 — 2팀 · 3파전, 여러 폰 크기.
//
// 경기 중에는 로고 · 메뉴 · 제목을 접고(body.rec-focus) 위아래 여백도 24px → 8px 로
// 줄인다. 그런데 여백을 줄이는 규칙(body.rec-focus main)이 #app 의 padding 에
// 우선순위로 져서 한 번도 먹지 않았다 — 3파전은 390×844 에서 16px 넘쳐 스크롤이 생겼다.
//
// 폰 크기는 실제 기기의 CSS 화면 크기(가로 × 세로). 팀당 5명(3파전 15명)이 기준.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

const 폰들 = [
  ["아이폰 12~14", 390, 844], ["아이폰 15 · 16", 393, 852], ["갤럭시 S", 412, 915],
  ["아이폰 11 · XR", 414, 896], ["아이폰 12~14 Pro Max", 428, 926], ["아이폰 15 · 16 Plus/Pro Max", 430, 932],
];
let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };

const b = await chromium.launch();
const errs = [];
for (const 팀수 of [2, 3]) {
  for (const [이름, w, h] of 폰들) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
    await p.goto(`${URL}/index.html#/record`); await p.waitForTimeout(700);
    await p.click(`.rec-nbtn[data-n="${팀수}"]`); await p.waitForTimeout(150);
    const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
    for (const n of 로스터.slice(0, 팀수 * 5)) {
      await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
    }
    await p.click("#rec-start"); await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const cs = getComputedStyle(document.querySelector("#app"));
      return { 넘침: document.documentElement.scrollHeight - innerHeight, 위: cs.paddingTop, 아래: cs.paddingBottom,
        집중: document.body.classList.contains("rec-focus") };
    });
    확인(r.집중 && r.넘침 <= 0 && r.위 === "8px" && r.아래 === "8px",
      `${팀수 === 3 ? "3파전" : "2팀"} ${w}×${h} ${이름} — 넘침 ${Math.max(0, r.넘침)}px · 여백 ${r.위}/${r.아래}`);
    await ctx.close();
  }
}
확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
