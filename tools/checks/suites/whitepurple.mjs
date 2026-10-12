// 2팀 경기는 화이트 · 퍼플 — 이름과 색이 팀 편성부터 기록 · 밴드 이미지 · 엑셀까지 이어지는가.
//
// 동호회가 입는 유니폼이 아이보리(화이트)와 보라(퍼플) 두 벌이라 2팀이면 A팀 · B팀 대신
// 이 이름으로 부른다. 3팀(3파전)은 A · B · C 그대로. 이미 보관함에 있는 옛 경기(A팀 · B팀)
// 는 예전 색(주황 · 초록) 그대로 보여야 한다.
//
// 색은 눈이 아니라 명암비로 잰다: 글씨 4.5 · 도형 3.0, 두 테마 모두.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dlwp");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];
function 명암(fg, bg) {
  const L = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const [a, c] = [L(fg), L(bg)].sort((x, y) => y - x); return (a + 0.05) / (c + 0.05);
}
async function 새창(테마 = "dark", w = 390) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, colorScheme: 테마, acceptDownloads: true });
  await ctx.addInitScript((t) => { try { if (!sessionStorage.getItem("깨끗")) { localStorage.clear(); sessionStorage.setItem("깨끗", "1"); } localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } }, 테마);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
  return { p, ctx };
}
async function 팀짜기(p, 팀수, 사람수) {
  await p.goto(`${URL}/index.html#/team-shuffle`); await p.waitForTimeout(600);
  if (팀수 === 3) { await p.click('.team-count-select .chip[data-count="3"]'); await p.waitForTimeout(200); }
  for (let i = 0; i < 사람수; i++) await p.evaluate((k) => document.querySelectorAll("input[type=checkbox][data-name]")[k]?.click(), i);
  await p.click("#ts-auto-assign"); await p.waitForTimeout(300);
}

// ── 1. 팀 편성: 2팀은 화이트 · 퍼플, 3팀은 A · B · C ──
{
  const { p, ctx } = await 새창();
  await 팀짜기(p, 2, 10);
  const r = await p.evaluate(() => ({
    칸: [...document.querySelectorAll(".ts-col-title")].map((h) => h.textContent.trim().replace(/ \(\d+명\)/, "")),
    칩말: [...new Set([...document.querySelectorAll(".ts-col .ts-chip")].map((x) => x.getAttribute("aria-label").split("누르면 ")[1]))],
    칩높이: Math.min(...[...document.querySelectorAll(".ts-chip")].map((x) => x.getBoundingClientRect().height)),
    넘침: document.documentElement.scrollWidth - innerWidth,
  }));
  확인(r.칸.join() === "화이트,퍼플" && r.칩말.sort().join() === "퍼플로,화이트로" && r.칩높이 >= 44 && r.넘침 === 0,
    `2팀 팀 판 — 칸 ${r.칸.join(" · ")} · 칩 안내 "${r.칩말.join(" · ")}" (칩 최소 높이 ${Math.round(r.칩높이)}px) · 가로 넘침 ${r.넘침}`);
  // 기록지 이름
  const 기록지 = await p.evaluate(() => { document.querySelector("#ts-sheet-btn").click(); return [...document.querySelectorAll(".sheet-print-modal .sheet")].map((s) => (s.textContent.match(/혼 (화이트|퍼플|[A-C])/) || [""])[0]); });
  확인(기록지.join() === "혼 화이트,혼 퍼플", `기록지 두 장의 팀 이름 — ${기록지.join(" · ")}`);
  await p.goto(`${URL}/index.html?r=1#/record`); await p.waitForTimeout(600);
  const 가져옴 = await p.evaluate(() => [...document.querySelectorAll(".rec-draft-team")].map((x) => `${x.textContent.trim().split(" ")[0]}:${x.dataset.t}`));
  확인(가져옴.join() === "화이트:3,퍼플:4", `기록 탭이 가져온 팀 — ${가져옴.join(" · ")} (색 번호 3 · 4)`);
  await p.click("#rec-use-draft"); await p.waitForTimeout(600);
  const 점수판 = await p.evaluate(() => [...document.querySelectorAll(".rec-score span[data-t]")].map((x) => `${x.textContent.trim()}:${x.dataset.t}`));
  확인(점수판.join() === "화이트:3,퍼플:4", `점수판 — ${점수판.join(" · ")}`);
  await ctx.close();
}
{
  const { p, ctx } = await 새창();
  await 팀짜기(p, 3, 12);
  await p.locator(".ts-col .ts-chip").first().click(); await p.waitForTimeout(300);
  const r = await p.evaluate(() => ({
    칸: [...document.querySelectorAll(".ts-col-title")].map((h) => h.textContent.trim().replace(/ \(\d+명\)/, "")),
    옮길곳: [...document.querySelectorAll(".ts-move")].map((x) => x.textContent.trim()),
  }));
  확인(r.칸.join() === "A팀,B팀,C팀" && r.옮길곳.join() === "→ B팀,→ C팀,빼기",
    `3팀 팀 판은 그대로 A · B · C — 칸 ${r.칸.join(" · ")} · A팀 칩을 누르면 ${r.옮길곳.join(" · ")}`);
  await ctx.close();
}

