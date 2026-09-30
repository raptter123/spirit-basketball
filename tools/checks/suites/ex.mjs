// 교류전(1팀) 기록을 확인한다.
//   우리 팀은 선수별로. 상대는 경기 중에는 아무것도 안 적고, 결과 화면에서 최종 점수 하나만 적는다.
//   숫자는 이벤트 원본에서 따로 센 값과 맞댄다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dlex");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const bad = []; const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());
await p.clock.install({ time: new Date("2026-09-27T14:00:00") });

await p.goto(`${URL}/index.html#/record`);
await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } });
await p.goto(`${URL}/index.html?ex=1#/record`);
await p.waitForTimeout(900);

const 점수판 = () => p.evaluate(() => document.querySelector(".rec-score").innerText.replace(/\s+/g, " ").replace(/\s*:\s*/, " : ").trim());

// ── 설정 ──────────────────────────────────────────────────
const 버튼들 = await p.evaluate(() => [...document.querySelectorAll(".rec-nbtn")].map((x) => x.textContent.trim()));
say(버튼들.join(" / ") === "1팀 · 교류전 / 2팀 / 3팀", `팀 수 버튼: ${버튼들.join(" / ")}`);
say(await p.evaluate(() => document.querySelector("#rec-opp-field").hidden), "2팀일 때는 상대 이름 칸이 숨어 있음");
await p.click('.rec-nbtn[data-n="1"]'); await p.waitForTimeout(200);
const 설정 = await p.evaluate(() => ({
  이름칸: !document.querySelector("#rec-opp-field").hidden,
  칸: document.querySelectorAll(".rec-pick-col").length,
  칸이름: document.querySelector(".rec-pick-col b").textContent.trim(),
  안내: document.querySelector("#rec-nteam-say").textContent.trim(),
  시작: document.querySelector("#rec-start").textContent.trim(),
}));
say(설정.이름칸 && 설정.칸 === 1 && 설정.칸이름 === "혼", `1팀: 상대 이름 칸 · 팀 칸 ${설정.칸}개 "${설정.칸이름}" — "${설정.안내}"`);
say(설정.안내.includes("최종 점수만"), "설정 안내에 '최종 점수만' 이라고 적힘");
say(설정.시작 === "뛸 사람을 골라 주세요", `아무도 안 골랐을 때 — "${설정.시작}"`);
const 로스터 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 로스터.slice(0, 8)) await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
await p.fill("#rec-opp-name", "불사조");
say((await p.evaluate(() => document.querySelector("#rec-start").textContent.trim())) === "경기 시작 (8명)", "여덟 명 → 경기 시작 (8명)");
await p.click("#rec-start"); await p.waitForTimeout(600);

// ── 기록 화면: 상대 줄 없음 ───────────────────────────────
const 라이브 = await p.evaluate(() => ({
  줄: [...document.querySelectorAll(".rec-team-row")].map((r) => r.querySelector(".rec-team-tag").textContent.trim()),
  칩: document.querySelectorAll(".rec-pchip").length,
  상대버튼: document.querySelectorAll("[data-opp]").length,
  벤치: document.querySelector(".rec-bench summary")?.textContent.trim(),
  끝: Math.round(Math.max(...[...document.querySelectorAll("main *")].map((e) => e.getBoundingClientRect().bottom + scrollY))),
  가로: document.documentElement.scrollWidth > innerWidth,
}));
say(라이브.줄.join() === "혼" && 라이브.칩 === 5, `팀 줄은 "혼" 하나 · 코트 ${라이브.칩}명`);
say(라이브.상대버튼 === 0, "상대 +1/+2/+3 버튼 없음");
say(/벤치 3명/.test(라이브.벤치 || ""), `벤치 — "${라이브.벤치}"`);
say((await 점수판()) === "혼 0 : – 불사조", `점수판 — "${await 점수판()}" (상대는 아직 모름)`);
say(라이브.끝 <= 844 && !라이브.가로, `한 화면 (내용 끝 ${라이브.끝}px / 844)`);

