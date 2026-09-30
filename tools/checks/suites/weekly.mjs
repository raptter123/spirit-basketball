// 주간 점검 — 오늘(2026-09-01, 화) 기준으로 화면을 돌면서 에러/넘침/누를 곳/명암비를 잰다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";

const OUT = 폴더("shots");
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["home", "#/"], ["tactics", "#/tactics"], ["new-tactic", "#/new-tactic"],
  ["glossary", "#/glossary"], ["board", "#/board"], ["shuffle", "#/team-shuffle"],
  ["roster", "#/roster"], ["stats", "#/stats"], ["schedule", "#/schedule"],
  ["detail", "#/tactic/pick-and-roll"], ["player", "#/player/%ED%99%A9%EA%B7%9C%EC%B2%A0"],
  ["없는전술", "#/tactic/ZZZ-없는거"], ["없는선수", "#/player/없는사람"],
];

const PROBE = `(() => {
  const srgb = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
  const parse = (s) => { const m = String(s).match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  const bgOf = (el) => { const layers = []; let cur = el;
    while (cur && cur.nodeType === 1) { const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; } cur = cur.parentElement; }
    let acc = [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc); return acc; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

  const out = { overflow: [], contrast: [], tiny: [], taps: [], empty: false };
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.overflow.push({ what: "문서", w: de.scrollWidth, view: de.clientWidth });
  out.empty = (document.querySelector("#app")?.textContent || "").trim().length < 5;

  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (el.closest("svg")) continue;
    if (r.right > de.clientWidth + 1.5 && cs.overflowX !== "auto" && cs.overflowX !== "scroll" && cs.position !== "fixed") {
      const p = el.parentElement && getComputedStyle(el.parentElement);
      if (!p || (p.overflowX !== "auto" && p.overflowX !== "scroll")) {
        out.overflow.push({ sel: el.tagName.toLowerCase() + "." + String(el.className).trim().split(/\\s+/).slice(0,2).join("."),
          right: Math.round(r.right), text: (el.textContent || "").trim().slice(0, 26) });
      }
    }
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!own) continue;
    const fs2 = parseFloat(cs.fontSize);
    if (fs2 < 12) out.tiny.push({ size: +fs2.toFixed(2), text: own.slice(0, 24), cls: String(el.className).slice(0, 32) });
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const cr = ratio(over(fg, bg), bg);
    const bold = parseFloat(cs.fontWeight) >= 700;
    const need = fs2 >= 24 || (fs2 >= 18.66 && bold) ? 3 : 4.5;
    if (cr < need) out.contrast.push({ ratio: +cr.toFixed(2), need, size: fs2, text: own.slice(0, 26), cls: String(el.className).slice(0, 32) });
  }

  for (const el of document.querySelectorAll("a, button, input:not([type=hidden]), select, summary, [role=button]")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || el.disabled) continue;
    if (el.type === "checkbox" && el.closest("label")) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e === el || el.contains(e); };
    if (!hit(cx, cy)) continue;
    let t = cy, b = cy, l = cx, ri = cx;
    while (t > 0 && hit(cx, t - 1)) t--;
    while (b < innerHeight - 1 && hit(cx, b + 1)) b++;
    while (l > 0 && hit(l - 1, cy)) l--;
    while (ri < innerWidth - 1 && hit(ri + 1, cy)) ri++;
    const w = ri - l + 1, h = b - t + 1;
    if (w < 44 || h < 44) out.taps.push({ cls: String(el.className).trim().split(/\\s+/).slice(0,2).join("."),
      label: (el.textContent || el.value || el.getAttribute("aria-label") || "").trim().slice(0, 20), 실제: [w, h] });
  }
  return out;
})()`;

const browser = await chromium.launch();
const problems = [];
const seen = new Set();
const add = (k, s) => { if (seen.has(k)) return; seen.add(k); problems.push(s); };

for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) {} }, theme);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("JS오류: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 120)); });

  for (const [name, hash] of ROUTES) {
    errs.length = 0;
    await page.goto(`${URL}/index.html${hash}`);
    await page.waitForTimeout(900);
    if (theme === "dark") await page.screenshot({ path: `${OUT}/w-${name}.png`, fullPage: true });
    const r = await page.evaluate(PROBE);
    for (const e of errs) add(`${name}|${e}`, `[${name}] ${e}`);
    if (r.empty) add(`${name}|empty`, `[${name}] 화면이 비었습니다`);
    for (const o of r.overflow) add(`${name}|of|${o.sel || o.what}`, `[${name}] 가로 넘침 ${o.sel || o.what} 오른쪽 ${o.right || o.w} > ${390} "${o.text || ""}"`);
    for (const c of r.contrast) add(`${theme}|${c.cls}|${c.text}`, `[${name}/${theme}] 명암비 ${c.ratio}:1 (기준 ${c.need}) ${c.size}px "${c.text}" .${c.cls}`);
    for (const t of r.tiny) add(`tiny|${t.cls}|${t.size}`, `[${name}] 작은 글씨 ${t.size}px "${t.text}" .${t.cls}`);
    // 누를 곳 크기는 taps2.mjs 가 화면 안으로 굴려 놓고 잰다. 여기서는 화면 아래끝에
    // 걸린 것을 잘라 재는 오탐이 나와서 빼둔다.
  }
  await ctx.close();
}
await browser.close();

if (!problems.length) console.log("✅ 화면 점검 이상 없음");
else { console.log(`발견 ${problems.length}건\n`); for (const p of problems) console.log("  " + p); }
