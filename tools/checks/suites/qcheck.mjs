// 기록 화면 — 쿼터를 넘길 때 점수판과 맞춰 보는 창.
//
// 혼자 기록하면 슛을 놓치기 쉽다. 점수가 점수판과 다르면 빠진 슛이 있다는 뜻이고, 그걸
// 아는 가장 이른 때가 쿼터 끝이다(기억이 남아 있다). 그래서 '▸ 2쿼터로' 를 누르면 바로
// 넘기지 않고 한 번 묻는다.
//
// 1) 누르면 창만 뜨고 쿼터는 그대로. 바깥을 누르면 닫힘. '같아' 로 넘김. 되돌리기로 복귀.
// 2) '점수판이 달라' → 점수판 점수를 −/+ 로 넣으면 몇 점 빠졌는지 · 많은지 알려 줌.
//    '돌아가서 채우기' 는 쿼터 그대로, '이대로 넘기기' 는 넘김. 같아지면 넘기는 단추가 앞.
// 3) 4쿼터 다음은 '연장1로'. 교류전은 상대 점수를 경기 중에 안 적으므로 우리 팀만.
// 4) 320px 에서 창이 화면 안 · 누를 곳 44px · 두 테마 명암비.
// 5) 많을 때 문장의 조사: "퍼플이" · "화이트가".
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 열기(w, h, theme = "dark") {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(300);
  await p.evaluate(async (theme) => {
    localStorage.setItem("spirit-theme", theme);
    const { ROSTER } = await import("./js/roster.js");
    const sel = ROSTER.slice(0, 10).map((x) => x.name);
    const asg = {}; sel.forEach((n, i) => (asg[n] = i % 2));
    localStorage.setItem("spirit-team-builder-draft", JSON.stringify({ teamCount: 2, gameDate: "2026-10-18", selected: sel, assignments: asg }));
  }, theme);
  await p.goto(`${URL}/index.html?s=${Math.random()}#/record`); await p.waitForTimeout(600);
  await p.click("#rec-use-draft"); await p.waitForTimeout(500);
  return { p, ctx };
}
const 코트 = async (p, sx, sy) => {
  const r = await p.evaluate(() => { const b = document.getElementById("rec-court-svg").getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; });
  await p.mouse.click(r.l + (sx / 500) * r.w, r.t + ((sy - 135) / 325) * r.h);
};
const 슛 = async (p, 이름, made = true) => { await p.click(`.rec-pchip[data-player="${이름}"]`); await 코트(p, 250, 330); await p.click(made ? "#rec-made" : "#rec-miss"); };
const 상태 = (p) => p.evaluate(() => ({
  쿼터: document.querySelector("#rec-q b").textContent.trim(),
  창: !!document.getElementById("rec-qc-bg"),
  제목: document.getElementById("rec-qc-title")?.textContent.trim() || "",
  점수: [...document.querySelectorAll(".rec-qc-team b")].map((x) => x.textContent.trim()),
  팀: [...document.querySelectorAll(".rec-qc-team span")].map((x) => x.textContent.trim()),
  말: document.querySelector(".rec-qc-diff")?.innerText.replace(/\s+/g, " ").trim() || "",
  넘김글: document.getElementById("rec-qc-ok")?.textContent.trim() || document.getElementById("rec-qc-go")?.textContent.trim() || "",
  넘김앞: document.getElementById("rec-qc-go")?.classList.contains("is-main") ?? null,
  기록수: document.querySelector(".rec-n b").textContent.trim(),
}));

