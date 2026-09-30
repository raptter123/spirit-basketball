// 3파전을 실제로 기록해 본다.
//
// 코트에서 도는 순서: AB 1쿼터 → BC 1쿼터 → CA 1쿼터 → AB 2쿼터 → …
// 경기는 셋이고 각 경기가 제 쿼터를 이어 가야 한다. 갈아타며 찍은 기록이
// 엉뚱한 경기로 새지 않는지, 쿼터가 제자리에 붙는지를 본다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
const HERE = 폴더();
const DL = `${HERE}/dltri`;
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

// ── 3팀으로 차린다 ────────────────────────────────────
await p.click('.rec-nbtn[data-n="3"]');
await p.waitForTimeout(200);
const 칸수 = await p.evaluate(() => document.querySelectorAll(".rec-pick-col").length);
say(칸수 === 3, `팀 고르는 칸 ${칸수}개`);
const 안내 = await p.evaluate(() => document.querySelector("#rec-nteam-say").textContent.trim());
say(안내 === "A팀–B팀 · B팀–C팀 · C팀–A팀 세 경기", `대진 안내 — "${안내}"`);

const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
// 12명이면 A/B/C 에 네 명씩 차례로 들어간다.
for (const n of 로스터.slice(0, 12)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}


const 인원 = await p.evaluate(() =>
  [...document.querySelectorAll(".rec-pick-list")].map((l) => l.querySelectorAll(".rec-picked").length));
say(인원.join(",") === "4,4,4", `세 팀에 ${인원.join(" / ")}명씩 들어감`);

await p.click("#rec-start");
await p.waitForTimeout(700);

// ── 경기가 셋 만들어졌나 ──────────────────────────────
const 전환 = await p.evaluate(() =>
  [...document.querySelectorAll(".rec-gbtn")].map((x) => ({
    // 칸은 세 줄(대진 / 점수 / 쿼터·기록 수)이다. 대진과 점수를 옛 모양 "A팀 0 : 0 B팀" 으로 다시 짠다.
    t: (() => { const [a, c] = x.querySelector(".rec-gbtn-vs").textContent.split(" : ");
      return `${a} ${x.querySelector("b").textContent.trim()} ${c}`; })(),
    s: x.querySelector("span:last-child").textContent.trim(),
    on: x.classList.contains("is-on"),
    h: Math.round(x.getBoundingClientRect().height),
  })));
say(전환.length === 3, `경기 전환 버튼 ${전환.length}개`);
say(전환.map((x) => x.t.replace(/\s+/g, " ")).join(" | ")
  === "A팀 0 : 0 B팀 | B팀 0 : 0 C팀 | C팀 0 : 0 A팀",
  `대진: ${전환.map((x) => x.t.replace(/\s+/g, " ")).join(" | ")}`);
say(전환.filter((x) => x.on).length === 1 && 전환[0].on, "지금 경기는 첫 번째 (A팀–B팀)");
say(전환.every((x) => x.h >= 44), `전환 버튼 높이 전부 44px 이상 (${전환[0].h}px)`);

// ── 기록 도구 ─────────────────────────────────────────
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
  // data-t 는 이제 팀 **색** 번호다(A=0 · B=1 · C=2). 경기 안 자리(앞/뒤)는
  // 팀 줄이 몇 번째로 그려졌는지로 봐야 한다 — CA 경기에서 C팀은 앞자리지만 색은 2다.
  [...document.querySelectorAll(".rec-team-row")].flatMap((row, 자리) =>
    [...row.querySelectorAll(".rec-pchip")].map((c) => ({ p: c.dataset.player, t: String(자리) }))));
const 선수탭 = (n) => p.evaluate((v) =>
  document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(140));
const 스팟 = (k) => p.evaluate((v) =>
  document.querySelector(`[data-spot="${v}"]`).click(), k).then(() => p.waitForTimeout(140));
// 리바는 '리바' 를 누른 뒤 공격/수비를 고르고 선수를 누른다.
const 리바 = async (kind) => {
  await 스팟("reb");
  await p.click(kind === "rebO" ? "#rec-reb-o" : "#rec-reb-d");
  await p.waitForTimeout(140);
};
const 경기로 = (i) => p.evaluate((v) =>
  document.querySelector(`.rec-gbtn[data-game="${v}"]`).click(), i).then(() => p.waitForTimeout(300));
const 쿼터넘김 = () => p.click("#rec-q").then(() => p.waitForTimeout(250));
const 상태 = () => p.evaluate(() => ({
  점수: document.querySelector(".rec-score").innerText.replace(/\s+/g, " ").trim(),
  쿼터: document.querySelector("#rec-q b").textContent.trim(),
  수: Number(document.querySelector(".rec-n b").textContent),
  전환: [...document.querySelectorAll(".rec-gbtn")].map((x) => x.querySelector("span:last-child").textContent.trim()),
}));

