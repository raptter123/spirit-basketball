// 받는 파일 바로잡기를 확인한다.
//   1. 같은 날 A팀–B팀을 두 번 하면 엑셀도 이미지도 이름이 갈린다
//   2. 한 경기의 엑셀과 이미지는 이름 뒷부분(날짜-시각-대진)이 같다
//   3. 결과 화면의 엑셀 안내 글이 실제 엑셀 시트 이름과 같다
//
// 두 경기를 한 분 안에 시작하면 시각(분)이 같아 시험이 거짓으로 깨진다. 실제로는
// 한 경기를 1분 안에 끝낼 수 없으니, 브라우저 시계를 40분 앞으로 돌려 두 번째를 연다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dlfiles");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const bad = []; const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());

// 오후 7시 5분으로 시계를 박아 둔다 — 날짜가 바뀌는 자정 근처를 피한다.
await p.clock.install({ time: new Date("2026-09-24T19:05:00") });
await p.goto(`${URL}/index.html#/record`);
await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } });
await p.goto(`${URL}/index.html?f=1#/record`);
await p.waitForTimeout(900);

async function 한경기() {
  const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 로스터.slice(0, 10)) {
    await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`)?.click(), n);
  }
  await p.click("#rec-start"); await p.waitForTimeout(500);
  const 코트 = await p.evaluate(() => {
    const s = document.querySelector("#rec-court-svg"); const r = s.getBoundingClientRect();
    const [vx, vy, vw, vh] = s.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  for (let i = 0; i < 4; i++) {
    await p.mouse.click(코트.l + ((180 + i * 40 - 코트.vx) / 코트.vw) * 코트.w,
      코트.t + ((330 + i * 25 - 코트.vy) / 코트.vh) * 코트.h);
    await p.waitForTimeout(80);
    await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`)?.click(), 선수[i * 2]);
    await p.waitForTimeout(80);
    await p.click(i % 2 ? "#rec-miss" : "#rec-made"); await p.waitForTimeout(120);
  }
  await p.click("#rec-finish"); await p.waitForTimeout(700);
  const [x] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.click("#rec-xlsx")]);
  await x.saveAs(`${DL}/${x.suggestedFilename()}`);
  const [g] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.click("#rec-band-img")]);
  await g.saveAs(`${DL}/${g.suggestedFilename()}`);
  return { xlsx: x.suggestedFilename(), png: g.suggestedFilename() };
}

const 첫 = await 한경기();
// 안내 글에 적힌 시트 이름들
const 안내시트 = await p.evaluate(() =>
  [...document.querySelectorAll(".rec-xlsx-sheets b")].map((b) => b.textContent.trim()));

// '새 경기' → 40분 뒤 두 번째 경기
await p.click("#rec-new"); await p.waitForTimeout(600);
await p.clock.fastForward("40:00");
const 둘 = await 한경기();

console.log(`첫 경기: ${첫.xlsx}  /  ${첫.png}`);
console.log(`둘째:    ${둘.xlsx}  /  ${둘.png}`);

const 꼬리 = (n) => n.replace(/^spirit-(game|result)-/, "").replace(/\.(xlsx|png)$/, "");
say(첫.png !== 둘.png, `밴드 이미지 이름이 갈림 (${꼬리(첫.png)} ≠ ${꼬리(둘.png)})`);
say(첫.xlsx !== 둘.xlsx, `엑셀 이름이 갈림 (${꼬리(첫.xlsx)} ≠ ${꼬리(둘.xlsx)})`);
say(꼬리(첫.xlsx) === 꼬리(첫.png) && 꼬리(둘.xlsx) === 꼬리(둘.png),
  `한 경기의 엑셀과 이미지는 이름 뒷부분이 같음 (${꼬리(첫.png)})`);
say(/^spirit-result-2026-09-24-1905-AB\.png$/.test(첫.png), `이미지 이름 모양 — ${첫.png}`);
say(/^spirit-result-2026-09-24-19(4[5-9]|5\d)-AB\.png$/.test(둘.png), `40분 뒤 경기는 시각이 19:4x — ${둘.png}`);
say(fs.readdirSync(DL).length === 4, `폴더에 파일 ${fs.readdirSync(DL).length}개 (덮어쓴 것 없음)`);
say(fs.readdirSync(DL).every((f) => fs.statSync(`${DL}/${f}`).size > 1000),
  `네 파일 모두 내용이 있음 (가장 작은 것 ${Math.min(...fs.readdirSync(DL).map((f) => fs.statSync(`${DL}/${f}`).size)).toLocaleString()}바이트)`);

// 안내 글 ↔ 실제 시트
const 실제 = JSON.parse(execFileSync("python3", ["-c", `
import json, zipfile, re
z = zipfile.ZipFile(${JSON.stringify(`${DL}/${첫.xlsx}`)})
print(json.dumps(re.findall(r'<sheet name="([^"]+)"', z.read("xl/workbook.xml").decode()), ensure_ascii=False))
`], { encoding: "utf8" }));
say(JSON.stringify(안내시트) === JSON.stringify(실제),
  `안내 글 시트 이름 = 실제 엑셀 시트 이름 (${실제.length}장: ${실제.join(" · ")})`);
if (JSON.stringify(안내시트) !== JSON.stringify(실제)) console.log("   안내 글:", 안내시트.join(" · "));

say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
