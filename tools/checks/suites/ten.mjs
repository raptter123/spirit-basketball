// 기록 기능을 열 판 실제로 돌리고, 화면·엑셀·이미지에 나온 숫자를
// **이벤트 원본에서 따로 셈한 값**과 맞대 본다.
//
// 왜 이렇게 하나
//   "안 깨진다" 는 통과 기준이 너무 낮다. 숫자가 조용히 틀리는 쪽이 더 무섭다.
//   그래서 앱이 쓰는 함수를 안 부르고, game.events 만 보고 이 시험이 직접
//   점수·시도·리바운드를 다시 센 뒤 앱이 내놓은 값과 견준다. 둘이 다르면
//   둘 중 하나가 틀린 것이고, 어느 쪽이든 알아야 한다.
//
// 열 판은 서로 다르게 짠다 — 한 가지 모양만 열 번 돌리면 열 번 다 같은 길만 밟는다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
const HERE = 폴더();
const DL = `${HERE}/ten`;
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });

const 판들 = [
  { 이름: "1. 보통 경기",       팀수: 2, 인원: 10, 쿼터: 4, 공격: 20, 씨: 101 },
  { 이름: "2. 저득점(잘 안 들어감)", 팀수: 2, 인원: 10, 쿼터: 4, 공격: 20, 씨: 202, 성공배: 0.45 },
  { 이름: "3. 고득점",          팀수: 2, 인원: 10, 쿼터: 4, 공격: 26, 씨: 303, 성공배: 1.45 },
  { 이름: "4. 1쿼터만",         팀수: 2, 인원: 10, 쿼터: 1, 공격: 18, 씨: 404 },
  { 이름: "5. 적은 인원(6명)",   팀수: 2, 인원: 6,  쿼터: 4, 공격: 16, 씨: 505 },
  { 이름: "6. 많은 인원(16명)",  팀수: 2, 인원: 16, 쿼터: 4, 공격: 22, 씨: 606, 교체: true },
  { 이름: "7. 자유투·파울 잔치", 팀수: 2, 인원: 10, 쿼터: 4, 공격: 18, 씨: 707, 파울배: 4 },
  { 이름: "8. 리바운드 잔치",    팀수: 2, 인원: 10, 쿼터: 4, 공격: 20, 씨: 808, 성공배: 0.5 },
  { 이름: "9. 3파전 (세 경기)",  팀수: 3, 인원: 12, 쿼터: 4, 공격: 14, 씨: 909 },
  { 이름: "10. 되돌리기 섞기",   팀수: 2, 인원: 10, 쿼터: 4, 공격: 20, 씨: 1010, 되돌리기: true },
];

const 전체문제 = [];
const 요약 = [];
const 받은파일 = [];

const b = await chromium.launch();

