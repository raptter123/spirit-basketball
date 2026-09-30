// 기록 화면에서 팀 색을 글씨로 쓰는 자리를 전부 찾아, 실제로 그려진 색과
// 실제 배경색으로 명암비를 잰다. 작은 글씨 기준은 4.5 다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const 잼 = `
(() => {
  const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
  const lum = (s) => { const [r, g, b] = parse(s).map((v) => srgb(v / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  // 투명한 배경은 위로 올라가며 실제로 칠해진 색을 찾는다
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const 자리 = [
    [".rec-score [data-t]", "스코어보드 팀·점수"],
    [".rec-team-tag", "코트 위 팀 이름표"],
    [".rec-arch-side .nm", "지난 경기 팀 이름"],
    [".rec-adv-team", "팀 효율 카드 제목"],
    [".rec-bench-team > b", "벤치 팀 이름"],
  ];
  const out = [];
  for (const [sel, 설명] of 자리) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.getClientRects().length) continue;
      const st = getComputedStyle(el);
      out.push({ 설명, 글: el.textContent.trim().slice(0, 8), 색: st.color,
        바탕: bgOf(el), 크기: st.fontSize, 비: Math.round(ratio(st.color, bgOf(el)) * 100) / 100 });
    }
  }
  return out;
})()`;

const b = await chromium.launch();
for (const theme of ["dark", "light"]) {
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  p.on("dialog", (d) => d.accept());
  await p.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch {} }, theme);
  await p.goto(`${URL}/index.html#/record`);
  await p.waitForTimeout(800);

  // 경기 하나를 기록해 결과·보관함까지 만들어 둔다
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름.slice(0, 12)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start"); await p.waitForTimeout(500);
  const box = await p.evaluate(() => { const r = document.querySelector("#rec-court-svg").getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
  const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  for (let i = 0; i < 6; i++) {
    await p.mouse.click(box.l + 0.5 * box.w, box.t + 0.85 * box.h);
    await p.waitForTimeout(90);
    await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 선수[i % 2 ? 5 : 0]);
    await p.waitForTimeout(90);
    await p.click(i % 3 ? "#rec-made" : "#rec-miss"); await p.waitForTimeout(110);
  }
  await p.evaluate(() => { document.querySelector(".rec-bench").open = true; });
  await p.waitForTimeout(200);

  const 살아있는 = await p.evaluate(잼);
  await p.click("#rec-finish"); await p.waitForTimeout(500);
  const 결과 = await p.evaluate(잼);
  await p.click("#rec-new"); await p.waitForTimeout(500);
  const 보관 = await p.evaluate(잼);

  const 전부 = [...살아있는, ...결과, ...보관];
  const 못한것 = 전부.filter((x) => x.비 < 4.5);
  console.log(`\n── ${theme} — 팀 색 글씨 ${전부.length}곳`);
  const 본것 = new Set();
  for (const x of 전부) {
    if (본것.has(x.설명 + x.색)) continue;
    본것.add(x.설명 + x.색);
    console.log(`   ${x.비 >= 4.5 ? "✓" : "✗"} ${x.설명.padEnd(18)} ${x.색} on ${x.바탕} · ${x.크기} → ${x.비}`);
  }
  say(못한것.length === 0, `${theme}: 팀 색 글씨 ${전부.length}곳 전부 4.5 이상 (미달 ${못한것.length}곳)`);
  await p.close();
}
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
