// 기록하는 동안 화면이 꺼지지 않게 — 언제 부탁하고 언제 놓는가(js/wakelock.js).
//
// 시험 브라우저로는 폰의 자동 잠금을 흉내 낼 수 없다. 그래서 브라우저의 wakeLock 을 가짜로
// 바꿔 끼워 "부탁 · 놓기" 횟수를 센다. 실제로 화면이 안 꺼지는지는 폰으로 확인한다.
//
// 1) 홈 · 기록 설정 화면에서는 부탁하지 않음.
// 2) 경기 기록 화면에 들어가면 부탁 1번. 기록을 적어도(다시 그려도) 더 부탁하지 않음.
// 3) 다른 앱에 갔다 오면(가려짐 → 보임) 브라우저가 놓은 것을 다시 부탁.
// 4) 결과 화면 · 홈으로 나가면 놓음. 나간 뒤 보임이 돼도 다시 부탁하지 않음.
// 5) 지원 안 하는 브라우저 · 거절당할 때도 오류 없이 기록됨.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

// 가짜 wakeLock. 가려지면 브라우저처럼 잡고 있던 것을 놓는다.
const 가짜 = (모드) => {
  window.__wl = { req: 0, rel: 0, 잡음: 0 };
  window.__vis = "visible";
  Object.defineProperty(document, "visibilityState", { get: () => window.__vis, configurable: true });
  if (모드 === "없음") { try { delete Navigator.prototype.wakeLock; } catch (e) { /* */ } return; }
  class 센티넬 extends EventTarget {
    constructor() { super(); this.released = false; }
    async release() {
      if (this.released) return;
      this.released = true; window.__wl.rel++; window.__wl.잡음--;
      this.dispatchEvent(new Event("release"));
    }
  }
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: {
      request: async () => {
        if (모드 === "거절") throw new DOMException("배터리 절약", "NotAllowedError");
        window.__wl.req++; window.__wl.잡음++;
        const s = new 센티넬(); window.__wl.last = s; return s;
      },
    },
  });
  window.__가리기 = () => { window.__vis = "hidden"; window.__wl.last?.release(); document.dispatchEvent(new Event("visibilitychange")); };
  window.__보이기 = () => { window.__vis = "visible"; document.dispatchEvent(new Event("visibilitychange")); };
};

