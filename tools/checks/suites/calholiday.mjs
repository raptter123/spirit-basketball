// 달력 '오늘' 칸 글씨 명암비 — 오늘이 공휴일인 날이 밝은 테마에서 3.73:1 로 흐렸다(#152).
// 평일 · 일정 있는 날 · 공휴일을 두 테마로 열어 오늘 칸 숫자의 대비를 잰다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const b = await chromium.launch();
let 실패 = 0;
for (const 테마 of ["light", "dark"]) for (const d of ["2026-09-30", "2026-10-04", "2026-10-09", "2026-09-24", "2026-12-25"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 테마 });
  await ctx.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) {} }, 테마);
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date(`${d}T10:00:00`) });
  await p.goto(`${URL}/index.html?c=${d}${테마}#/schedule`); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const el = document.querySelector(".calendar-day.is-today");
    const 숫 = (s) => s.match(/[\d.]+/g).map(Number);
    const 글 = [...el.querySelectorAll("*")].filter((c) => !c.children.length && c.textContent.trim())[0] || el;
    let n = 글, bg; while (n) { const c = 숫(getComputedStyle(n).backgroundColor); if ((c[3] ?? 1) > 0.99) { bg = c; break; } n = n.parentElement; }
    return { cls: el.className, 글: 글.textContent.trim(), 앞: 숫(getComputedStyle(글).color).slice(0, 3), 뒤: bg.slice(0, 3) };
  });
  const 비 = cr(r.앞, r.뒤);
  if (비 < 4.5) 실패++;
  console.log(`${비 < 4.5 ? "❌" : "✅"} ${테마.padEnd(5)} ${d}  오늘 칸 "${r.글}" 명암비 ${비.toFixed(2)} (기준 4.5 · ${r.cls.replace("calendar-day ", "")})`);
  await ctx.close();
}
await b.close();
console.log(실패 ? `\n❌ ${실패}건 실패` : "\n✅ 전부 통과");
process.exit(실패 ? 1 : 0);
