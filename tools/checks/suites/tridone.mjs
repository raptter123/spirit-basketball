// 3파전 결과 화면을 확인한다.
//   1. 전환 줄 셋째 칸이 안 잘린다 (360 · 390 · 430px, 점수 두 자리)
//   2. 결과 화면에도 전환 줄이 있고, 누르면 결과 화면에 머문 채 경기가 바뀐다
//   3. 한꺼번에 받기 — 엑셀 3 + 이미지 3 + 오늘 합계 엑셀 1, 이름이 전부 다르고 점수가 맞다
//   4. 2팀 경기에는 전환 줄도 한꺼번에 받기도 안 나온다
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dltridone");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const bad = []; const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

function 광도([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const 대비 = (a, b) => { const [x, y] = [광도(a), 광도(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const b = await chromium.launch();

/** 3파전을 차리고 세 경기에 점수가 두 자리가 되도록 슛을 넣는다. */
async function 차리기(p, 슛 = 14) {
  await p.goto(`${URL}/index.html#/record`);
  await p.evaluate(() => { try { const t = localStorage.getItem("spirit-theme"); localStorage.clear(); if (t) localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } });
  await p.goto(`${URL}/index.html?r=${Math.random()}#/record`);
  await p.waitForTimeout(800);
  await p.click('.rec-nbtn[data-n="3"]'); await p.waitForTimeout(200);
  const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 로스터.slice(0, 12)) {
    await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`)?.click(), n);
  }
  await p.click("#rec-start"); await p.waitForTimeout(600);
  const 코트 = await p.evaluate(() => {
    const s = document.querySelector("#rec-court-svg"); const r = s.getBoundingClientRect();
    const [vx, vy, vw, vh] = s.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  for (const gi of [0, 1, 2]) {
    await p.evaluate((i) => document.querySelector(`.rec-gbtn[data-game="${i}"]`)?.click(), gi);
    await p.waitForTimeout(200);
    const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
    for (let k = 0; k < 슛; k++) {
      // 3점을 넉넉히 넣어 점수를 두 자리로 만든다 (칸이 넓어지는 조건)
      await p.mouse.click(코트.l + ((k % 2 ? 60 : 440) - 코트.vx) / 코트.vw * 코트.w,
        코트.t + ((250 - 코트.vy) / 코트.vh) * 코트.h);
      await p.waitForTimeout(50);
      await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`)?.click(), 선수[k % 8]);
      await p.waitForTimeout(50);
      await p.click(k % 5 === 4 ? "#rec-miss" : "#rec-made"); await p.waitForTimeout(60);
    }
  }
}

// ── 1. 전환 줄이 폭마다 안 잘리나 ─────────────────────────
for (const 폭 of [320, 360, 390, 430]) {
  const ctx = await b.newContext({ viewport: { width: 폭, height: 844 } });
  const p = await ctx.newPage(); p.on("dialog", (d) => d.accept());
  await 차리기(p, 10);
  const r = await p.evaluate(() => {
    const row = document.querySelector(".rec-gswitch"); const rr = row.getBoundingClientRect();
    const 칸 = [...row.querySelectorAll(".rec-gbtn")].map((x) => {
      const q = x.getBoundingClientRect();
      const 잘린글 = [...x.children].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.textContent.trim());
      return { l: q.left, r: q.right, w: q.width, h: q.height, 잘린글, 글: x.innerText.replace(/\s+/g, " ").trim() };
    });
    return {
      줄: { l: rr.left, r: rr.right }, 칸, 가로넘침: document.documentElement.scrollWidth > window.innerWidth,
      내용끝: Math.max(...[...document.querySelectorAll("main *")].map((e) => e.getBoundingClientRect().bottom + window.scrollY)),
    };
  });
  const 다보임 = r.칸.every((c) => c.l >= r.줄.l - 0.5 && c.r <= r.줄.r + 0.5);
  const 같은폭 = Math.max(...r.칸.map((c) => c.w)) - Math.min(...r.칸.map((c) => c.w)) < 1;
  say(다보임 && 같은폭, `${폭}px: 세 칸 다 보임 · 칸 너비 ${r.칸.map((c) => Math.round(c.w)).join("/")}px — "${r.칸[2].글}"`);
  say(!r.칸.some((c) => c.잘린글.length), `${폭}px: 칸 안 글자가 … 으로 안 잘림`
    + (r.칸.some((c) => c.잘린글.length) ? ` (잘림: ${r.칸.flatMap((c) => c.잘린글).join(", ")})` : ""));
  // 세 줄로 쌓아도 옛 두 줄짜리(46px)보다 거의 안 높아야 한다 — 이 줄이 높아지면
  // 기록 화면 전체가 그만큼 길어진다. 44 이상은 누를 곳 규칙이다.
  say(r.칸.every((c) => c.h >= 44 && c.h <= 48.5), `${폭}px: 칸 높이 ${Math.round(r.칸[0].h)}px (44 이상 · 옛 46px 에서 +2 이내)`);
  say(!r.가로넘침, `${폭}px: 가로 넘침 없음`);
  // 한 화면 기준은 390×844(아이폰 12~15) 한 가지다. 414·430 폭은 코트가 폭에 맞춰
  // 커져서 고치기 전 코드도 850 · 860px 로 이미 넘쳤다 — 이 변경 탓이 아니다.
  if (폭 === 390) say(r.내용끝 <= 844, `390px: 기록 화면이 한 화면에 들어감 (내용 끝 ${Math.round(r.내용끝)}px / 844)`);
  else console.log(`   (${폭}px: 내용 끝 ${Math.round(r.내용끝)}px — 참고)`);
  await ctx.close();
}

