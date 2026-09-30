// 잡힌 것들을 종류별로 묶고, 비활성 버튼인지까지 본다.
// WCAG 는 비활성(disabled) 조작 요소를 명암비 기준에서 뺀다 — 진짜만 남겨야 한다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const 화면 = [
  ["홈", "#/"], ["전술목록", "#/tactics"], ["전술상세", "#/tactic/man-to-man-defense"],
  ["전술추가", "#/new-tactic"], ["작전판", "#/board"], ["일정", "#/schedule"],
  ["팀편성", "#/team-shuffle"], ["기록", "#/record"], ["로스터", "#/roster"],
  ["용어사전", "#/glossary"], ["통계", "#/stats"],
];
const b = await chromium.launch();
let 순번 = 0;
const 작은표 = {};   // 클래스 → { 크기들, 화면들, 폭들 }
const 대비표 = [];

for (const 폭 of [320, 390, 768]) {
  for (const 테마 of ["dark", "light"]) {
    const ctx = await b.newContext({ viewport: { width: 폭, height: 844 }, colorScheme: 테마 });
    await ctx.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } }, 테마);
    const p = await ctx.newPage();
    p.on("dialog", (d) => d.accept());
    for (const [이름, 길] of 화면) {
      await p.goto(`${URL}/index.html?b=${++순번}${길}`);
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const 광도 = ([r2, g, b2]) => {
          const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(r2) + 0.7152 * f(g) + 0.0722 * f(b2);
        };
        const 대비 = (a, c) => { const [x, y] = [광도(a), 광도(c)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const 색숫자 = (s) => { const m = s.match(/-?[\d.]+/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 } : null; };
        const 보이는배경 = (el) => {
          const 층 = []; let n = el;
          while (n) { const c = 색숫자(getComputedStyle(n).backgroundColor);
            if (c && c.a > 0) 층.push(c); if (c && c.a >= 0.999) break; n = n.parentElement; }
          let [r2, g, b2] = [255, 255, 255];
          for (let i = 층.length - 1; i >= 0; i--) { const c = 층[i];
            r2 = c.r * c.a + r2 * (1 - c.a); g = c.g * c.a + g * (1 - c.a); b2 = c.b * c.a + b2 * (1 - c.a); }
          return [r2, g, b2];
        };
        const 이름표 = (el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().trim().split(/\s+/)[0] || "—"}`;

        const 작은 = [];
        for (const el of document.querySelectorAll("button, a[href], input, select, textarea, [role=button]")) {
          if (el.closest("[hidden]")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const rr = el.getBoundingClientRect();
          if (!rr.width || !rr.height) continue;
          const a = getComputedStyle(el, "::after");
          let w = rr.width, h = rr.height;
          if (a.content !== "none" && a.position === "absolute") {
            const 넓힘 = (v) => (v.endsWith("px") ? -parseFloat(v) : 0);
            w += 넓힘(a.left) + 넓힘(a.right); h += 넓힘(a.top) + 넓힘(a.bottom);
          }
          if (w < 43.5 || h < 43.5) 작은.push({ 이름: 이름표(el), w: Math.round(w), h: Math.round(h) });
        }

        const 대비목 = [];
        for (const el of document.querySelectorAll("main *, header *")) {
          if (el.children.length || el.closest("svg")) continue;
          const t = (el.textContent || "").trim();
          if (!t) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const rr = el.getBoundingClientRect();
          if (!rr.width || !rr.height) continue;
          const 뒤 = 보이는배경(el);
          const c0 = 색숫자(cs.color);
          let a = c0.a; let n = el;
          while (n && n !== document.documentElement) { a *= Number(getComputedStyle(n).opacity); n = n.parentElement; }
          const 앞 = [c0.r * a + 뒤[0] * (1 - a), c0.g * a + 뒤[1] * (1 - a), c0.b * a + 뒤[2] * (1 - a)];
          const cr = 대비(앞, 뒤);
          const px = Math.round(parseFloat(cs.fontSize));
          const 굵기 = Number(cs.fontWeight) || 400;
          const 기준 = px >= 24 || (px >= 18.66 && 굵기 >= 700) ? 3 : 4.5;
          if (cr >= 기준) continue;
          const 조작 = el.closest("button, a, input, select, textarea, [role=button]");
          대비목.push({
            이름: 이름표(el), 글: t.slice(0, 18), px, 굵기, 비: +cr.toFixed(2), 기준,
            꺼짐: !!(조작 && (조작.disabled || 조작.getAttribute("aria-disabled") === "true")),
          });
        }
        return { 작은, 대비목 };
      });
      for (const s of r.작은) {
        const k = s.이름;
        (작은표[k] ||= { 크기: new Set(), 화면: new Set(), 폭: new Set(), 수: 0 });
        작은표[k].크기.add(`${s.w}×${s.h}`); 작은표[k].화면.add(이름); 작은표[k].폭.add(폭); 작은표[k].수++;
      }
      for (const c of r.대비목) 대비표.push({ ...c, 화면: 이름, 폭, 테마 });
    }
    await ctx.close();
  }
}
await b.close();

console.log("── 누를 곳 44px 미만: 종류별 ──");
for (const [k, v] of Object.entries(작은표).sort((a, c) => c[1].수 - a[1].수)) {
  console.log(`  ${k.padEnd(26)} ${String(v.수).padStart(4)}개  크기 ${[...v.크기].slice(0, 4).join(" ")}`
    + `  화면 ${[...v.화면].join("/")}  폭 ${[...v.폭].join("/")}`);
}

console.log("\n── 명암비 미달: 켜진 것만 ──");
const 켜짐 = 대비표.filter((c) => !c.꺼짐);
const 묶음 = {};
for (const c of 켜짐) {
  const k = `${c.이름} "${c.글}"`;
  (묶음[k] ||= { 비: [], 기준: c.기준, px: c.px, 굵기: c.굵기, 테마: new Set() });
  묶음[k].비.push(c.비); 묶음[k].테마.add(c.테마);
}
for (const [k, v] of Object.entries(묶음)) {
  console.log(`  ${k} — ${v.px}px/${v.굵기} 비 ${[...new Set(v.비)].join(", ")} (기준 ${v.기준}) · ${[...v.테마].join("+")}`);
}
console.log(`\n비활성(disabled)이라 기준에서 빠지는 것: ${대비표.length - 켜짐.length}건`);
const 꺼진묶음 = [...new Set(대비표.filter((c) => c.꺼짐).map((c) => `${c.이름} "${c.글}"`))];
꺼진묶음.forEach((m) => console.log(`  (꺼짐) ${m}`));
process.exit(0);
