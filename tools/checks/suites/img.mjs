// 밴드용 결과 이미지 한 장을 실제로 받아 열어 본다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const OUT = 폴더("shots");
const DL = 폴더("dl5");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 160)); });
p.on("dialog", (d) => { errs.push("알림창: " + d.message().slice(0, 120)); d.accept(); });
await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(800);

const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
await p.click("#rec-start"); await p.waitForTimeout(450);
const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
const 자리 = () => p.evaluate(() => { const s2 = document.querySelector("#rec-court-svg"); const r = s2.getBoundingClientRect(); const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number); return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh }; });
const rnd = (() => { let s = 91; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();
const 찍기 = async (x, y, who, made) => {
  const box = await 자리();
  await p.mouse.click(box.l + ((x - box.vx) / box.vw) * box.w, box.t + ((y - box.vy) / box.vh) * box.h);
  await p.waitForTimeout(60);
  await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), who);
  await p.waitForTimeout(60);
  if (!(await p.evaluate(() => !document.querySelector("#rec-made").disabled))) return;
  await p.click(made ? "#rec-made" : "#rec-miss"); await p.waitForTimeout(70);
};
const 스팟 = async (k, who) => {
  await p.evaluate((v) => document.querySelector(`[data-spot="${v}"]`).click(), k);
  await p.waitForTimeout(60);
  await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), who);
  await p.waitForTimeout(60);
};
// 리바는 '리바' 를 누른 뒤 공격/수비를 고르고 선수를 누른다.
const 리바 = async (kind, who) => {
  await p.evaluate(() => document.querySelector('[data-spot="reb"]').click());
  await p.waitForTimeout(60);
  await p.click(kind === "rebO" ? "#rec-reb-o" : "#rec-reb-d");
  await p.waitForTimeout(60);
  await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), who);
  await p.waitForTimeout(60);
};
// 열 명 모두 슛을 쏘게 — 4쿼터, 선수마다 자리를 흩어서
for (let q = 0; q < 4; q++) {
  for (let i = 0; i < 10; i++) {
    const who = 코트[i];
    const r = rnd();
    const [x, y] = r < 0.4 ? [230 + rnd() * 45, 400 + rnd() * 45]
      : r < 0.7 ? [110 + rnd() * 280, 290 + rnd() * 70]
      : [60 + rnd() * 380, 192 + rnd() * 50];
    const made = rnd() < 0.45;
    await 찍기(x, y, who, made);
    if (!made && rnd() < 0.8) await 리바(rnd() < 0.3 ? "rebO" : "rebD", 코트[Math.floor(rnd() * 10)]);
    else if (made && rnd() < 0.4) await 스팟("ast", 코트[Math.floor(rnd() * 10)]);
    if (rnd() < 0.15) await 스팟("to", who);
  }
  if (q < 3) { await p.click("#rec-q"); await p.waitForTimeout(120); }
}


await p.click("#rec-finish"); await p.waitForTimeout(800);

say(!(await p.evaluate(() => !!document.querySelector("#rec-chart-png"))), "차트 쪽 '그림으로 받기' 버튼이 없어짐");
say(await p.evaluate(() => !!document.querySelector("#rec-band-img")), "'밴드용 결과 이미지 받기' 버튼 있음");
say(await p.evaluate(() => !!document.querySelector(".rec-band-more")), "글 복사는 접힌 칸 안으로 들어감");

const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.click("#rec-band-img")]);
const 파일 = `${DL}/${dl.suggestedFilename()}`;
await dl.saveAs(파일);
fs.copyFileSync(파일, `${OUT}/result.png`);
// 시각(시분)까지 붙는다 — 같은 날 같은 대진을 두 번 해도 안 겹친다. 엑셀과 같은 꼬리다.
say(/^spirit-result-\d{4}-\d{2}-\d{2}-\d{4}-AB\.png$/.test(dl.suggestedFilename()), `파일명 ${dl.suggestedFilename()} (날짜-시각-대진, 엑셀과 같은 꼬리)`);
const 정보 = execFileSync("python3", ["-c", `
from struct import unpack
from PIL import Image
d = open(${JSON.stringify(파일)}, 'rb').read()
assert d[:8] == b'\\x89PNG\\r\\n\\x1a\\n'
w, h = unpack('>II', d[16:24])
im = Image.open(${JSON.stringify(파일)}).convert('RGB')
px = im.load()
# 맨 위 띠가 남색인지, 바탕이 흰색인지 (테마를 안 따르는지)
top = px[10, 10]; mid = px[5, h//2]
print(f"{w} {h} {len(d)} {len(set(im.getdata()))} {top} {mid}")
`], { encoding: "utf8" }).trim().split(" ");
const [w, h, 바이트, 색수] = 정보;
say(w === "2000", `가로 ${w}px (1000 좌표 × 2배)`);
say(Number(h) > 1500, `세로 ${h}px — 표와 차트가 다 들어감`);
say(Number(바이트) > 50000 && Number(바이트) < 3000000, `${Number(바이트).toLocaleString()}바이트`);
say(Number(색수) > 200, `색 ${색수}가지`);
say(정보.slice(4).join(" ").includes("(21, 27, 51)"), `맨 위 띠가 고정 남색 — ${정보.slice(4).join(" ")}`);
say(정보.slice(4).join(" ").includes("(255, 255, 255)"), `바탕이 흰색 (테마를 안 따름)`);

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