for (const 판 of 판들) {
  const 문제 = [];
  const say = (ok, m) => { if (!ok) 문제.push(m); };
  const 시작시각 = Date.now();

  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p = await ctx.newPage();
  // 판마다 시작 시각을 30분씩 띄운다. 파일 이름에는 시작 시각(분)이 들어가는데, 이 시험은
  // 한 판을 30초에 돌려서 그대로 두면 두 경기가 같은 분에 시작해 이름이 겹친다 —
  // 실제 경기는 1분 안에 안 끝나므로 앱 잘못이 아니라 시험의 잘못이다.
  await p.clock.install({ time: new Date(2026, 8, 27, 9, 0) .getTime() + 판들.indexOf(판) * 30 * 60000 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(`오류: ${e.message.slice(0, 120)}`));
  p.on("console", (m) => { if (m.type() === "error") errs.push(`콘솔: ${m.text().slice(0, 120)}`); });
  p.on("dialog", (d) => d.accept());

  await p.goto(`${URL}/index.html?t=${판.씨}#/record`);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  await p.goto(`${URL}/index.html?t=${판.씨}b#/record`);
  await p.waitForTimeout(800);

  if (판.팀수 === 3) { await p.click('.rec-nbtn[data-n="3"]'); await p.waitForTimeout(250); }
  const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 로스터.slice(0, 판.인원)) {
    await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`)?.click(), n);
  }
  if (판.쿼터 !== 4) {
    await p.evaluate((q) => {
      const btn = [...document.querySelectorAll(".rec-qbtn, [data-q]")].find((x) => x.textContent.trim().startsWith(String(q)));
      if (btn) btn.click();
    }, 판.쿼터);
    await p.waitForTimeout(200);
  }
  await p.click("#rec-start");
  await p.waitForTimeout(600);

  // ── 코트 좌표 (화면에서 읽는다) ─────────────────────────
  const 코트 = await p.evaluate(() => {
    const s = document.querySelector("#rec-court-svg");
    const r = s.getBoundingClientRect();
    const [vx, vy, vw, vh] = s.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  const 탭 = async (vx, vy) => {
    await p.mouse.click(코트.l + ((vx - 코트.vx) / 코트.vw) * 코트.w,
      코트.t + ((vy - 코트.vy) / 코트.vh) * 코트.h);
    await p.waitForTimeout(45);
  };
  const 선수탭 = (n) => p.evaluate((v) =>
    document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`)?.click(), n).then(() => p.waitForTimeout(45));
  const 스팟 = (k) => p.evaluate((v) =>
    document.querySelector(`[data-spot="${v}"]`)?.click(), k).then(() => p.waitForTimeout(45));
  const 리바 = async (공격, who) => {
    await 스팟("reb");
    await p.click(공격 ? "#rec-reb-o" : "#rec-reb-d");
    await p.waitForTimeout(45);
    await 선수탭(who);
  };
  const 찍기 = async (k, who) => { await 스팟(k); await 선수탭(who); };

  // ── 씨앗 난수 ───────────────────────────────────────────
  let 씨 = 판.씨;
  const rnd = () => (씨 = (씨 * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const 하나 = (a) => a[Math.floor(rnd() * a.length)];
  const 사이 = (a, c) => Math.round(a + rnd() * (c - a));
  const 자리 = {
    골밑: () => [사이(205, 295), 사이(400, 455)],
    미들: () => (rnd() < 0.45 ? [사이(185, 315), 사이(285, 385)]
      : [rnd() < 0.5 ? 사이(95, 165) : 사이(335, 405), 사이(320, 420)]),
    "3점": () => (rnd() < 0.35 ? [rnd() < 0.5 ? 사이(14, 30) : 사이(470, 486), 사이(395, 450)]
      : [rnd() < 0.5 ? 사이(45, 110) : 사이(390, 455), 사이(150, 330)]),
  };
  const 성공률 = { 골밑: 0.58 * (판.성공배 ?? 1), 미들: 0.38 * (판.성공배 ?? 1), "3점": 0.33 * (판.성공배 ?? 1) };
  const 구역뽑기 = () => { const r = rnd(); return r < 0.45 ? "골밑" : r < 0.75 ? "미들" : "3점"; };

  // ── 경기 하나를 뛴다 ────────────────────────────────────
  async function 한경기(라벨) {
    for (let q = 1; q <= 판.쿼터; q++) {
      if (q > 1) { await p.click("#rec-q"); await p.waitForTimeout(150); }
      const 코트선수 = await p.evaluate(() =>
        [...document.querySelectorAll(".rec-team-row")].map((row) =>
          [...row.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player)));
      for (let k = 0; k < 판.공격; k++) {
        const ti = k % 2;
        const 나 = 코트선수[ti]; const 상대 = 코트선수[1 - ti];
        if (!나?.length) continue;
        const 쏜사람 = 하나(나);
        if (rnd() < 0.12) {                      // 턴오버
          await 찍기("to", 쏜사람);
          if (rnd() < 0.5) await 찍기("stl", 하나(상대));
          continue;
        }
        const 구역 = 구역뽑기();
        const [x, y] = 자리[구역]();
        const 들어감 = rnd() < 성공률[구역];
        await 탭(x, y); await 선수탭(쏜사람);
        await p.click(들어감 ? "#rec-made" : "#rec-miss");
        await p.waitForTimeout(60);
        if (들어감) {
          if (rnd() < 0.5) await 찍기("ast", 하나(나.filter((n) => n !== 쏜사람)) || 쏜사람);
        } else {
          if (rnd() < 0.09) await 찍기("blk", 하나(상대));
          const 공격리바 = rnd() < 0.3;
          await 리바(공격리바, 하나(공격리바 ? 나 : 상대));
        }
        if (rnd() < 0.09 * (판.파울배 ?? 1)) {   // 파울 → 자유투
          await 찍기("pf", 하나(상대));
          const 개수 = 구역 === "3점" ? 3 : 2;
          for (let f = 0; f < 개수; f++) await 찍기(rnd() < 0.7 ? "ftm" : "fta", 쏜사람);
        }
        // 되돌리기를 섞어 본다 — 넣었다 빼도 숫자가 맞아야 한다
        if (판.되돌리기 && rnd() < 0.1) {
          await 찍기("stl", 하나(나));
          await p.click("#rec-undo"); await p.waitForTimeout(80);
        }
        // 교체
        if (판.교체 && rnd() < 0.07) {
          await p.evaluate(() => {
            const d = document.querySelector(".rec-bench"); if (d) d.open = true;
            const btn = document.querySelector(".rec-sub"); if (btn) btn.click();
          });
          await p.waitForTimeout(80);
          const 나갈사람 = await p.evaluate(() => {
            const c = document.querySelector(".rec-team-row .rec-pchip");
            if (c) { c.click(); return c.dataset.player; } return null;
          });
          await p.waitForTimeout(120);
          if (나갈사람) {
            const 새코트 = await p.evaluate(() =>
              [...document.querySelectorAll(".rec-team-row")].map((row) =>
                [...row.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player)));
            코트선수[0] = 새코트[0]; 코트선수[1] = 새코트[1];
          }
        }
      }
    }
  }

  const 경기수 = 판.팀수 === 3 ? 3 : 1;
  for (let gi = 0; gi < 경기수; gi++) {
    if (gi > 0) {
      await p.evaluate((i) => document.querySelector(`.rec-gbtn[data-game="${i}"]`)?.click(), gi);
      await p.waitForTimeout(250);
    }
    await 한경기(gi);
  }

  // ── 새로고침해도 그대로인가 ─────────────────────────────
  const 전점수 = await p.evaluate(() => document.querySelector(".rec-score").innerText.replace(/\s+/g, " ").trim());
  await p.reload(); await p.waitForTimeout(900);
  const 후점수 = await p.evaluate(() => document.querySelector(".rec-score")?.innerText?.replace(/\s+/g, " ").trim() || "없음");
  say(전점수 === 후점수, `새로고침 전후 점수 다름: "${전점수}" → "${후점수}"`);

  // ── 이벤트 원본에서 따로 셈해 앱과 맞대기 ────────────────
  const 대조 = await p.evaluate(async () => {
    const st = await import("./js/storage.js");
    const R = await import("./js/record.js");
    const S = await import("./js/record-stats.js");
    const sess = st.getRecordSession();
    const out = [];
    for (let gi = 0; gi < sess.games.length; gi++) {
      const g = sess.games[gi];
      const ev = g.events;
      // ── 이 시험이 직접 세는 값 (앱 함수를 안 쓴다) ──
      const 손점수 = [0, 0];
      const 손 = {};
      const 칸 = () => ({ p2m: 0, p2a: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0, rebO: 0, rebD: 0,
        ast: 0, stl: 0, blk: 0, to: 0, pf: 0, pts: 0 });
      const 쿼터점수 = {};
      for (const e of ev) {
        const k = `${e.team}|${e.player}`;
        if (e.type !== "q" && e.type !== "sub") (손[k] ||= 칸());
        const q = e.q || 1;
        (쿼터점수[q] ||= [0, 0]);
        if (e.type === "shot") {
          const 점 = e.made ? e.pts : 0;
          손점수[e.team] += 점; 쿼터점수[q][e.team] += 점;
          손[k].pts += 점;
          if (e.pts === 3) { 손[k].p3a++; if (e.made) 손[k].p3m++; }
          else { 손[k].p2a++; if (e.made) 손[k].p2m++; }
        } else if (e.type === "ftm") {
          손점수[e.team] += 1; 쿼터점수[q][e.team] += 1;
          손[k].pts += 1; 손[k].ftm++; 손[k].fta++;
        } else if (e.type === "fta") { 손[k].fta++; }
        else if (e.type === "rebO") { 손[k].rebO++; }
        else if (e.type === "rebD") { 손[k].rebD++; }
        else if (["ast", "stl", "blk", "to", "pf"].includes(e.type)) { 손[k][e.type]++; }
      }
      // ── 앱이 내놓는 값 ──
      const 앱점수 = R.scoreOf(ev);
      const 표 = R.boxScore(g);
      const 지표 = S.팀지표(g);

      const 어긋 = [];
      if (앱점수[0] !== 손점수[0] || 앱점수[1] !== 손점수[1]) {
        어긋.push(`점수: 앱 ${앱점수.join(":")} vs 손 ${손점수.join(":")}`);
      }
      // 박스스코어 한 줄씩
      for (const r of 표) {
        const h = 손[`${r.team}|${r.name}`];
        if (!h) { if (r.pts || r.p2a || r.p3a || r.fta || r.reb || r.ast) 어긋.push(`${r.name}: 이벤트 없는데 기록 있음`); continue; }
        for (const k of ["pts", "p2m", "p2a", "p3m", "p3a", "ftm", "fta", "rebO", "rebD", "ast", "stl", "blk", "to", "pf"]) {
          if (r[k] !== h[k]) 어긋.push(`${r.name}.${k}: 앱 ${r[k]} vs 손 ${h[k]}`);
        }
        if (r.reb !== r.rebO + r.rebD) 어긋.push(`${r.name}.reb ${r.reb} ≠ 공${r.rebO}+수${r.rebD}`);
      }
      // 팀 합계 = 점수
      for (const ti of [0, 1]) {
        const 합 = 표.filter((r) => r.team === ti).reduce((a, r) => a + r.pts, 0);
        if (합 !== 앱점수[ti]) 어긋.push(`팀${ti} 선수 득점 합 ${합} ≠ 점수 ${앱점수[ti]}`);
        if (지표[ti].pts !== 앱점수[ti]) 어긋.push(`팀${ti} 팀지표 pts ${지표[ti].pts} ≠ 점수 ${앱점수[ti]}`);
      }
      // 쿼터 합 = 최종
      for (const ti of [0, 1]) {
        const 합 = Object.values(쿼터점수).reduce((a, v) => a + v[ti], 0);
        if (합 !== 앱점수[ti]) 어긋.push(`팀${ti} 쿼터 합 ${합} ≠ 최종 ${앱점수[ti]}`);
      }
      // NaN / Infinity
      for (const ti of [0, 1]) {
        for (const [k, v] of Object.entries(지표[ti])) {
          if (typeof v === "number" && !Number.isFinite(v)) 어긋.push(`팀${ti}.${k} = ${v}`);
        }
      }
      // 샷 차트 점 개수 = 슛 이벤트 수
      const I = await import("./js/record-image.js");
      const { svg } = I.샷차트한장SVG(g, [g], 1000);
      const 점수세기 = (svg.match(/class="shot-made"/g) || []).length + (svg.match(/class="shot-miss"/g) || []).length;
      const 슛수 = ev.filter((e) => e.type === "shot").length;
      // 팀 차트 둘 + 선수 차트들 → 슛 하나가 두 번 그려진다(팀 + 본인)
      if (점수세기 !== 슛수 * 2) 어긋.push(`샷차트 점 ${점수세기} ≠ 슛 ${슛수}×2`);

      out.push({
        gi, 점수: 앱점수, 이벤트: ev.length, 기록수: R.playCount(ev),
        쿼터: Math.max(...ev.map((e) => e.q || 1), 1),
        선수: 표.length, 슛: 슛수, 어긋,
        poss: 지표[0].poss, 넉넉: 지표[0].넉넉,
        ortg: 지표[0].ortg == null ? null : Math.round(지표[0].ortg * 10) / 10,
      });
    }
    return out;
  });

  for (const g of 대조) for (const m of g.어긋) say(false, `경기${g.gi + 1} ${m}`);

  // ── 파일 받기 ───────────────────────────────────────────
  await p.click("#rec-finish");
  await p.waitForTimeout(700);
  try {
    const [x] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click("#rec-xlsx")]);
    const 이름 = x.suggestedFilename();
    await x.saveAs(`${DL}/${판.씨}-${이름}`);
    받은파일.push(이름);
    const 크기 = fs.statSync(`${DL}/${판.씨}-${이름}`).size;
    say(크기 > 5000, `엑셀이 너무 작음 (${크기}바이트)`);
  } catch (e) { say(false, `엑셀 실패: ${e.message.slice(0, 60)}`); }
  try {
    const [g] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click("#rec-band-img")]);
    const 이름 = g.suggestedFilename();
    await g.saveAs(`${DL}/${판.씨}-${이름}`);
    받은파일.push(이름);
    const 크기 = fs.statSync(`${DL}/${판.씨}-${이름}`).size;
    say(크기 > 20000, `밴드 이미지가 너무 작음 (${크기}바이트)`);
  } catch (e) { say(false, `이미지 실패: ${e.message.slice(0, 60)}`); }

  if (errs.length) say(false, `브라우저 오류 ${errs.length}건 — ${[...new Set(errs)][0]}`);

  const 걸린 = ((Date.now() - 시작시각) / 1000).toFixed(1);
  const 첫 = 대조[0];
  요약.push({
    이름: 판.이름,
    점수: 대조.map((g) => g.점수.join(":")).join(" / "),
    기록: 대조.map((g) => g.기록수).join("/"),
    선수: 첫.선수, 슛: 대조.reduce((a, g) => a + g.슛, 0),
    poss: Math.round(첫.poss * 10) / 10, ortg: 첫.ortg,
    초: 걸린, 문제: 문제.length,
  });
  if (문제.length) 전체문제.push({ 판: 판.이름, 목록: 문제 });
  console.log(`${판.이름.padEnd(20)} ${대조.map((g) => g.점수.join(":")).join(" / ").padEnd(18)}`
    + ` 기록 ${대조.map((g) => g.기록수).join("/").padEnd(12)} ${걸린}초  ${문제.length ? `❌ ${문제.length}건` : "✅"}`);
  await ctx.close();
}
await b.close();

