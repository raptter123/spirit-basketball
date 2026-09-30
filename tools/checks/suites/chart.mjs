// 샷 차트를 본다. 점이 넣은 자리에 정확히 찍히는지, 선수를 고르면 그 사람 것만
// 남는지, 누적이 보관함을 제대로 걸어오는지, 그리고 내려받은 PNG 가 진짜 그림인지.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const OUT = 폴더("shots");
const DL = 폴더("dl4");
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());
await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 골밑 = [250, 425], 미들 = [180, 330], 아크 = [150, 195], 코너 = [20, 440];

async function 경기하기(계획) {
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start"); await p.waitForTimeout(450);
  const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  const box = await p.evaluate(() => { const s2 = document.querySelector("#rec-court-svg"); const r = s2.getBoundingClientRect(); const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number); return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh }; });
  for (const [i, 자리, made] of 계획) {
    await p.mouse.click(box.l + ((자리[0] - box.vx) / box.vw) * box.w, box.t + ((자리[1] - box.vy) / box.vh) * box.h);
    await p.waitForTimeout(80);
    await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 코트[i]);
    await p.waitForTimeout(80);
    await p.click(made ? "#rec-made" : "#rec-miss"); await p.waitForTimeout(100);
  }
  return 코트;
}

// ── 지난 경기 하나를 먼저 쌓아 둔다 (누적 시험용) ─────────
const 옛코트 = await 경기하기([[0, 골밑, true], [0, 골밑, true], [0, 아크, false]]);
await p.click("#rec-finish"); await p.waitForTimeout(400);
await p.click("#rec-new"); await p.waitForTimeout(450);

// ── 이번 경기: 사람마다 자리를 다르게 둬서 손으로 셀 수 있게 ─────
// 0번: 골밑 2/3 · 3점(아크) 0/1   |   5번: 코너 3점 1/1   |   1번: 미들 0/2
const 계획 = [
  [0, 골밑, true], [0, 골밑, true], [0, 골밑, false], [0, 아크, false],
  [5, 코너, true],
  [1, 미들, false], [1, 미들, false],
];
const 코트 = await 경기하기(계획);
await p.click("#rec-finish");
await p.waitForTimeout(700);

const 차트 = () => p.evaluate(() => {
  const el = document.querySelector("#rec-chart-svg");
  return {
    들어간점: el.querySelectorAll(".shot-made").length,
    빗나간점: el.querySelectorAll(".shot-miss").length,
    라벨: el.getAttribute("aria-label"),
    구역: [...document.querySelectorAll(".rec-chart-zone")].map((z) => ({
      이름: z.querySelector(".nm").textContent.trim(),
      율: z.querySelector("b").textContent.trim(),
      sub: z.querySelector(".sub").textContent.replace(/\s+/g, " ").trim(),
      막대: z.querySelector("i").style.width,
    })),
    칩: [...document.querySelectorAll(".rec-chart-who .rec-chip")].map((c) => c.textContent.replace(/\s+/g, " ").trim()),
    켜진칩: document.querySelector(".rec-chart-who .rec-chip.on")?.textContent.replace(/\s+/g, " ").trim(),
    안내: document.querySelector(".rec-chart .hint").textContent.replace(/\s+/g, " ").trim(),
  };
});

// ── 전체 보기 ────────────────────────────────────────
const 전체 = await 차트();
// 계획대로면 성공 3(골밑 2 + 코너 1) · 실패 4(골밑 1 + 아크 1 + 미들 2)
say(전체.들어간점 === 3, `들어간 슛 점 ${전체.들어간점}개 (넣은 것 3개)`);
say(전체.빗나간점 === 4, `빗나간 슛 ✕ ${전체.빗나간점}개 (넣은 것 4개)`);
say(전체.라벨 === "전체 슛 3/7", `그림 설명: "${전체.라벨}"`);
say(전체.켜진칩 === "전체", `처음엔 "전체" 가 켜짐`);
say(전체.칩.length === 4, `칩 ${전체.칩.length}개 (전체 + 슛 쏜 3명): ${전체.칩.join(" | ")}`);
// 많이 쏜 순 — 0번이 4개로 맨 앞
say(전체.칩[1].startsWith(코트[0]), `많이 쏜 사람이 앞에: ${전체.칩[1]}`);
// 구역: 골밑 3(2성공) · 미들 2(0) · 3점 2(1) → 총 7
const Z = Object.fromEntries(전체.구역.map((z) => [z.이름, z]));
say(Z["골밑"].율 === "67%" && Z["골밑"].sub.startsWith("2/3"), `골밑 ${Z["골밑"].율} · ${Z["골밑"].sub}`);
say(Z["미들"].율 === "0%" && Z["미들"].sub.startsWith("0/2"), `미들 ${Z["미들"].율} · ${Z["미들"].sub}`);
say(Z["3점"].율 === "50%" && Z["3점"].sub.startsWith("1/2"), `3점 ${Z["3점"].율} · ${Z["3점"].sub}`);
say(Z["골밑"].막대 === "43%", `시도 몫 막대 — 골밑 ${Z["골밑"].막대} (3/7)`);
say(전체.안내.includes("슛이 7개뿐이라"), `표본이 적다고 일러 줌`);

