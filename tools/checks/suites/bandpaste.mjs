// 팀 편성 — 밴드 참불 글을 붙여 넣으면 로스터 이름을 참석으로 골라 주는가.
//
// 밴드에서 복사한 글은 모양이 제각각이라(출석체크 화면 · 댓글 · 쉼표 목록) 세 모양을
// 다 넣어 본다. 로스터에 없는 이름은 바로 넣지 않고 게스트 후보로만 보여야 한다.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.goto(`${URL}/index.html#/team-shuffle`); await p.waitForTimeout(700);

// ── 읽는 쪽(js/band-paste.js) ──
const 읽기 = await p.evaluate(async () => {
  const { 참석명단읽기 } = await import("./js/band-paste.js");
  const { ROSTER } = await import("./js/roster.js");
  const 이름들 = ROSTER.map((x) => x.name);
  const 글 = {
    출석체크: "출석체크\n참석 5\n김산\n조우진\n심인보\n황규철님\n이철수\n불참 2\n유우진\n박윤호\n미정 1\n김준석",
    댓글: "1. 김산 참\n2. 조우진(92) 참석!\n3. 김산책하고 옴\n4. 박윤호 불참이요\n5. 홍길동 참석합니다\n오늘 게스트 한명 데려가요",
    쉼표: "참석: 김산, 조우진, 수잔, 신윤호, 윤호",
    번복: "김산 불참\n김산 다시 참석으로 바꿀게요",
    빈글: "",
  };
  return Object.fromEntries(Object.entries(글).map(([k, v]) => [k, 참석명단읽기(v, 이름들)]));
});
const 같음 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const 적기 = (r) => `참석 [${r.찾음.join(", ")}] · 뺌 [${r.뺌.join(", ")}] · 모름 [${r.모름.join(", ")}]`;
확인(같음(읽기.출석체크, { 찾음: ["김산", "조우진", "심인보", "황규철"], 뺌: ["유우진", "박윤호", "김준석"], 모름: ["이철수"] }),
  `출석체크 모양 — ${적기(읽기.출석체크)}`);
확인(같음(읽기.댓글, { 찾음: ["김산", "조우진"], 뺌: ["박윤호"], 모름: ["홍길동"] }),
  `댓글 모양("김산책" 은 김산이 아님, "불참이요" 줄은 뺌) — ${적기(읽기.댓글)}`);
확인(같음(읽기.쉼표, { 찾음: ["김산", "조우진", "수잔", "신윤호"], 뺌: [], 모름: ["윤호"] }),
  `쉼표 목록(신윤호 안의 "윤호" 는 한 번만, 따로 적힌 "윤호" 는 후보) — ${적기(읽기.쉼표)}`);
확인(같음(읽기.번복, { 찾음: ["김산"], 뺌: [], 모름: [] }), `불참했다가 참석으로 번복 — 참석으로 둠 — ${적기(읽기.번복)}`);
확인(같음(읽기.빈글, { 찾음: [], 뺌: [], 모름: [] }), "빈 글 — 아무것도 안 고름");

// ── 화면 ──
await p.click("#ts-paste-toggle");
const 칸 = await p.evaluate(() => {
  const t = document.querySelector("#ts-paste-text");
  const 누름 = ["#ts-paste-toggle", "#ts-paste-read", "#ts-paste-close"].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().height));
  return { 글씨: getComputedStyle(t).fontSize, 라벨: !!document.querySelector('label[for="ts-paste-text"]'), 누름,
    펼침: document.querySelector("#ts-paste-toggle").getAttribute("aria-expanded") };
});
확인(칸.글씨 === "16px" && 칸.라벨 && 칸.누름.every((h) => h >= 44) && 칸.펼침 === "true",
  `붙여넣기 칸 — 글씨 ${칸.글씨}(아이폰 확대 방지 16px) · 라벨 ${칸.라벨 ? "있음" : "없음"} · 단추 높이 ${칸.누름.join("/")}px · aria-expanded ${칸.펼침}`);

await p.fill("#ts-paste-text", "출석체크\n참석 5\n김산\n조우진\n심인보\n황규철님\n이철수\n불참 2\n유우진\n박윤호");
await p.click("#ts-paste-read"); await p.waitForTimeout(300);
const 고른뒤 = await p.evaluate(() => ({
  제목: document.querySelector(".section-title").textContent.trim(),
  체크: [...document.querySelectorAll(".ts-roster-grid input[data-name]:checked")].map((i) => i.dataset.name),
  후보: [...document.querySelectorAll("[data-paste-guest]")].map((i) => i.dataset.pasteGuest),
  글남음: document.querySelector("#ts-paste-text").value.includes("황규철님"),
}));
확인(고른뒤.제목 === "참석자 선택 (4명)" && 같음(고른뒤.체크.sort(), ["김산", "심인보", "조우진", "황규철"].sort()) && 같음(고른뒤.후보, ["이철수"]) && 고른뒤.글남음,
  `명단 읽기 → "${고른뒤.제목}" · 체크 ${고른뒤.체크.join(", ")} · 게스트 후보 ${고른뒤.후보.join(", ")} · 붙인 글 그대로 남음`);

await p.click('label:has([data-paste-guest="이철수"])'); await p.waitForTimeout(200);
await p.click("#ts-paste-guests"); await p.waitForTimeout(300);
const 게스트뒤 = await p.evaluate(() => ({
  제목: document.querySelector(".section-title").textContent.trim(),
  게스트: [...document.querySelectorAll(".ts-guest-input")].map((i) => i.value),
  초안: JSON.parse(localStorage.getItem("spirit-team-builder-draft")).selected,
}));
확인(게스트뒤.제목 === "참석자 선택 (5명)" && 같음(게스트뒤.게스트, ["이철수"]) && 게스트뒤.초안.every((n) => typeof n === "string") && 게스트뒤.초안.includes("이철수"),
  `게스트로 넣기 → "${게스트뒤.제목}" · 게스트 ${게스트뒤.게스트.join(", ")} · 저장된 참석자 ${게스트뒤.초안.length}명 전부 이름`);

// 같은 글을 한 번 더 읽어도 겹치지 않는다
await p.click("#ts-paste-read"); await p.waitForTimeout(300);
const 두번 = await p.evaluate(() => ({ 제목: document.querySelector(".section-title").textContent.trim(), 결과: document.querySelector(".ts-paste-result").innerText }));
// 이번에는 게스트 이철수도 이름 목록에 있으므로 다섯이 다 "이미 골라 둔" 사람이다.
확인(두번.제목 === "참석자 선택 (5명)" && 두번.결과.includes("이미 골라 둔 5명 포함"), `한 번 더 읽기 → "${두번.제목}" · "${두번.결과.split("\n")[0]}"`);

await p.click("#ts-paste-close"); await p.waitForTimeout(200);
const 닫음 = await p.evaluate(() => ({ 칸: !!document.querySelector("#ts-paste"), 제목: document.querySelector(".section-title").textContent.trim() }));
확인(!닫음.칸 && 닫음.제목 === "참석자 선택 (5명)", `닫기 → 칸 ${닫음.칸 ? "남음" : "사라짐"} · 고른 사람은 그대로 "${닫음.제목}"`);

// 원래 참석자 칩은 그대로 된다
await p.click('label:has(input[data-name="고성익"])'); await p.waitForTimeout(200);
const 칩 = await p.evaluate(() => document.querySelector(".section-title").textContent.trim());
확인(칩 === "참석자 선택 (6명)", `로스터 칩 눌러 고르기 → "${칩}"`);

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
