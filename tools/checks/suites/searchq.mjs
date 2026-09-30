// 검색칸에 따옴표 · 꺾쇠를 쳤을 때 칸에 남는 글자와 화면에 생기는 요소를 본다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
let ok = true;
for (const [길, sel] of [["#/tactics", "#tactic-search"], ["#/glossary", "#glossary-search"], ["#/team-shuffle", "#ts-search"]]) {
  for (const 글 of ['3"점', '"><b id=inj>x</b>']) {
    await p.goto(`${URL}/index.html?s=${Math.random()}${길}`); await p.waitForTimeout(600);
    await p.click(sel);
    await p.keyboard.type(글, { delay: 30 });
    await p.waitForTimeout(300);
    const r = await p.evaluate((s) => ({ 값: document.querySelector(s)?.value, 주입: !!document.querySelector("#inj") }), sel);
    const 맞음 = r.값 === 글 && !r.주입;
    if (!맞음) ok = false;
    console.log(`${맞음 ? "✅" : "❌"} ${길} 친 글자 ${JSON.stringify(글)} → 칸에 남은 것 ${JSON.stringify(r.값)}${r.주입 ? " · <b id=inj> 가 화면에 생김" : ""}`);
  }
}
console.log(errs.length ? `오류: ${errs[0]}` : "자바스크립트 오류 없음");
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