console.log("\n── 판별 요약 ──");
console.log("판                   점수               기록   선수 슛   포제션 ORtg   초");
for (const s of 요약) {
  console.log(`${s.이름.padEnd(20)} ${s.점수.padEnd(18)} ${String(s.기록).padEnd(6)} ${String(s.선수).padEnd(4)} `
    + `${String(s.슛).padEnd(5)} ${String(s.poss).padEnd(6)} ${String(s.ortg ?? "–").padEnd(6)} ${s.초}`);
}

console.log("\n── 내려받은 파일 이름이 서로 다른가 ──");
const 겹침 = 받은파일.filter((n, i) => 받은파일.indexOf(n) !== i);
console.log(겹침.length ? `❌ 같은 이름 ${[...new Set(겹침)].length}가지: ${[...new Set(겹침)].join(", ")}`
  : `✅ ${받은파일.length}개 전부 다른 이름`);

console.log("\n── 어긋난 것 ──");
if (!전체문제.length) console.log("✅ 열 판 전부, 앱이 내놓은 숫자와 따로 센 숫자가 같음");
for (const f of 전체문제) {
  console.log(`❌ ${f.판} — ${f.목록.length}건`);
  f.목록.slice(0, 8).forEach((m) => console.log(`     ${m}`));
  if (f.목록.length > 8) console.log(`     … ${f.목록.length - 8}건 더`);
}
const 실패 = 전체문제.length + (겹침.length ? 1 : 0);
console.log(실패 ? `\n❌ ${실패}건 실패` : "\n✅ 전부 통과");
process.exit(실패 ? 1 : 0);
