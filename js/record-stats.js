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
import { boxScore, pointsOf, scoreOf, playCount, qLabel, zoneOf } from "./record.js";

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

const RIM = { x: 250, y: 442 };

/** 슛 하나가 어느 자리에서 나왔나. 골밑은 골대에서 100 안쪽이다.
 *  코트 그림은 실제 치수대로 그린 것이 아니라 "몇 m" 로는 못 바꾼다(record-export.js
 *  머리말 참고). 그림 좌표에서 확실하게 나오는 구역만 적는다. */
export function 구역이름(e) {
  if (e.type !== "shot") return "";
  if (zoneOf(e.x, e.y) === 3) return "3점";
  return Math.hypot(e.x - RIM.x, e.y - RIM.y) <= 100 ? "골밑" : "미들";
}

/** 화면에서 본 좌우. 페인트존 양 끝(170 / 330)을 경계로 삼는다. */
export function 좌우이름(e) {
  if (e.type !== "shot") return "";
  if (e.x < 170) return "왼쪽";
  if (e.x > 330) return "오른쪽";
  return "가운데";
}

export const 구역들 = ["골밑", "미들", "3점"];

/** 슛 목록 → 자리별 성공/시도. 좌표를 그림 대신 말로 옮긴 것이다 —
 *  샷 차트가 알려 주는 것의 대부분은 "어디서 쐈고 거기서 얼마나 들어갔나" 다. */
export function 구역집계(shots) {
  const 칸 = Object.fromEntries(구역들.map((z) => [z, { m: 0, a: 0 }]));
  for (const e of shots) {
    const z = 칸[구역이름(e)];
    if (!z) continue;
    z.a++;
    if (e.made) z.m++;
  }
  return 칸;
}

/** 팀 하나의 자리별 슛. */
export function 구역별(game, ti, events = game.events) {
  return 구역집계(events.filter((e) => e.type === "shot" && e.team === ti));
}

/** 선수마다 자리별 슛을 모은 표.
 *
 *  샷 차트 그림은 한 사람씩 받아야 하고, 무엇보다 기록한 기기에만 남아 다른 사람은
 *  못 본다. 좌표에서 나온 값이 바깥으로 나가는 길은 엑셀과 밴드 글뿐이므로,
 *  거기에 선수별 표로 실어 보낸다.
 *
 *  슛을 안 쏜 선수도 0 으로 넣는다 — 선수기록 시트와 줄 순서가 같아야
 *  기록원이 두 시트를 나란히 놓고 볼 수 있다. */
export function 자리별선수(game, events = game.events) {
  const 빈칸 = () => Object.fromEntries(구역들.map((z) => [z, { m: 0, a: 0 }]));
  const 표 = [];
  game.teams.forEach((team, ti) => {
    for (const p of team.players) {
      const mine = events.filter((e) => e.type === "shot" && e.team === ti && e.player === p.name);
      const 칸 = 빈칸();
      for (const e of mine) {
        const z = 칸[구역이름(e)];
        if (!z) continue;
        z.a++;
        if (e.made) z.m++;
      }
      표.push({
        team: ti, name: p.name, number: p.number, 칸,
        총: { m: mine.filter((e) => e.made).length, a: mine.length },
      });
    }
  });
  return 표;
}

/** 여러 경기에서 슛만 모은다. 한 경기의 열다섯 개로는 "어디서 잘 들어가나" 를
 *  말할 수 없다 — 보관함을 통째로 걸어야 비로소 자리마다 표본이 쌓인다.
 *  경기마다 팀이 바뀌므로(오늘 A팀, 다음엔 B팀) 사람은 **이름으로** 맞춘다. */
export function 슛모음(games, 이름 = null, 팀 = null) {
  const out = [];
  for (const g of games) {
    for (const e of g.events) {
      if (e.type !== "shot") continue;
      if (이름 && e.player !== 이름) continue;
      if (팀 != null && e.team !== 팀) continue;
      out.push(e);
    }
  }
  return out;
}