// ── 한 사람만 ───────────────────────────────────────
await p.evaluate((n) => document.querySelector(`.rec-chart-who [data-who="${CSS.escape(n)}"]`).click(), 코트[0]);
await p.waitForTimeout(300);
const 혼자 = await 차트();
say(혼자.들어간점 === 2 && 혼자.빗나간점 === 2, `${코트[0]} 만: 들어간 ${혼자.들어간점} · 빗나간 ${혼자.빗나간점} (2/4)`);
say(혼자.라벨 === `${코트[0]} 슛 2/4`, `그림 설명: "${혼자.라벨}"`);
const Z2 = Object.fromEntries(혼자.구역.map((z) => [z.이름, z]));
say(Z2["골밑"].sub.startsWith("2/3") && Z2["미들"].sub === "0/0" && Z2["3점"].sub.startsWith("0/1"),
  `${코트[0]} 구역: 골밑 ${Z2["골밑"].sub} · 미들 ${Z2["미들"].sub} · 3점 ${Z2["3점"].sub}`);
say(Z2["미들"].율 === "–", `안 쏜 자리는 0% 가 아니라 "${Z2["미들"].율}"`);

// 점이 진짜 그 자리에 찍혔나 — 골밑 2점 성공 세 개 중 성공 두 개의 좌표 확인
const 좌표 = await p.evaluate(() => [...document.querySelectorAll("#rec-chart-svg .shot-made")]
  .map((c) => [Math.round(+c.getAttribute("cx")), Math.round(+c.getAttribute("cy"))]));
say(좌표.every(([x, y]) => Math.abs(x - 250) <= 4 && Math.abs(y - 425) <= 6),
  `들어간 점이 누른 자리(250,425)에 찍힘 — ${좌표.map((c) => c.join(",")).join(" / ")}`);

// ── 누적 ────────────────────────────────────────────
await p.evaluate(() => document.querySelector('[data-scope="all"]').click());
await p.waitForTimeout(350);
const 누적 = await 차트();
// 지난 경기에서 0번이 골밑 2개 성공 + 아크 1개 실패를 더 쐈다 → 4/7
say(누적.라벨 === `${코트[0]} 슛 4/7`, `누적: "${누적.라벨}" (이 경기 2/4 + 지난 경기 2/3)`);
say(누적.안내.includes("2경기 누적"), `안내에 경기 수: "${누적.안내.slice(0, 60)}…"`);
const 범위 = await p.evaluate(() => [...document.querySelectorAll("[data-scope]")].map((b) => `${b.textContent.trim()}${b.classList.contains("on") ? "*" : ""}`));
say(범위.join(" | ").includes("전부 (2경기)*"), `범위 버튼: ${범위.join(" | ")}`);

await p.evaluate(() => document.querySelector(".rec-chart").scrollIntoView());
await p.waitForTimeout(250);
await p.locator(".rec-chart").screenshot({ path: `${OUT}/chart.png` });

// 차트만 따로 받던 PNG 버튼은 없앴다(PR #142) — 선수마다 한 장씩 받아야 해서
// 쓸모가 없었고, 지금은 밴드용 결과 이미지 한 장과 엑셀 샷차트 시트로 나간다.
// 그 두 길은 img.mjs · xlsimg.mjs 가 본다.
say(!(await p.evaluate(() => !!document.querySelector("#rec-chart-png"))),
  "차트 쪽 '그림으로 받기' 버튼이 없음 (밴드 이미지·엑셀로 대신함)");

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
