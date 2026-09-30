// 팀 효율 카드가 좁은 화면에서 안 깨지나 + 첫 화면 무게가 얼마나 늘었나
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const OUT = 폴더("shots");
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };
const b = await chromium.launch();

// 무게 먼저
{
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const got = [];
  p.on("response", async (r) => {
    if (!/\.(js|css)(\?|$)/.test(r.url())) return;
    try { got.push({ u: r.url().split("/").pop().split("?")[0], n: (await r.body()).length }); } catch {}
  });
  await p.goto(`${URL}/index.html#/record`);
  await p.waitForTimeout(1200);
  const 합 = got.reduce((a, x) => a + x.n, 0);
  const st = got.find((x) => x.u === "record-stats.js");
  console.log(`첫 화면 js/css ${got.length}개 · ${(합 / 1024).toFixed(1)}KB — record-stats.js ${st ? (st.n / 1024).toFixed(1) + "KB" : "안 받음"}`);
  say(!got.some((x) => x.u === "record-export.js"), "record-export.js 는 여전히 첫 화면에서 안 받음");
  await p.close();
}

for (const w of [320, 390, 768]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w === 390 ? 2 : 1 })).newPage();
  p.on("dialog", (d) => d.accept());
  await p.goto(`${URL}/index.html#/record`);
  await p.waitForTimeout(800);
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start"); await p.waitForTimeout(500);
  const box = await p.evaluate(() => { const s2 = document.querySelector("#rec-court-svg"); const r = s2.getBoundingClientRect(); const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number); return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh }; });
  const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  const tap = async (x, y) => { await p.mouse.click(box.l + ((x - box.vx) / box.vw) * box.w, box.t + ((y - box.vy) / box.vh) * box.h); await p.waitForTimeout(120); };
  const pick = (n) => p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(120));
  await tap(250, 425); await pick(선수[0]); await p.click("#rec-made"); await p.waitForTimeout(150);
  await tap(150, 195); await pick(선수[5]); await p.click("#rec-miss"); await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector('[data-spot="reb"]').click()); await p.waitForTimeout(120);
  await p.click("#rec-reb-d"); await p.waitForTimeout(120);
  await pick(선수[1]);
  await p.click("#rec-finish"); await p.waitForTimeout(500);
  const m = await p.evaluate(() => {
    const 넘친것 = [...document.querySelectorAll(".rec-adv-card *")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
    const c = document.querySelector(".rec-adv-card").getBoundingClientRect();
    return {
      가로: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      넘친것, 카드: Math.round(c.width),
      단: getComputedStyle(document.querySelector(".rec-adv")).gridTemplateColumns.split(" ").length,
    };
  });
  say(!m.가로 && !m.넘친것.length,
    `${w}px — 카드 ${m.카드}px · ${m.단}단 · 페이지 가로넘침 ${m.가로 ? "있음" : "없음"} · 글자 넘침 ${m.넘친것.length}곳`);
  if (w === 390) await p.locator(".rec-adv").screenshot({ path: `${OUT}/adv.png` });
  await p.close();
}
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
