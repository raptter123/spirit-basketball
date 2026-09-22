// 기록한 경기를 엑셀 파일로 내보낸다.
//
// 왜 시트를 셋으로 나누나
//   합계만 저장하면 "3쿼터만" "골밑만" 같은 질문을 나중에 영원히 못 한다. 그래서
//   사람이 바로 읽을 합계(선수기록) · 쿼터별 · 그리고 **이벤트 원본**을 같이 넣는다.
//   원본 한 장이 있으면 나머지 두 장은 언제든 다시 만들 수 있다. 반대는 안 된다.
//
// 왜 필요할 때만 불러오나
//   기록 화면(record.js)은 app.js 가 처음부터 들고 간다. 여기를 정적으로 import
//   하면 엑셀을 한 번도 안 받는 사람까지 이 파일을 매번 내려받는다. 재 보니
//   첫 화면에서 빠지고, 버튼을 눌렀을 때만 6.1KB 를 받는다.
//   xlsx-lite 는 statspage.js 가 이미 정적으로 쓰고 있어서 첫 화면에 어차피 들어
//   있다. 그래도 여기서 동적으로 부르는 것은, 나중에 그쪽이 빠져도 이쪽은 그대로
//   두면 되기 때문이다.
//
// 좌표를 미터로 바꾸지 않는 이유
//   코트 그림은 실제 치수대로 그린 것이 아니다. 3점 아크 반지름 257 을 FIBA 의
//   6.75m 로 놓고 환산하면 코트 너비 480 이 12.6m 가 되는데 실제는 15m 다.
//   그래서 "골대에서 몇 m" 는 지어낸 숫자가 된다. 대신 구역(골밑·미들·3점)과
//   좌우만 적는다 — 그림 좌표에서 확실하게 나오는 값이다.
import { boxScore, pointsOf, zoneOf, qLabel } from "./record.js";
import { 효율, plusMinus, 팀지표, 승패 } from "./record-stats.js";

const 종류이름 = {
  shot: "슛", ast: "어시스트", reb: "리바운드", stl: "스틸", blk: "블락",
  to: "턴오버", pf: "파울", ftm: "자유투", fta: "자유투",
  rebO: "공격리바", rebD: "수비리바",
  sub: "교체", quarter: "쿼터",
};

const RIM = { x: 250, y: 442 };

/** 골밑 · 미들 · 3점. 골밑은 골대에서 100 안쪽으로, 자유투 라인(y=428) 언저리까지다. */
function 구역이름(e) {
  if (e.type !== "shot") return "";
  if (zoneOf(e.x, e.y) === 3) return "3점";
  return Math.hypot(e.x - RIM.x, e.y - RIM.y) <= 100 ? "골밑" : "미들";
}

/** 화면에서 본 좌우. 페인트존 양 끝(170 / 330)을 경계로 삼는다. */
function 좌우이름(e) {
  if (e.type !== "shot") return "";
  if (e.x < 170) return "왼쪽";
  if (e.x > 330) return "오른쪽";
  return "가운데";
}

