// 하루 합계 — 그날 여러 경기(3파전 · 교류전 여러 판)를 선수별로 더한 표와 엑셀.
//
// 숫자는 화면 표 · 엑셀 · 경기마다 따로 센 값(record.js 의 boxScore · plusMinus) 셋을
// 맞댄다. 경기 기록은 저장소(spirit-record-session)에 직접 넣는다 — 코트를 눌러
// 넣는 흐름은 tri · tridone 이 이미 본다. 여기서는 더하기가 맞는지가 관심사다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dlday");
fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

// ── 경기 만들기 ──
const 팀 = (이름, 사람들) => ({ name: 이름, players: 사람들.map((n) => ({ name: n })), onCourt: 사람들.slice(0, 5) });
const A = ["김산", "조우진", "심인보", "황규철"], B = ["고성익", "권혁남", "김도여", "김동현"], C = ["김성훈", "김웅기", "김준석", "김창범"];
let t0 = new Date("2026-09-27T12:10:00").getTime();
const 슛 = (team, player, pts, made, q = 1) => ({ t: t0++, q, type: "shot", team, player, pts, made, x: 250, y: 100 });
const 기타 = (team, player, type, q = 1) => ({ t: t0++, q, type, team, player });
function 경기(a, b, 사건들, i) {
  return { date: "2026-09-27", quarters: 4, q: 2, startedAt: new Date("2026-09-27T12:10:00").getTime() + i * 1000,
    teams: [팀(a[0], a[1]), 팀(b[0], b[1])], events: 사건들 };
}
const 삼파전 = [
  경기(["A팀", A], ["B팀", B], [슛(0, "김산", 2, true), 슛(0, "김산", 3, true), 슛(1, "고성익", 2, true), 기타(0, "조우진", "ast"),
    기타(1, "권혁남", "rebD"), 슛(0, "심인보", 3, false), 기타(0, "황규철", "rebO"), 슛(0, "황규철", 2, true), 기타(1, "김도여", "to")], 0),
  경기(["B팀", B], ["C팀", C], [슛(0, "고성익", 3, true), 슛(1, "김성훈", 2, true), 슛(1, "김성훈", 2, true), 기타(1, "김웅기", "stl"),
    { t: t0++, q: 1, type: "ftm", team: 0, player: "권혁남" }, { t: t0++, q: 1, type: "fta", team: 0, player: "권혁남" }], 1),
  경기(["C팀", C], ["A팀", A], [슛(1, "김산", 2, true), 슛(0, "김준석", 3, true), 기타(0, "김창범", "blk"), 슛(1, "조우진", 2, false),
    기타(1, "조우진", "rebO"), 슛(1, "조우진", 2, true), 기타(0, "김성훈", "pf")], 2),
];

async function 결과화면(session, w = 390) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, acceptDownloads: true });
  await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem("심음")) { localStorage.clear(); localStorage.setItem("spirit-record-session", JSON.stringify(s)); sessionStorage.setItem("심음", "1"); } } catch (e) { /* */ } }, session);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.goto(`${URL}/index.html#/record`); await p.waitForTimeout(800);
  await p.click("#rec-finish"); await p.waitForTimeout(800);
  return { p, ctx };
}
const 표읽기 = (p) => p.evaluate(() => {
  const t = document.querySelector(".rec-day");
  if (!t) return null;
  const 머리 = [...t.querySelectorAll("thead th")].map((x) => x.textContent.trim());
  return { 머리, 줄: [...t.querySelectorAll("tbody tr")].map((tr) => Object.fromEntries([...tr.children].map((td, i) => [머리[i], td.textContent.trim()]))),
    제목: [...document.querySelectorAll(".rec-adv-title")].map((h) => h.textContent.replace(/\s+/g, " ").trim()).find((x) => x.startsWith("오늘 합계")) };
});

