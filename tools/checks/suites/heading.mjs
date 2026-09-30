// 제목 단계 — 화면 낭독기로 제목만 훑을 때 h1 → h3 처럼 건너뛰는 곳이 없는가.
//
// 건너뛰면 낭독기는 "중간 단계가 빠졌다" 고 읽어서, 이 제목이 어디 딸린 것인지 헷갈린다.
// 새 전술(h1→h4) · 일정 · 팀 편성 · 기록(h1→h3) 네 화면이 그랬다. 태그만 바꾸고
// 생김새는 그대로 두었으므로, 글씨 크기도 같이 본다.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
// 기록 화면의 '지난 경기' 제목이 보이게 보관함에 경기 하나를 넣어 둔다.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("spirit-record-games", JSON.stringify([{
      date: "2026-09-27", quarters: 4, q: 4, events: [], startedAt: 1790000000000,
      teams: [{ name: "A팀", players: [] }, { name: "B팀", players: [] }],
    }]));
  } catch (e) { /* */ }
});
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));

const 길들 = ["#/", "#/tactics", "#/tactic/pick-and-roll", "#/new-tactic", "#/schedule", "#/roster",
  "#/glossary", "#/board", "#/team-shuffle", "#/stats", "#/record"];
const 크기 = {};
for (const 길 of 길들) {
  await p.goto(`${URL}/index.html?s=${Math.random()}${길}`); await p.waitForTimeout(600);
  if (길 === "#/team-shuffle") {
    // 참석자를 골라야 '팀 구성 미리보기' 아래 팀 카드 제목이 생긴다.
    for (let i = 0; i < 8; i++) await p.evaluate((k) => document.querySelectorAll("input[type=checkbox][data-name]")[k]?.click(), i);
    await p.waitForTimeout(300);
  }
  const r = await p.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3, main h4, main h5, main h6")]
    .filter((h) => h.getClientRects().length)
    .map((h) => ({ n: Number(h.tagName[1]), 글: h.textContent.trim().replace(/\s+/g, " ").slice(0, 16), px: getComputedStyle(h).fontSize })));
  const 건너뜀 = [];
  for (let i = 1; i < r.length; i++) if (r[i].n - r[i - 1].n > 1) 건너뜀.push(`h${r[i - 1].n}→h${r[i].n} "${r[i].글}"`);
  확인(건너뜀.length === 0 && r[0]?.n === 1,
    `${길.padEnd(24)} ${r.map((x) => x.n).join("")}${건너뜀.length ? " — 건너뜀 " + 건너뜀.join(", ") : ""}`);
  for (const x of r) 크기[x.글] = x.px;
}

// 태그를 바꾼 제목들이 전과 같은 크기인가 (전: h3 · h4 였을 때 잰 값).
const 전 = { "공 소유 타이밍": "16px", "2026-09-30 일정": null, "다가오는 일정": "18px", "참석자 선택 (8명)": "16px",
  "팀 배정": "16px", "팀 구성 미리보기": "16px", "직접 고르기": "18px", "지난 경기 1개": "18.72px" };
for (const [글, px] of Object.entries(전)) {
  if (px === null) continue;
  확인(크기[글] === px, `"${글}" 글씨 ${크기[글]} (전 ${px})`);
}
const 팀카드 = Object.entries(크기).filter(([글]) => /^[A-C]팀 \(\d+명\)$/.test(글));
확인(팀카드.length > 0 && 팀카드.every(([, px]) => px === "16px"), `팀 카드 제목 ${팀카드.length}개 글씨 ${[...new Set(팀카드.map(([, px]) => px))].join()} (전 16px)`);
확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);

console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
