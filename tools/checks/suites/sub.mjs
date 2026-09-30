// 교체와 그 되돌리기만 따로 본다. 벤치가 있어야 하므로 12명(6 vs 6)으로 시작한다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => d.accept());
await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 12)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
  await p.waitForTimeout(40);
}
await p.click("#rec-start");
await p.waitForTimeout(600);

const 코트 = () => p.evaluate(() => ({
  선수: [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player),
  수: Number(document.querySelector(".rec-n b").textContent),
  최근: document.querySelector(".rec-last").innerText.replace(/\n/g, " / "),
}));
const c0 = await 코트();
say(c0.선수.length === 10, `코트 위 ${c0.선수.length}명 (벤치 2명)`);

// 벤치를 펼치고 A팀 벤치 한 명을 넣는다 → 뺄 사람을 고른다
await p.evaluate(() => document.querySelector(".rec-bench").open = true);
await p.waitForTimeout(150);
const 넣을사람 = await p.evaluate(() => document.querySelector('.rec-sub[data-team="0"]').dataset.in);
await p.evaluate(() => document.querySelector('.rec-sub[data-team="0"]').click());
await p.waitForTimeout(200);
const 뺄사람 = c0.선수[0];
await p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), 뺄사람);
await p.waitForTimeout(250);
const c1 = await 코트();
say(c1.선수.includes(넣을사람) && !c1.선수.includes(뺄사람), `교체: ${뺄사람} → ${넣을사람}`);
say(c1.수 === c0.수, `교체는 기록 수에 안 들어감 — ${c0.수} → ${c1.수}`);
say(c1.최근.includes(넣을사람) && c1.최근.includes(뺄사람), `기록줄: ${c1.최근}`);

// 되돌리면 코트 명단도 같이 돌아와야 한다
await p.click("#rec-undo");
await p.waitForTimeout(250);
const c2 = await 코트();
say(c2.선수.includes(뺄사람) && !c2.선수.includes(넣을사람), `되돌리니 코트가 원래대로 — ${뺄사람} 복귀`);
say(c2.선수.length === 10, `코트 위 ${c2.선수.length}명 유지`);

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
