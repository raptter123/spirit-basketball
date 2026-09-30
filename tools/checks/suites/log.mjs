// 지난 경기 목록을 본다.
// 경기 셋(A 승 · B 승 · 무승부)을 실제로 기록해 쌓고, 목록이 맞게 나오는지 대조한다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const OUT = 폴더("shots");
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());
await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 골밑 = [250, 425];
const 좌표 = async (x, y) => {
  const r = await p.evaluate(() => {
    const s2 = document.querySelector("#rec-court-svg");
    const b = s2.getBoundingClientRect();
    const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
    return { l: b.left, t: b.top, w: b.width, h: b.height, vx, vy, vw, vh };
  });
  await p.mouse.click(r.l + ((x - r.vx) / r.vw) * r.w, r.t + ((y - r.vy) / r.vh) * r.h);
  await p.waitForTimeout(110);
};
const 선수 = (n) => p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(110));

/** 한 경기를 기록한다. 득점 = [A팀이 넣을 2점슛 수, B팀이 넣을 수] */
async function 한경기(득점) {
  const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
  for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.click("#rec-start");
  await p.waitForTimeout(500);
  const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
  const 팀 = [코트.slice(0, 5), 코트.slice(5)];
  for (const t of [0, 1]) {
    for (let i = 0; i < 득점[t]; i++) {
      // 득점자를 갈라 놓아야 "최다 득점자" 가 누구인지 손으로 셀 수 있다
      const 누구 = 팀[t][i === 0 ? 0 : 1];
      await 좌표(...골밑); await 선수(누구); await p.click("#rec-made"); await p.waitForTimeout(130);
    }
  }
  await p.click("#rec-finish");
  await p.waitForTimeout(400);
  const 이름들 = { A: 팀[0], B: 팀[1] };
  await p.click("#rec-new");
  await p.waitForTimeout(500);
  return 이름들;
}

// A 크게 승 · B 승 · 무승부
const g1 = await 한경기([4, 1]);   // A 8 : 2 B
const g2 = await 한경기([1, 3]);   // A 2 : 6 B
const g3 = await 한경기([2, 2]);   // A 4 : 4 B

const 목록 = await p.evaluate(() => [...document.querySelectorAll(".rec-arch-row")].map((r) => ({
  날짜: r.querySelector(".rec-arch-when").textContent.trim(),
  점수: [...r.querySelectorAll(".rec-arch-side")].map((s) => ({
    이름: s.querySelector(".nm").textContent.trim(),
    점: s.querySelector("b").textContent.trim(),
    이김: s.classList.contains("win"),
  })),
  아래: r.querySelector(".rec-arch-sub").textContent.replace(/\s+/g, " ").trim(),
  배지: r.querySelector(".rec-arch-badge").textContent.trim(),
  버튼: [...r.querySelectorAll(".rec-arch-btns button")].map((x) => x.textContent.trim()),
})));
const 머리 = await p.evaluate(() => ({
  제목: document.querySelector(".rec-archive h2").textContent.trim(),
  안내: document.querySelector(".rec-archive .hint").textContent.replace(/\s+/g, " ").trim(),
}));

say(목록.length === 3, `경기 ${목록.length}개 쌓임`);
say(머리.제목 === "지난 경기 3개", `제목: ${머리.제목}`);
// 기록 수 = 4+1 + 1+3 + 2+2 = 13
say(머리.안내.includes("기록 13개"), `안내: ${머리.안내.slice(0, 40)}…`);

// 최근 경기가 맨 위에 와야 한다 (마지막에 넣은 무승부)
say(목록[0].배지 === "무", `맨 위가 가장 최근 경기 — 배지 "${목록[0].배지}"`);
say(목록[0].점수.map((s) => s.점).join(":") === "4:4", `맨 위 점수 ${목록[0].점수.map((s) => s.점).join(" : ")}`);
say(목록[0].점수.every((s) => !s.이김), `무승부는 어느 쪽도 win 아님`);

say(목록[1].배지 === "B팀 승" && 목록[1].점수.map((s) => s.점).join(":") === "2:6",
  `둘째 줄 ${목록[1].점수.map((s) => s.점).join(" : ")} → ${목록[1].배지}`);
say(목록[1].점수[1].이김 && !목록[1].점수[0].이김, `이긴 B팀 점수만 진하게 (win 표시)`);

say(목록[2].배지 === "A팀 승" && 목록[2].점수.map((s) => s.점).join(":") === "8:2",
  `셋째 줄 ${목록[2].점수.map((s) => s.점).join(" : ")} → ${목록[2].배지}`);
// 첫 경기는 A팀 첫 선수가 2점 하나, 둘째 선수가 셋 → 최다는 둘째 선수 6점
say(목록[2].아래.includes(`최다 ${g1.A[1]} 6점`), `최다 득점자: "${목록[2].아래}"`);
say(목록[2].아래.includes("1쿼터까지 · 기록 5개"), `쿼터·기록 수: "${목록[2].아래}"`);
say(목록.every((r) => r.버튼.join("/") === "열기/엑셀/지우기"), `줄마다 버튼 셋`);
say(/^\d+\/\d+ \([일월화수목금토]\)$/.test(목록[0].날짜), `날짜 형식 "${목록[0].날짜}"`);

// 좁은 화면에서 안 깨지나 · 누를 곳 크기
for (const w of [320, 390]) {
  await p.setViewportSize({ width: w, height: 900 });
  await p.waitForTimeout(250);
  const m = await p.evaluate(() => {
    const rows = [...document.querySelectorAll(".rec-arch-row")];
    const 넘침 = rows.some((r) => r.scrollWidth > r.clientWidth + 1);
    const 작은버튼 = rows.flatMap((r) => [...r.querySelectorAll("button")])
      .filter((el) => el.getBoundingClientRect().height < 44).length;
    const 겹침 = rows.some((r) => {
      const a = r.querySelector(".rec-arch-mid").getBoundingClientRect();
      const bd = r.querySelector(".rec-arch-badge").getBoundingClientRect();
      return a.right > bd.left + 0.5;
    });
    return {
      가로: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      넘침, 작은버튼, 겹침, 높이: Math.round(rows[0].getBoundingClientRect().height),
    };
  });
  say(!m.가로 && !m.넘침 && !m.겹침 && m.작은버튼 === 0,
    `${w}px — 줄 높이 ${m.높이}px · 가로넘침 ${m.가로 ? "있음" : "없음"} · 겹침 ${m.겹침 ? "있음" : "없음"} · 44px 미만 버튼 ${m.작은버튼}개`);
}

await p.setViewportSize({ width: 390, height: 900 });
await p.waitForTimeout(200);
await p.locator(".rec-archive").screenshot({ path: `${OUT}/log.png` });

// 지우기가 그 줄만 지우나
await p.evaluate(() => document.querySelectorAll("[data-arch-del]")[1].click());
await p.waitForTimeout(500);
const 남은 = await p.evaluate(() => [...document.querySelectorAll(".rec-arch-row")]
  .map((r) => r.querySelector(".rec-arch-badge").textContent.trim()));
say(남은.join("/") === "무/A팀 승", `가운데 줄만 지워짐 — 남은 것 ${남은.join(", ")}`);

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