/** 샷 차트에 이름을 올릴 사람들. 슛을 한 번이라도 쏜 사람만, 많이 쏜 순으로. */
export function 슛쏜사람(games) {
  const 셈 = new Map();
  for (const g of games) {
    for (const e of g.events) {
      if (e.type !== "shot") continue;
      const v = 셈.get(e.player) || { name: e.player, a: 0, m: 0 };
      v.a++;
      if (e.made) v.m++;
      셈.set(e.player, v);
    }
  }
  return [...셈.values()].sort((x, y) => y.a - x.a || x.name.localeCompare(y.name, "ko"));
}

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

/** 내려받는 파일 이름에 붙일 대진 표시.
 *
 *  3파전은 같은 날 세 경기를 받는다. 이름이 날짜와 시각뿐이면 세 파일이 같은 이름으로
 *  떨어져서 받는 족족 앞의 것을 덮어쓴다(실제로 세 개가 다 `spirit-game-2026-09-23-0434`
 *  로 나왔다). 그래서 팀 이름에서 아스키 글자를 따 붙인다 — "A팀" → "A", 곧 "AB".
 *
 *  딸 글자가 없으면(이름이 전부 한글이면) 시작 시각의 밀리초를 쓴다. 한 세션의
 *  경기들은 startedAt 을 한 칸씩 띄워 만들므로 여기서 갈린다.
 *
 *  아스키만 쓰는 이유: 크로미움은 a[download] 이름에 한글이 섞이면 이름을 통째로
 *  버리고 확장자 없는 "download" 로 받는다. */
export function 대진표시(game) {
  const 딴것 = (game.teams || []).map((t) => (String(t?.name || "").match(/[A-Za-z0-9]+/) || [""])[0]);
  return 딴것.length && 딴것.every(Boolean)
    ? 딴것.join("")
    : String((game.startedAt || 0) % 1000).padStart(3, "0");
}

/** 내려받는 파일 이름의 뒷부분 — "2026-09-23-1715-AB".
 *
 *  엑셀과 밴드 이미지가 이 함수 하나를 같이 쓴다. 전에는 각자 이름을 만들었는데
 *  엑셀에만 시각이 들어가고 이미지에는 빠져서, 같은 날 A팀–B팀을 두 번 하면 두 번째
 *  이미지가 첫 번째를 덮어썼다. 한 곳에서 만들면 둘이 다시 갈라질 수 없다.
 *
 *  시각은 경기를 **시작한** 때다. 끝낸 때로 하면 같은 경기를 두 번 받을 때 이름이
 *  달라져 한 경기가 파일 두 개로 남는다. */
export function 파일꼬리(game) {
  const d = new Date(game.startedAt || Date.now());
  const 시각 = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `${game.date}-${시각}-${대진표시(game)}`;
}

/** Blob 을 파일로 내려준다.
 *
 *  주소(object URL)를 a.click() 바로 뒤에 거두면 사파리·파이어폭스는 받기를 시작하기도
 *  전에 주소가 사라져 받기가 조용히 취소될 수 있다. 크로미움은 괜찮아서 여기서는 티가
 *  안 났다. 넉넉히 1분 뒤에 거둔다 — 그동안 차지하는 것은 이 파일 크기만큼의 메모리다. */
export function 내려주기(blob, 이름) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = 이름;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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

// ── 밴드에 붙일 글 ───────────────────────────────────────
// 엑셀은 기록원이 누적용으로 챙기는 것이고, 경기 당일 밴드에 올리는 건 글이다.
// 그래서 숫자를 표가 아니라 문장으로 늘어놓는다. 밴드는 서식을 못 살리므로
// 고정폭 글꼴에 기대는 줄맞춤은 쓰지 않는다 — 어디서 봐도 같게 읽혀야 한다.

const 퍼센트 = (m, a) => (a > 0 ? ` (${Math.round((m / a) * 100)}%)` : "");
const 몇개 = (v, 단위 = "") => `${v}${단위}`;

/** 자리별 슛 한 줄. 좌표가 남긴 것 중 사람이 실제로 읽는 부분이다. */
function 구역줄(game, ti) {
  const z = 구역별(game, ti);
  const 쓸것 = 구역들.filter((k) => z[k].a > 0);
  if (!쓸것.length) return null;
  return `자리 — ${쓸것.map((k) => `${k} ${z[k].m}/${z[k].a}${퍼센트(z[k].m, z[k].a)}`).join(" · ")}`;
}

