// 코트를 키운 뒤 — 크기, 탑 3점이 찍히는지, 화면이 안 넘치는지.
// 겸해서 1·2번(리바 흐름 · 누르는 순서)이 실제로 되는지 같이 본다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);
const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 로스터.slice(0, 10)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}
await p.click("#rec-start");
await p.waitForTimeout(600);

// ── 3. 코트 크기 ──────────────────────────────────────
const 코트 = await p.evaluate(() => {
  const svg = document.querySelector("#rec-court-svg");
  const r = svg.getBoundingClientRect();
  return {
    w: Math.round(r.width), h: Math.round(r.height),
    view: svg.getAttribute("viewBox"),
    화면폭: window.innerWidth,
  };
});
say(코트.view === "0 135 500 325", `viewBox ${코트.view}`);
// 칸은 382px(main 여백 24 를 -20 으로 되받음), 안쪽 여백 4px 씩 빼면 그림은 374px.
say(코트.w === 374, `코트 그림 ${코트.w} × ${코트.h}px (화면 ${코트.화면폭}px)`);
const 넓이 = 코트.w * 코트.h;
say(넓이 / (334 * 190) >= 1.4, `넓이 ${넓이.toLocaleString()}px² — 전(334×190=63,460)의 ${(넓이 / 63460).toFixed(2)}배`);

const 크기 = await p.evaluate(() => {
  const live = document.querySelector(".rec-live").getBoundingClientRect();
  return {
    아래: Math.round(live.bottom), 화면: window.innerHeight,
    남음: Math.round(window.innerHeight - live.bottom),
    가로넘침: document.documentElement.scrollWidth > window.innerWidth,
  };
});
say(크기.아래 <= 크기.화면, `화면 안에 들어감 — 내용이 ${크기.아래}px 에서 끝남 (화면 ${크기.화면}px, ${크기.남음}px 남음)`);
say(!크기.가로넘침, "가로 넘침 없음");

// ── 탑 3점이 찍히나 ───────────────────────────────────
async function 코트탭(vx, vy) {
  const r = await p.evaluate(() => {
    const s2 = document.querySelector("#rec-court-svg");
    const b2 = s2.getBoundingClientRect();
    const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
    return { l: b2.left, t: b2.top, w: b2.width, h: b2.height, vx, vy, vw, vh };
  });
  await p.mouse.click(r.l + ((vx - r.vx) / r.vw) * r.w, r.t + ((vy - r.vy) / r.vh) * r.h);
  await p.waitForTimeout(160);
}
const 점수말 = () => p.evaluate(() => document.querySelector(".rec-zone")?.textContent?.trim() || "");

// 아크 꼭대기는 y=185.8. 그 위(정면 탑)를 찍으면 3점이어야 한다.
await 코트탭(250, 165);
say(await 점수말() === "3점", `정면 탑 (250,165) → ${await 점수말()}`);
await p.keyboard.press("Escape");
await 코트탭(250, 145);
say(await 점수말() === "3점", `더 뒤 (250,145) → ${await 점수말()}`);
// 아크 안쪽은 그대로 2점이어야 한다
await 코트탭(250, 240);
say(await 점수말() === "2점", `아크 안 (250,240) → ${await 점수말()}`);
await 코트탭(250, 430);
say(await 점수말() === "2점", `골밑 (250,430) → ${await 점수말()}`);
await 코트탭(20, 440);
say(await 점수말() === "3점", `코너 (20,440) → ${await 점수말()}`);

// 실제로 3점으로 기록되나
const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
await 코트탭(250, 150);
await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 선수[0]);
await p.waitForTimeout(140);
await p.click("#rec-made"); await p.waitForTimeout(250);
const 점 = await p.evaluate(() => document.querySelector(".rec-score").innerText.replace(/\s+/g, " ").trim());
say(/\b3\b/.test(점), `탑에서 넣으니 점수 ${점} (3점이 들어감)`);

// 찍은 자리 글씨가 화면 밖으로 안 나가나 — 위쪽에 찍으면 점 아래로 내려 적는다
await 코트탭(250, 145);
const 글y = await p.evaluate(() => Number(document.querySelector(".rec-zone")?.getAttribute("y")));
say(글y >= 140, `(250,145) 에 찍은 '3점' 글씨 y=${글y} — 코트 위쪽 끝(135) 안에 있음`);
await 코트탭(250, 430);
const 글y2 = await p.evaluate(() => Number(document.querySelector(".rec-zone")?.getAttribute("y")));
say(글y2 > 140 && 글y2 < 429, `골밑에 찍으면 전처럼 점 위에 적음 y=${글y2}`);