// ── 2·3. 결과 화면 + 한꺼번에 받기 ─────────────────────────
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());
await 차리기(p, 8);
// 두 번째 경기(BC)를 보다가 결과 보기
await p.evaluate(() => document.querySelector('.rec-gbtn[data-game="1"]').click());
await p.waitForTimeout(250);
await p.click("#rec-finish"); await p.waitForTimeout(800);

const 결과1 = await p.evaluate(() => ({
  전환: document.querySelectorAll(".rec-done .rec-gbtn").length,
  켜짐: document.querySelector(".rec-done .rec-gbtn.is-on")?.dataset.game,
  제목: document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim(),
  모두: !!document.querySelector("#rec-all"),
  모두글: document.querySelector("#rec-all")?.textContent.trim(),
  엑셀글: document.querySelector("#rec-xlsx").textContent.trim(),
}));
say(결과1.전환 === 3, `결과 화면에 전환 줄 — 칸 ${결과1.전환}개`);
say(결과1.켜짐 === "1" && /^B팀 \d+ : \d+ C팀$/.test(결과1.제목), `보던 경기(BC)가 켜져 있고 제목도 BC — "${결과1.제목}"`);
say(결과1.모두 && 결과1.모두글.includes("세 경기 한꺼번에"), `한꺼번에 받기 버튼 — "${결과1.모두글}"`);
say(결과1.엑셀글 === "이 경기 엑셀만 받기", `한 경기 버튼은 '이 경기' 라고 적힘 — "${결과1.엑셀글}"`);

// 결과 화면에서 CA 로 갈아타기
await p.evaluate(() => document.querySelector('.rec-done .rec-gbtn[data-game="2"]').click());
await p.waitForTimeout(500);
const 결과2 = await p.evaluate(async () => {
  const st = await import("./js/storage.js");
  return {
    결과화면: !!document.querySelector(".rec-done"),
    기록화면: !!document.querySelector("#rec-court-svg"),
    켜짐: document.querySelector(".rec-done .rec-gbtn.is-on")?.dataset.game,
    제목: document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim(),
    보관: st.getRecordArchive().map((g) => g.teams.map((t) => t.name).join("-")),
    차트: !!document.querySelector("#rec-chart svg"),
    위: Math.round(window.scrollY),
  };
});
say(결과2.결과화면 && !결과2.기록화면, "갈아타도 결과 화면에 머묾 (기록 화면으로 안 돌아감)");
say(결과2.켜짐 === "2" && /^C팀 \d+ : \d+ A팀$/.test(결과2.제목), `CA 로 바뀜 — "${결과2.제목}"`);
say(결과2.보관.includes("B팀-C팀") && 결과2.보관.includes("C팀-A팀"), `보관함에 BC · CA 둘 다 — ${결과2.보관.join(", ")}`);
say(결과2.차트, "샷 차트도 새 경기로 다시 그려짐");
say(결과2.위 === 0, `갈아탄 뒤 맨 위로 (scrollY ${결과2.위})`);

// 다시 한 번 눌러도 같은 경기면 아무 일 없음
await p.evaluate(() => document.querySelector('.rec-done .rec-gbtn[data-game="2"]').click());
await p.waitForTimeout(200);

// 한꺼번에 받기 — 7개 다 받는지 (경기마다 엑셀 + 이미지, 맨 끝에 오늘 합계 엑셀)
const 받음 = [];
p.on("download", (d) => 받음.push(d));
await p.click("#rec-all");
const 끝 = Date.now() + 60000;
while (받음.length < 7 && Date.now() < 끝) await p.waitForTimeout(200);
await p.waitForTimeout(1500);   // 8번째가 오는지도 본다
for (const d of 받음) await d.saveAs(`${DL}/${d.suggestedFilename()}`);
const 이름들 = 받음.map((d) => d.suggestedFilename());
console.log("   받은 파일:", 이름들.join("  "));
say(받음.length === 7, `받은 파일 ${받음.length}개 (엑셀 3 + 이미지 3 + 오늘 합계 1)`);
say(new Set(이름들).size === 이름들.length, "이름이 전부 다름");
const 경기엑셀 = 이름들.filter((n) => n.startsWith("spirit-game-") && n.endsWith(".xlsx"));
say(경기엑셀.length === 3 && 이름들.filter((n) => n.endsWith(".png")).length === 3,
  "경기 엑셀 3 · 이미지 3");
say(/^spirit-day-\d{4}-\d{2}-\d{2}-\d{4}-DAY\.xlsx$/.test(이름들[이름들.length - 1] || ""),
  `맨 끝이 오늘 합계 엑셀 — ${이름들[이름들.length - 1]}`);
