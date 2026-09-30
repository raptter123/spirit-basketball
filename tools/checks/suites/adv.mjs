// 고급 지표가 맞는 값인지 본다.
// 화면이 내놓은 숫자를 믿지 않고, 넣을 동작 목록에서 손으로 다시 계산해 대조한다.
// 기대값은 화면 코드를 한 줄도 안 보고 여기서 따로 센다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dl3");
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };
const 가깝나 = (a, b, eps = 0.1) => a != null && Math.abs(a - b) < eps;

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());
await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 12)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
await p.click("#rec-start");
await p.waitForTimeout(600);
const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
const A = 코트.slice(0, 5), B = 코트.slice(5);

const box = await p.evaluate(() => {
  const s2 = document.querySelector("#rec-court-svg");
  const r = s2.getBoundingClientRect();
  const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
  return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
});
const 탭 = async (x, y) => { await p.mouse.click(box.l + ((x - box.vx) / box.vw) * box.w, box.t + ((y - box.vy) / box.vh) * box.h); await p.waitForTimeout(110); };
const 선수 = (n) => p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(110));
const 스팟 = (k) => p.evaluate((v) => document.querySelector(`[data-spot="${v}"]`).click(), k).then(() => p.waitForTimeout(110));


// 리바는 '리바' 를 누른 뒤 공격/수비를 고르고 선수를 누른다.
// (자동으로 가르던 판과 공격리바·수비리바 버튼을 따로 두던 판을 거쳐 여기로 돌아왔다.)
const 리바 = async (kind) => {
  await p.evaluate(() => document.querySelector('[data-spot="reb"]').click());
  await p.waitForTimeout(140);
  await p.click(kind === "rebO" ? "#rec-reb-o" : "#rec-reb-d");
  await p.waitForTimeout(140);
};

// 자리 — 2점은 아크 안, 3점은 아크 밖
const 골밑 = [250, 425], 미들 = [180, 330], 아크 = [150, 195], 코너 = [20, 440];
const 삼점자리 = new Set([아크.join(), 코너.join()]);

// ── 넣을 동작을 목록으로 적는다. 기대값은 이 목록에서 다시 센다 ──────
const 할일 = [];
const 슛하기 = (t, i, 자리, made) => 할일.push(["슛", t, i, 자리, made]);
슛하기(0, 0, 골밑, true); 슛하기(0, 0, 미들, true); 슛하기(0, 0, 골밑, false);
할일.push(["리바", 0, 1, "rebO"]);               // A팀 슛 실패 → A가 잡음 = 공격리바
슛하기(0, 0, 아크, true); 슛하기(0, 0, 코너, false);
할일.push(["리바", 1, 0, "rebD"]);               // A팀 슛 실패 → B가 잡음 = 수비리바
슛하기(1, 0, 골밑, true); 슛하기(1, 0, 미들, false);
할일.push(["리바", 0, 2, "rebD"]);               // B팀 슛 실패 → A가 잡음 = 수비리바
할일.push(["ftm", 0, 1], ["ftm", 0, 1], ["fta", 0, 1]);
할일.push(["리바", 1, 1, "rebD"]);               // A팀 자유투 실패 → B가 잡음 = 수비리바
for (const _ of [1, 2, 3, 4]) 할일.push(["ast", 0, 1]);
할일.push(["to", 0, 1], ["to", 0, 1], ["to", 1, 0]);
// 양 팀 포제션이 MIN_POSS(10)를 넘게 슛을 더 넣는다
for (let i = 0; i < 4; i++) 슛하기(0, 3, 미들, i % 2 === 0);
for (let i = 0; i < 8; i++) 슛하기(1, 2, 미들, i % 3 === 0);