async function 열기(모드 = "있음") {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(가짜, 모드);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${모드}: ${e.message}`));
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(300);
  await p.evaluate(async () => {
    const { ROSTER } = await import("./js/roster.js");
    const sel = ROSTER.slice(0, 10).map((x) => x.name);
    const asg = {}; sel.forEach((n, i) => (asg[n] = i % 2));
    localStorage.setItem("spirit-team-builder-draft", JSON.stringify({ teamCount: 2, gameDate: "2026-10-18", selected: sel, assignments: asg }));
  });
  return { p, ctx };
}
const 셈 = (p) => p.evaluate(() => ({ ...window.__wl, last: undefined }));
const 쉼 = (p, ms = 150) => p.waitForTimeout(ms);
const 슛 = async (p) => {
  await p.click(".rec-pchip");
  const r = await p.evaluate(() => { const b = document.getElementById("rec-court-svg").getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height * 0.6]; });
  await p.mouse.click(...r); await p.click("#rec-made"); await 쉼(p);
};

{
  const { p, ctx } = await 열기();
  let c = await 셈(p);
  확인(c.req === 0, `홈 화면에서는 부탁 안 함 (부탁 ${c.req})`);

  await p.goto(`${URL}/index.html?s=${Math.random()}#/record`); await 쉼(p, 500);
  c = await 셈(p);
  확인(c.req === 0, `기록 설정 화면(경기 전)에서도 부탁 안 함 (부탁 ${c.req})`);

  await p.click("#rec-use-draft"); await 쉼(p, 400);
  c = await 셈(p);
  확인(c.req === 1 && c.잡음 === 1, `경기 기록 화면에 들어가면 부탁 1번 (부탁 ${c.req} · 잡고 있음 ${c.잡음})`);

  await 슛(p); await 슛(p); await p.click("#rec-undo"); await 쉼(p);
  c = await 셈(p);
  확인(c.req === 1 && c.잡음 === 1, `기록을 적고 되돌려도(다시 그려도) 더 부탁하지 않음 (부탁 ${c.req})`);

  await p.evaluate(() => window.__가리기()); await 쉼(p);
  c = await 셈(p);
  확인(c.잡음 === 0, "다른 앱으로 가면(가려짐) 브라우저가 놓음");
  await p.evaluate(() => window.__보이기()); await 쉼(p);
  c = await 셈(p);
  확인(c.req === 2 && c.잡음 === 1, `돌아오면(보임) 다시 부탁 (부탁 ${c.req} · 잡고 있음 ${c.잡음})`);

  await p.click("#rec-finish"); await 쉼(p, 400);
  c = await 셈(p);
  확인(c.잡음 === 0 && c.rel >= 2, `결과 화면으로 가면 놓음 (놓기 ${c.rel} · 잡고 있음 ${c.잡음})`);
  await p.evaluate(() => { window.__가리기(); window.__보이기(); }); await 쉼(p);
  c = await 셈(p);
  확인(c.req === 2, `결과 화면에서는 다시 보여도 부탁 안 함 (부탁 ${c.req})`);

  // 결과 화면에서 기록 화면으로 돌아가면 다시 부탁, 홈으로 나가면 놓음
  await p.click("#rec-back"); await 쉼(p, 400);
  c = await 셈(p);
  확인(c.잡음 === 1, `결과 화면에서 '계속 기록하기' 로 돌아가면 다시 부탁 (잡고 있음 ${c.잡음})`);
  await p.goto(`${URL}/index.html#/`); await 쉼(p, 400);
  c = await 셈(p);
  확인(c.잡음 === 0, `홈으로 나가면 놓음 (잡고 있음 ${c.잡음})`);
  await ctx.close();
}

// 기록 화면에서 바로 홈으로(✕) 나가는 길
{
  const { p, ctx } = await 열기();
  await p.goto(`${URL}/index.html?s=${Math.random()}#/record`); await 쉼(p, 500);
  await p.click("#rec-use-draft"); await 쉼(p, 400);
  await p.click(".rec-exit"); await 쉼(p, 400);
  const c = await 셈(p);
  확인(c.req === 1 && c.잡음 === 0, `기록 화면 ✕ 로 홈에 가면 놓음 (부탁 ${c.req} · 잡고 있음 ${c.잡음})`);
  await p.evaluate(() => { window.__가리기(); window.__보이기(); }); await 쉼(p);
  확인((await 셈(p)).req === 1, "홈에서는 다시 보여도 부탁 안 함");
  await ctx.close();
}

// 지원 안 함 · 거절
for (const 모드 of ["없음", "거절"]) {
  const { p, ctx } = await 열기(모드);
  await p.goto(`${URL}/index.html?s=${Math.random()}#/record`); await 쉼(p, 500);
  await p.click("#rec-use-draft"); await 쉼(p, 400);
  await 슛(p);
  const n = await p.evaluate(() => document.querySelector(".rec-n b").textContent.trim());
  확인(n === "1", `wakeLock ${모드 === "없음" ? "없는 브라우저" : "거절당함"} — 기록은 그대로 됨 (기록 ${n}개)`);
  await ctx.close();
}

// 진짜 브라우저(시험용 크로미움)에 기능이 있는지는 참고로만 적는다.
{
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto(`${URL}/index.html#/`);
  const 있음 = await p.evaluate(() => "wakeLock" in navigator);
  console.log(`ℹ️ 시험용 크로미움의 navigator.wakeLock: ${있음 ? "있음" : "없음"}`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
