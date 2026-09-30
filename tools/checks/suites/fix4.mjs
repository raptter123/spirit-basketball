// 네 가지를 고쳤는지 본다.
//   1. 엑셀 샷차트가 그림 한 장에 전원
//   2. A·B·C 팀 색이 경기가 바뀌어도 그대로
//   3. 선수를 먼저 누른 뒤 이벤트를 눌러도 기록됨
//   4. 리바 → 공격/수비 → 선수
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const HERE = 폴더();
const DL = `${HERE}/dlfix`;
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);
await p.click('.rec-nbtn[data-n="3"]');
await p.waitForTimeout(200);
const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 로스터.slice(0, 12)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}
await p.click("#rec-start");
await p.waitForTimeout(700);

async function 코트탭(vx, vy) {
  const box = await p.evaluate(() => {
    const s2 = document.querySelector("#rec-court-svg");
    const r = s2.getBoundingClientRect();
    const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  await p.mouse.click(box.l + (((vx - box.vx) / box.vw) * box.w), box.t + ((vy - box.vy) / box.vh) * box.h);
  await p.waitForTimeout(150);
}
const 선수목록 = () => p.evaluate(() =>
  [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
const 선수탭 = (n) => p.evaluate((v) =>
  document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(140));
const 스팟 = (k) => p.evaluate((v) =>
  document.querySelector(`[data-spot="${v}"]`).click(), k).then(() => p.waitForTimeout(140));
const 경기로 = (i) => p.evaluate((v) =>
  document.querySelector(`.rec-gbtn[data-game="${v}"]`).click(), i).then(() => p.waitForTimeout(280));
const 수 = () => p.evaluate(() => Number(document.querySelector(".rec-n b").textContent));
const 안내 = () => p.evaluate(() => document.querySelector(".rec-tip").textContent.trim());
const 최근 = () => p.evaluate(() => document.querySelector(".rec-last").innerText.replace(/\s+/g, " ").trim());

// ── 4. 리바 → 공격/수비 → 선수 ────────────────────────
const 버튼 = await p.evaluate(() =>
  [...document.querySelectorAll(".rec-ebtn")].map((x) => x.dataset.spot));
say(버튼.includes("reb") && !버튼.includes("rebO") && !버튼.includes("rebD"),
  `기타 이벤트 ${버튼.length}개 — '리바' 하나 (공격리바·수비리바 따로 없음)`);
const 줄수 = await p.evaluate(() =>
  new Set([...document.querySelectorAll(".rec-ebtn")].map((x) => Math.round(x.getBoundingClientRect().top))).size);
const 칸너비 = await p.evaluate(() => Math.round(document.querySelector(".rec-ebtn").getBoundingClientRect().width));
say(줄수 === 2 && 버튼.length === 8, `네 열 두 줄로 돌아옴 (칸 너비 ${칸너비}px)`);

await 스팟("reb");
say((await 안내()).includes("공격이야 수비야"), `리바를 누르니 물어봄 — "${await 안내()}"`);
const 공수버튼 = await p.evaluate(() => ({
  o: !!document.querySelector("#rec-reb-o"), d: !!document.querySelector("#rec-reb-d"),
  h: Math.round(document.querySelector("#rec-reb-o").getBoundingClientRect().height),
}));
say(공수버튼.o && 공수버튼.d, `공격 리바 · 수비 리바 버튼이 뜸 (높이 ${공수버튼.h}px)`);
await p.click("#rec-reb-d"); await p.waitForTimeout(200);
say((await 안내()).includes("수비 리바운드 — 누구?"), `고르고 나니 선수를 기다림 — "${await 안내()}"`);
const 선수 = await 선수목록();
await 선수탭(선수[0]);
say(await 수() === 1, `선수를 누르니 기록 1개 — ${await 최근()}`);

// ── 3. 선수를 먼저 눌러도 되나 ────────────────────────
await 선수탭(선수[1]);
await 스팟("ast");
say(await 수() === 2, `선수 → 어시 순서로도 기록됨 (${await 수()}개) — ${await 최근()}`);
say(!(await 안내()).includes("누구?"), `"다시 누르라" 는 말이 안 뜸 — "${await 안내()}"`);

// 선수 먼저 + 리바도 되나
await 선수탭(선수[2]);
await 스팟("reb");
say((await 안내()).includes("공격이야 수비야"), "선수 → 리바 순서면 공수만 물어봄");
await p.click("#rec-reb-o"); await p.waitForTimeout(220);
say(await 수() === 3, `공격 리바를 고르자 바로 기록 (${await 수()}개) — ${await 최근()}`);

// 슛은 코트를 먼저 눌러야 하는 흐름 그대로인가
await 코트탭(250, 430); await 선수탭(선수[3]);
await p.click("#rec-made"); await p.waitForTimeout(200);
say(await 수() === 4, `슛 흐름은 그대로 (${await 수()}개) — ${await 최근()}`);

// ── 2. 팀 색이 경기가 바뀌어도 그대로인가 ─────────────
const 색보기 = () => p.evaluate(() => {
  const 줄 = [...document.querySelectorAll(".rec-team-row")];
  return 줄.map((r) => ({
    이름: r.querySelector(".rec-team-tag").textContent.trim(),
    t: r.dataset.t,
    색: getComputedStyle(r).getPropertyValue("--c").trim(),
  }));
});
const ab = await 색보기();
await 경기로(1); const bc = await 색보기();
await 경기로(2); const ca = await 색보기();
const 모두 = [...ab, ...bc, ...ca];
const 팀별 = {};
for (const x of 모두) (팀별[x.이름] ||= new Set()).add(x.색);
say(Object.values(팀별).every((v) => v.size === 1),
  `팀마다 색이 하나씩 — ${Object.entries(팀별).map(([k, v]) => `${k} ${[...v][0]}`).join(" · ")}`);
say(new Set(모두.map((x) => x.색)).size === 3,
  `세 팀이 서로 다른 색 (${new Set(모두.map((x) => x.색)).size}가지)`);
say(ab.find((x) => x.이름 === "B팀").색 === bc.find((x) => x.이름 === "B팀").색,
  `B팀이 AB 경기와 BC 경기에서 같은 색 (${ab.find((x) => x.이름 === "B팀").색})`);

// ── 1. 엑셀 샷차트가 한 장인가 ────────────────────────
await 경기로(0);
// 여러 사람이 쏘게 만든다
for (let i = 0; i < 5; i++) {
  await 코트탭(150 + i * 50, 300 + (i % 3) * 50);
  await 선수탭(선수[i % 10]);
  await p.click(i % 2 ? "#rec-miss" : "#rec-made");
  await p.waitForTimeout(160);
}
await p.click("#rec-finish");
await p.waitForTimeout(600);
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.click("#rec-xlsx")]);
const 파일 = `${DL}/${dl.suggestedFilename()}`;
await dl.saveAs(파일);
say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await b.close();

const z = JSON.parse(execFileSync("python3", ["-c", `
import json, zipfile, re
z = zipfile.ZipFile(${JSON.stringify(파일)})
names = z.namelist()
draw = z.read("xl/drawings/drawing1.xml").decode()
styles = z.read("xl/styles.xml").decode()
print(json.dumps({
  "media": [n for n in names if n.startswith("xl/media/")],
  "닻": draw.count("<xdr:oneCellAnchor>"),
  "ext": [(int(x)//9525, int(y)//9525) for x, y in re.findall(r'<xdr:ext cx="(\\d+)" cy="(\\d+)"/>', draw)],
  "글꼴수": int(re.search(r'<fonts count="(\\d+)"', styles).group(1)),
  "서식수": int(re.search(r'<cellXfs count="(\\d+)"', styles).group(1)),
  "C팀색": "FF6B21A8" in styles,
}, ensure_ascii=False))
`], { encoding: "utf8" }));
say(z.media.length === 1 && z.닻 === 1, `엑셀 샷차트 그림 ${z.media.length}장 · 닻 ${z.닻}개 (한 장에 전원)`);
say(z.ext[0][0] === 1000, `그림 너비 ${z.ext[0][0]}px (밴드 이미지와 같은 좌표계)`);
say(z.ext[0][1] > 400, `그림 높이 ${z.ext[0][1]}px — 팀 둘 + 선수들이 다 들어감`);
say(z.글꼴수 === 7 && z.서식수 === 21 && z.C팀색, `엑셀 서식에 C팀 색 있음 (글꼴 ${z.글꼴수}벌 · 서식 ${z.서식수}가지)`);

// 그림 안에 선수가 여럿인지 — PNG 를 열어 높이로 본다
const 크기 = execFileSync("python3", ["-c", `
import zipfile
from struct import unpack
z = zipfile.ZipFile(${JSON.stringify(파일)})
d = z.read([n for n in z.namelist() if n.startswith("xl/media/")][0])
w, h = unpack('>II', d[16:24])
print(f"{w} {h} {len(d)}")
`], { encoding: "utf8" }).trim().split(" ");
say(Number(크기[0]) === 2000, `박힌 png ${크기[0]}×${크기[1]}px (2배로 뽑음, ${Number(크기[2]).toLocaleString()}바이트)`);

console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