// ── 손으로 센 기대값 ─────────────────────────────────────
const 빈팀 = () => ({ pts: 0, fgm: 0, fga: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, to: 0 });
const 기대 = [빈팀(), 빈팀()];
const 선수기대 = {};
const 칸 = (t, i) => (선수기대[`${t}|${i}`] ??= 빈팀());
let 마지막슛 = null;
for (const a of 할일) {
  const [종류, t, i] = a;
  const T = 기대[t], P = 칸(t, i);
  if (종류 === "슛") {
    const [, , , 자리, made] = a;
    const 삼 = 삼점자리.has(자리.join());
    for (const o of [T, P]) {
      o.fga++; if (삼) o.p3a++;
      if (made) { o.fgm++; o.pts += 삼 ? 3 : 2; if (삼) o.p3m++; }
    }
    마지막슛 = [t, made];
  } else if (종류 === "리바") {
    // 어느 쪽인지는 시나리오에 적어 둔 것을 그대로 쓴다. 예전에는 앱이 직전 슛으로
    // 자동으로 갈랐고 손계산도 그 규칙을 흉내 냈지만, 지금은 사람이 버튼으로 고른다.
    for (const o of [T, P]) o[a[3] === "rebO" ? "orb" : "drb"]++;
  } else if (종류 === "ftm") {
    for (const o of [T, P]) { o.ftm++; o.fta++; o.pts++; }
    마지막슛 = null;              // 들어간 자유투 뒤에는 리바운드가 없다
  } else if (종류 === "fta") {
    for (const o of [T, P]) o.fta++;
    마지막슛 = [t, false];
  } else if (종류 === "ast") { T.ast++; P.ast++; }
  else if (종류 === "to") { T.to++; P.to++; }
}
const 지표 = (o, 상대) => {
  const poss = o.fga - o.orb + o.to + 0.44 * o.fta;
  return {
    poss,
    efg: o.fga ? (o.fgm + 0.5 * o.p3m) / o.fga : null,
    ts: (o.fga + 0.44 * o.fta) ? o.pts / (2 * (o.fga + 0.44 * o.fta)) : null,
    ortg: (o.pts / poss) * 100,
    orbPct: (o.orb + 상대.drb) ? o.orb / (o.orb + 상대.drb) : null,
  };
};
const E = [지표(기대[0], 기대[1]), 지표(기대[1], 기대[0])];
E[0].drtg = E[1].ortg; E[1].drtg = E[0].ortg;
console.log(`   손계산 A: ${기대[0].pts}점 · 포제션 ${E[0].poss.toFixed(2)} · ORtg ${E[0].ortg.toFixed(1)} · DRtg ${E[0].drtg.toFixed(1)} · eFG ${(E[0].efg * 100).toFixed(1)}% · TS ${(E[0].ts * 100).toFixed(1)}%`);
console.log(`   손계산 B: ${기대[1].pts}점 · 포제션 ${E[1].poss.toFixed(2)} · ORtg ${E[1].ortg.toFixed(1)} · eFG ${(E[1].efg * 100).toFixed(1)}%`);

// ── 포제션이 적을 때는 안 보여주는지 먼저 본다 ───────────────
{
  await 탭(...골밑); await 선수(A[0]); await p.click("#rec-made"); await p.waitForTimeout(200);
  await p.click("#rec-finish"); await p.waitForTimeout(400);
  const 작은표본 = await p.evaluate(() => {
    const c = document.querySelector(".rec-adv-card");
    return {
      rtg: c.querySelectorAll(".rec-adv-rtg b")[0].textContent.trim(),
      안내: document.querySelector(".rec-adv-note").textContent.replace(/\s+/g, " ").trim(),
      efg: c.querySelectorAll(".rec-adv-grid b")[0].textContent.trim(),
    };
  });
  say(작은표본.rtg === "–", `포제션 1개일 때 ORtg 는 "${작은표본.rtg}" (200.0 을 안 띄움)`);
  say(작은표본.안내.includes("포제션이 10개도 안 돼서"), `이유를 적어 줌 — "…${작은표본.안내.slice(-80)}"`);
  say(작은표본.efg === "100.0%", `표본과 무관한 eFG% 는 그대로 ${작은표본.efg}`);
  await p.click("#rec-back"); await p.waitForTimeout(300);
  await p.click("#rec-undo"); await p.waitForTimeout(250);   // 넣어 본 슛 되돌리기
}

// ── 목록대로 실제로 넣는다 ───────────────────────────────
for (const a of 할일) {
  const [종류, t, i] = a;
  const 사람 = (t ? B : A)[i];
  if (종류 === "슛") {
    const [, , , 자리, made] = a;
    await 탭(...자리); await 선수(사람);
    await p.click(made ? "#rec-made" : "#rec-miss"); await p.waitForTimeout(140);
  } else if (종류 === "리바") {
    await 리바(a[3]); await 선수(사람);
  } else {
    await 스팟(종류); await 선수(사람);
  }
}
await p.click("#rec-finish");
await p.waitForTimeout(600);

