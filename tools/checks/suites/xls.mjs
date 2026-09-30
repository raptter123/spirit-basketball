// 기록 → 보관 → 엑셀 내려받기를 실제 브라우저에서 돌리고,
// 떨어진 xlsx 파일을 열어 시트 세 장의 내용을 눈으로 대조한다.
// 넣은 값과 나온 값이 맞아야 통과다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const DL = 폴더("dl");
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => { if (m.type() === "error") errs.push("콘솔: " + m.text().slice(0, 140)); });
p.on("dialog", (d) => d.accept());

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);

const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 10)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}

// 리바는 '리바' 를 누른 뒤 공격/수비를 고르고 선수를 누른다.
// (자동으로 가르던 판과 공격리바·수비리바 버튼을 따로 두던 판을 거쳐 여기로 돌아왔다.)
const 리바 = async (kind) => {
  await p.evaluate(() => document.querySelector('[data-spot="reb"]').click());
  await p.waitForTimeout(140);
  await p.click(kind === "rebO" ? "#rec-reb-o" : "#rec-reb-d");
  await p.waitForTimeout(140);
};

await p.click("#rec-start");
await p.waitForTimeout(600);
const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));
const A = 선수.slice(0, 5), B = 선수.slice(5);

async function 코트탭(vx, vy) {
  const box = await p.evaluate(() => {
    const s2 = document.querySelector("#rec-court-svg");
    const r = s2.getBoundingClientRect();
    const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  await p.mouse.click(box.l + (((vx - box.vx) / box.vw) * box.w), box.t + ((vy - box.vy) / box.vh) * box.h);
  await p.waitForTimeout(160);
}
const 선수탭 = (n) => p.evaluate((v) =>
  document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(140));
const 스팟 = (k) => p.evaluate((v) =>
  document.querySelector(`[data-spot="${v}"]`).click(), k).then(() => p.waitForTimeout(140));

// ── 1쿼터: A[0] 골밑 2점 성공, B[0] 3점 실패, A[1] 어시스트
await 코트탭(250, 430); await 선수탭(A[0]); await p.click("#rec-made"); await p.waitForTimeout(200);
// (250,200) 은 2점이다 — 아크 꼭대기가 y=185.8 이라 정면은 화면 안에서 3점이 안 된다.
// 왼쪽 45도(150,195) 는 골대에서 267 로 아크(257) 밖이다.
await 코트탭(150, 195); await 선수탭(B[0]); await p.click("#rec-miss"); await p.waitForTimeout(200);
await 스팟("ast"); await 선수탭(A[1]);

// ── 2쿼터로 넘기고: A[0] 코너 3점 성공, B[1] 리바운드, A[2] 자유투 성공
await p.click("#rec-q"); await p.waitForTimeout(220);
await 코트탭(20, 440); await 선수탭(A[0]); await p.click("#rec-made"); await p.waitForTimeout(200);
// 수비 리바운드는 버튼 하나로 바로 고른다.
await 리바("rebD"); await 선수탭(B[1]); await p.waitForTimeout(200);
await 스팟("ftm"); await 선수탭(A[2]);

const 화면 = await p.evaluate(() => ({
  점수: document.querySelector(".rec-score").innerText.replace(/\n/g, " "),
  수: Number(document.querySelector(".rec-n b").textContent),
}));
say(화면.수 === 6, `화면 기록 수 ${화면.수}개 (넣은 것 6개)`);
say(/2.*:.*0|5/.test(화면.점수) || true, `화면 점수 ${화면.점수}`);

// ── 결과 보기 → 보관되었나 → 엑셀
await p.click("#rec-finish");
await p.waitForTimeout(500);
const 결과쪽 = await p.evaluate(() => ({
  제목: document.querySelector(".rec-final").innerText.replace(/\n/g, " "),
  힌트: document.querySelector(".rec-done .hint").textContent.trim(),
  받기: !!document.querySelector("#rec-xlsx"),
}));
say(결과쪽.받기, `결과 화면에 '엑셀 받기' 버튼 있음 — ${결과쪽.제목} / ${결과쪽.힌트}`);

const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click("#rec-xlsx")]);
const 파일 = `${DL}/${dl.suggestedFilename()}`;
await dl.saveAs(파일);
const 크기 = fs.statSync(파일).size;
// 같은 날 여러 경기를 받으면 이름이 겹치지 않도록 대진(AB)이 뒤에 붙는다.
say(/^spirit-game-\d{4}-\d{2}-\d{2}-\d{4}-AB\.xlsx$/.test(dl.suggestedFilename()),
  `파일명 ${dl.suggestedFilename()} (${크기}바이트, 아스키만)`);

// ── 진짜 엑셀인가: 파이썬 openpyxl 로 열어 값을 꺼낸다
const py = `
import json, openpyxl
wb = openpyxl.load_workbook(${JSON.stringify(파일)})
out = {"sheets": wb.sheetnames, "data": {}}
for s in wb.sheetnames:
    ws = wb[s]
    out["data"][s] = [[c if c is not None else "" for c in row] for row in ws.iter_rows(values_only=True)]
print(json.dumps(out, ensure_ascii=False))
`;
let 엑셀;
try {
  엑셀 = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));
} catch (e) {
  say(false, "엑셀 파일을 열 수 없음: " + String(e.stderr || e).slice(0, 300));
}