// ── 2. 기록 탭 직접 고르기: 2팀 칸 이름 · 3팀 대진 글 ──
{
  const { p, ctx } = await 새창();
  await p.goto(`${URL}/index.html#/record`); await p.waitForTimeout(600);
  const 둘 = await p.evaluate(() => [...document.querySelectorAll(".rec-pick-col b")].map((x) => x.textContent.trim()));
  await p.click('.rec-nbtn[data-n="3"]'); await p.waitForTimeout(150);
  const 셋 = await p.evaluate(() => ({ 칸: [...document.querySelectorAll(".rec-pick-col b")].map((x) => x.textContent.trim()), 안내: document.querySelector("#rec-nteam-say").textContent.trim() }));
  확인(둘.join() === "화이트,퍼플" && 셋.칸.join() === "A팀,B팀,C팀" && 셋.안내 === "A팀–B팀 · B팀–C팀 · C팀–A팀 세 경기",
    `직접 고르기 — 2팀 칸 ${둘.join(" · ")} / 3팀 칸 ${셋.칸.join(" · ")} · "${셋.안내}"`);
  await ctx.close();
}

// ── 3. 색: 두 테마에서 화이트 · 퍼플 글씨 · 도형 명암비 ──
for (const 테마 of ["dark", "light"]) {
  const { p, ctx } = await 새창(테마);
  await p.goto(`${URL}/index.html#/record`); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const 판 = document.createElement("div"); 판.style.cssText = "position:fixed;left:0;top:0"; document.body.append(판);
    const 결과 = {};
    for (const t of ["3", "4"]) {
      const el = document.createElement("span"); el.dataset.t = t; el.style.cssText = "color:var(--ct);border-color:var(--c);border:1px solid var(--c)"; 판.append(el);
      const cs = getComputedStyle(el); 결과[t] = { 글씨: rgb(cs.color), 도형: rgb(cs.borderTopColor) };
    }
    const 바탕 = ["--bg", "--surface", "--surface-2"].map((v) => { const e = document.createElement("i"); e.style.background = `var(${v})`; 판.append(e); return rgb(getComputedStyle(e).backgroundColor); });
    판.remove();
    return { 결과, 바탕 };
  });
  for (const [t, 이름] of [["3", "화이트"], ["4", "퍼플"]]) {
    const 글 = Math.min(...r.바탕.map((bg) => 명암(r.결과[t].글씨, bg)));
    const 도 = Math.min(...r.바탕.map((bg) => 명암(r.결과[t].도형, bg)));
    확인(글 >= 4.5 && 도 >= 3, `${테마} ${이름} — 글씨 rgb(${r.결과[t].글씨}) 최저 ${글.toFixed(2)}:1 · 도형 rgb(${r.결과[t].도형}) 최저 ${도.toFixed(2)}:1`);
  }
  if (테마 === "dark") 확인(r.결과["3"].도형.join() === "255,243,221", `다크 화이트 도형은 아이보리 #fff3dd 그대로 — rgb(${r.결과["3"].도형})`);
  await ctx.close();
}

