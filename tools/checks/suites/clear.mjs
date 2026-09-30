// '전부 지우기' 를 본다. 경기 셋을 쌓아 두고,
//  ① 확인 창을 거절하면 하나도 안 지워지는지
//  ② 받아들이면 전부 지워지는지
//  ③ 지운 뒤에도 새 경기를 기록할 수 있는지 (저장 칸이 깨지지 않았는지)
//  ④ 기록 중인 경기는 건드리지 않는지
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const OUT = 폴더("shots");
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
let 물음 = "";
let 대답 = true;
p.on("dialog", (d) => { 물음 = d.message(); 대답 ? d.accept() : d.dismiss(); });

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 골밑 = async () => {
  const r = await p.evaluate(() => {
    const b = document.querySelector("#rec-court-svg").getBoundingClientRect();
    return { l: b.left, t: b.top, w: b.width, h: b.height };
  });
  await p.mouse.click(r.l + 0.5 * r.w, r.t + 0.85 * r.h);
  await p.waitForTimeout(110);
};

async function 한경기(골수) {
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start"); await p.waitForTimeout(450);
  const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  for (let i = 0; i < 골수; i++) {
    await 골밑();
    await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 코트[0]);
    await p.waitForTimeout(100);
    await p.click("#rec-made"); await p.waitForTimeout(120);
  }
  await p.click("#rec-finish"); await p.waitForTimeout(400);
  await p.click("#rec-new"); await p.waitForTimeout(450);
}

await 한경기(1); await 한경기(2); await 한경기(3);
const 셈 = () => p.evaluate(() => document.querySelectorAll(".rec-arch-row").length);
say(await 셈() === 3, `경기 ${await 셈()}개 쌓임`);

const 머리 = await p.evaluate(() => {
  const h = document.querySelector(".rec-arch-head");
  const btn = document.querySelector("#rec-arch-clear");
  const t = h.querySelector("h3").getBoundingClientRect();
  const r = btn.getBoundingClientRect();
  return { 글: btn.textContent.trim(), 높이: Math.round(r.height),
    오른쪽끝: Math.round(document.documentElement.clientWidth - r.right),
    겹침: t.right > r.left + 0.5 };
});
say(머리.글 === "전부 지우기", `버튼 글: "${머리.글}"`);
say(머리.높이 >= 44, `버튼 높이 ${머리.높이}px`);
say(!머리.겹침, `제목과 안 겹침 (오른쪽 여백 ${머리.오른쪽끝}px)`);

await p.locator(".rec-arch-head").screenshot({ path: `${OUT}/clear-head.png` });

// ① 거절하면 그대로
대답 = false;
await p.click("#rec-arch-clear");
await p.waitForTimeout(400);
say(물음.includes("지난 경기 3개를 전부 지울까요"), `몇 개인지 숫자로 물음 — "${물음.split("\n")[0]}"`);
say(물음.includes("엑셀로 받아 두세요"), `엑셀 먼저 받으라고 일러 줌`);
say(await 셈() === 3, `취소하면 ${await 셈()}개 그대로`);

// ② 받아들이면 전부
대답 = true;
await p.click("#rec-arch-clear");
await p.waitForTimeout(500);
say(await 셈() === 0, `확인하면 ${await 셈()}개 — 전부 지워짐`);
const 사라짐 = await p.evaluate(() => ({
  목록: !!document.querySelector(".rec-archive"),
  저장: localStorage.getItem("spirit-record-games"),
  설정: !!document.querySelector("#rec-start"),
}));
say(!사라짐.목록, `보관함 칸 자체가 사라짐 (경기가 없으니)`);
say(사라짐.저장 === null, `저장 칸도 비워짐 (${사라짐.저장})`);
say(사라짐.설정, `설정 화면은 그대로 — 새 경기를 바로 시작할 수 있음`);

// ③ 지운 뒤에도 정상 동작
await 한경기(2);
say(await 셈() === 1, `지운 뒤 새 경기 기록됨 — 보관함 ${await 셈()}개`);

// ④ 기록 중인 경기는 안 건드림
{
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start"); await p.waitForTimeout(450);
  await 골밑();
  const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 코트[0]);
  await p.waitForTimeout(100);
  await p.click("#rec-made"); await p.waitForTimeout(150);
  // 기록 중에는 보관함 화면이 안 보이므로, 저장 칸을 직접 확인한다
  const 상태 = await p.evaluate(() => ({
    // 기록 중인 경기는 이제 세션(경기 여럿)으로 담긴다 — 옛 키는 spirit-record-game
    진행중: !!localStorage.getItem("spirit-record-session"),
    보관: JSON.parse(localStorage.getItem("spirit-record-games") || "[]").length,
    이벤트: JSON.parse(localStorage.getItem("spirit-record-session")).games[0].events.length,
  }));
  say(상태.진행중 && 상태.이벤트 === 1, `기록 중인 경기가 따로 남아 있음 (이벤트 ${상태.이벤트}개)`);
  say(상태.보관 === 1, `보관함은 ${상태.보관}개로 그대로 — 두 칸이 서로 안 건드림`);
}

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