// ── 1 · 2) 2팀 390×844 ──
{
  const { p, ctx } = await 열기(390, 844);
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((e) => e.dataset.player));
  await 슛(p, 이름[0]); await 슛(p, 이름[1]); await 슛(p, 이름[5]);   // 화이트 4 : 2 퍼플
  const 전 = await 상태(p);

  await p.click("#rec-q"); await p.waitForTimeout(150);
  let r = await 상태(p);
  확인(r.창 && r.쿼터 === "1쿼터" && r.제목 === "1쿼터 끝 — 점수판이랑 같아?" && r.점수.join(":") === "4:2" && r.팀.join() === "화이트,퍼플",
    `'▸ 2쿼터로' → 창 "${r.제목}" ${r.팀[0]} ${r.점수.join(" : ")} ${r.팀[1]} · 쿼터는 그대로 ${r.쿼터}`);
  확인(r.넘김글 === "✓ 같아 · 2쿼터로", `넘김 단추 "${r.넘김글}"`);
  확인(await p.evaluate(() => document.activeElement?.id) === "rec-qc-ok", "창이 뜨면 '같아' 단추에 초점");

  await p.mouse.click(195, 20); await p.waitForTimeout(150);   // 창 바깥(어두운 곳)
  r = await 상태(p);
  확인(!r.창 && r.쿼터 === "1쿼터" && r.기록수 === 전.기록수, "창 바깥을 누르면 그냥 닫힘 — 쿼터 · 기록 수 그대로");

  await p.click("#rec-q"); await p.click("#rec-qc-ok"); await p.waitForTimeout(150);
  r = await 상태(p);
  확인(!r.창 && r.쿼터 === "2쿼터", `'같아' → ${r.쿼터} 로 넘어가고 창 닫힘`);
  await p.click("#rec-undo"); await p.waitForTimeout(150);
  확인((await 상태(p)).쿼터 === "1쿼터", "되돌리기로 1쿼터 복귀(넘김은 전처럼 한 줄)");

  // 점수판이 다를 때
  await p.click("#rec-q"); await p.click("#rec-qc-diff"); await p.waitForTimeout(150);
  r = await 상태(p);
  확인(r.제목 === "점수판 점수를 넣어 줘" && r.말 === "이제 점수가 같아요." && r.넘김앞 === true && r.넘김글 === "✓ 2쿼터로",
    `'점수판이 달라' → 처음엔 앱 점수 그대로 "${r.말}" · 넘김 단추가 앞("${r.넘김글}")`);
  await p.click('[data-qc-team="0"][data-qc-d="1"]'); await p.click('[data-qc-team="0"][data-qc-d="1"]');
  await p.click('[data-qc-team="1"][data-qc-d="-1"]'); await p.waitForTimeout(100);
  r = await 상태(p);
  확인(r.말 === "화이트 2점이 빠졌어요. 빠진 슛 · 자유투를 더 적으면 맞아요. 퍼플이 점수판보다 1점 많아요. 잘못 적은 슛이 있는지 봐요."
    && r.넘김앞 === false && r.넘김글 === "이대로 2쿼터로", `점수판 화이트 6 · 퍼플 1 → "${r.말}"`);
  const 칸초점 = await p.evaluate(() => document.activeElement?.dataset?.qcTeam);
  확인(칸초점 === "1", "−/+ 를 누른 뒤에도 초점이 그 단추에(연달아 누르기)");
  // 받침 없는 이름은 "가" — 화이트를 점수판보다 많게 만들어 본다.
  for (let i = 0; i < 4; i++) await p.click('[data-qc-team="0"][data-qc-d="-1"]');
  r = await 상태(p);
  확인(r.말.startsWith("화이트가 점수판보다 2점 많아요."), `조사: "${r.말.split(".")[0]}."`);
  for (let i = 0; i < 5; i++) await p.click('[data-qc-team="1"][data-qc-d="-1"]');
  확인((await p.evaluate(() => document.querySelectorAll(".rec-qc-ctl b")[1].textContent.trim())) === "0", "점수판 점수는 0 아래로 안 내려감");

  await p.click("#rec-qc-back"); await p.waitForTimeout(150);
  r = await 상태(p);
  확인(!r.창 && r.쿼터 === "1쿼터", "'돌아가서 채우기' → 창 닫힘 · 1쿼터 그대로");
  await 슛(p, 이름[2]);
  await p.click("#rec-q"); await p.click("#rec-qc-diff"); await p.waitForTimeout(100);
  확인((await p.evaluate(() => [...document.querySelectorAll(".rec-qc-ctl b")].map((x) => x.textContent.trim()).join(":"))) === "6:2",
    "다시 열면 점수판 칸은 지금 앱 점수(6 : 2)부터");
  await p.click('[data-qc-team="0"][data-qc-d="1"]'); await p.click("#rec-qc-go"); await p.waitForTimeout(150);
  확인((await 상태(p)).쿼터 === "2쿼터", "'이대로 2쿼터로' → 차이를 둔 채 넘어감");

  for (let q = 2; q < 4; q++) { await p.click("#rec-q"); await p.click("#rec-qc-ok"); await p.waitForTimeout(100); }
  await p.click("#rec-q"); await p.waitForTimeout(100);
  r = await 상태(p);
  확인(r.제목 === "4쿼터 끝 — 점수판이랑 같아?" && r.넘김글 === "✓ 같아 · 연장1로", `4쿼터 끝 → "${r.넘김글}"`);
  await ctx.close();
}