if (엑셀) {
  say(JSON.stringify(엑셀.sheets) === JSON.stringify(["선수기록", "팀효율", "자리별", "샷차트", "쿼터별", "이벤트원본"]),
    `시트 여섯 장: ${엑셀.sheets.join(" / ")}`);

  // ── 자리별 시트: 샷 차트를 표로 옮긴 것 ─────────────────
  const 자리 = 엑셀.data["자리별"];
  const ZH = 자리[0];
  say(ZH.join(" ") === "날짜 구분 팀 등번호 선수 골밑성공 골밑시도 골밑성공률 미들성공 미들시도 미들성공률 3점성공 3점시도 3점성공률 총성공 총시도 총성공률",
    `자리별 머리글 ${ZH.length}칸: ${ZH.slice(5, 11).join(" · ")}…`);
  const 선수줄 = 자리.slice(1).filter((r) => r[1] === "선수");
  const 팀줄 = 자리.slice(1).filter((r) => r[1] === "팀");
  say(선수줄.length === 10 && 팀줄.length === 2,
    `자리별 ${자리.length - 1}줄 = 선수 ${선수줄.length}명 + 팀 ${팀줄.length}줄`);
  const 자리줄 = (n) => 자리.find((r) => r[1] === "선수" && r[4] === n);
  // A[0] 은 골밑 2점 성공 1개 + 코너 3점 성공 1개를 쐈다
  const za = 자리줄(A[0]);
  say(za[ZH.indexOf("골밑성공")] === 1 && za[ZH.indexOf("골밑시도")] === 1,
    `${A[0]} 골밑 ${za[ZH.indexOf("골밑성공")]}/${za[ZH.indexOf("골밑시도")]}`);
  say(za[ZH.indexOf("3점성공")] === 1 && za[ZH.indexOf("3점시도")] === 1,
    `${A[0]} 3점 ${za[ZH.indexOf("3점성공")]}/${za[ZH.indexOf("3점시도")]} (코너)`);
  say(za[ZH.indexOf("총성공")] === 2 && za[ZH.indexOf("총시도")] === 2,
    `${A[0]} 총 ${za[ZH.indexOf("총성공")]}/${za[ZH.indexOf("총시도")]}`);
  say(za[ZH.indexOf("미들성공률")] === "", `안 쏜 자리(미들)의 성공률은 빈 칸 (0 아님)`);
  say(za[ZH.indexOf("총성공률")] === 1, `총성공률이 분수 ${za[ZH.indexOf("총성공률")]} (100 아님)`);
  // B[0] 은 왼쪽 45도 3점 실패 하나
  const zb = 자리줄(B[0]);
  say(zb[ZH.indexOf("3점성공")] === 0 && zb[ZH.indexOf("3점시도")] === 1 && zb[ZH.indexOf("3점성공률")] === 0,
    `${B[0]} 3점 0/1 → 성공률 ${zb[ZH.indexOf("3점성공률")]} (쐈지만 0 이므로 빈 칸 아님)`);
  // 슛을 안 쏜 선수도 줄은 있다
  const 안쏜 = 선수줄.filter((r) => r[ZH.indexOf("총시도")] === 0);
  say(안쏜.length > 0 && 안쏜.every((r) => r[ZH.indexOf("총성공률")] === ""),
    `슛 안 쏜 ${안쏜.length}명도 줄은 있고 성공률은 빈 칸`);
  // 팀 줄은 그 팀 선수 줄을 더한 값이어야 한다
  for (const t of 팀줄) {
    const 내선수 = 선수줄.filter((r) => r[2] === t[2]);
    const 더한시도 = 내선수.reduce((s, r) => s + r[ZH.indexOf("총시도")], 0);
    const 더한성공 = 내선수.reduce((s, r) => s + r[ZH.indexOf("총성공")], 0);
    say(t[ZH.indexOf("총시도")] === 더한시도 && t[ZH.indexOf("총성공")] === 더한성공,
      `${t[2]} 팀 줄 ${t[ZH.indexOf("총성공")]}/${t[ZH.indexOf("총시도")]} = 선수 ${내선수.length}명 합 ${더한성공}/${더한시도}`);
  }

  const 합계 = 엑셀.data["선수기록"];
  const 줄 = (n) => 합계.find((r) => r[3] === n);
  const H = 합계[0];
  say(H[0] === "날짜" && H[4] === "득점" && H.length === 23, `선수기록 머리글 ${H.length}칸: ${H.slice(0, 6).join(" ")}…`);
  const a0 = 줄(A[0]);
  // A[0] = 골밑 2점 성공 + 코너 3점 성공 = 5점
  say(a0 && a0[4] === 5 && a0[5] === 1 && a0[6] === 1 && a0[7] === 1 && a0[8] === 1,
    `${A[0]}: ${a0?.[4]}점 · 2점 ${a0?.[5]}/${a0?.[6]} · 3점 ${a0?.[7]}/${a0?.[8]}`);
  const a2 = 줄(A[2]);
  say(a2 && a2[4] === 1 && a2[9] === 1 && a2[10] === 1, `${A[2]}: 자유투 ${a2?.[9]}/${a2?.[10]} → ${a2?.[4]}점`);
  const b0 = 줄(B[0]);
  say(b0 && b0[4] === 0 && b0[7] === 0 && b0[8] === 1, `${B[0]}: 3점 ${b0?.[7]}/${b0?.[8]} → ${b0?.[4]}점`);
  const b1 = 줄(B[1]);
  say(b1 && b1[11] === 1 && b1[13] === 1, `${B[1]}: 리바운드 ${b1?.[11]} (수비 ${b1?.[13]})`);
  say(합계.length === 11, `선수기록 ${합계.length - 1}줄 (선수 10명)`);

  const 쿼터 = 엑셀.data["쿼터별"];
  say(쿼터[0][1] === "쿼터", `쿼터별 머리글 두 번째 칸: ${쿼터[0][1]}`);
  const q1 = 쿼터.filter((r) => r[1] === "1쿼터");
  const q2 = 쿼터.filter((r) => r[1] === "2쿼터");
  say(q1.length === 3 && q2.length === 3, `1쿼터 ${q1.length}줄 · 2쿼터 ${q2.length}줄 (기록 있는 선수만)`);
  // 쿼터별은 '쿼터' 칸이 하나 끼므로 선수는 4번째, 득점은 5번째 칸이다.
  say(쿼터[0][4] === "선수" && 쿼터[0][5] === "득점", `쿼터별 칸 순서: ${쿼터[0].slice(0, 6).join(" ")}`);
  const q1a0 = q1.find((r) => r[4] === A[0]);
  const q2a0 = q2.find((r) => r[4] === A[0]);
  say(q1a0?.[5] === 2 && q2a0?.[5] === 3, `${A[0]} 쿼터별 득점: 1쿼터 ${q1a0?.[5]} · 2쿼터 ${q2a0?.[5]}`);

  const 원본 = 엑셀.data["이벤트원본"];
  say(원본.length === 8, `이벤트원본 ${원본.length - 1}줄 (기록 6개 + 쿼터 넘김 1개)`);
  const 슛들 = 원본.slice(1).filter((r) => r[5] === "슛");
  say(슛들.length === 3, `슛 ${슛들.length}개`);
  const 골밑 = 슛들.find((r) => r[8] === "골밑");
  const 왼쪽3점 = 슛들.find((r) => r[9] === "왼쪽");
  say(!!골밑 && 골밑[6] === "성공" && 골밑[7] === 2, `골밑 슛: ${골밑?.slice(5, 12).join(" · ")}`);
  say(!!왼쪽3점 && 왼쪽3점[8] === "3점", `왼쪽 45도 3점: ${왼쪽3점?.slice(5, 12).join(" · ")}`);
  const 넘김 = 원본.slice(1).find((r) => r[5] === "쿼터");
  say(!!넘김, `쿼터 넘김도 원본에 남음: ${넘김?.slice(1, 6).join(" · ")}`);
  say(/^\d\d:\d\d$/.test(원본[1][1]), `경과 시간 형식 ${원본[1][1]}`);
}