// ── 1. 3파전 ──
{
  const { p, ctx } = await 결과화면({ games: 삼파전, at: 0 });
  const 표 = await 표읽기(p);
  // 따로 센 값: 경기마다 boxScore · plusMinus 를 돌려 이름별로 더한다.
  const 따로 = await p.evaluate(async (games) => {
    const R = await import("./js/record.js"); const S = await import("./js/record-stats.js");
    const 합 = {};
    for (const g of games) {
      const pm = S.plusMinus(g);
      for (const r of R.boxScore(g)) {
        const a = (합[r.name] ||= { pts: 0, reb: 0, ast: 0, 경기: 0, pm: 0, p3m: 0, p3a: 0 });
        a.pts += r.pts; a.reb += r.reb; a.ast += r.ast; a.경기 += 1; a.p3m += r.p3m; a.p3a += r.p3a; a.pm += pm[`${r.team}|${r.name}`] ?? 0;
      }
    }
    return 합;
  }, 삼파전);
  확인(표 && 표.제목 === "오늘 합계 3경기 · 12명" && 표.줄.length === 12, `제목 "${표?.제목}" · 줄 ${표?.줄.length}개`);
  const 틀린 = 표.줄.filter((r) => {
    const a = 따로[r["선수"]];
    return !a || +r["득점"] !== a.pts || +r["리바"] !== a.reb || +r["어시"] !== a.ast || +r["경기"] !== a.경기
      || r["3점"] !== `${a.p3m}/${a.p3a}` || +r["+/-"].replace("+", "") !== a.pm;
  });
  확인(!틀린.length, `선수 12명 득점 · 리바 · 어시 · 경기 수 · 3점 · +/- 가 경기별로 따로 센 합과 같음${틀린.length ? " — 틀림: " + 틀린.map((r) => r["선수"]).join(", ") : ""}`);
  확인(표.줄.every((r) => r["경기"] === "2"), "3파전이라 모두 2경기씩");
  const 득점들 = 표.줄.map((r) => +r["득점"]);
  확인(득점들.every((v, i) => i === 0 || 득점들[i - 1] >= v), `득점 많은 순 — ${표.줄.slice(0, 3).map((r) => `${r["선수"]} ${r["득점"]}`).join(", ")} …`);
  const 총 = await p.evaluate(async (games) => { const R = await import("./js/record.js"); return games.reduce((s, g) => s + R.scoreOf(g.events)[0] + R.scoreOf(g.events)[1], 0); }, 삼파전);
  확인(득점들.reduce((a, v) => a + v, 0) === 총, `표 득점 합 ${득점들.reduce((a, v) => a + v, 0)} = 세 경기 점수 합 ${총}`);
  확인(표.줄.find((r) => r["선수"] === "김산")?.["팀"] === "A팀", `팀 칸 — 김산 "${표.줄.find((r) => r["선수"] === "김산")?.["팀"]}"`);
  const 가로 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  확인(가로 === 0, `390px 에서 페이지 가로 넘침 ${가로}px (표는 표 칸 안에서만 밀림)`);
  const 단추 = await p.evaluate(() => Math.round(document.querySelector("#rec-day-xlsx").getBoundingClientRect().height));
  확인(단추 >= 44, `오늘 합계 엑셀 단추 높이 ${단추}px`);

  // 엑셀
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#rec-day-xlsx")]);
  const 파일 = `${DL}/${dl.suggestedFilename()}`; await dl.saveAs(파일);
  확인(/^spirit-day-2026-09-27-\d{4}-DAY\.xlsx$/.test(dl.suggestedFilename()), `파일 이름 ${dl.suggestedFilename()}`);
  const 엑셀 = JSON.parse(execFileSync("python3", ["-c", `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(파일)}, data_only=True)
ws = wb.worksheets[0]
rows = [list(r) for r in ws.iter_rows(values_only=True)]
h = rows[0]
표 = [r for r in rows[1:] if r[h.index("선수")]]
꼬리 = [r[0] for r in rows[1:] if r[0] and str(r[0]).startswith("■")]
print(json.dumps({"시트": wb.sheetnames, "머리": h, "줄": {r[h.index("선수")]: [r[h.index("득점")], r[h.index("리바운드")], r[h.index("경기수")], r[h.index("+/-")]] for r in 표}, "꼬리": 꼬리}, ensure_ascii=False))
`], { encoding: "utf8" }));
  const 엑셀틀림 = 표.줄.filter((r) => { const e = 엑셀.줄[r["선수"]]; return !e || e[0] !== +r["득점"] || e[1] !== +r["리바"] || e[2] !== +r["경기"] || e[3] !== +r["+/-"].replace("+", ""); });
  확인(엑셀.시트.join() === "하루합계" && Object.keys(엑셀.줄).length === 12 && !엑셀틀림.length,
    `엑셀 시트 [${엑셀.시트}] · ${Object.keys(엑셀.줄).length}명 · 득점 · 리바 · 경기수 · +/- 가 화면 표와 같음${엑셀틀림.length ? " — 틀림: " + 엑셀틀림.map((r) => r["선수"]).join(", ") : ""}`);
  확인(엑셀.꼬리.length === 3 && /^■ 1경기: A팀 \d+ : \d+ B팀$/.test(엑셀.꼬리[0]), `엑셀 아래 경기 점수 — ${엑셀.꼬리.join(" / ")}`);
  await ctx.close();
}

// ── 2. 교류전 두 판: 우리 선수만, +/- 칸 없음 ──
{
  const 우리 = ["김산", "조우진", "심인보", "황규철", "고성익"];
  const 교류 = (상대, no, 사건들, i) => {
    const g = 경기(["혼", 우리], [상대, []], 사건들, i);
    g.teams[1].opp = true; g.no = no; g.teams[1].final = 10 + i; return g;
  };
  const games = [교류("불사조", 1, [슛(0, "김산", 3, true), 슛(0, "조우진", 2, true)], 0), 교류("청룡", 2, [슛(0, "김산", 2, true)], 1)];
  const { p, ctx } = await 결과화면({ games, at: 1 });
  const 표 = await 표읽기(p);
  확인(표 && 표.줄.length === 5 && !표.머리.includes("+/-"), `교류전 두 판 — 줄 ${표?.줄.length}개(우리 선수만) · +/- 칸 ${표?.머리.includes("+/-") ? "있음" : "없음"}`);
  확인(표.줄[0]["선수"] === "김산" && 표.줄[0]["득점"] === "5" && 표.줄[0]["경기"] === "2", `1위 김산 5점 · 2경기 — ${JSON.stringify(표.줄[0]).slice(0, 80)}`);
  await ctx.close();
}

// ── 3. 한 경기면 오늘 합계가 없다 ──
{
  const { p, ctx } = await 결과화면({ games: [삼파전[0]], at: 0 });
  확인(!(await 표읽기(p)) && !(await p.$("#rec-day-xlsx")), "한 경기(2팀) 결과 화면에는 오늘 합계 없음");
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