// ── 4. 결과 화면 · 밴드 이미지 · 엑셀 · 파일 이름 ──
{
  const { p, ctx } = await 새창();
  await 팀짜기(p, 2, 10);
  await p.goto(`${URL}/index.html?r=2#/record`); await p.waitForTimeout(600);
  await p.click("#rec-use-draft"); await p.waitForTimeout(500);
  await p.click("#rec-finish"); await p.waitForTimeout(700);
  const 제목 = await p.evaluate(() => document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim());
  확인(/^화이트 \d+ : \d+ 퍼플$/.test(제목), `결과 제목 "${제목}"`);
  const svg = await p.evaluate(async () => {
    const st = await import("./js/storage.js"); const I = await import("./js/record-image.js");
    const g = st.getRecordSession().games[0];
    return I.결과이미지SVG(g).svg;
  });
  확인(svg.includes('fill="#fff3dd"') && svg.includes('stroke="#9c7c45"') && svg.includes('fill="#5b3fd0"'),
    `밴드 이미지 — 화이트 띠는 아이보리(#fff3dd) + 테두리(#9c7c45), 퍼플 띠는 #5b3fd0`);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#rec-xlsx")]);
  const 파일 = `${DL}/${dl.suggestedFilename()}`; await dl.saveAs(파일);
  확인(/-WP\.xlsx$/.test(dl.suggestedFilename()), `엑셀 파일 이름 ${dl.suggestedFilename()} (대진 꼬리 WP)`);
  const 칸 = JSON.parse(execFileSync("python3", ["-c", `
import json, openpyxl
ws = openpyxl.load_workbook(${JSON.stringify(파일)})["선수기록"]
h = [c.value for c in ws[1]]; col = h.index("팀") + 1
out = {}
for r in range(2, ws.max_row + 1):
    c = ws.cell(r, col)
    if c.value and c.value not in out:
        out[c.value] = {"글자": c.font.color.rgb if c.font and c.font.color else None, "바탕": c.fill.fgColor.rgb if c.fill and c.fill.fill_type else None}
print(json.dumps(out, ensure_ascii=False))
`], { encoding: "utf8" }));
  확인(칸["화이트"]?.글자 === "FF7A5A24" && 칸["화이트"]?.바탕 === "FFFFF3DD" && 칸["퍼플"]?.글자 === "FF5B3FD0",
    `엑셀 팀 칸 — 화이트 글자 ${칸["화이트"]?.글자} · 바탕 ${칸["화이트"]?.바탕} / 퍼플 글자 ${칸["퍼플"]?.글자}`);
  await ctx.close();
}

// ── 5. 옛 경기(A팀 · B팀)는 예전 색 그대로 ──
{
  const { p, ctx } = await 새창();
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => {
    const R = await import("./js/record.js"); const S = await import("./js/record-stats.js");
    const 옛 = { teams: [{ name: "A팀" }, { name: "B팀" }] }, 새 = { teams: [{ name: "화이트" }, { name: "퍼플" }] };
    return { 옛색: [R.팀색자리(옛, 0), R.팀색자리(옛, 1)], 새색: [R.팀색자리(새, 0), R.팀색자리(새, 1)],
      옛꼬리: S.대진표시({ teams: 옛.teams, startedAt: 1 }), 새꼬리: S.대진표시({ teams: 새.teams, startedAt: 1 }),
      셋: [0, 1, 2].map((i) => R.팀이름들(3)[i]).join() };
  });
  확인(r.옛색.join() === "0,1" && r.새색.join() === "3,4" && r.옛꼬리 === "AB" && r.새꼬리 === "WP" && r.셋 === "A팀,B팀,C팀",
    `옛 경기 A팀 · B팀 색 번호 ${r.옛색} · 파일 꼬리 ${r.옛꼬리} / 새 경기 ${r.새색} · ${r.새꼬리} / 3팀 ${r.셋}`);
  await ctx.close();
}

// ── 6. 종이 기록지 화면(통계)의 기본 팀 이름 ──
{
  const { p, ctx } = await 새창();
  await p.goto(`${URL}/index.html#/stats`); await p.waitForTimeout(700);
  const 이름 = await p.evaluate(async () => { const G = await import("./js/gamestats.js"); return G.emptyGame().teams.map((t) => t.name); });
  확인(이름.join() === "혼 화이트,혼 퍼플", `기록지 정리 기본 팀 이름 — ${이름.join(" · ")}`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