// ── 팀 카드 ────────────────────────────────────────────
const 카드 = await p.evaluate(() => [...document.querySelectorAll(".rec-adv-card")].map((c) => ({
  머리: c.querySelector(".rec-adv-score").textContent.trim(),
  rtg: [...c.querySelectorAll(".rec-adv-rtg b")].map((x) => x.textContent.trim()),
  net: c.querySelector(".rec-adv-net").textContent.replace(/\s+/g, " ").trim(),
  netCls: c.querySelector(".rec-adv-net").className,
  격자: [...c.querySelectorAll(".rec-adv-grid div")].map((d) => `${d.querySelector("span").textContent} ${d.querySelector("b").textContent}`),
})));
console.log(`   A: ${카드[0].머리} · ORtg ${카드[0].rtg[0]} · DRtg ${카드[0].rtg[1]} · ${카드[0].net}`);
console.log(`      ${카드[0].격자.join(" · ")}`);
say(카드[0].머리.includes(`${E[0].poss.toFixed(1)}포제션`), `A팀 ${카드[0].머리} (손계산 ${E[0].poss.toFixed(1)})`);
say(가깝나(Number(카드[0].rtg[0]), E[0].ortg), `A팀 ORtg ${카드[0].rtg[0]} (손계산 ${E[0].ortg.toFixed(1)})`);
say(가깝나(Number(카드[0].rtg[1]), E[0].drtg), `A팀 DRtg ${카드[0].rtg[1]} (손계산 ${E[0].drtg.toFixed(1)})`);
say(가깝나(Number(카드[1].rtg[0]), E[1].ortg), `B팀 ORtg ${카드[1].rtg[0]} (손계산 ${E[1].ortg.toFixed(1)})`);
say(가깝나(Number(카드[0].net.replace(/[^\d.+-]/g, "")), E[0].ortg - E[0].drtg, 0.15),
  `A팀 Net ${카드[0].net} (손계산 ${(E[0].ortg - E[0].drtg).toFixed(1)})`);
say(카드[0].격자[0] === `eFG% ${(E[0].efg * 100).toFixed(1)}%`, `A팀 ${카드[0].격자[0]} (손계산 ${(E[0].efg * 100).toFixed(1)}%)`);
say(카드[0].격자[1] === `TS% ${(E[0].ts * 100).toFixed(1)}%`, `A팀 ${카드[0].격자[1]} (손계산 ${(E[0].ts * 100).toFixed(1)}%)`);
say(카드[0].격자[3] === `공격리바% ${(E[0].orbPct * 100).toFixed(1)}%`,
  `A팀 ${카드[0].격자[3]} (손계산 ${기대[0].orb}/(${기대[0].orb}+${기대[1].drb}) = ${(E[0].orbPct * 100).toFixed(1)}%)`);
const 이김 = E[0].ortg > E[0].drtg ? 0 : 1;
say(카드[이김].netCls.includes("up") && 카드[1 - 이김].netCls.includes("down"),
  `Net 색이 갈림 — ${카드[0].netCls.replace("rec-adv-net ", "")} / ${카드[1].netCls.replace("rec-adv-net ", "")}`);

