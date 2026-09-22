// 이벤트 원본에서 고급 지표를 뽑는다. 박스스코어 너머, NBA 가 쓰는 효율 지표다.
//
// 왜 이제야 되나
//   이 지표들은 대부분 **포제션(공격 기회)** 을 분모로 쓴다. 포제션 추정식에는
//   공격 리바운드가 들어가는데, 종이 기록지는 공수를 안 나눠 적어서 낼 수가 없었다
//   (js/gamestats.js:78 의 경고가 그 이야기다 — 거기서는 공격 3할이라는 통념값으로
//   때웠다). 기록 탭이 공수를 나눠 적으면서 추정이 아니라 **센 값**으로 낼 수 있게 됐다.
//
// 분모가 0 일 때
//   슛을 한 번도 안 쏜 선수의 야투율은 0% 가 아니라 "없음" 이다. 0 으로 적으면
//   평균을 낼 때 못 쏜 사람이 못 넣은 사람으로 섞인다. 그래서 null 을 돌려주고,
//   화면에서는 "–" 로 적는다.
import { boxScore, pointsOf, scoreOf, playCount, qLabel } from "./record.js";

/** 자유투 시도를 포제션으로 환산하는 계수.
 *
 *  자유투 두 개가 포제션 하나라면 0.5 여야 하지만, 실제로는 and-1(한 개만 쏘고
 *  포제션이 이미 끝난 것)과 3점 파울(세 개)이 섞여서 조금 낮다. NBA 가 오래 써 온
 *  값이 0.44 다.
 *
 *  ⚠️ 이 값은 NBA 경기에서 얻은 것이고 우리 경기로 검증한 값이 아니다. 자유투가
 *  적은 동호회 경기에서는 어차피 영향이 작다 — 자유투 10개면 포제션 4.4개 차이다. */
export const FT_POSS = 0.44;

/** 100 포제션당 지표를 내보이기 시작하는 최소 포제션 수.
 *
 *  포제션 하나에서 2점이 나면 ORtg 200 이다. 숫자로는 맞지만 "이 팀의 공격력이
 *  200" 이라는 뜻은 전혀 아니다 — 표본이 하나뿐이라 아무것도 말해 주지 않는다.
 *  그런 값을 큰 글씨로 띄우면 정밀해 보이는 거짓말이 된다.
 *
 *  ⚠️ 10 이라는 선은 우리 기록으로 정한 값이 아니라 **판단**이다. 8분 쿼터 자체전
 *  한 쿼터가 대략 포제션 15~20 개이므로, 한 쿼터도 안 되는 분량은 안 보여 준다는
 *  뜻으로 잡았다. 경기를 몇 판 쌓아 실제 분포를 재면 그때 고치면 된다. */
export const MIN_POSS = 10;

const 나누기 = (a, b) => (b > 0 ? a / b : null);

/** 선수 한 줄(boxScore 의 결과)에서 효율 지표를 낸다. */
export function 효율(r) {
  const fgm = r.p2m + r.p3m;
  const fga = r.p2a + r.p3a;
  return {
    fgm, fga,
    // eFG% — 3점은 한 개에 1.5개 값을 하므로 그만큼 쳐준다.
    efg: 나누기(fgm + 0.5 * r.p3m, fga),
    // TS% — 자유투까지 포함한 진짜 득점 효율. 분모의 2 는 "슛 한 번에 2점" 기준이다.
    ts: 나누기(r.pts, 2 * (fga + FT_POSS * r.fta)),
    // 어시스트를 턴오버로 나눈 값. 턴오버가 0이면 나눌 수 없다 —
    // "무한히 좋다" 가 아니라 "잴 수 없다" 이므로 null 이다.
    astTo: 나누기(r.ast, r.to),
  };
}

/** 교체를 거꾸로 되감아 경기 시작 때의 라인업을 복원한다.
 *
 *  teams[i].onCourt 는 지금 코트에 있는 사람이라 교체가 일어나면 덮어써진다.
 *  시작 라인업을 따로 저장해 두지 않았으므로, 남아 있는 교체 기록을 뒤에서부터
 *  하나씩 되돌려 처음 모습을 되찾는다. (되돌리기 단추가 하는 일과 같다) */
export function 시작라인업(game) {
  const lines = game.teams.map((t) => [...(t.onCourt || [])]);
  for (let i = game.events.length - 1; i >= 0; i--) {
    const e = game.events[i];
    if (e.type !== "sub") continue;
    const L = lines[e.team];
    const k = L.indexOf(e.player);
    if (e.out) {
      // 바꿔 넣은 교체 — 들어온 사람 자리에 나간 사람을 되돌린다.
      if (k >= 0) L[k] = e.out;
      else L.push(e.out);
    } else if (k >= 0) {
      // 빈자리에 채워 넣은 것 — 도로 뺀다.
      L.splice(k, 1);
    }
  }
  return lines;
}

/** +/- — 그 선수가 코트에 있는 동안 팀이 얼마나 앞섰나.
 *
 *  기록을 앞에서부터 다시 재생하면서, 점수가 날 때마다 그 순간 코트에 있던
 *  선수들에게 득실을 더한다. 교체가 드문 자체전에서는 대개 팀 득실차와 같지만,
 *  대회처럼 교체가 잦으면 여기서 갈린다.
 *
 *  돌아오는 값: { "0|김성훈": 12, … } — 팀번호와 이름을 묶은 열쇠다. */