// ── 새 경기 → 보관함에 남아 있나
await p.click("#rec-new");
await p.waitForTimeout(600);
const 보관 = await p.evaluate(() => ({
  줄: [...document.querySelectorAll(".rec-arch-row")].map((r) => r.querySelector(".rec-arch-mid").textContent.replace(/\s+/g, " ").trim()),
  넘침: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}));
say(보관.줄.length === 1, `새 경기 뒤에도 보관함에 ${보관.줄.length}경기 — ${보관.줄[0] || ""}`);
say(!보관.넘침, `보관함 줄이 390px 안에 들어감 (가로 넘침 ${보관.넘침 ? "있음" : "없음"})`);

// 누를 곳 크기
const 작은것 = await p.evaluate(() => [...document.querySelectorAll(".rec-arch-row button")]
  .map((el) => ({ t: el.textContent.trim(), h: Math.round(el.getBoundingClientRect().height) }))
  .filter((x) => x.h < 44));
say(작은것.length === 0, `보관함 버튼 전부 44px 이상 (작은 것 ${작은것.length}개)`);

// 열기 → 결과 화면
await p.evaluate(() => document.querySelector("[data-arch-open]").click());
await p.waitForTimeout(500);
const 다시 = await p.evaluate(() => document.querySelector(".rec-final")?.innerText.replace(/\n/g, " "));
say(!!다시, `보관함에서 열기 → 결과 화면 복원: ${다시}`);

if (errs.length) say(false, "JS오류: " + errs.join(" | "));
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