say(["AB", "BC", "CA"].every((v) => 이름들.some((n) => n.endsWith(`-${v}.xlsx`)) && 이름들.some((n) => n.endsWith(`-${v}.png`))),
  "AB · BC · CA 마다 엑셀과 이미지가 하나씩");
const 버튼끝 = await p.evaluate(() => document.querySelector("#rec-all").textContent.trim());
say(버튼끝.includes("7개"), `버튼이 "${버튼끝}" 로 알려 줌`);

// 엑셀 점수가 각 경기 점수와 같은가
const 점수들 = await p.evaluate(async () => {
  const st = await import("./js/storage.js"); const R = await import("./js/record.js");
  return st.getRecordSession().games.map((g) => ({ 대진: g.teams.map((t) => t.name).join("-"), 점: R.scoreOf(g.events) }));
});
const 엑셀점수 = JSON.parse(execFileSync("python3", ["-c", `
import json, glob, openpyxl
out = {}
for f in glob.glob(${JSON.stringify(`${DL}/spirit-game-*.xlsx`)}):
    ws = openpyxl.load_workbook(f, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True)); h = list(rows[0])
    i팀, i득 = h.index("팀"), h.index("득점")
    tot = {}
    for r in rows[1:]:
        if r[i팀]: tot[r[i팀]] = tot.get(r[i팀], 0) + int(r[i득] or 0)
    out[f.split("-")[-1][:2]] = tot
print(json.dumps(out, ensure_ascii=False))
`], { encoding: "utf8" }));
for (const g of 점수들) {
  const [a, c] = g.대진.split("-");
  const 키 = a[0] + c[0];
  const e = 엑셀점수[키] || {};
  say(e[a] === g.점[0] && e[c] === g.점[1], `${g.대진} 엑셀 ${e[a]}:${e[c]} = 화면 ${g.점.join(":")}`);
}
say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await ctx.close();

// ── 명암비: 전환 줄 글자 (두 테마, 켜진 칸 포함) ──────────
for (const 테마 of ["dark", "light"]) {
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 테마 });
  await c2.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } }, 테마);
  const q = await c2.newPage(); q.on("dialog", (d) => d.accept());
  await 차리기(q, 2);
  const 색 = await q.evaluate(() => {
    const 숫 = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
    const 배경 = (el) => { const 층 = []; let n = el;
      while (n) { const c = 숫(getComputedStyle(n).backgroundColor); if (c.a > 0) 층.push(c); if (c.a >= 0.999) break; n = n.parentElement; }
      let v = [255, 255, 255]; for (let i = 층.length - 1; i >= 0; i--) { const c = 층[i]; v = [c.r * c.a + v[0] * (1 - c.a), c.g * c.a + v[1] * (1 - c.a), c.b * c.a + v[2] * (1 - c.a)]; } return v; };
    return [...document.querySelectorAll(".rec-gbtn > *")].map((el) => {
      const c = 숫(getComputedStyle(el).color); return { 글: el.textContent.trim(), 켜짐: el.parentElement.classList.contains("is-on"),
        앞: [c.r, c.g, c.b], 뒤: 배경(el), px: parseFloat(getComputedStyle(el).fontSize) };
    });
  });
  const 최저 = 색.map((x) => ({ ...x, 비: 대비(x.앞, x.뒤) })).sort((a2, c3) => a2.비 - c3.비)[0];
  say(최저.비 >= 4.5, `${테마}: 전환 줄 글자 명암비 가장 낮은 것 ${최저.비.toFixed(2)} ("${최저.글}" ${최저.px}px${최저.켜짐 ? " · 켜진 칸" : ""})`);
  await c2.close();
}

// ── 4. 2팀 경기에는 안 나온다 ─────────────────────────────
const c3 = await b.newContext({ viewport: { width: 390, height: 844 } });
const q3 = await c3.newPage(); q3.on("dialog", (d) => d.accept());
await q3.goto(`${URL}/index.html#/record`);
await q3.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } });
await q3.goto(`${URL}/index.html?two=1#/record`); await q3.waitForTimeout(800);
const 로스터 = await q3.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 로스터.slice(0, 10)) await q3.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`)?.click(), n);
await q3.click("#rec-start"); await q3.waitForTimeout(500);
await q3.click("#rec-finish"); await q3.waitForTimeout(600);
const 둘 = await q3.evaluate(() => ({
  전환: document.querySelectorAll(".rec-gbtn").length, 모두: !!document.querySelector("#rec-all"),
  엑셀: document.querySelector("#rec-xlsx").textContent.trim(), 이미지: document.querySelector("#rec-band-img").textContent.trim(),
}));
say(둘.전환 === 0 && !둘.모두, "2팀 경기: 전환 줄 · 한꺼번에 받기 없음");
say(둘.엑셀 === "엑셀 받기" && 둘.이미지 === "밴드용 결과 이미지 받기", `2팀 경기 버튼 글자는 그대로 — "${둘.엑셀}" · "${둘.이미지}"`);
await c3.close();

await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
