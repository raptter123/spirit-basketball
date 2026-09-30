// 기록 화면을 사람이 쓰는 길 그대로 돌려 본다.
// 설정 → 경기 시작 → 코트 탭 → 선수 탭 → 성공/실패 → 기타 이벤트 → 되돌리기 → 결과.
// 마지막에는 넣은 것과 나온 합계가 맞는지 직접 대조한다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
const OUT = 폴더("shots");
fs.mkdirSync(OUT, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 120)); });
p.on("dialog", (d) => d.accept());

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

// ── 설정: 로스터에서 10명 고르기 (A/B 번갈아 들어간다)
const 이름 = await p.evaluate(() =>
  [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
say(이름.length >= 10, `설정 화면 로스터 ${이름.length}명`);
for (const n of 이름.slice(0, 10)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.waitForTimeout(50);
}
const 시작 = await p.evaluate(() => {
  const b = document.querySelector("#rec-start");
  return { 글: b.textContent.trim(), 꺼짐: b.disabled };
});
say(!시작.꺼짐 && 시작.글.includes("5 vs 5"), `시작 버튼: "${시작.글}"`);
await p.screenshot({ path: `${OUT}/rec-setup.png`, fullPage: true });

await p.click("#rec-start");
await p.waitForTimeout(700);

const 상태 = () => p.evaluate(() => ({
  점수: document.querySelector(".rec-score")?.innerText.replace(/\n/g, " "),
  안내: document.querySelector(".rec-tip")?.textContent.trim(),
  선수: [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player),
  성공꺼짐: document.querySelector("#rec-made")?.disabled,
  이벤트수: Number(document.querySelector(".rec-n b")?.textContent || 0),
  최근: document.querySelector(".rec-last")?.innerText.replace(/\n/g, " / "),
  쿼터: {
    now: document.querySelector("#rec-q b")?.textContent.trim(),
    next: document.querySelector("#rec-q span")?.textContent.trim(),
  },
  스크롤: 0,
}));
const s0 = await 상태();
say(s0.선수.length === 10, `코트 위 ${s0.선수.length}명: ${s0.선수.join(", ")}`);
say(s0.성공꺼짐 === true, "선수를 고르기 전엔 성공/실패가 꺼져 있음");
say(s0.안내 === "슛한 자리를 눌러", `안내: "${s0.안내}"`);

// 한 화면에 들어가나
const 맞나 = await p.evaluate(() => ({
  스크롤: document.documentElement.scrollHeight > innerHeight + 1,
  높이: document.documentElement.scrollHeight, 화면: innerHeight,
  가로: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}));
say(!맞나.스크롤 && !맞나.가로, `한 화면에 들어감 — ${맞나.높이}/${맞나.화면}px, 가로 넘침 ${맞나.가로 ? "있음" : "없음"}`);

// ── 코트의 한 점을 누른다. viewBox 0 185 500 285 기준 좌표를 화면 좌표로 바꾼다.
async function 코트탭(vx, vy) {
  const box = await p.evaluate(() => {
    const s2 = document.querySelector("#rec-court-svg");
    const r = s2.getBoundingClientRect();
    const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  await p.mouse.click(box.l + ((vx - 0) / 500) * box.w, box.t + ((vy - box.vy) / box.vh) * box.h);
  await p.waitForTimeout(250);
}
async function 선수탭(name) {
  await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), name);
  await p.waitForTimeout(200);
}

// ① 골밑(2점) 성공
await 코트탭(250, 420);
const s1 = await 상태();
say(s1.안내.includes("2점"), `골밑을 누르니 "${s1.안내}"`);
await 선수탭(s0.선수[0]);
const s2 = await 상태();
say(s2.성공꺼짐 === false, `선수를 고르니 성공/실패가 켜짐 — "${s2.안내}"`);
await p.click("#rec-made");
await p.waitForTimeout(300);
const s3 = await 상태();
say(s3.점수.includes("2"), `점수 ${s3.점수}`);

// ② 3점 자리 실패
await 코트탭(95, 215);   // 아크는 x=95 에서 y=237.8 — 그보다 위라 3점
const s4 = await 상태();
say(s4.안내.includes("3점"), `아크 밖(95,215)을 누르니 "${s4.안내}"`);
await 선수탭(s0.선수[5]);      // B팀
await p.click("#rec-miss");
await p.waitForTimeout(300);

// ③ 코너 3점 성공 (아크가 아니라 직선이라 따로 본다)
await 코트탭(20, 430);
const s5 = await 상태();
say(s5.안내.includes("3점"), `코너를 누르니 "${s5.안내}"`);
await 선수탭(s0.선수[1]);
await p.click("#rec-made");
await p.waitForTimeout(300);

// ④ 기타 이벤트 — 리바운드
await p.evaluate(() => document.querySelector('[data-spot="reb"]').click());
await p.click("#rec-reb-d"); await p.waitForTimeout(140);
await p.waitForTimeout(200);
const s6 = await 상태();
say(s6.안내.includes("리바운드"), `리바 버튼을 누르니 "${s6.안내}"`);
await 선수탭(s0.선수[6]);
await p.waitForTimeout(250);
const s7 = await 상태();
say(s7.최근.includes("수비 리바운드"), `기록됨 — ${s7.최근}`);

// ⑤ 되돌리기 — 방금 넣은 리바운드가 지워진다
const 전 = (await 상태()).이벤트수;
await p.click("#rec-undo");
await p.waitForTimeout(250);
const 후 = (await 상태()).이벤트수;
say(후 === 전 - 1, `되돌리기: ${전} → ${후}`);

// ⑥ 쿼터 넘기기 — 넘어가고, 되돌리기로 돌아오고, 기록 수는 안 늘어난다
const q0 = await 상태();
say(q0.쿼터.now === "1쿼터" && q0.쿼터.next === "▸ 2쿼터로", `쿼터 버튼: "${q0.쿼터.now} / ${q0.쿼터.next}"`);
await p.click("#rec-q");
await p.waitForTimeout(250);
const q1 = await 상태();
say(q1.쿼터.now === "2쿼터", `쿼터 넘김 — ${q1.쿼터.now}`);
say(q1.이벤트수 === 후, `쿼터 넘김은 기록 수에 안 들어감 — ${후} → ${q1.이벤트수}`);
say(q1.최근.includes("2쿼터 시작"), `기록줄: ${q1.최근}`);
await p.click("#rec-undo");
await p.waitForTimeout(250);
const q2 = await 상태();
say(q2.쿼터.now === "1쿼터", `쿼터 넘김을 되돌리니 ${q2.쿼터.now} 로 복귀`);
// 4쿼터 다음은 1쿼터가 아니라 연장이어야 한다 (되돌아가면 뒤 기록이 1쿼터에 섞인다)
for (let i = 0; i < 4; i++) { await p.click("#rec-q"); await p.waitForTimeout(120); }
const q3 = await 상태();
say(q3.쿼터.now === "연장1", `4쿼터 다음은 1쿼터가 아니라 ${q3.쿼터.now}`);
// 가장 긴 글("연장1 / ▸ 연장2로")일 때 윗줄이 안 넘치나
const 윗줄 = await p.evaluate(() => {
  const top = document.querySelector(".rec-top");
  const b = document.querySelector("#rec-q").getBoundingClientRect();
  const s = document.querySelector(".rec-score").getBoundingClientRect();
  return { 넘침: top.scrollWidth > top.clientWidth + 1, 겹침: s.right > b.left + 0.5,
    버튼: Math.round(b.width), 높이: Math.round(b.height), 칸: top.clientWidth };
});
say(!윗줄.넘침 && !윗줄.겹침, `윗줄 ${윗줄.칸}px 안에 버튼 ${윗줄.버튼}×${윗줄.높이}px — 넘침 ${윗줄.넘침 ? "있음" : "없음"}, 겹침 ${윗줄.겹침 ? "있음" : "없음"}`);
for (let i = 0; i < 4; i++) { await p.click("#rec-undo"); await p.waitForTimeout(120); }
const q4 = await 상태();
say(q4.쿼터.now === "1쿼터" && q4.이벤트수 === 후, `네 번 되돌리니 ${q4.쿼터.now} · 기록 ${q4.이벤트수}개`);

await p.screenshot({ path: `${OUT}/rec-live.png`, fullPage: true });

// ⑦ 새로고침해도 남아 있나 (경기 중 전화가 오거나 사파리가 탭을 재울 수 있다)
await p.reload();
await p.waitForTimeout(900);
const s8 = await 상태();
say(s8.이벤트수 === 후, `새로고침 뒤에도 이벤트 ${s8.이벤트수}개 그대로`);

// ⑧ 결과 화면 — 넣은 것과 합계가 맞나
await p.click("#rec-finish");
await p.waitForTimeout(600);
const 결과 = await p.evaluate(() => {
  const rows = [...document.querySelectorAll(".rec-bs tbody tr")].map((tr) =>
    [...tr.children].map((td) => td.textContent.trim()));
  return { 제목: document.querySelector(".rec-final")?.innerText.replace(/\n/g, " "), rows };
});
console.log(`\n   ${결과.제목}`);
const A0 = 결과.rows.find((r) => r[0] === s0.선수[0]);
const A1 = 결과.rows.find((r) => r[0] === s0.선수[1]);
const B0 = 결과.rows.find((r) => r[0] === s0.선수[5]);
const B1 = 결과.rows.find((r) => r[0] === s0.선수[6]);
say(A0 && A0[1] === "2" && A0[2] === "1/1", `${s0.선수[0]}: 2점 · 2점슛 1/1 — ${A0?.slice(1, 5).join(" ")}`);
say(A1 && A1[1] === "3" && A1[3] === "1/1", `${s0.선수[1]}: 3점 · 3점슛 1/1 (코너) — ${A1?.slice(1, 5).join(" ")}`);
say(B0 && B0[1] === "0" && B0[3] === "0/1", `${s0.선수[5]}: 0점 · 3점슛 0/1 — ${B0?.slice(1, 5).join(" ")}`);
say(B1 && B1[5] === "0", `${s0.선수[6]}: 리바운드가 되돌려져 0 — 리바 ${B1?.[5]}`);
await p.screenshot({ path: `${OUT}/rec-done.png`, fullPage: true });

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