/** 선수 한 줄. 0 인 항목은 빼서 눈이 숫자에 걸리지 않게 한다. */
function 선수줄(r) {
  const 조각 = [`${r.pts}점`];
  // 야투(2점+3점 합)로 적으면 옆의 "3점 0/1" 과 겹쳐 보여 헷갈린다. 나눠 적는다.
  if (r.p2a) 조각.push(`2점 ${r.p2m}/${r.p2a}`);
  if (r.p3a) 조각.push(`3점 ${r.p3m}/${r.p3a}`);
  if (r.fta) 조각.push(`자유투 ${r.ftm}/${r.fta}`);
  if (r.reb) 조각.push(`리바 ${r.reb}`);
  if (r.ast) 조각.push(`어시 ${r.ast}`);
  if (r.stl) 조각.push(`스틸 ${r.stl}`);
  if (r.blk) 조각.push(`블락 ${r.blk}`);
  if (r.to) 조각.push(`턴오버 ${r.to}`);
  if (r.pf) 조각.push(`파울 ${r.pf}`);
  return `  ${r.name} ${조각.join(" · ")}`;
}

/** 숫자를 다시 늘어놓지 않고, 눈에 띄는 것만 몇 줄 짚는다.
 *  값이 없거나 표본이 모자라면 아예 말하지 않는다 — 없는 이야기를 지어내지 않는다. */
function 짚어볼점(game, T) {
  const 말 = [];
  const 이름 = game.teams.map((t) => t.name);
  const [sa, sb] = scoreOf(game.events);
  const 차 = Math.abs(sa - sb);

  for (const ti of [0, 1]) {
    const t = T[ti];
    const fga = t.p2a + t.p3a;
    if (fga >= 10 && t.efg != null) {
      if (t.efg >= 0.55) 말.push(`${이름[ti]} eFG ${pct1(t.efg)} 로 슛이 잘 들어간 경기`);
      else if (t.efg <= 0.35) 말.push(`${이름[ti]} eFG ${pct1(t.efg)} 로 슛이 안 들어간 경기`);
    }
    if (t.p3a >= 8 && t.p3m / t.p3a >= 0.4) {
      말.push(`${이름[ti]} 3점 ${t.p3m}/${t.p3a} 로 외곽이 터짐`);
    }
    if (t.넉넉 && t.tov != null && t.tov >= 20) {
      // "다섯 번에 한 번" 처럼 고정해 두면 31.6% 에도 같은 말이 나가 틀린 글이 된다.
      말.push(`${이름[ti]} 턴오버율 ${t.tov.toFixed(1)}% — 공격 ${Math.round(100 / t.tov)}번에 한 번꼴로 그냥 내줌`);
    }
    if (t.orbPct != null && t.rebO + t.rebD >= 10 && t.orbPct >= 0.4) {
      말.push(`${이름[ti]} 공격 리바운드 ${pct1(t.orbPct)} 로 두 번째 기회를 많이 만듦`);
    }
    // 어디서 쐈나가 한쪽으로 쏠렸을 때만 짚는다
    const z = 구역별(game, ti);
    const 총 = 구역들.reduce((a, k) => a + z[k].a, 0);
    if (총 >= 12) {
      for (const k of 구역들) {
        if (z[k].a / 총 >= 0.6) 말.push(`${이름[ti]} 슛의 ${Math.round((z[k].a / 총) * 100)}% 가 ${k} 에서 나옴 — ${z[k].m}/${z[k].a}`);
      }
    }
  }

  const 리바차 = Math.abs(T[0].reb - T[1].reb);
  if (리바차 >= 8) 말.push(`리바운드 ${리바차}개 차로 ${이름[T[0].reb > T[1].reb ? 0 : 1]} 우세`);
  if (차 && 차 <= 3) 말.push(`${차}점 차 접전`);
  else if (차 >= 20) 말.push(`${차}점 차`);
  return 말;
}

