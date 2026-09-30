// 공용 도구(js/util.js) — 글자 이스케이프 · 날짜 글이 한 벌만 있는가, 그리고 제대로 도는가.
//
// 1) 파일을 읽어 사본이 다시 생기지 않았나 본다. 전에는 이스케이프 6벌 · 날짜 글 6곳이
//    화면마다 따로 있었고, 조금씩 달랐다(null 을 "null" 로 찍는 것, ' 를 그대로 두는 것).
//    xlsx-lite.js 의 escXml 은 엑셀 XML 전용(되돌리는 unescXml 과 짝)이라 뺀다.
// 2) 브라우저에서 util.js 를 불러 값을 맞대 본다. 날짜는 서울 시각 새벽 0시 30분 —
//    toISOString(UTC) 으로 만들면 하루 전날이 나오는 시각이다.
// 3) 화면을 전부 한 번씩 열어 모듈을 못 불러오는 오류가 없나 본다.
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { URL, 저장소 } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };

// 1) 사본
const 사본틀 = [
  [/function\s+(esc|escapeHtml|escHtml)\s*\(/, "이스케이프 함수"],
  [/function\s+todayStr\s*\(/, "todayStr 함수"],
  [/padStart\(2, "0"\)\}-\$\{String\(/, "날짜 글 직접 조립"],
];
const 찾음 = [];
for (const f of fs.readdirSync(path.join(저장소, "js")).filter((f) => f.endsWith(".js") && f !== "util.js")) {
  fs.readFileSync(path.join(저장소, "js", f), "utf8").split("\n").forEach((줄, i) => {
    for (const [틀, 이름] of 사본틀) if (틀.test(줄)) 찾음.push(`js/${f}:${i + 1} ${이름}`);
  });
}
확인(찾음.length === 0, `util.js 밖의 사본 ${찾음.length}곳${찾음.length ? " — " + 찾음.join(", ") : ""}`);

// 2) 값
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul" });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await p.clock.install({ time: new Date("2026-09-30T00:30:00+09:00") });
await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(600);
const r = await p.evaluate(async () => {
  const u = await import("./js/util.js");
  return {
    null: u.escapeHtml(null), undef: u.escapeHtml(undefined), 숫자: u.escapeHtml(0),
    섞음: u.escapeHtml(`<b class="x">'&'</b>`),
    날짜: u.dateStr(new Date(2026, 0, 5)), 오늘: u.todayStr(),
  };
});
확인(r.null === "" && r.undef === "", `null · undefined → 빈 글 (${JSON.stringify(r.null)} · ${JSON.stringify(r.undef)})`);
확인(r.숫자 === "0", `0 → "0" (${JSON.stringify(r.숫자)}) — 0번 등번호가 사라지면 안 된다`);
const 기대 = "&lt;b class=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;";
확인(r.섞음 === 기대, `꺾쇠 · 따옴표 두 가지 · & → ${r.섞음}`);
확인(r.날짜 === "2026-01-05", `dateStr(2026년 1월 5일) → ${r.날짜}`);
확인(r.오늘 === "2026-09-30", `서울 9/30 새벽 0:30 의 todayStr → ${r.오늘} (UTC 로 만들면 2026-09-29)`);

// 3) 화면 전부
const 길들 = ["#/", "#/tactics", "#/new-tactic", "#/schedule", "#/roster", "#/glossary", "#/board",
  "#/team-shuffle", "#/stats", "#/record"];
const 빈화면 = [];
for (const 길 of 길들) {
  await p.goto(`${URL}/index.html?s=${Math.random()}${길}`); await p.waitForTimeout(500);
  const 글 = await p.evaluate(() => (document.querySelector("#app")?.innerText || "").trim().length);
  if (글 < 20) 빈화면.push(`${길}(${글}자)`);
}
확인(빈화면.length === 0, `화면 ${길들.length}개 열기 — 빈 화면 ${빈화면.length ? 빈화면.join(", ") : "없음"}`);
확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);

console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