// ── 선수 표 ────────────────────────────────────────────
const 표 = await p.evaluate(() => ({
  머리: [...document.querySelectorAll(".rec-bs thead th")].map((t) => t.textContent.replace(/\s+/g, " ").trim()),
  줄: [...document.querySelectorAll(".rec-bs tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent.replace(/\s+/g, " ").trim())),
}));
say(표.머리.slice(-4).join(" ") === "eFG% TS% AST/TO +/-", `표 끝 네 칸: ${표.머리.slice(-4).join(" · ")}`);
const 줄 = (n) => 표.줄.find((r) => r[0] === n);
const a0기대 = 지표(선수기대["0|0"], 빈팀());
say(줄(A[0])?.[11] === `${(a0기대.efg * 100).toFixed(1)}%`,
  `${A[0]} eFG% ${줄(A[0])?.[11]} (손계산 ${(a0기대.efg * 100).toFixed(1)}%)`);
say(줄(A[0])?.[12] === `${(a0기대.ts * 100).toFixed(1)}%`,
  `${A[0]} TS% ${줄(A[0])?.[12]} (손계산 ${(a0기대.ts * 100).toFixed(1)}%)`);
const a1 = 선수기대["0|1"];
say(줄(A[1])?.[13] === (a1.ast / a1.to).toFixed(1), `${A[1]} AST/TO ${줄(A[1])?.[13]} (손계산 ${a1.ast}/${a1.to})`);
say(줄(A[4])?.[11] === "–", `${A[4]} 는 슛이 없어 eFG% ${줄(A[4])?.[11]} (0% 아님)`);
say(줄(A[4])?.[13] === "–", `${A[4]} 는 턴오버가 없어 AST/TO ${줄(A[4])?.[13]}`);
const 득실 = 기대[0].pts - 기대[1].pts;
const 부호 = (v) => (v > 0 ? `+${v}` : `${v}`);
say(A.every((n) => 줄(n)?.[14] === 부호(득실)),
  `A팀 선발 5명 +/- ${A.map((n) => 줄(n)?.[14]).join(" ")} (팀 득실차 ${기대[0].pts}−${기대[1].pts})`);
const 벤치 = 표.줄.filter((r) => ![...A, ...B].includes(r[0]));
say(벤치.length === 2 && 벤치.every((r) => r[14] === "0"), `안 뛴 벤치 2명은 +/- 0`);

// ── 교체하면 +/- 가 갈리나 ───────────────────────────────
await p.click("#rec-back");
await p.waitForTimeout(400);
await p.evaluate(() => { document.querySelector(".rec-bench").open = true; });
await p.waitForTimeout(150);
const 들어올사람 = await p.evaluate(() => document.querySelector('.rec-sub[data-team="0"]').dataset.in);
await p.evaluate(() => document.querySelector('.rec-sub[data-team="0"]').click());
await p.waitForTimeout(200);
await 선수(A[0]);
await p.waitForTimeout(250);
await 탭(...골밑); await 선수(B[1]); await p.click("#rec-made"); await p.waitForTimeout(200);
await p.click("#rec-finish");
await p.waitForTimeout(500);
const 표2 = await p.evaluate(() => [...document.querySelectorAll(".rec-bs tbody tr")]
  .map((tr) => [...tr.children].map((td) => td.textContent.replace(/\s+/g, " ").trim())));
const 줄2 = (n) => 표2.find((r) => r[0] === n);
say(줄2(A[0])?.[14] === 부호(득실), `빠진 ${A[0]} 은 ${줄2(A[0])?.[14]} 그대로 (나간 뒤 실점은 안 붙음)`);
say(줄2(들어올사람)?.[14] === "-2", `들어온 ${들어올사람} 은 ${줄2(들어올사람)?.[14]} (들어온 뒤 2실점만)`);
say(줄2(A[1])?.[14] === 부호(득실 - 2), `계속 뛴 ${A[1]} 은 ${줄2(A[1])?.[14]} (${득실} − 2)`);

// ── 엑셀 ──────────────────────────────────────────────
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click("#rec-xlsx")]);
const 파일 = `${DL}/${dl.suggestedFilename()}`;
await dl.saveAs(파일);
const 엑셀 = JSON.parse(execFileSync("python3", ["-c", `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(파일)})
print(json.dumps({s: [[c if c is not None else "" for c in r] for r in wb[s].iter_rows(values_only=True)] for s in wb.sheetnames}, ensure_ascii=False))
`], { encoding: "utf8" }));
say(Object.keys(엑셀).join("/") === "선수기록/팀효율/자리별/샷차트/쿼터별/이벤트원본", `시트 여섯 장: ${Object.keys(엑셀).join(" / ")}`);
const 팀시트 = 엑셀["팀효율"];
const H = 팀시트[0];
const aRow = 팀시트.find((r) => r[1] === "A팀");
say(팀시트.length === 3 && H.length === 14, `팀효율 ${팀시트.length - 1}줄 · ${H.length}칸`);
say(aRow[2] === (득실 > 0 ? "승" : "패"), `A팀 승패 칸: ${aRow[2]}`);
const efgCol = H.indexOf("eFG%");
say(aRow[efgCol] > 0 && aRow[efgCol] < 1, `eFG% 가 분수로 저장됨: ${aRow[efgCol]} (${(aRow[efgCol] * 100).toFixed(1)} 아님)`);
const 선수시트 = 엑셀["선수기록"];
say(선수시트[0].slice(-4).join(" ") === "eFG% TS% AST/TO +/-", `선수기록 끝 네 칸: ${선수시트[0].slice(-4).join(" · ")}`);
say(선수시트.find((r) => r[3] === A[4])[선수시트[0].indexOf("eFG%")] === "", `슛 없는 ${A[4]} 의 eFG% 는 빈 칸 (0 아님)`);

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