/** 밴드에 그대로 붙여 넣을 경기 요약. */
export function 밴드글(game) {
  const [sa, sb] = scoreOf(game.events);
  const T = 팀지표(game);
  const rows = boxScore(game);
  const 이름 = game.teams.map((t) => t.name);
  const 이긴팀 = sa === sb ? -1 : sa > sb ? 0 : 1;
  const 쿼터들 = [...new Set(game.events.map((e) => e.q || 1))].sort((a, b) => a - b);
  const L = [];

  L.push(`[${game.date}] ${이름[0]} ${sa} : ${sb} ${이름[1]}`
    + (이긴팀 === -1 ? " — 무승부" : ` — ${이름[이긴팀]} 승`));
  L.push(`${qLabel(쿼터들[쿼터들.length - 1] || 1, game.quarters)}까지 · 기록 ${playCount(game.events)}개`);

  if (쿼터들.length > 1) {
    L.push("", "■ 쿼터별");
    for (const ti of [0, 1]) {
      const 점 = 쿼터들.map((q) => scoreOf(game.events.filter((e) => (e.q || 1) === q))[ti]);
      L.push(`${이름[ti]}  ${점.join(" / ")}`);
    }
  }

  if (T[0].넉넉) {
    L.push("", "■ 팀 효율 (100 포제션 기준)");
    for (const ti of [0, 1]) {
      const t = T[ti];
      L.push(`${이름[ti]} — 공격 ${num1(t.ortg)} · 수비 ${num1(t.drtg)} · Net ${t.net > 0 ? "+" : ""}${num1(t.net)}`);
      L.push(`  eFG ${pct1(t.efg)} · TS ${pct1(t.ts)} · 턴오버율 ${num1(t.tov)}% · 공격리바 ${pct1(t.orbPct)}`);
    }
  }

  for (const ti of [0, 1]) {
    const t = T[ti];
    L.push("", `■ ${이름[ti]} ${t.pts}점`);
    L.push(`슛 — 2점 ${t.p2m}/${t.p2a}${퍼센트(t.p2m, t.p2a)}`
      + ` · 3점 ${t.p3m}/${t.p3a}${퍼센트(t.p3m, t.p3a)}`
      + ` · 자유투 ${t.ftm}/${t.fta}${퍼센트(t.ftm, t.fta)}`);
    const 자리 = 구역줄(game, ti);
    if (자리) L.push(자리);
    L.push(`팀 — 리바 ${몇개(t.reb)}${t.rebO + t.rebD ? ` (공 ${t.rebO} / 수 ${t.rebD})` : ""}`
      + ` · 어시 ${t.ast} · 스틸 ${t.stl} · 블락 ${t.blk} · 턴오버 ${t.to} · 파울 ${t.pf}`);
    // 기록이 하나도 없는 선수는 빼고, 득점 많은 순으로 적는다.
    const 뛴사람 = rows.filter((r) => r.team === ti)
      .filter((r) => r.pts || r.p2a || r.p3a || r.fta || r.reb || r.ast || r.stl || r.blk || r.to || r.pf)
      .sort((x, y) => y.pts - x.pts || (y.reb + y.ast) - (x.reb + x.ast));
    for (const r of 뛴사람) L.push(선수줄(r));
  }

  // 자리별 — 샷 차트를 글로 옮긴 것. 그림은 한 사람씩 받아야 하고 기록한 기기에만
  // 남으므로, 다른 사람이 보는 길은 이 줄과 엑셀의 자리별 시트뿐이다.
  const 쏜사람 = 자리별선수(game)
    .filter((r) => r.총.a > 0)
    .sort((x, y) => x.team - y.team || y.총.a - x.총.a);
  if (쏜사람.length) {
    L.push("", "■ 자리별 슛 (골밑 / 미들 / 3점)");
    let 앞팀 = -1;
    for (const r of 쏜사람) {
      if (r.team !== 앞팀) { L.push(`[${이름[r.team]}]`); 앞팀 = r.team; }
      const 칸 = 구역들
        .filter((z) => r.칸[z].a > 0)
        .map((z) => `${z} ${r.칸[z].m}/${r.칸[z].a}${퍼센트(r.칸[z].m, r.칸[z].a)}`);
      L.push(`  ${r.name} ${r.총.m}/${r.총.a} — ${칸.join(" · ")}`);
    }
  }

  const 말 = 짚어볼점(game, T);
  if (말.length) L.push("", "■ 짚어볼 점", ...말.map((m) => `- ${m}`));
  return L.join("\n");
}