// 찍힌 자리가 차트에도 남나 — 그림 잘라내기가 같은 값이어야 한다
const 잘림 = await p.evaluate(async () => {
  const m = await import("./js/record-chart.js");
  return m.CHART_VIEW;
});
say(잘림.y === 135 && 잘림.h === 325, `차트 잘라내기 y ${잘림.y} h ${잘림.h} — 코트와 같음`);

// ── 1. 리바 흐름 ──────────────────────────────────────
const 버튼 = await p.evaluate(() => [...document.querySelectorAll(".rec-ebtn")].map((x) => x.dataset.spot));
say(버튼.join(" ") === "ast reb stl blk to pf ftm fta", `기타 이벤트: ${버튼.join(" ")}`);
await p.evaluate(() => document.querySelector('[data-spot="reb"]').click());
await p.waitForTimeout(200);
const 안내 = await p.evaluate(() => document.querySelector(".rec-tip").textContent.trim());
say(안내.includes("공격이야 수비야"), `리바 → "${안내}"`);
say(await p.evaluate(() => !!document.querySelector("#rec-reb-o") && !!document.querySelector("#rec-reb-d")),
  "공격 리바 · 수비 리바 버튼이 뜸");
await p.click("#rec-reb-d"); await p.waitForTimeout(160);
await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 선수[1]);
await p.waitForTimeout(200);
const 수1 = await p.evaluate(() => Number(document.querySelector(".rec-n b").textContent));
say(수1 === 2, `리바 → 수비 → 선수 로 기록 ${수1}개`);

// ── 2. 선수 먼저 → 이벤트 ─────────────────────────────
// 바로 위에서 코트를 눌러 둔 상태 그대로 이어 간다. 그 자리를 들고 있으면
// 선수 → 이벤트가 아무 일도 안 했었다.
await 코트탭(300, 350);
say(await p.evaluate(() => !!document.querySelector(".rec-shot-live")), "코트를 눌러 둔 자리가 남아 있는 상태");
await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 선수[2]);
await p.waitForTimeout(140);
await p.evaluate(() => document.querySelector('[data-spot="stl"]').click());
await p.waitForTimeout(250);
const 수2 = await p.evaluate(() => Number(document.querySelector(".rec-n b").textContent));
const 안내2 = await p.evaluate(() => document.querySelector(".rec-tip").textContent.trim());
say(수2 === 3, `코트를 눌러 둔 채로도 선수 → 스틸 로 기록 ${수2}개 (한 번 더 안 눌러도 됨)`);
say(!(await p.evaluate(() => !!document.querySelector(".rec-shot-live"))),
  "눌러 뒀던 코트 자리는 지워짐 (표시만 남아 다음 누름을 막지 않음)");
say(!안내2.includes("누구?"), `"누구?" 가 안 뜸 — "${안내2}"`);

await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 선수[3]);
await p.waitForTimeout(140);
await p.evaluate(() => document.querySelector('[data-spot="ftm"]').click());
await p.waitForTimeout(250);
say(await p.evaluate(() => Number(document.querySelector(".rec-n b").textContent)) === 4, "선수 → 자유투○ 도 바로 기록");

// ── 3파전이면 전환 줄이 한 줄 더 붙는다. 그래도 들어가나 ──
await p.evaluate(() => localStorage.clear());
await p.reload();   // 같은 주소로 goto 하면 해시만 같아 새로 안 읽는다
await p.waitForTimeout(900);
await p.click('.rec-nbtn[data-n="3"]');
await p.waitForTimeout(200);
const 로스터2 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 로스터2.slice(0, 12)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}
await p.click("#rec-start");
await p.waitForTimeout(700);
const 셋 = await p.evaluate(() => {
  const live = document.querySelector(".rec-live").getBoundingClientRect();
  return {
    전환줄: Math.round(document.querySelector(".rec-gswitch").getBoundingClientRect().height),
    아래: Math.round(live.bottom), 화면: window.innerHeight,
    가로넘침: document.documentElement.scrollWidth > window.innerWidth,
  };
});
say(셋.아래 <= 셋.화면,
  `3파전(전환 줄 ${셋.전환줄}px)에서도 화면 안 — ${셋.아래}px / ${셋.화면}px`);
say(!셋.가로넘침, "3파전에서도 가로 넘침 없음");

say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