/** 경기 시작부터 흐른 시간. 절대 시각보다 "언제쯤 일어난 일인가"를 보기 쉽다. */
function 경과(e, startedAt) {
  const s = Math.max(0, Math.round(((e.t || startedAt) - startedAt) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const 합계머리 = ["날짜", "팀", "등번호", "선수", "득점",
  "2점성공", "2점시도", "3점성공", "3점시도", "자유투성공", "자유투시도",
  "리바운드", "공격리바", "수비리바", "어시스트", "스틸", "블락", "턴오버", "파울"];

// 효율 지표는 뒤에 따로 붙인다. 앞쪽은 센 값(정수), 뒤쪽은 계산한 값(비율)이라
// 섞어 두면 나중에 합계를 낼 때 비율까지 더하는 실수가 나온다.
const 효율머리 = ["eFG%", "TS%", "AST/TO", "+/-"];

function 합계줄(game, r) {
  return [game.date, game.teams[r.team].name, typeof r.number === "number" ? r.number : "", r.name,
    r.pts, r.p2m, r.p2a, r.p3m, r.p3a, r.ftm, r.fta,
    // 리바운드는 공수의 합이다. 공수를 안 가른 옛 기록도 여기에는 들어가므로
    // 공격+수비가 리바운드보다 작을 수 있다.
    r.reb, r.rebO, r.rebD, r.ast, r.stl, r.blk, r.to, r.pf];
}

// 잴 수 없는 값은 빈 칸으로 둔다. 0 으로 적으면 "못 쐈다" 와 "넣지 못했다" 가 섞인다.
const 값 = (v) => (v == null ? "" : v);

/** 선수기록 시트 — 경기 전체 합계. 한 줄이 한 선수다. */
export function 합계시트(game) {
  const pm = plusMinus(game);
  return [[...합계머리, ...효율머리], ...boxScore(game).map((r) => {
    const e = 효율(r);
    return [...합계줄(game, r), 값(e.efg), 값(e.ts), 값(e.astTo), pm[`${r.team}|${r.name}`] ?? 0];
  })];
}

/** 팀효율 시트 — 한 줄이 한 팀. 100 포제션당 득점·실점과 네 가지 요소다. */
export function 팀시트(game) {
  const T = 팀지표(game);
  const rows = [["날짜", "팀", "승패", "득점", "실점", "포제션",
    "ORtg", "DRtg", "NetRtg", "eFG%", "TS%", "턴오버%", "공격리바%", "수비리바%"]];
  [0, 1].forEach((ti) => {
    const t = T[ti];
    rows.push([game.date, game.teams[ti].name, 승패(game, ti),
      t.pts, T[1 - ti].pts, Math.round(t.poss * 10) / 10,
      값(t.ortg && Math.round(t.ortg * 10) / 10),
      값(t.drtg && Math.round(t.drtg * 10) / 10),
      값(t.net && Math.round(t.net * 10) / 10),
      값(t.efg), 값(t.ts), 값(t.tov && Math.round(t.tov * 10) / 10),
      값(t.orbPct), 값(t.drbPct)]);
  });
  return rows;
}

/** 쿼터별 시트 — 한 줄이 한 선수의 한 쿼터.
 *  기록이 하나도 없는 선수·쿼터는 넣지 않는다. 안 뛴 쿼터가 0 으로 가득 차면
 *  줄만 늘고 읽기 나빠진다. */
export function 쿼터시트(game) {
  const 쿼터들 = [...new Set(game.events.map((e) => e.q || 1))].sort((a, b) => a - b);
  const rows = [["날짜", "쿼터", ...합계머리.slice(1)]];
  for (const q of 쿼터들) {
    const 그쿼터 = game.events.filter((e) => (e.q || 1) === q);
    for (const r of boxScore(game, 그쿼터)) {
      // 기록이 하나라도 있는 줄만 남긴다.
      // 리바운드는 이미 공수를 합친 값이라 여기서 또 더하지 않는다.
      const 합 = r.pts + r.p2a + r.p3a + r.fta + r.reb + r.ast + r.stl + r.blk + r.to + r.pf;
      if (!합) continue;
      const [날짜, ...나머지] = 합계줄(game, r);
      rows.push([날짜, qLabel(q, game.quarters), ...나머지]);
    }
  }
  return rows;
}

/** 이벤트원본 시트 — 누른 순서 그대로. 이 한 장이 있으면 나머지는 다시 만들 수 있다. */
export function 원본시트(game) {
  const rows = [["번호", "경과", "쿼터", "팀", "선수", "종류", "결과", "점수", "구역", "좌우", "X", "Y"]];
  game.events.forEach((e, i) => {
    const 결과 = e.type === "shot" ? (e.made ? "성공" : "실패")
      : e.type === "ftm" ? "성공" : e.type === "fta" ? "실패"
      : e.type === "sub" ? `${e.out ? `${e.out} 나감` : "들어옴"}` : "";
    rows.push([
      i + 1,
      경과(e, game.startedAt || e.t),
      qLabel(e.q || 1, game.quarters),
      game.teams[e.team]?.name || "",
      e.player || "",
      종류이름[e.type] || e.type,
      결과,
      pointsOf(e) || (e.type === "shot" ? e.pts : ""),
      구역이름(e),
      좌우이름(e),
      typeof e.x === "number" ? e.x : "",
      typeof e.y === "number" ? e.y : "",
    ]);
  });
  return rows;
}

/** 크로미움은 a[download] 이름에 한글이 섞이면 이름을 통째로 버리고 확장자 없는
 *  "download" 로 받는다 — 더블클릭해도 안 열린다. 그래서 파일명은 아스키만 쓴다. */
export function 파일이름(game) {
  const d = new Date(game.startedAt || Date.now());
  const 시각 = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `spirit-game-${game.date}-${시각}.xlsx`;
}

/** 세 시트를 담은 xlsx 바이트. */
export async function 엑셀만들기(game) {
  const { createWorkbookSheets } = await import("./xlsx-lite.js");
  // 비율 칸은 0.562 같은 분수로 넣고 엑셀에서 0.00% 서식으로 보이게 한다.
  // 56.2 로 넣으면 나중에 평균을 낼 때 100배 틀린 값이 나온다 (js/gamestats.js:236 과 같은 이유).
  const 합계 = 합계시트(game);
  const 팀 = 팀시트(game);
  const 쿼터 = 쿼터시트(game);
  const 비율 = (머리, 이름들) => 이름들.map((n) => 머리.indexOf(n)).filter((i) => i >= 0);
  return createWorkbookSheets([
    { name: "선수기록", rows: 합계, percentCols: 비율(합계[0], ["eFG%", "TS%"]) },
    { name: "팀효율", rows: 팀, percentCols: 비율(팀[0], ["eFG%", "TS%", "공격리바%", "수비리바%"]) },
    { name: "쿼터별", rows: 쿼터 },
    { name: "이벤트원본", rows: 원본시트(game) },
  ]);
}

/** 버튼에서 부르는 것. 파일을 만들어 바로 내려받는다. */
export async function 엑셀받기(game) {
  const bytes = await 엑셀만들기(game);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = 파일이름(game);
  a.click();
  URL.revokeObjectURL(url);
}
