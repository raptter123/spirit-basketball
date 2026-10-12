// 팀 편성 — 배정을 시작하면 참석자 고르기를 한 줄로 접는가(D1), 아래 고정 줄(D3).
//
// 16명을 고르고 자동 배정하면 화면이 3721px(390×844 폰 4.4장)이었다. 칩 격자만 980px,
// 공지 이미지 단추는 3510px 아래. 접고 나면 그 사이를 굴리지 않아도 된다.
//
// 1) 칩 격자: 375~479px 폰에서 세 칸, 그보다 좁으면 두 칸. 이름이 두 줄로 갈라지지 않는가.
// 2) 접기: 배정이 생기면 접히고, 누른 단추가 손가락 밑에 그대로 있는가(위가 접혀도 안 튐).
// 3) 고정 줄: 아래 탭 바로 위, 인원 · 팀별 수, 공지 이미지로 바로 가는가.
//    페이지 끝을 가리지 않는가, 글자를 칠 때 숨는가, PC 에서는 맨 아래인가.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

/** 16명을 골라 둔(배정은 nAssign 명) 팀 편성 화면을 연다. */
async function 열기(w, h, { teamCount = 2, n = 16, nAssign = 0, theme = "dark" } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(300);
  await p.evaluate(async ([teamCount, n, nAssign, theme]) => {
    localStorage.setItem("spirit-theme", theme);
    const { ROSTER } = await import("./js/roster.js");
    const sel = ROSTER.slice(0, n).map((x) => x.name);
    const asg = {}; sel.slice(0, nAssign).forEach((name, i) => (asg[name] = i % teamCount));
    localStorage.setItem("spirit-team-builder-draft",
      JSON.stringify({ teamCount, gameDate: "2026-10-18", selected: sel, assignments: asg }));
  }, [teamCount, n, nAssign, theme]);
  await p.goto(`${URL}/index.html?s=${Math.random()}#/team-shuffle`); await p.waitForTimeout(600);
  return { p, ctx };
}

const 위 = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top : null; }, s);
const 격자 = (p) => p.evaluate(() => {
  const chips = [...document.querySelectorAll(".ts-roster-grid .ts-roster-chip")];
  return {
    칸: new Set(chips.map((c) => Math.round(c.getBoundingClientRect().left))).size,
    두줄: chips.filter((c) => c.getBoundingClientRect().height > 46).map((c) => c.innerText.trim()),
    높이: Math.round(document.querySelector(".ts-roster-grid").getBoundingClientRect().height),
  };
});

// ── 1) 칩 격자 칸 수 ──
for (const [w, h, 기대] of [[430, 932, 3], [390, 844, 3], [375, 667, 3], [360, 780, 2], [320, 568, 2]]) {
  const { p, ctx } = await 열기(w, h);
  const g = await 격자(p);
  확인(g.칸 === 기대 && g.두줄.length === 0,
    `${w}px 칩 ${g.칸}칸(기대 ${기대}) · 높이 ${g.높이}px · 두 줄로 갈라진 칩 ${g.두줄.length ? g.두줄.join(", ") : "없음"}`);
  await ctx.close();
}

