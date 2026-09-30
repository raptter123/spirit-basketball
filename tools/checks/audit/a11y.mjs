// 화면 낭독기가 읽을 이름이 없는 조작 요소, 라벨 없는 입력칸, 제목 순서 건너뜀을 찾는다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const 화면 = ["#/", "#/tactics", "#/tactic/pick-and-roll", "#/new-tactic", "#/board", "#/schedule", "#/team-shuffle", "#/record", "#/roster", "#/glossary", "#/stats"];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); p.on("dialog", (d) => d.accept());
const 모음 = {};
const lang = [];
for (const 길 of 화면) {
  await p.goto(`${URL}/index.html?a=${Math.random()}${길}`); await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const 이름 = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.value || el.getAttribute("alt") || "").trim();
    const 기호만 = (s) => s && !/[0-9A-Za-z가-힣]/.test(s);
    const 이름없음 = [...document.querySelectorAll("button, a[href], [role=button]")]
      .filter((e) => e.getBoundingClientRect().width && !e.closest("[hidden]"))
      .filter((e) => { const n = 이름(e); return !n || 기호만(n); })
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ")[0]} "${(e.innerText || "").trim().slice(0, 6)}"`);
    const 라벨없음 = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
      .filter((e) => e.getBoundingClientRect().width || e.type === "checkbox")
      .filter((e) => !(e.getAttribute("aria-label") || e.closest("label") || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) || e.getAttribute("aria-labelledby")))
      .map((e) => `${e.tagName.toLowerCase()}[${e.type || ""}]#${e.id || "—"}.${(e.className || "").toString().split(" ")[0]} ph="${e.placeholder || ""}"`);
    const 제목 = [...document.querySelectorAll("main h1, main h2, main h3, main h4")].map((h) => Number(h.tagName[1]));
    const 건너뜀 = []; for (let i = 1; i < 제목.length; i++) if (제목[i] - 제목[i - 1] > 1) 건너뜀.push(`h${제목[i - 1]}→h${제목[i]}`);
    const svg이름없음 = [...document.querySelectorAll("main svg")].filter((s) => s.getBoundingClientRect().width > 100 && !s.getAttribute("aria-label") && !s.getAttribute("aria-hidden") && !s.querySelector("title") && s.getAttribute("role") !== "img").length;
    return { 이름없음: [...new Set(이름없음)], 라벨없음: [...new Set(라벨없음)], 건너뜀: [...new Set(건너뜀)], svg이름없음, lang: document.documentElement.lang };
  });
  lang.push(r.lang);
  for (const [k, v] of Object.entries(r)) {
    if (k === "lang") continue;
    if (Array.isArray(v) ? v.length : v) (모음[k] ||= []).push(`${길}: ${Array.isArray(v) ? v.join(", ") : v}`);
  }
}
console.log(`html lang: ${[...new Set(lang)].join()}`);
for (const [k, v] of Object.entries(모음)) { console.log(`\n■ ${k} — ${v.length}화면`); v.forEach((x) => console.log(`  ${x.slice(0, 230)}`)); }
await b.close(); process.exit(0);
