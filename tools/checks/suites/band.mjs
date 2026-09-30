// 밴드용 글을 실제 기록에서 뽑아 눈으로 본다. 그리고 복사 버튼이 되는지 확인한다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());
await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 10)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
await p.click("#rec-start"); await p.waitForTimeout(500);
const 코트 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
const A = 코트.slice(0, 5), B = 코트.slice(5);
const box = await p.evaluate(() => { const s2 = document.querySelector("#rec-court-svg"); const r = s2.getBoundingClientRect(); const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number); return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh }; });
const 탭 = async (x, y) => { await p.mouse.click(box.l + ((x - box.vx) / box.vw) * box.w, box.t + ((y - box.vy) / box.vh) * box.h); await p.waitForTimeout(80); };
const 선수 = (n) => p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(80));
const 스팟 = (k) => p.evaluate((v) => document.querySelector(`[data-spot="${v}"]`).click(), k).then(() => p.waitForTimeout(80));

// 리바는 '리바' 를 누른 뒤 공격/수비를 고르고 선수를 누른다.
// (자동으로 가르던 판과 공격리바·수비리바 버튼을 따로 두던 판을 거쳐 여기로 돌아왔다.)
const 리바 = async (kind) => {
  await p.evaluate(() => document.querySelector('[data-spot="reb"]').click());
  await p.waitForTimeout(140);
  await p.click(kind === "rebO" ? "#rec-reb-o" : "#rec-reb-d");
  await p.waitForTimeout(140);
};

const 슛 = async (자리, who, made) => { await 탭(...자리); await 선수(who); await p.click(made ? "#rec-made" : "#rec-miss"); await p.waitForTimeout(100); };

const 골밑 = [250, 425], 미들 = [180, 330], 아크 = [150, 195], 코너 = [20, 440];
const rnd = (() => { let s = 7; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; })();

// 네 쿼터짜리 경기를 만든다 — 쿼터마다 슛 여러 개 + 리바 + 어시 + 턴오버
for (let q = 0; q < 4; q++) {
  for (let i = 0; i < 9; i++) {
    const t = i % 2, 팀 = t ? B : A;
    const who = 팀[Math.floor(rnd() * 5)];
    const r = rnd();
    const 자리 = r < 0.45 ? 골밑 : r < 0.7 ? 미들 : r < 0.88 ? 아크 : 코너;
    const made = rnd() < (t ? 0.38 : 0.52);
    await 슛(자리, who, made);
    if (!made) { await 리바("rebD"); await 선수((rnd() < 0.3 ? 팀 : (t ? A : B))[Math.floor(rnd() * 5)]); }
    else if (rnd() < 0.5) { await 스팟("ast"); await 선수(팀[Math.floor(rnd() * 5)]); }
    if (rnd() < 0.18) { await 스팟("to"); await 선수(팀[Math.floor(rnd() * 5)]); }
    if (rnd() < 0.12) { await 스팟("stl"); await 선수((t ? A : B)[Math.floor(rnd() * 5)]); }
    if (rnd() < 0.1) { await 스팟("ftm"); await 선수(팀[Math.floor(rnd() * 5)]); }
    if (rnd() < 0.08) { await 스팟("pf"); await 선수(팀[Math.floor(rnd() * 5)]); }
  }
  if (q < 3) { await p.click("#rec-q"); await p.waitForTimeout(150); }
}
await p.click("#rec-finish");
await p.waitForTimeout(700);

const 글 = await p.evaluate(() => document.querySelector("#rec-band-text").value);
console.log("\n──────── 밴드에 붙는 글 ────────");
console.log(글);
console.log("────────────────────────────────\n");
say(글.includes("■ 쿼터별"), "쿼터별 줄 있음");
say(글.includes("■ 팀 효율"), "팀 효율 줄 있음");
say(/자리 — (골밑|미들|3점)/.test(글), "자리별 슛(샷차트를 말로) 있음");
say(글.includes("■ 짚어볼 점"), "짚어볼 점 있음");
say(!/undefined|NaN|null/.test(글), "빈 값(undefined·NaN·null) 없음");
say(글.split("\n").length > 20, `${글.split("\n").length}줄`);
say(Math.max(...글.split("\n").map((l) => l.length)) <= 78, `가장 긴 줄 ${Math.max(...글.split("\n").map((l) => l.length))}자 (밴드에서 안 접히게 78자 이내)`);

// 복사 버튼 — 밴드 이미지가 주인공이 되면서 글 복사는 접힌 칸 안으로 들어갔다(PR #140).
// 접힌 채로는 못 누르므로 먼저 편다.
await p.evaluate(() => { const d = document.querySelector(".rec-band-more"); if (d) d.open = true; });
await p.waitForTimeout(200);
await p.click("#rec-band");
await p.waitForTimeout(400);
const 복사됨 = await p.evaluate(() => navigator.clipboard.readText());
say(복사됨 === 글, `클립보드에 그대로 들어감 (${복사됨.length}자)`);
say((await p.evaluate(() => document.querySelector("#rec-band").textContent.trim())).includes("복사됨"),
  "버튼이 '복사됨' 으로 바뀜");
const 크기 = await p.evaluate(() => {
  const btn = document.querySelector("#rec-band").getBoundingClientRect();
  const ta = document.querySelector("#rec-band-text").getBoundingClientRect();
  return { 버튼: Math.round(btn.height), 칸: Math.round(ta.height),
    가로: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 };
});
say(크기.버튼 >= 44 && !크기.가로, `버튼 ${크기.버튼}px · 글 칸 ${크기.칸}px · 페이지 가로넘침 ${크기.가로 ? "있음" : "없음"}`);

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