// ── 2) 390×844: 배정 전 → 자동 배정 → 접힘 ──
{
  const { p, ctx } = await 열기(390, 844);
  const 독글 = () => p.evaluate(() => document.querySelector(".ts-dock-sum")?.innerText);
  확인(await p.locator("#ts-pick-fold").count() === 0, "배정 전에는 접기 줄이 없다(접을 것이 없음)");
  확인(await 독글() === "16명 · 화이트 0 · 퍼플 0" && await p.locator("#ts-dock-assign").count() === 1,
    `배정 전 고정 줄: "${await 독글()}" + 팀 배정 ↓`);

  await p.click("#ts-dock-assign"); await p.waitForTimeout(300);
  const 제목위 = await 위(p, "#ts-assign-title");
  확인(제목위 > -1 && 제목위 < 10, `'팀 배정 ↓' → 팀 배정 제목이 화면 맨 위로(top ${제목위.toFixed(1)}px)`);

  const 길이전 = await p.evaluate(() => document.documentElement.scrollHeight);
  const 단추전 = await 위(p, "#ts-auto-assign");
  await p.click("#ts-auto-assign"); await p.waitForTimeout(300);
  const 단추후 = await 위(p, "#ts-auto-assign");
  const 길이후 = await p.evaluate(() => document.documentElement.scrollHeight);
  const 접힘 = await p.evaluate(() => ({
    숨김: document.getElementById("ts-pick-body").hidden,
    펼침: document.getElementById("ts-pick-fold").getAttribute("aria-expanded"),
    글: document.getElementById("ts-pick-fold").innerText.replace(/\s+/g, " ").trim(),
    높이: Math.round(document.getElementById("ts-pick-fold").getBoundingClientRect().height),
  }));
  확인(접힘.숨김 && 접힘.펼침 === "false" && 접힘.글 === "✓ 참석 16명 펼쳐서 고치기 ▾",
    `자동 배정하면 접힘 — "${접힘.글}" (${접힘.높이}px, aria-expanded=${접힘.펼침})`);
  확인(Math.abs(단추후 - 단추전) <= 1,
    `위가 접혀도 '자동 배정' 단추가 제자리(${Math.round(단추전)} → ${Math.round(단추후)}px)`);
  확인(길이후 <= 길이전 - 500, `화면 길이 ${길이전} → ${길이후}px`);

  // 고정 줄
  const 독 = await p.evaluate(() => {
    const d = document.querySelector(".ts-dock").getBoundingClientRect();
    const t = document.querySelector(".tabbar").getBoundingClientRect();
    const btn = document.getElementById("ts-dock-image").getBoundingClientRect();
    return { 위: d.top, 아래: d.bottom, 높이: d.height, 탭위: t.top, 단추: [btn.width, btn.height] };
  });
  확인(Math.abs(독.아래 - 독.탭위) <= 1, `고정 줄이 아래 탭 바로 위(줄 아래 ${Math.round(독.아래)} · 탭 위 ${Math.round(독.탭위)}px)`);
  확인(독.높이 <= 54 && 독.단추[1] >= 44, `고정 줄 ${Math.round(독.높이)}px · 단추 ${Math.round(독.단추[0])}×${Math.round(독.단추[1])}px`);
  확인(await 독글() === "16명 · 화이트 8 · 퍼플 8", `배정 뒤 고정 줄: "${await 독글()}"`);

  // 페이지 끝을 가리지 않는가
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(200);
  const 끝 = await p.evaluate(() => ({
    단추아래: document.getElementById("ts-sheet-btn").getBoundingClientRect().bottom,
    줄위: document.querySelector(".ts-dock").getBoundingClientRect().top,
  }));
  확인(끝.단추아래 <= 끝.줄위, `맨 아래로 굴리면 '기록지 출력' 단추가 줄 위에 보임(단추 아래 ${Math.round(끝.단추아래)} ≤ 줄 위 ${Math.round(끝.줄위)}px)`);

  // 공지 이미지로 바로
  await p.click("#ts-dock-image"); await p.waitForTimeout(500);
  확인(await p.locator(".ts-image-modal").count() === 1, "고정 줄 '공지 이미지 →' 로 공지 이미지 창이 열림");
  await p.click("#ts-image-close"); await p.waitForTimeout(200);

  // 펼치기 · 접기 — 누른 줄이 제자리
  await p.evaluate(() => document.getElementById("ts-pick-fold").scrollIntoView({ block: "center" }));
  const 줄전 = await 위(p, "#ts-pick-fold");
  await p.click("#ts-pick-fold"); await p.waitForTimeout(300);
  const 펼침 = await p.evaluate(() => ({
    숨김: document.getElementById("ts-pick-body").hidden,
    글: document.getElementById("ts-pick-fold").innerText.replace(/\s+/g, " ").trim(),
  }));
  확인(!펼침.숨김 && 펼침.글 === "✓ 참석 16명 접기 ▴" && Math.abs((await 위(p, "#ts-pick-fold")) - 줄전) <= 1,
    `펼치면 칩이 다시 보이고 줄은 제자리 — "${펼침.글}"`);
  // 펼친 채로 한 명 더 고르기 — 배정이 남아 있어도 펼친 상태가 유지되는가
  await p.locator(".ts-roster-chip:not(.is-checked)").first().click(); await p.waitForTimeout(300);
  확인(!(await p.evaluate(() => document.getElementById("ts-pick-body").hidden)) && await 독글() === "17명 · 화이트 8 · 퍼플 8 · 남음 1",
    `펼친 채로 한 명 더 고르면 펼친 그대로 · 고정 줄 "${await 독글()}"`);
  await p.click("#ts-pick-fold"); await p.waitForTimeout(300);
  확인(await p.evaluate(() => document.getElementById("ts-pick-body").hidden), "다시 누르면 접힘");

  // 글자 칠 때 숨기 — 펼쳐서 검색칸에
  await p.click("#ts-pick-fold"); await p.waitForTimeout(300);
  await p.focus("#ts-search");
  const 칠때 = await p.evaluate(() => getComputedStyle(document.querySelector(".ts-dock")).display);
  확인(칠때 === "none", `검색칸에 글자를 칠 때 고정 줄 숨김(display ${칠때})`);
  await p.evaluate(() => document.activeElement.blur());

  // 배정 초기화 → 접기 줄이 사라지고 칩이 보인다
  await p.click("#ts-clear-assign"); await p.waitForTimeout(300);
  확인(await p.locator("#ts-pick-fold").count() === 0 && !(await p.evaluate(() => document.getElementById("ts-pick-body").hidden)),
    "배정 초기화하면 접기 줄이 없어지고 칩이 다시 보임");
  await ctx.close();
}