export function plusMinus(game) {
  const 키 = (t, n) => `${t}|${n}`;
  const pm = {};
  game.teams.forEach((t, ti) => t.players.forEach((p) => { pm[키(ti, p.name)] = 0; }));

  const lines = 시작라인업(game);
  for (const e of game.events) {
    if (e.type === "sub") {
      const L = lines[e.team];
      const k = L.indexOf(e.out);
      if (e.out && k >= 0) L[k] = e.player;
      else if (!L.includes(e.player)) L.push(e.player);
      continue;
    }
    const pts = pointsOf(e);
    if (!pts) continue;
    for (const ti of [0, 1]) {
      const 부호 = ti === e.team ? pts : -pts;
      for (const n of lines[ti]) {
        if (pm[키(ti, n)] !== undefined) pm[키(ti, n)] += 부호;
      }
    }
  }
  return pm;
}

/** 팀 하나의 합계. boxScore 를 팀별로 더한다. */
function 팀합계(game, ti, events) {
  const acc = { pts: 0, p2m: 0, p2a: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0,
    rebO: 0, rebD: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0 };
  for (const r of boxScore(game, events)) {
    if (r.team !== ti) continue;
    for (const k of Object.keys(acc)) acc[k] += r[k];
  }
  return acc;
}

/** 팀 지표. 두 팀을 같이 봐야 나오는 것들이 있어(수비 효율·리바운드 점유율)
 *  한 팀씩이 아니라 경기 단위로 낸다. */
export function 팀지표(game, events = game.events) {
  const T = [0, 1].map((ti) => 팀합계(game, ti, events));

  // 포제션(공격 기회) 추정식 — NBA 가 쓰는 것과 같다.
  //   슛 시도 − 공격 리바운드 + 턴오버 + 0.44 × 자유투 시도
  // 공격 리바운드를 빼는 이유는, 잡아서 다시 공격하면 포제션이 새로 시작된 게
  // 아니라 같은 포제션이 이어진 것이기 때문이다.
  const poss = T.map((t) => (t.p2a + t.p3a) - t.rebO + t.to + FT_POSS * t.fta);

  // 두 팀의 포제션 수는 거의 같다(공을 주고받으므로). 한쪽이 모자라면 양쪽 다
  // 못 믿으므로, 표본이 넉넉한지는 두 팀을 같이 본다.
  const 넉넉 = Math.min(poss[0], poss[1]) >= MIN_POSS;

  return [0, 1].map((ti) => {
    const me = T[ti], 상대 = T[1 - ti];
    const e = 효율({ ...me, pts: me.pts });
    // 100 포제션당 득점 / 실점. 경기 속도가 달라도 견줄 수 있게 만드는 값이다.
    // 같은 20점도 포제션 40개에서 낸 것과 80개에서 낸 것은 다르다.
    const rate = (pts, n) => (넉넉 && n > 0 ? (pts / n) * 100 : null);
    const o = rate(me.pts, poss[ti]);
    const d = rate(상대.pts, poss[1 - ti]);
    return {
      ...me,
      poss: poss[ti],
      넉넉,
      ortg: o,
      drtg: d,
      net: o != null && d != null ? o - d : null,
      efg: e.efg,
      ts: e.ts,
      // 턴오버율 — 포제션 100개 중 몇 개를 그냥 내줬나.
      tov: rate(me.to, poss[ti]),
      // 리바운드 점유율 — 잡을 수 있었던 것 중 몇 할을 잡았나.
      // 내 공격 리바운드의 상대는 상대의 수비 리바운드다.
      orbPct: 나누기(me.rebO, me.rebO + 상대.rebD),
      drbPct: 나누기(me.rebD, me.rebD + 상대.rebO),
    };
  });
}

/** 화면과 엑셀이 같이 쓰는 표시 규칙. 잴 수 없는 값은 0 이 아니라 "–" 다. */
export const pct1 = (v) => (v == null ? "–" : `${(v * 100).toFixed(1)}%`);
export const num1 = (v) => (v == null ? "–" : v.toFixed(1));
export const 부호 = (v) => (v > 0 ? `+${v}` : `${v}`);

/** 경기 한 줄 요약에 쓸 승패. 비기면 "무". */
export function 승패(game, ti) {
  const [a, b] = scoreOf(game.events);
  if (a === b) return "무";
  return (a > b ? 0 : 1) === ti ? "승" : "패";
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-09-22" → "9/22 (화)". 목록에서는 연도보다 요일이 쓸모 있다 —
 *  수요일 자체전인지 주말 대회인지가 한눈에 갈린다. */
export function 짧은날짜(s) {
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

/** 지난 경기 목록 한 줄에 필요한 것만 추린다.
 *  목록은 경기가 스무 개까지 쌓이므로, 줄마다 boxScore 를 두 번 돌리지 않도록
 *  여기서 한 번에 뽑는다. */
export function 경기요약(game) {
  const [a, b] = scoreOf(game.events);
  const rows = boxScore(game);
  // 최다 득점자. 동점이면 리바운드·어시스트가 많은 쪽을 앞에 둔다.
  const 최다 = rows
    .filter((r) => r.pts > 0)
    .sort((x, y) => y.pts - x.pts || (y.reb + y.ast) - (x.reb + x.ast))[0] || null;
  const 마지막쿼터 = game.events.reduce((m, e) => Math.max(m, e.q || 1), game.q || 1);
  return {
    날짜: 짧은날짜(game.date),
    점수: [a, b],
    이긴팀: a === b ? -1 : a > b ? 0 : 1,
    이름: game.teams.map((t) => t.name),
    마지막쿼터,
    기록수: playCount(game.events),
    최다,
  };
}
