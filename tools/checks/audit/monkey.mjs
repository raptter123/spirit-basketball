// 화면마다 보이는 버튼·칩·링크(내부)를 전부 한 번씩 눌러 보고 자바스크립트 오류를 모은다.
// 누른 뒤 화면이 바뀌면 다시 그 화면으로 돌아와 다음 것을 누른다. 씨앗을 박아 순서가 같다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const 화면 = ["#/", "#/tactics", "#/tactic/pick-and-roll", "#/tactic/man-to-man-defense", "#/new-tactic",
  "#/board", "#/schedule", "#/team-shuffle", "#/roster", "#/glossary", "#/stats"];
const b = await chromium.launch();
const 결과 = [];
for (const 길 of 화면) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(`${e.message.slice(0, 120)}`));
  p.on("console", (m) => { if (m.type() === "error") errs.push(`콘솔: ${m.text().slice(0, 120)}`); });
  p.on("dialog", (d) => d.accept("테스트"));
  p.on("download", () => {});
  await p.clock.install({ time: new Date("2026-09-30T10:00:00") });
  await p.goto(`${URL}/index.html?m=1${길}`); await p.waitForTimeout(700);
  // 팀 편성은 사람을 좀 골라 둬야 버튼이 켜진다
  if (길 === "#/team-shuffle") {
    await p.evaluate(() => { [...document.querySelectorAll(".ts-roster-chip")].slice(0, 12).forEach((c) => c.click()); });
    await p.waitForTimeout(300);
  }
  const 목록 = await p.evaluate(() => [...document.querySelectorAll("main button, main a[href^='#'], main [role=button], main summary, main input[type=checkbox]")]
    .filter((e) => e.getBoundingClientRect().width && !e.disabled)
    .map((e, i) => { e.dataset.monkey = String(i); return { i, 글: (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().replace(/\s+/g, " ").slice(0, 24) }; }));
  let 누름 = 0;
  for (const x of 목록.slice(0, 120)) {
    const 전 = errs.length;
    const 있음 = await p.evaluate((i) => { const e = document.querySelector(`[data-monkey="${i}"]`); if (!e || e.disabled) return false; e.click(); return true; }, x.i);
    if (!있음) continue;
    누름++;
    await p.waitForTimeout(120);
    if (errs.length > 전) 결과.push(`${길} "${x.글}" → ${errs.slice(전).join(" / ")}`);
    // 다른 화면으로 넘어갔으면 되돌아온다. 같은 화면이어도 다시 그려졌을 수 있으니
    // 누를 때마다 번호를 새로 붙인다 — 안 그러면 표시가 사라져 나머지를 못 누른다.
    const 지금 = await p.evaluate(() => location.hash || "#/");
    if (지금 !== 길) {
      await p.goto(`${URL}/index.html?m=2${길}`); await p.waitForTimeout(400);
      if (길 === "#/team-shuffle") await p.evaluate(() => { [...document.querySelectorAll(".ts-roster-chip")].slice(0, 12).forEach((c) => c.click()); });
    }
    await p.evaluate(() => [...document.querySelectorAll("main button, main a[href^='#'], main [role=button], main summary, main input[type=checkbox]")]
      .filter((e) => e.getBoundingClientRect().width && !e.disabled).forEach((e, i) => { e.dataset.monkey = String(i); }));
  }
  console.log(`${길.padEnd(30)} 보이는 것 ${String(목록.length).padStart(3)}개 중 ${String(누름).padStart(3)}개 누름 · 오류 ${errs.length}건`);
  await ctx.close();
}
await b.close();
console.log(결과.length ? `\n❌ 오류 난 누름 ${결과.length}건\n  ${결과.join("\n  ")}` : "\n✅ 누른 것 전부 오류 없음");
process.exit(0);