// ── 3) 칩을 펼친 채 첫 배정(남은 사람 칩) — 위가 접혀도 팀 판이 제자리 ──
{
  const { p, ctx } = await 열기(390, 844);
  await p.evaluate(() => document.getElementById("ts-board").scrollIntoView({ block: "center" }));
  const 이름 = await p.evaluate(() => document.querySelector(".ts-left-list .ts-chip").dataset.name);
  const 전 = await 위(p, "#ts-board");
  await p.locator(".ts-left-list .ts-chip").first().click(); await p.waitForTimeout(300);
  const 후 = await 위(p, "#ts-board");
  확인(Math.abs(후 - 전) <= 1 && await p.evaluate(() => document.getElementById("ts-pick-body").hidden),
    `첫 배정(남은 사람 ${이름} → 화이트)을 하면 참석자 칸이 접히고 팀 판은 제자리(${Math.round(전)} → ${Math.round(후)}px)`);
  await ctx.close();
}

// ── 4) 320px 3팀, 남은 사람 있음 — 줄 높이 그대로, '남음' 이 갈라지지 않음 ──
{
  const { p, ctx } = await 열기(320, 568, { teamCount: 3, nAssign: 14, theme: "light" });
  const r = await p.evaluate(() => {
    const d = document.querySelector(".ts-dock").getBoundingClientRect();
    const s = document.querySelector(".ts-dock-sum").getBoundingClientRect();
    const left = document.querySelector(".ts-dock-left").getClientRects().length;
    return { 높이: d.height, 글위: s.top - d.top, 글아래: d.bottom - s.bottom, 줄수: left, 글: document.querySelector(".ts-dock-sum").innerText };
  });
  확인(r.높이 <= 54 && r.글위 >= 0 && r.글아래 >= 0 && r.줄수 === 1,
    `320px 3팀: 줄 ${Math.round(r.높이)}px 안에 "${r.글}" · '남음' 한 덩어리(조각 ${r.줄수})`);
  await ctx.close();
}

// ── 5) PC(1024px): 아래 탭이 없으니 맨 아래, 그만큼 비움 ──
{
  const { p, ctx } = await 열기(1024, 768, { nAssign: 16 });
  const r = await p.evaluate(() => ({
    아래: innerHeight - document.querySelector(".ts-dock").getBoundingClientRect().bottom,
    여백: getComputedStyle(document.body).paddingBottom,
  }));
  확인(Math.abs(r.아래) <= 1 && r.여백 === "53px", `PC 에서 줄이 화면 맨 아래(${r.아래}px) · 아래 여백 ${r.여백}`);
  await ctx.close();
}

// ── 6) 아무도 안 골랐으면 줄 없음 ──
{
  const { p, ctx } = await 열기(390, 844, { n: 0 });
  확인(await p.locator(".ts-dock").count() === 0, "참석자 0명이면 고정 줄 없음");
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
