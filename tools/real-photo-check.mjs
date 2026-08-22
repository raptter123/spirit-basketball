// 실제 사진 한 장을 **사람이 종이와 맞춰 확인한 값**에 대고 재는 시험.
//
// 왜 이게 필요한가: 합성 시험 아홉 종은 그리는 쪽과 읽는 쪽이 같은 코드라 언제나
// 맞는다. 종이·프린터·펜·카메라가 끼어드는 진짜 오차는 거기서 절대 안 나온다.
// 그런데 사진을 눈으로 세어 정답을 만들면 **그 정답이 먼저 틀린다** — 틀린 자를
// 들고 자를 고치는 셈이다.
//
// 그래서 이 파일의 기대값은 추측이 아니다. 2026-08-23 혼 A 기록지의 두 줄을
// 사람이 종이를 직접 보고 한 칸씩 확인해 준 값이다. 한 줄이 200칸쯤 되고,
// 검정·빨강 마킹이 섞여 있고, 출전·슛·카운트 세 종류가 다 들어 있다.
//
// 이 시험이 깨지면 판독기가 실제로 나빠진 것이다. 기대값을 고치지 말 것 —
// 종이가 그렇게 칠해져 있다.
//
// 쓰는 법:  npx http-server -p 8911 -s .   그리고   node tools/real-photo-check.mjs
import { chromium } from "playwright";

const URL = "http://127.0.0.1:8911";
const PHOTO = "/test/fixtures/sheet-honA-260823.jpg";

// 사람이 종이를 보고 확인해 준 값 (2026-08-23 · 1경기 · 혼 A)
//
// 박윤호 줄은 처음엔 3점을 0/2 로 읽었다. 사람이 종이를 보고 1/3 이라고 알려 줬고,
// 파고들어 보니 넣음 칸 하나(어둡기 0.694)가 문턱값 0.62 에 걸려 떨어지고 있었다.
// 빈 칸 무리(0.89~1.05)에서 0.2 나 떨어져 있는데도. 그래서 문턱값을 분포의
// 골짜기에서 잡도록 바꿨다 — 이 줄이 그 수정을 지키는 시험이다.

// 종이에 인쇄된 명단 — 이름 칸 판독이 세 번이나 엉뚱한 사람을 내놨던 자리라
// 여기서 못 박아 둔다(손걸 = 로스터 15번, 어두운 칸이 둘뿐이라 아무 줄이나
// 바싹 자르면 튀어나오던 함정).
const NAMES = ["박윤호", "배준혁", "조보규", "이남희", "수잔", "조연우"];

const TRUTH = [
  { name: "조보규", quarters: [1, 2, 4],
    p2m: 5, p2a: 10, p3m: 2, p3a: 4, ftm: 1, fta: 2,
    reb: 4, ast: 4, stl: 2, blk: 1, to: 1, pf: 1 },
  { name: "박윤호", quarters: [1, 2, 3],
    p2m: 2, p2a: 7, p3m: 1, p3a: 3, ftm: 1, fta: 2,
    reb: 4, ast: 3, stl: 1, blk: 0, to: 1, pf: 2 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(`${URL}/index.html`);
await page.waitForTimeout(800);

const got = await page.evaluate(async (photo) => {
  const form = await import("/js/sheetform.js");
  const read = await import("/js/sheetread.js");
  const { ROSTER } = await import("/js/roster.js");

  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;width:297mm";
  document.body.appendChild(host);
  const st = document.createElement("style");
  st.textContent = form.SHEET_CSS;
  document.head.appendChild(st);
  host.innerHTML = form.sheetHTML({ roster: [] });
  const geom = form.measureSheet(host.querySelector(".sheet"));

  const img = new Image();
  img.src = photo;
  await img.decode();
  // 앱과 같은 크기로 줄인다(statspage 의 상한이 2200px).
  const sc = Math.min(1, 2200 / img.naturalWidth);
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.naturalWidth * sc);
  cv.height = Math.round(img.naturalHeight * sc);
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  const idata = ctx.getImageData(0, 0, cv.width, cv.height);

  const corners = read.detectFiducials(idata, geom);
  if (!corners) return { err: "귀퉁이를 못 찾았습니다" };
  const readings = read.readBubbles(idata, corners, geom);
  const paper = read.readSheetRoster(readings, ROSTER);
  const names = paper.rows.map((w) => (w ? w.name : ""));
  const team = read.readingsToTeam(
    readings,
    names.map((n, k) => [paper.rows[k] ? paper.rows[k].no : null, n]));

  return {
    size: [idata.width, idata.height],
    ticks: `${readings.tickHits}/${readings.tickTotal}`,
    corrected: readings.corrected,
    cut: readings.threshold,
    filled: team.filled,
    namesRead: paper.read,
    namesBad: paper.bad,
    names,
    byName: Object.fromEntries(
      names.map((n, k) => [n, team.players[k]]).filter(([n]) => n)),
  };
}, PHOTO);

if (got.err) { console.error("❌", got.err); process.exit(1); }

console.log(`실제 사진 ${got.size.join("x")} · 눈금 ${got.ticks} · ${got.corrected ? "밀림 보정 함" : "보정 못 함"}`);
console.log(`문턱값 ${got.cut.toFixed(3)} · 칠해진 칸 ${got.filled} · 이름 ${got.namesRead}줄 읽음${got.namesBad ? ` · ${got.namesBad}줄 실패` : ""}\n`);

const bad0 = [];

for (const want of NAMES) {
  if (!got.names.includes(want)) bad0.push(`명단에 ${want} 가 없습니다 — 읽힌 이름: ${got.names.filter(Boolean).join(", ") || "없음"}`);
}
for (const n of got.names) {
  if (n && !NAMES.includes(n)) bad0.push(`명단에 없는 이름을 읽었습니다: ${n}`);
}

const KEYS = ["p2m", "p2a", "p3m", "p3a", "ftm", "fta", "reb", "ast", "stl", "blk", "to", "pf"];
const q = (a) => [...a].sort((x, y) => x - y).join(",");
const bad = [...bad0];
for (const want of TRUTH) {
  const row = got.byName[want.name];
  if (!row) { bad.push(`${want.name} 줄을 아예 못 찾았습니다`); continue; }
  const miss = [];
  if (q(row.quarters) !== q(want.quarters)) {
    miss.push(`출전 기대 ${q(want.quarters)} · 실제 ${q(row.quarters) || "없음"}`);
  }
  for (const k of KEYS) if (row[k] !== want[k]) miss.push(`${k} 기대 ${want[k]} · 실제 ${row[k]}`);
  if (miss.length) { bad.push(...miss.map((m) => `${want.name}: ${m}`)); continue; }
  console.log(`✅ ${want.name} — 출전 ${want.quarters.join(",")} · 2점 ${want.p2m}/${want.p2a} · ` +
    `3점 ${want.p3m}/${want.p3a} · 자유투 ${want.ftm}/${want.fta} · ` +
    `리바 ${want.reb} 어시 ${want.ast} 스틸 ${want.stl} 블락 ${want.blk} 턴오버 ${want.to} 파울 ${want.pf}`);
}
if (errs.length) bad.push(`페이지 오류: ${errs.join(" | ")}`);

if (bad.length) {
  console.error(`\n❌ 사람이 종이를 보고 확인해 준 값과 어긋납니다 (${bad.length}건)`);
  for (const b of bad) console.error("   " + b);
  process.exit(1);
}
console.log(`\n사람이 확인한 ${TRUTH.length}줄 전부 일치합니다.`);
await browser.close();