const 코트 = await p.evaluate(() => {
  const s = document.querySelector("#rec-court-svg"); const r = s.getBoundingClientRect();
  const [vx, vy, vw, vh] = s.getAttribute("viewBox").split(" ").map(Number);
  return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
});
const 탭 = async (x, y) => { await p.mouse.click(코트.l + ((x - 코트.vx) / 코트.vw) * 코트.w, 코트.t + ((y - 코트.vy) / 코트.vh) * 코트.h); await p.waitForTimeout(60); };
const 선수탭 = (n) => p.evaluate((v) => document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`)?.click(), n).then(() => p.waitForTimeout(60));
const 코트선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));

// 1쿼터: 2점 성공 · 3점 실패 → 공격리바 · 자유투○ = 3점
await 탭(250, 430); await 선수탭(코트선수[0]); await p.click("#rec-made"); await p.waitForTimeout(60);
await 탭(60, 250); await 선수탭(코트선수[1]); await p.click("#rec-miss"); await p.waitForTimeout(60);
await p.evaluate(() => document.querySelector('[data-spot="reb"]').click()); await p.waitForTimeout(50);
await p.click("#rec-reb-o"); await p.waitForTimeout(50); await 선수탭(코트선수[2]);
await p.evaluate(() => document.querySelector('[data-spot="ftm"]').click()); await 선수탭(코트선수[2]);
// 2쿼터: 3점 성공
await p.click("#rec-q"); await p.waitForTimeout(120);
await 탭(440, 250); await 선수탭(코트선수[3]); await p.click("#rec-made"); await p.waitForTimeout(60);
say((await 점수판()) === "혼 6 : – 불사조", `기록 뒤 점수판 — "${await 점수판()}"`);

// ── 결과 화면: 상대 점수를 적기 전 ────────────────────────
await p.click("#rec-finish"); await p.waitForTimeout(800);
const 전 = await p.evaluate(async () => {
  const S = await import("./js/record-stats.js"); const st = await import("./js/storage.js");
  const g = st.getRecordSession().games[0];
  return {
    제목: document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim(),
    칸: !!document.querySelector("#rec-opp-final"), 칸값: document.querySelector("#rec-opp-final")?.value,
    칸이름: document.querySelector(".rec-oppfinal .rec-opp-field span")?.textContent.trim(),
    안내: document.querySelector(".rec-oppfinal .hint")?.textContent.trim(),
    플마: [...document.querySelectorAll(".rec-bs tbody tr")].map((tr) => tr.lastElementChild.textContent.trim()),
    효율안내: document.querySelector(".rec-ex-note")?.textContent.replace(/\s+/g, " ").trim(),
    승패: S.승패(g, 0), 첫줄: S.밴드글(g).split("\n")[0],
  };
});
say(전.제목 === "혼 6 : – 불사조", `결과 제목 — "${전.제목}"`);
say(전.칸 && 전.칸값 === "" && 전.칸이름 === "불사조 최종 점수", `상대 최종 점수 칸 — "${전.칸이름}" (빈 칸)`);
say(전.안내.startsWith("상대 점수를 적어 주세요"), `적기 전 안내 — "${전.안내.slice(0, 30)}…"`);
say(전.플마.length === 8 && 전.플마.every((v) => v === "–"), `+/- 칸 8명 모두 "–" (${[...new Set(전.플마)].join()})`);
say(/팀 효율\(ORtg·DRtg\)과 \+\/- 는 안 나와요/.test(전.효율안내 || ""), "효율·+/- 가 왜 안 나오는지 안내");
say(전.승패 === "" && 전.첫줄 === "[2026-09-27] 혼 6 : – 불사조", `적기 전 승패 "${전.승패}" · 밴드 글 "${전.첫줄}"`);

// ── 상대 점수 10 을 적는다 ────────────────────────────────
await p.fill("#rec-opp-final", "10");
await p.press("#rec-opp-final", "Enter"); await p.waitForTimeout(400);
const 후 = await p.evaluate(async () => {
  const S = await import("./js/record-stats.js"); const st = await import("./js/storage.js"); const R = await import("./js/record.js");
  const g = st.getRecordSession().games[0];
  const 손 = [0, 0]; const 쿼터 = {};
  for (const e of g.events) {
    const 점 = e.type === "shot" ? (e.made ? e.pts : 0) : e.type === "ftm" ? 1 : 0;
    손[e.team] += 점; (쿼터[e.q] ||= [0, 0])[e.team] += 점;
  }
  const T = S.팀지표(g);
  const 글 = S.밴드글(g);
  return {
    제목: document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim(),
    칸값: document.querySelector("#rec-opp-final").value,
    안내: document.querySelector(".rec-oppfinal .hint").textContent.trim(),
    저장: g.teams[1].final, 보관: st.getRecordArchive()[0].teams[1].final,
    점수: R.경기점수(g), 손, 쿼터, 승패: [S.승패(g, 0), S.승패(g, 1)],
    T: { a: T[0].pts, b: T[1].pts, orb: T[0].orbPct, 넉넉: T[0].넉넉 },
    첫줄: 글.split("\n")[0], 쿼터줄: 글.split("\n").filter((l) => /^(혼|불사조)  /.test(l)),
    리바차: /리바운드 \d+개 차/.test(글), 상대블록: 글.includes("■ 불사조"),
    대진: S.대진표시(g), 상대이벤트: g.events.filter((e) => e.type === "opp").length,
  };
});
say(후.제목 === "혼 6 : 10 불사조" && 후.칸값 === "10", `적은 뒤 제목 — "${후.제목}"`);
say(후.저장 === 10 && 후.보관 === 10, `세션 · 보관함 둘 다 final=10 (${후.저장}, ${후.보관})`);
say(후.안내.startsWith("적어 둔 점수로"), `적은 뒤 안내 — "${후.안내.slice(0, 20)}…"`);
say(후.점수.join(":") === "6:10" && 후.손[0] === 6 && 후.손[1] === 0, `경기점수 ${후.점수.join(":")} — 우리 6 은 이벤트에서 따로 센 값과 같음, 상대 이벤트 ${후.상대이벤트}개`);
say(JSON.stringify(후.쿼터) === JSON.stringify({ 1: [3, 0], 2: [3, 0] }), `우리 쿼터별 ${JSON.stringify(후.쿼터)}`);
say(후.승패.join() === "패,승", `승패 혼 ${후.승패[0]} · 불사조 ${후.승패[1]}`);
say(후.T.a === 6 && 후.T.b === 10 && 후.T.orb === null && !후.T.넉넉, `팀지표 6 · 10, 공격리바% 비움, ORtg 안 냄`);
say(후.첫줄 === "[2026-09-27] 혼 6 : 10 불사조 — 불사조 승", `밴드 글 — "${후.첫줄}"`);
say(후.쿼터줄.length === 1 && 후.쿼터줄[0].startsWith("혼  3 / 3"), `밴드 글 쿼터별은 우리 팀만 — ${JSON.stringify(후.쿼터줄)}`);
say(!후.리바차 && !후.상대블록, "밴드 글에 리바운드 차 · '■ 불사조' 블록 없음");
say(후.대진 === "EX1", `파일 표시 ${후.대진}`);

// 고치기 · 지우기
await p.fill("#rec-opp-final", "5"); await p.press("#rec-opp-final", "Enter"); await p.waitForTimeout(300);
const 고침 = await p.evaluate(() => document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim());
await p.fill("#rec-opp-final", ""); await p.press("#rec-opp-final", "Enter"); await p.waitForTimeout(300);
const 지움 = await p.evaluate(async () => {
  const st = await import("./js/storage.js"); const g = st.getRecordSession().games[0];
  return { 제목: document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim(), 있음: "final" in g.teams[1] };
});
say(고침 === "혼 6 : 5 불사조" && 지움.제목 === "혼 6 : – 불사조" && !지움.있음, `5 로 고치면 "${고침}", 비우면 "${지움.제목}"`);
await p.fill("#rec-opp-final", "-3"); await p.press("#rec-opp-final", "Enter"); await p.waitForTimeout(300);
say((await p.evaluate(() => document.querySelector(".rec-final").innerText.replace(/\s+/g, " ").trim())) === "혼 6 : – 불사조", "음수는 안 받음");
await p.fill("#rec-opp-final", "10"); await p.press("#rec-opp-final", "Enter"); await p.waitForTimeout(300);

// 새로고침해도 남나
await p.reload(); await p.waitForTimeout(900);
say((await 점수판()) === "혼 6 : 10 불사조", `새로고침 뒤 기록 화면 점수판 — "${await 점수판()}"`);
await p.click("#rec-finish"); await p.waitForTimeout(700);

// ── 엑셀 · 밴드 이미지 ────────────────────────────────────
const [x1] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.click("#rec-xlsx")]);
await x1.saveAs(`${DL}/${x1.suggestedFilename()}`);
const [g1] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.click("#rec-band-img")]);
await g1.saveAs(`${DL}/${g1.suggestedFilename()}`);
say(x1.suggestedFilename() === "spirit-game-2026-09-27-1400-EX1.xlsx" && g1.suggestedFilename() === "spirit-result-2026-09-27-1400-EX1.png",
  `파일 ${x1.suggestedFilename()} · ${g1.suggestedFilename()}`);
const 엑셀 = JSON.parse(execFileSync("python3", ["-c", `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(`${DL}/${x1.suggestedFilename()}`)}, data_only=True)
def rows(n): return [list(r) for r in wb[n].iter_rows(values_only=True)]
합 = rows("선수기록"); h = 합[0]
팀 = rows("팀효율")
원 = rows("이벤트원본"); ho = 원[0]
print(json.dumps({
  "시트": len(wb.sheetnames), "선수수": len(합) - 1,
  "득점합": sum(int(r[h.index("득점")] or 0) for r in 합[1:]),
  "플마": sorted(set(str(r[h.index("+/-")]) for r in 합[1:])),
  "팀줄": [[r[1], r[2], r[3], r[4]] for r in 팀[1:]],
  "상대줄": sum(1 for r in 원[1:] if r[ho.index("종류")] == "상대 득점"),
}, ensure_ascii=False, default=str))
`], { encoding: "utf8" }));
say(엑셀.시트 === 6 && 엑셀.선수수 === 8 && 엑셀.득점합 === 6, `엑셀 시트 ${엑셀.시트} · 선수 ${엑셀.선수수} · 득점 합 ${엑셀.득점합}`);
say(JSON.stringify(엑셀.플마) === JSON.stringify(["None"]), `선수기록 +/- 칸은 전부 빈 칸 (${엑셀.플마.join()})`);
say(JSON.stringify(엑셀.팀줄) === JSON.stringify([["혼", "패", 6, 10]]), `팀효율 줄 ${JSON.stringify(엑셀.팀줄)}`);
say(엑셀.상대줄 === 0, "이벤트원본에 상대 득점 줄 없음 (최종 점수는 이벤트가 아님)");

const 그림 = await p.evaluate(async () => {
  const st = await import("./js/storage.js"); const I = await import("./js/record-image.js");
  const g = st.getRecordSession().games[0];
  const { svg, height } = I.결과이미지SVG(g, [g]);
  const 글 = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
  return { height, 제목: 글.find((t) => t.includes(" : ")), 승: 글.includes("불사조 승"),
    쿼터: 글.filter((t) => /^(혼|불사조)   /.test(t)), 대시: 글.filter((t) => t === "–").length,
    코트: (svg.match(/width="480" height="450"/g) || []).length };
});
say(그림.제목 === "혼  6 : 10  불사조" && 그림.승, `밴드 이미지 머리 "${그림.제목}" · "불사조 승"`);
say(그림.쿼터.length === 1 && 그림.쿼터[0].startsWith("혼"), `밴드 이미지 쿼터별은 우리 팀 한 줄 — ${JSON.stringify(그림.쿼터)}`);
say(그림.대시 >= 8, `밴드 이미지 +/- 칸 "–" ${그림.대시}개 (선수 8명)`);
say(그림.코트 === 1 + 3, `밴드 이미지 코트 ${그림.코트}칸 = 팀 1 + 슛 쏜 선수 3`);

// ── 다음 경기 ────────────────────────────────────────────
await p.clock.fastForward("55:00");
await p.fill("#rec-next-opp", "청룡");
await p.click("#rec-next"); await p.waitForTimeout(600);
const 둘째 = await p.evaluate(() => ({
  전환: [...document.querySelectorAll(".rec-gbtn")].map((x) => x.innerText.replace(/\s+/g, " ").trim()),
}));
say((await 점수판()) === "혼 0 : – 청룡", `다음 경기 점수판 — "${await 점수판()}"`);
say(둘째.전환.length === 2 && 둘째.전환[0].startsWith("혼 : 불사조 6 : 10") && 둘째.전환[1].startsWith("혼 : 청룡 0 : –"),
  `전환 줄 — ${둘째.전환.join(" | ")}`);
await p.click("#rec-finish"); await p.waitForTimeout(600);
say((await p.evaluate(() => document.querySelector("#rec-opp-final").value)) === "", "새 경기 상대 점수 칸은 비어 있음");
say((await p.evaluate(() => document.querySelector("#rec-next-opp").value)) === "청룡", "그다음 경기 상대 칸에 '청룡'");

// 보관함 목록 (설정 화면)
const 보관줄 = await p.evaluate(async () => {
  const st = await import("./js/storage.js");
  return st.getRecordArchive().map((g) => `${g.teams[1].name}:${g.teams[1].final ?? "없음"}`);
});
say(보관줄.includes("불사조:10") && 보관줄.includes("청룡:없음"), `보관함 — ${보관줄.join(", ")}`);

// 옛 버튼 기록(opp 이벤트)만 있는 경기는 그 합을 쓴다
const 옛것 = await p.evaluate(async () => {
  const R = await import("./js/record.js");
  const g = { teams: [{ name: "혼", players: [] }, { name: "옛상대", players: [], opp: true }],
    events: [{ type: "opp", team: 1, pts: 2, q: 1 }, { type: "opp", team: 1, pts: 3, q: 2 }] };
  return R.경기점수(g).join(":");
});
say(옛것 === "0:5", `옛 +1/+2/+3 기록만 있는 경기는 그 합 — ${옛것}`);

say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