/** 한 쿼터를 뛴다: 양 팀에서 한 명씩 슛 하나. */
async function 한쿼터(자리) {
  const 선수 = await 선수목록();
  const A = 선수.filter((s) => s.t === "0");
  const B = 선수.filter((s) => s.t === "1");
  await 코트탭(자리[0], 자리[1]); await 선수탭(A[0].p); await p.click("#rec-made"); await p.waitForTimeout(200);
  await 코트탭(자리[2], 자리[3]); await 선수탭(B[0].p); await p.click("#rec-miss"); await p.waitForTimeout(200);
  await 리바("rebD"); await 선수탭(A[1].p);
}

// ── 1라운드: AB → BC → CA (각 1쿼터) ──────────────────
await 한쿼터([250, 430, 200, 300]);
const ab1 = await 상태();
say(ab1.수 === 3, `AB 1쿼터 기록 ${ab1.수}개 · ${ab1.점수}`);

await 경기로(1);
const bc0 = await 상태();
say(bc0.수 === 0 && bc0.쿼터 === "1쿼터", `BC 로 갈아타니 기록 ${bc0.수}개 · ${bc0.쿼터} (섞이지 않음)`);
await 한쿼터([60, 430, 440, 440]);

await 경기로(2);
await 한쿼터([250, 250, 300, 350]);

// ── 2라운드: 각 경기를 2쿼터로 넘기고 한 쿼터씩 더 ────
for (const i of [0, 1, 2]) {
  await 경기로(i);
  await 쿼터넘김();
  await 한쿼터([180, 400, 320, 400]);
}

// ── 각 경기가 제 쿼터를 이어 갔나 ─────────────────────
const 끝 = [];
for (const i of [0, 1, 2]) {
  await 경기로(i);
  끝.push(await 상태());
}
say(끝.every((s) => s.쿼터 === "2쿼터"), `세 경기 모두 ${끝.map((s) => s.쿼터).join(" / ")}`);
say(끝.every((s) => s.수 === 6), `세 경기 모두 기록 ${끝.map((s) => s.수).join(" / ")}개 (한 쿼터 3개 × 2쿼터)`);
say(끝[0].점수 !== "" && 끝.map((s) => s.점수).length === 3, `점수 — ${끝.map((s) => s.점수).join(" | ")}`);

// ── 새로고침해도 셋 다 남나 ───────────────────────────
await p.reload();
await p.waitForTimeout(900);
const 되살린 = await p.evaluate(() =>
  [...document.querySelectorAll(".rec-gbtn")].map((x) => x.querySelector("span:last-child").textContent.trim()));
say(되살린.length === 3 && 되살린.every((s) => s.includes("2쿼터") && s.includes("6개")),
  `새로고침 뒤에도 세 경기 그대로 — ${되살린.join(" | ")}`);

// ── 화면이 넘치지 않나 ────────────────────────────────
const 크기 = await p.evaluate(() => ({
  h: document.documentElement.scrollHeight,
  vh: window.innerHeight,
  가로: document.documentElement.scrollWidth > window.innerWidth,
}));
say(!크기.가로, "가로 넘침 없음");
say(크기.h <= 920, `세로 ${크기.h}px (전환 줄이 한 줄 늘어난 만큼만)`);

// ── 결과 · 엑셀 · 밴드 이미지 ─────────────────────────
await p.click("#rec-finish");
await p.waitForTimeout(600);
const 결과 = await p.evaluate(() => document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim());
say(결과.includes("C팀") || 결과.includes("A팀"), `결과 화면 — ${결과.slice(0, 60)}`);

const [xlsx] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click("#rec-xlsx")]);
await xlsx.saveAs(`${DL}/${xlsx.suggestedFilename()}`);
say(fs.statSync(`${DL}/${xlsx.suggestedFilename()}`).size > 10000,
  `엑셀 ${xlsx.suggestedFilename()} (${fs.statSync(`${DL}/${xlsx.suggestedFilename()}`).size}바이트)`);

const [png] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click("#rec-band-img")]);
await png.saveAs(`${DL}/${png.suggestedFilename()}`);
say(fs.statSync(`${DL}/${png.suggestedFilename()}`).size > 10000,
  `밴드 이미지 ${png.suggestedFilename()} (${fs.statSync(`${DL}/${png.suggestedFilename()}`).size}바이트)`);

say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(0);
