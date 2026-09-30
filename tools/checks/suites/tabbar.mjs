// 폰 아래 탭 — 폰에서만 보이고, 지금 화면의 탭이 켜지고, 페이지 끝을 가리지 않는가.
//
// 폰(720px 미만)에서는 위 메뉴 줄 대신 아래 탭 다섯 개(홈 · 전술 · 일정 · 팀 편성 · 기록).
// 태블릿 · PC 는 위 메뉴 줄 그대로. 경기 중(기록 화면 집중 모드)에는 탭을 감춘다.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];
function 명암(fg, bg) {
  const L = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const [a, c] = [L(fg), L(bg)].sort((x, y) => y - x); return (a + 0.05) / (c + 0.05);
}
async function 새창(w, h, 테마 = "dark") {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: 테마 });
  await ctx.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } }, 테마);
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
  return { p, ctx };
}

// ── 폭마다: 보이나 · 크기 · 위 메뉴 줄 ──
for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024], [1280, 800]]) {
  const { p, ctx } = await 새창(w, h);
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const 보임 = (s) => !!document.querySelector(s)?.getClientRects().length;
    const 탭 = [...document.querySelectorAll(".tabbar a")].map((a) => { const r = a.getBoundingClientRect(); return { 글: a.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) }; });
    const t = document.querySelector(".tabbar").getBoundingClientRect();
    return { 탭보임: 보임(".tabbar"), 메뉴줄: 보임(".utility-bar"), 탭, 탭바닥: Math.round(innerHeight - t.bottom), 헤더: Math.round(document.querySelector(".site-header").getBoundingClientRect().height) };
  });
  if (w < 720) {
    const 작음 = r.탭.filter((x) => x.w < 44 || x.h < 44);
    확인(r.탭보임 && !r.메뉴줄 && r.탭.length === 5 && !작음.length && r.탭바닥 === 0,
      `${w}px — 아래 탭 ${r.탭.map((x) => x.글.replace(/\s+/g, "")).join("·")} · 칸 ${r.탭[0]?.w}×${r.탭[0]?.h} · 위 메뉴 줄 ${r.메뉴줄 ? "보임" : "숨김"} · 헤더 ${r.헤더}px`);
  } else {
    확인(!r.탭보임 && r.메뉴줄, `${w}px — 아래 탭 ${r.탭보임 ? "보임" : "없음"} · 위 메뉴 줄 ${r.메뉴줄 ? "그대로" : "사라짐"}`);
  }
  await ctx.close();
}

// ── 화면마다 켜지는 탭 ──
{
  const { p, ctx } = await 새창(390, 844);
  for (const [길, 탭] of [["#/", "홈"], ["#/tactics", "전술"], ["#/tactic/pick-and-roll", "전술"], ["#/new-tactic", "전술"],
    ["#/schedule", "일정"], ["#/team-shuffle", "팀 편성"], ["#/record", "기록"], ["#/roster", ""], ["#/board", ""], ["#/glossary", ""]]) {
    await p.goto(`${URL}/index.html?s=${Math.random()}${길}`); await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({
      켜짐: [...document.querySelectorAll(".tabbar a.is-active")].map((a) => a.lastChild.textContent.trim()),
      현재: [...document.querySelectorAll('.tabbar a[aria-current="page"]')].length,
    }));
    const 기대 = 탭 ? [탭] : [];
    확인(r.켜짐.join() === 기대.join() && r.현재 === 기대.length, `${길.padEnd(24)} 켜진 탭 ${r.켜짐.join() || "없음"}`);
  }
  // 탭을 누르면 그 화면으로
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(400);
  const 간곳 = [];
  for (const i of [1, 2, 3, 4, 0]) {
    await p.locator(".tabbar a").nth(i).click(); await p.waitForTimeout(300);
    간곳.push(await p.evaluate(() => location.hash));
  }
  확인(간곳.join(" ") === "#/tactics #/schedule #/team-shuffle #/record #/", `탭 차례로 누르기 → ${간곳.join(" ")}`);
  await ctx.close();
}

// ── 페이지 끝이 탭에 가리지 않는가 (배포판 번호 줄이 탭 위에 보여야 한다) ──
for (const 길 of ["#/", "#/tactics", "#/schedule", "#/team-shuffle", "#/roster"]) {
  const { p, ctx } = await 새창(390, 844);
  await p.goto(`${URL}/index.html${길}`); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(200);
  const r = await p.evaluate(() => {
    const 끝 = document.querySelector(".site-foot") || document.querySelector("#app");
    return { 끝아래: Math.round(끝.getBoundingClientRect().bottom), 탭위: Math.round(document.querySelector(".tabbar").getBoundingClientRect().top) };
  });
  확인(r.끝아래 <= r.탭위, `${길.padEnd(14)} 맨 아래로 굴렸을 때 페이지 끝 ${r.끝아래}px · 탭 위 ${r.탭위}px`);
  await ctx.close();
}

// ── 경기 중에는 탭이 없다 ──
{
  const { p, ctx } = await 새창(390, 844);
  await p.goto(`${URL}/index.html#/record`); await p.waitForTimeout(600);
  const 준비 = await p.evaluate(() => !!document.querySelector(".tabbar").getClientRects().length);
  const 이름들 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름들.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start"); await p.waitForTimeout(600);
  const r = await p.evaluate(() => ({ 집중: document.body.classList.contains("rec-focus"),
    탭: !!document.querySelector(".tabbar").getClientRects().length, 아래여백: getComputedStyle(document.body).paddingBottom,
    넘침: document.documentElement.scrollHeight - innerHeight }));
  확인(준비 && r.집중 && !r.탭 && r.아래여백 === "0px" && r.넘침 <= 0,
    `기록 — 차리는 화면에는 탭 ${준비 ? "있음" : "없음"}, 경기 중에는 ${r.탭 ? "있음" : "없음"} · body 아래 여백 ${r.아래여백} · 넘침 ${Math.max(0, r.넘침)}px`);
  await ctx.close();
}

// ── 명암비 · 옛 판 알림 띠 자리 ──
for (const 테마 of ["dark", "light"]) {
  const { p, ctx } = await 새창(390, 844, 테마);
  await p.goto(`${URL}/index.html#/tactics`); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const 바탕 = rgb(getComputedStyle(document.querySelector(".tabbar")).backgroundColor);
    const 띠 = document.createElement("button"); 띠.className = "app-stale"; 띠.textContent = "x"; document.body.append(띠);
    const 띠아래 = Math.round(innerHeight - 띠.getBoundingClientRect().bottom); 띠.remove();
    return { 바탕, 글: [...document.querySelectorAll(".tabbar a")].map((a) => ({ 켜짐: a.classList.contains("is-active"), c: rgb(getComputedStyle(a).color) })), 띠아래,
      탭높이: Math.round(document.querySelector(".tabbar").getBoundingClientRect().height) };
  });
  const 값 = r.글.map((x) => 명암(x.c, r.바탕));
  확인(값.every((v) => v >= 4.5), `${테마} — 탭 글씨 명암비 최저 ${Math.min(...값).toFixed(2)} (켜진 탭 ${값[r.글.findIndex((x) => x.켜짐)].toFixed(2)})`);
  확인(r.띠아래 >= r.탭높이, `${테마} — 옛 판 알림 띠가 탭 위에 뜸 (화면 아래에서 ${r.띠아래}px, 탭 ${r.탭높이}px)`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