// ── 3) 교류전: 우리 팀만 ──
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${URL}/index.html#/record`); await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } });
  await p.goto(`${URL}/index.html?ex=1#/record`); await p.waitForTimeout(600);
  await p.click('.rec-nbtn[data-n="1"]'); await p.waitForTimeout(200);
  const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 로스터.slice(0, 6)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.fill("#rec-opp-name", "불사조"); await p.click("#rec-start"); await p.waitForTimeout(600);
  const 첫 = await p.evaluate(() => document.querySelector(".rec-pchip").dataset.player);
  await 슛(p, 첫);
  await p.click("#rec-q"); await p.waitForTimeout(150);
  let r = await 상태(p);
  확인(r.점수.length === 1 && r.점수[0] === "2" && !r.팀.includes("불사조"), `교류전 → 우리 팀만(${r.팀.join()} ${r.점수.join()}) · 상대는 경기 중에 안 적음`);
  await p.click("#rec-qc-diff"); await p.waitForTimeout(100);
  확인((await p.locator(".rec-qc-step").count()) === 1, "교류전 점수판 칸도 우리 팀 하나");
  await ctx.close();
}

// ── 4) 320px · 두 테마 ──
for (const theme of ["dark", "light"]) {
  const { p, ctx } = await 열기(320, 568, theme);
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((e) => e.dataset.player));
  await 슛(p, 이름[0]);
  for (const 단계 of ["묻기", "넣기"]) {
    if (단계 === "묻기") { await p.click("#rec-q"); } else { await p.click("#rec-qc-diff"); await p.click('[data-qc-team="0"][data-qc-d="1"]'); }
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
      const 바탕 = (e) => { for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return rgb(c); } return [255, 255, 255]; };
      const 창 = document.querySelector(".rec-qc").getBoundingClientRect();
      const 누를곳 = [...document.querySelectorAll(".rec-qc button")].map((x) => x.getBoundingClientRect());
      const 글 = [...document.querySelectorAll(".rec-qc h3, .rec-qc-sub, .rec-qc-team, .rec-qc-btn, .rec-qc-app, .rec-qc-diff, .rec-qc-lab span, .rec-qc-ctl b")];
      const 낮음 = 글.map((e) => [e.className || e.tagName, cr(rgb(getComputedStyle(e).color), 바탕(e))]).filter(([, v]) => v < 4.5);
      return { 위: Math.round(창.top), 아래: Math.round(innerHeight - 창.bottom), 작은것: 누를곳.filter((x) => x.height < 44 || x.width < 44).length, 낮음, 넘침: document.documentElement.scrollWidth - innerWidth };
    });
    확인(r.위 >= 0 && r.아래 === 0 && r.작은것 === 0 && r.넘침 === 0,
      `320px ${theme} ${단계}: 창이 화면 안(위 ${r.위}px) · 44px 미만 ${r.작은것} · 가로 넘침 ${r.넘침}`);
    확인(r.낮음.length === 0, `320px ${theme} ${단계}: 글씨 명암비 4.5 미달 ${r.낮음.length ? r.낮음.map(([k, v]) => `${k} ${v}`).join(", ") : "없음"}`);
  }
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
