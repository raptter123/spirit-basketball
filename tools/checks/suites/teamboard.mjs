// 팀 편성 — 팀 판(D2). 팀마다 한 칸, 그 안에 이름 칩. 배정과 미리보기를 한 판에서 한다.
//
// 전에는 한 사람에 한 줄(줄마다 팀 단추)이라 16명이면 16줄이었고, 아래 '팀 구성 미리보기' 에
// 같은 이름이 또 나왔다. 16명 2팀 390×844 에서 배정 줄 + 미리보기가 화면 길이의 절반쯤.
//
// 1) 2팀: 칩을 누르면 반대 팀으로, 남은 사람은 누르면 화이트로. 누른 뒤에도 판이 제자리.
// 2) 3팀: 칩을 누르면 옮길 팀 단추가 펼쳐진다(한 번에 한 명). 옮기기 · 빼기.
// 3) 칸 머리 예상 득점 = 계산 값, 표에 나머지 예상치.
// 4) 폭 다섯 가지 × 2 · 3팀: 칸 제목 · 예상 줄이 한 줄, 가로 넘침 없음, 누를 곳 44px.
// 5) 두 테마 글씨 명암비 4.5.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

async function 열기(w, h, { teamCount = 2, n = 16, nAssign = n, theme = "dark" } = {}) {
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
const 칸들 = (p) => p.evaluate(() => [...document.querySelectorAll(".ts-col")].map((c) => ({
  제목: c.querySelector(".ts-col-title").textContent.trim(),
  이름: [...c.querySelectorAll(".ts-chip")].map((x) => x.dataset.name),
})));
const 판위 = (p) => p.evaluate(() => document.getElementById("ts-board").getBoundingClientRect().top);

// ── 1) 2팀 ──
{
  const { p, ctx } = await 열기(390, 844);
  const 길이 = await p.evaluate(() => document.documentElement.scrollHeight);
  확인(길이 <= 1800, `16명 2팀 배정 끝난 화면 길이 ${길이}px (판 전 2586px)`);
  const 전 = await 칸들(p);
  확인(전.map((c) => c.제목).join() === "화이트 (8명),퍼플 (8명)", `칸 제목 ${전.map((c) => c.제목).join(" · ")}`);
  const 사람 = 전[0].이름[2];
  await p.evaluate(() => document.getElementById("ts-board").scrollIntoView({ block: "center" }));
  const 위전 = await 판위(p);
  await p.click(`.ts-chip[data-name="${사람}"]`); await p.waitForTimeout(300);
  const 후 = await 칸들(p);
  확인(후[1].이름.includes(사람) && !후[0].이름.includes(사람) && 후.map((c) => c.제목).join() === "화이트 (7명),퍼플 (9명)",
    `${사람} 누르면 화이트 → 퍼플 (${후.map((c) => c.제목).join(" · ")})`);
  확인(Math.abs((await 판위(p)) - 위전) <= 1, `옮긴 뒤 판이 제자리(${Math.round(위전)} → ${Math.round(await 판위(p))}px)`);
  const 줄 = await p.evaluate(() => document.querySelector(".ts-dock-sum").innerText);
  확인(줄 === "16명 · 화이트 7 · 퍼플 9", `고정 줄도 같이 — "${줄}"`);
  await p.click(`.ts-chip[data-name="${사람}"]`); await p.waitForTimeout(300);
  확인((await 칸들(p))[0].이름.includes(사람), `한 번 더 누르면 화이트로 돌아옴`);
  const 저장 = await p.evaluate(() => JSON.parse(localStorage.getItem("spirit-team-builder-draft")).assignments);
  확인(저장[사람] === 0, `초안에도 저장(${사람} → ${저장[사람]})`);
  await ctx.close();
}
{
  const { p, ctx } = await 열기(390, 844, { nAssign: 14 });
  const 남은 = await p.evaluate(() => [...document.querySelectorAll(".ts-left-list .ts-chip")].map((x) => x.dataset.name));
  const 제목 = await p.evaluate(() => document.querySelector(".ts-left-title").textContent.trim());
  확인(남은.length === 2 && 제목 === "남은 사람 2명", `판 위 '${제목}' — ${남은.join(", ")}`);
  await p.click(`.ts-chip[data-name="${남은[0]}"]`); await p.waitForTimeout(300);
  확인((await 칸들(p))[0].이름.includes(남은[0]), `남은 사람 ${남은[0]} 누르면 화이트로`);
  await p.click(`.ts-chip[data-name="${남은[1]}"]`); await p.waitForTimeout(300);
  확인(await p.locator(".ts-left-row").count() === 0, "다 들어가면 남은 사람 줄이 없어짐");
  await ctx.close();
}

// ── 2) 3팀 ──
{
  const { p, ctx } = await 열기(390, 844, { teamCount: 3, n: 15, nAssign: 13 });
  const 전 = await 칸들(p);
  const 사람 = 전[0].이름[0];
  await p.click(`.ts-col .ts-chip[data-name="${사람}"]`); await p.waitForTimeout(300);
  const 펼침 = await p.evaluate((n) => ({
    열림: document.querySelector(`.ts-chip[data-name="${n}"]`).getAttribute("aria-expanded"),
    단추: [...document.querySelectorAll(".ts-move")].map((x) => x.textContent.trim()),
    높이: Math.min(...[...document.querySelectorAll(".ts-move")].map((x) => x.getBoundingClientRect().height)),
    초점: document.activeElement?.dataset?.name,
  }), 사람);
  확인(펼침.열림 === "true" && 펼침.단추.join() === "→ B팀,→ C팀,빼기" && 펼침.높이 >= 44,
    `${사람}(A팀) 누르면 ${펼침.단추.join(" · ")} (단추 ${Math.round(펼침.높이)}px) · 초점은 칩에(${펼침.초점 === 사람 ? "예" : 펼침.초점})`);
  // 다른 칩을 누르면 앞의 것은 닫힌다
  const 다른 = 전[1].이름[0];
  await p.click(`.ts-col .ts-chip[data-name="${다른}"]`); await p.waitForTimeout(300);
  const 열린수 = await p.evaluate(() => document.querySelectorAll('.ts-chip[aria-expanded="true"]').length);
  확인(열린수 === 1, `다른 칩을 누르면 한 명만 펼침(${열린수})`);
  await p.click(`.ts-col .ts-chip[data-name="${다른}"]`); await p.waitForTimeout(300);
  확인(await p.locator(".ts-move").count() === 0, "같은 칩을 다시 누르면 닫힘");

  await p.click(`.ts-col .ts-chip[data-name="${사람}"]`); await p.waitForTimeout(300);
  const 위전 = await 판위(p);
  await p.click(`.ts-move[data-name="${사람}"][data-team="2"]`); await p.waitForTimeout(300);
  확인((await 칸들(p))[2].이름.includes(사람) && await p.locator(".ts-move").count() === 0 && Math.abs((await 판위(p)) - 위전) <= 1,
    `→ C팀 누르면 C팀으로 옮기고 단추가 닫힘 · 판 제자리`);
  await p.click(`.ts-col .ts-chip[data-name="${사람}"]`); await p.waitForTimeout(300);
  await p.click(`.ts-move[data-name="${사람}"][data-team=""]`); await p.waitForTimeout(300);
  const 남은 = await p.evaluate(() => [...document.querySelectorAll(".ts-left-list .ts-chip")].map((x) => x.dataset.name));
  확인(남은.includes(사람) && 남은.length === 3, `빼기 누르면 남은 사람으로(${남은.length}명)`);
  // 남은 사람 칩: 세 팀 모두로 갈 수 있고, '빼기' 는 없다
  await p.click(`.ts-left-list .ts-chip[data-name="${사람}"]`); await p.waitForTimeout(300);
  const 남은단추 = await p.evaluate(() => [...document.querySelectorAll(".ts-move")].map((x) => x.textContent.trim()));
  확인(남은단추.join() === "→ A팀,→ B팀,→ C팀", `남은 사람 칩을 누르면 ${남은단추.join(" · ")}`);
  await p.click(`.ts-move[data-name="${사람}"][data-team="1"]`); await p.waitForTimeout(300);
  확인((await 칸들(p))[1].이름.includes(사람), "→ B팀 으로 들어감");
  await ctx.close();
}

// ── 3) 예상 득점 ──
{
  const { p, ctx } = await 열기(390, 844);
  const r = await p.evaluate(async () => {
    const { ROSTER } = await import("./js/roster.js");
    const by = Object.fromEntries(ROSTER.map((x) => [x.name, x]));
    return [...document.querySelectorAll(".ts-col")].map((c) => {
      const names = [...c.querySelectorAll(".ts-chip")].map((x) => x.dataset.name);
      const ps = names.map((n) => by[n]).filter((x) => x && typeof x.ppg === "number");
      const 셈 = ps.reduce((a, x) => a + x.ppg, 0) * (7 / names.length);
      return { 화면: c.querySelector(".ts-col-proj b")?.textContent, 셈: 셈.toFixed(1) };
    });
  });
  확인(r.every((x) => x.화면 === x.셈), `칸 머리 예상 득점 ${r.map((x) => `${x.화면}(셈 ${x.셈})`).join(" · ")}`);
  const 표 = await p.evaluate(() => ({
    머리: [...document.querySelectorAll(".ts-proj-table thead th")].map((x) => x.textContent.trim()),
    줄: [...document.querySelectorAll(".ts-proj-table tbody th")].map((x) => x.textContent.trim()),
    득점: [...document.querySelectorAll(".ts-proj-table tbody tr:first-child td")].map((x) => x.textContent.trim().split(" ")[0]),
  }));
  확인(표.머리.join() === "화이트,퍼플" && 표.줄[0] === "득점" && 표.득점.join() === r.map((x) => x.화면).join(),
    `예상치 표 — 줄 ${표.줄.join(" · ")} · 득점 ${표.득점.join(" · ")}`);
  await ctx.close();
}

// ── 4) 폭 · 팀 수 ──
for (const [w, h] of [[320, 568], [360, 780], [375, 667], [390, 844], [430, 932]]) {
  for (const teamCount of [2, 3]) {
    const { p, ctx } = await 열기(w, h, { teamCount, n: 18, nAssign: 16 });
    // 3팀은 칩 하나를 펼친 상태까지 본다.
    if (teamCount === 3) { await p.locator(".ts-col .ts-chip").first().click(); await p.waitForTimeout(300); }
    const r = await p.evaluate(() => {
      // 글자 줄 수 — 글자 조각들의 아랫변을 모아 8px 넘게 떨어진 곳마다 한 줄씩 센다
      // (예상 줄은 '예상' 과 굵은 숫자의 글씨 크기가 달라 아랫변이 1~2px 어긋난다).
      const 줄수 = (e) => {
        const r = document.createRange(); r.selectNodeContents(e);
        const 아래 = [...r.getClientRects()].map((x) => x.bottom).sort((m, n) => m - n);
        return 아래.reduce((n, y, i) => n + (i && y - 아래[i - 1] > 8 ? 1 : 0), 아래.length ? 1 : 0);
      };
      const 누를곳 = [...document.querySelectorAll(".ts-chip, .ts-move")].map((x) => x.getBoundingClientRect());
      return {
        제목: [...document.querySelectorAll(".ts-col-title")].map(줄수),
        예상: [...document.querySelectorAll(".ts-col-proj")].map(줄수),
        넘침: document.documentElement.scrollWidth - innerWidth,
        표넘침: (() => { const t = document.querySelector(".ts-proj-table"); return t.getBoundingClientRect().right - document.getElementById("ts-board").getBoundingClientRect().right; })(),
        작은것: 누를곳.filter((x) => x.height < 44).length,
        칸폭: Math.round(document.querySelector(".ts-col").getBoundingClientRect().width),
      };
    });
    확인(r.제목.every((x) => x === 1) && r.예상.every((x) => x === 1) && r.넘침 === 0 && r.표넘침 <= 0 && r.작은것 === 0,
      `${w}px ${teamCount}팀(칸 ${r.칸폭}px): 제목 · 예상 한 줄, 가로 넘침 ${r.넘침} · 표 ${Math.round(r.표넘침)}, 44px 미만 ${r.작은것}`);
    await ctx.close();
  }
}

// ── 5) 명암비 ──
for (const theme of ["dark", "light"]) {
  for (const teamCount of [2, 3]) {
    const { p, ctx } = await 열기(390, 844, { teamCount, n: 15, nAssign: 13, theme });
    await p.locator(".ts-col .ts-chip").first().click(); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const 바탕 = (e) => { for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return rgb(c); } return [255, 255, 255]; };
      const 잼 = {};
      for (const [이름, s] of [["칸 제목", ".ts-col-title"], ["예상", ".ts-col-proj"], ["칩", ".ts-chip-name"], ["옮길 곳", ".ts-move"],
        ["빼기", '.ts-move[data-team=""]'], ["남은 사람", ".ts-left-title"], ["표 글", ".ts-proj-table th[scope=row]"], ["표 괄호", ".ts-proj-table small"]]) {
        const e = document.querySelector(s); if (!e) continue;
        잼[이름] = +cr(rgb(getComputedStyle(e).color), 바탕(e)).toFixed(2);
      }
      return 잼;
    });
    const 낮음 = Object.entries(r).filter(([, v]) => v < 4.5);
    확인(낮음.length === 0, `${theme} ${teamCount}팀 글씨 명암비 — ${Object.entries(r).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    await ctx.close();
  }
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
