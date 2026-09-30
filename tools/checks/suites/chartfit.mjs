// 차트가 좁은 화면에서 안 깨지나 + 누를 곳 크기 + 두 테마 모두
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const OUT = 폴더("shots");
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };
const b = await chromium.launch();
const 골밑 = [250, 425], 미들 = [180, 330], 아크 = [150, 195];

for (const theme of ["dark", "light"]) {
  for (const w of [320, 390, 768]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })).newPage();
    p.on("dialog", (d) => d.accept());
    await p.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch {} }, theme);
    await p.goto(`${URL}/index.html#/record`);
    await p.waitForTimeout(700);
    const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
    for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
    await p.click("#rec-start"); await p.waitForTimeout(450);
    const box = await p.evaluate(() => { const s2 = document.querySelector("#rec-court-svg"); const r = s2.getBoundingClientRect(); const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number); return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh }; });
    const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
    for (let i = 0; i < 12; i++) {
      const 자리 = [골밑, 미들, 아크][i % 3];
      await p.mouse.click(box.l + ((자리[0] - box.vx) / box.vw) * box.w, box.t + ((자리[1] - box.vy) / box.vh) * box.h);
      await p.waitForTimeout(70);
      await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 코트[i % 10]);
      await p.waitForTimeout(70);
      await p.click(i % 2 ? "#rec-made" : "#rec-miss"); await p.waitForTimeout(90);
    }
    await p.click("#rec-finish"); await p.waitForTimeout(600);
    const m = await p.evaluate(() => {
      const c = document.querySelector(".rec-chart");
      const 작은버튼 = [...c.querySelectorAll("button")].filter((el) => el.getBoundingClientRect().height < 44);
      // 선수 칩 줄은 일부러 옆으로 미는 줄이므로 넘침 검사에서 뺀다.
      const 넘친것 = [...c.querySelectorAll("*")]
        .filter((el) => !el.classList.contains("rec-chart-who"))
        .filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
      const svg = c.querySelector("svg").getBoundingClientRect();
      return {
        가로: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        작은버튼: 작은버튼.map((el) => `${el.textContent.trim().slice(0, 8)}:${Math.round(el.getBoundingClientRect().height)}`),
        넘친것, 코트: `${Math.round(svg.width)}x${Math.round(svg.height)}`,
        점: c.querySelectorAll(".shot-made, .shot-miss").length,
        칩줄높이: Math.round(c.querySelector(".rec-chart-who").getBoundingClientRect().height),
        칩수: c.querySelectorAll(".rec-chart-who .rec-chip").length,
        칩밀수있나: c.querySelector(".rec-chart-who").scrollWidth > c.querySelector(".rec-chart-who").clientWidth + 1,
      };
    });
    say(!m.가로 && !m.작은버튼.length && !m.넘친것.length,
      `${theme} ${w}px — 코트 ${m.코트} · 칩 ${m.칩수}개가 ${m.칩줄높이}px 한 줄${m.칩밀수있나 ? "(밀 수 있음)" : ""} · 가로넘침 ${m.가로 ? "있음" : "없음"} · 44px 미만 ${m.작은버튼.join(",") || "없음"} · 글자넘침 ${m.넘친것.length}곳`);
    say(m.칩줄높이 <= 56, `${theme} ${w}px — 칩 줄이 ${m.칩줄높이}px (한 줄, 56px 이내)`);
    if (w === 390) { await p.evaluate(() => document.querySelector(".rec-chart").scrollIntoView()); await p.waitForTimeout(200);
      await p.locator(".rec-chart").screenshot({ path: `${OUT}/chart-${theme}.png` }); }
    await p.close();
  }
}
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
