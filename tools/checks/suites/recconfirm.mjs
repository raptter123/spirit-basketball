// 기록 화면 — 방금 적은 것을 코트 위 안내줄 자리에 크게 띄우는가.
//
// 전에는 "방금 김산 2점 ✓" 가 화면 맨 아래 기록 줄(390×844 에서 y≈686)에 작은 글씨로만
// 나왔다. 기록자는 코트를 보고 있으므로, 잘못 누른 것을 그 자리에서 알아채려면 보던 곳에
// 떠야 한다. 띠는 2초 뒤(또는 다음 것을 누르는 순간) 안내줄로 돌아간다.
//
// 1) 슛 성공 · 실패 · 리바 · 교체 · 되돌리기마다 맞는 글과 색. 쿼터 넘김은 안 띄움.
// 2) 2초 뒤 안내줄로 돌아감 / 다음 것을 누르면 바로 사라짐.
// 3) 띠 위를 눌러도 코트에 찍힘(띠는 눌리지 않음).
// 4) 320px 에서 긴 글(교체)도 코트 칸 밖으로 안 나감. 두 테마 명암비.
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
    const sel = ROSTER.slice(0, 12).map((x) => x.name);
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
const 선수들 = (p) => p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((e) => e.dataset.player));
const 띠 = (p) => p.evaluate(() => {
  const d = document.getElementById("rec-confirm");
  const tip = document.querySelector(".rec-tip");
  return {
    있음: !!d, 글: d ? d.textContent.replace(/\s+/g, " ").trim() : "", 종류: d ? [...d.classList].find((c) => c.startsWith("is-")) : "",
    안내보임: !!tip && !tip.hidden && getComputedStyle(tip).display !== "none",
  };
});

// ── 1 · 2 · 3) 390×844 ──
{
  const { p, ctx } = await 열기(390, 844);
  const [a0, a1] = await 선수들(p);
  확인(!(await 띠(p)).있음 && (await 띠(p)).안내보임, "처음에는 띠 없이 안내줄만");

  await p.click(`.rec-pchip[data-player="${a0}"]`); await 코트(p, 330, 300); await p.click("#rec-made");
  let r = await 띠(p);
  확인(r.있음 && r.글 === `✓ ${a0} 2점 성공` && r.종류 === "is-ok" && !r.안내보임, `슛 성공 → "${r.글}" (${r.종류}) · 안내줄 숨김`);

  const 크기 = await p.evaluate(() => {
    const d = document.getElementById("rec-confirm").getBoundingClientRect();
    return { w: Math.round(d.width), h: Math.round(d.height), x: d.left + d.width / 2, y: d.top + d.height / 2 };
  });
  // 띠 위를 누르면 아래 코트에 찍혀야 한다.
  await p.mouse.click(크기.x, 크기.y); await p.waitForTimeout(150);
  r = await 띠(p);
  const 찍힘 = await p.evaluate(() => !!document.querySelector(".rec-shot-live"));
  확인(찍힘 && !r.있음 && r.안내보임, `띠(${크기.w}×${크기.h}px) 위를 누르면 코트에 찍히고 띠는 바로 사라짐`);

  await p.click(`.rec-pchip[data-player="${a1}"]`); await p.click("#rec-miss");
  r = await 띠(p);
  확인(r.글 === `✗ ${a1} 3점 실패` && r.종류 === "is-no", `탑 3점 실패 → "${r.글}" (${r.종류})`);
  await p.waitForTimeout(2200);
  r = await 띠(p);
  확인(!r.있음 && r.안내보임, "2초 뒤 띠가 사라지고 안내줄로 돌아감");

  await p.click(`.rec-pchip[data-player="${a0}"]`); await p.click('.rec-ebtn[data-spot="reb"]'); await p.click("#rec-reb-o");
  r = await 띠(p);
  확인(r.글 === `↑ ${a0} 공격 리바` && r.종류 === "is-etc", `리바 → "${r.글}" (${r.종류})`);

  await p.click("#rec-undo");
  r = await 띠(p);
  확인(r.글 === `↩ 취소 ${a0} 공격 리바`, `되돌리기 → "${r.글}"`);

  await p.click("#rec-q"); await p.waitForTimeout(150);
  // 쿼터 확인 창이 있는 판이면 넘김 단추를 누른다(없는 판은 바로 넘어가 있다).
  const 넘김 = p.locator("#rec-qc-ok");
  if (await 넘김.count()) { await 넘김.click(); await p.waitForTimeout(150); }
  r = await 띠(p);
  확인(!r.있음, "쿼터 넘김은 띠를 안 띄움(위 쿼터 단추 글씨가 바뀜)");
  await ctx.close();
}

// ── 4) 320px 긴 글 · 명암비 ──
for (const theme of ["dark", "light"]) {
  const { p, ctx } = await 열기(320, 568, theme);
  const 이름 = await 선수들(p);
  const 벤치 = await p.evaluate(() => [...document.querySelectorAll(".rec-sub")].map((e) => e.dataset.in));
  await p.evaluate(() => { const d = document.querySelector(".rec-bench"); if (d) d.open = true; });
  await p.click(`.rec-sub[data-in="${벤치[0]}"]`); await p.click(`.rec-pchip[data-player="${이름[0]}"]`);
  const r = await p.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
    const d = document.getElementById("rec-confirm"), c = document.querySelector(".rec-court").getBoundingClientRect(), bb = d.getBoundingClientRect();
    const 바탕 = rgb(getComputedStyle(d).backgroundColor);
    return {
      글: d.textContent.replace(/\s+/g, " ").trim(),
      안: bb.left >= c.left && bb.right <= c.right,
      이름: cr(rgb(getComputedStyle(d.querySelector(".nm")).color), 바탕),
      무엇: cr(rgb(getComputedStyle(d.querySelector(".wh")).color), 바탕),
    };
  });
  확인(r.안, `320px ${theme} 교체 "${r.글}" — 코트 칸 안`);
  확인(r.이름 >= 4.5 && r.무엇 >= 4.5, `${theme} 띠 글씨 명암비 이름 ${r.이름} · 무엇 ${r.무엇}`);
  // 성공 · 실패 색도 잰다.
  for (const [sel, 말] of [["#rec-made", "성공"], ["#rec-miss", "실패"]]) {
    await p.click(`.rec-pchip[data-player="${이름[1]}"]`); await 코트(p, 250, 330); await p.click(sel);
    const c = await p.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
      const d = document.getElementById("rec-confirm");
      return cr(rgb(getComputedStyle(d.querySelector(".wh")).color), rgb(getComputedStyle(d).backgroundColor));
    });
    확인(c >= 4.5, `${theme} ${말} 글씨 명암비 ${c}`);
  }
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
