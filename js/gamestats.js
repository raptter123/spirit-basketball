// 한 경기 기록을 다루는 계산·검증·내보내기 로직만 모아둔다 (화면 코드는 statspage.js).
//
// 한 경기 = 두 팀이다. 기록지는 팀마다 한 장씩 나오지만, 여기서는 두 장을 한 경기로
// 묶는다. 그래야 MOM 을 원래 규칙대로 "이긴 팀에서" 뽑을 수 있고, 결과표에서 두 팀
// 기록을 나란히 볼 수 있다.
//
// game.teams[0] 이 왼쪽, [1] 이 오른쪽이지만 계산은 둘을 구분하지 않는다.

// 쿼터 하나의 길이. 출전 쿼터 수에 이걸 곱해서 MIN을 낸다.
// 대회는 쿼터 시간이 다를 때가 있어서 값을 바꿀 수 있게 밖으로 뺐다.
export const MINUTES_PER_QUARTER = 8;

export function emptyPlayer(no = null, name = "") {
  return {
    no,
    name,
    quarters: [], // 뛴 쿼터 번호 [1,2,3,4] 중
    p2m: 0, p2a: 0,
    p3m: 0, p3a: 0,
    ftm: 0, fta: 0,
    reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
    memo: "",
  };
}

export function emptyTeam(name = "") {
  return {
    name,
    // 쿼터별 "구간" 점수. 기록지에는 누적으로 적지만 저장은 구간으로 한다.
    q: [0, 0, 0, 0],
    players: [],
  };
}

export function emptyGame() {
  return {
    date: "",          // YYYY-MM-DD
    gameNo: 1,
    gameType: "자체전",
    teams: [emptyTeam("혼 A"), emptyTeam("혼 B")],
  };
}

// 기록지에 누적으로 적힌 점수를 구간 점수로 바꾼다. [14,20,23,40] → [14,6,3,17]
export function cumulativeToPerQuarter(cum) {
  return cum.map((v, i) => (i === 0 ? v : v - cum[i - 1]));
}

export function perQuarterToCumulative(per) {
  let sum = 0;
  return per.map((v) => (sum += v));
}

// ── 선수 한 명의 파생값 ─────────────────────────────────
export function derive(p) {
  const fgm = p.p2m + p.p3m;
  const fga = p.p2a + p.p3a;
  const pct = (m, a) => (a > 0 ? m / a : 0);
  return {
    min: p.quarters.length * MINUTES_PER_QUARTER,
    fgm,
    fga,
    pts: p.p2m * 2 + p.p3m * 3 + p.ftm,
    p2pct: pct(p.p2m, p.p2a),
    p3pct: pct(p.p3m, p.p3a),
    fgpct: pct(fgm, fga),
    ftpct: pct(p.ftm, p.fta),
  };
}

// ── GameScore (John Hollinger) ───────────────────────────
// 득점·야투 효율·리바운드·어시스트를 한 숫자로 묶어 그날의 활약을 재는 지표.
//
//   pts + 0.4·fgm − 0.7·fga − 0.4·(fta − ftm)
//       + 0.7·oreb + 0.3·dreb
//       + stl + 0.7·ast + 0.7·blk − 0.4·pf − to
//
// ⚠️ 우리 기록지는 공격/수비 리바운드를 나눠 적지 않는다. 원식은 둘의 가중치가
// 달라서(0.7 / 0.3) 총 리바운드만으로는 정확히 못 낸다. 그래서 섞은 가중치를 쓴다.
//   0.7×(공격 비율) + 0.3×(수비 비율)
// OREB_SHARE 는 동호회 경기에서 공격 리바운드가 전체의 대략 3할이라는 통념값이다.
// 우리 기록으로 검증한 값이 아니라 **가정**이다. 기록지에 공격/수비 칸을 나누면
// 이 근사를 버리고 원식 그대로 쓸 수 있다 — 그때 REB_WEIGHT 자리를 갈아끼우면 된다.
export const OREB_SHARE = 0.3;
export const REB_WEIGHT = 0.7 * OREB_SHARE + 0.3 * (1 - OREB_SHARE); // 0.42

export function gameScore(p) {
  const d = derive(p);
  return (
    d.pts +
    0.4 * d.fgm -
    0.7 * d.fga -
    0.4 * (p.fta - p.ftm) +
    REB_WEIGHT * p.reb +
    p.stl +
    0.7 * p.ast +
    0.7 * p.blk -
    0.4 * p.pf -
    p.to
  );
}

// ── 팀 단위 계산 ─────────────────────────────────────────
export const teamScore = (team) => team.q.reduce((a, b) => a + b, 0);

// 이긴 팀 번호. 비기면 -1.
export function winnerIndex(game) {
  const [a, b] = game.teams.map(teamScore);
  if (a === b) return -1;
  return a > b ? 0 : 1;
}

export function teamResult(game, i) {
  const w = winnerIndex(game);
  return w === -1 ? "무" : w === i ? "승" : "패";
}

export function teamTotals(team) {
  const acc = {
    min: 0, p2m: 0, p2a: 0, p3m: 0, p3a: 0, fgm: 0, fga: 0, ftm: 0, fta: 0,
    pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
  };
  for (const p of team.players) {
    const d = derive(p);
    acc.min += d.min; acc.fgm += d.fgm; acc.fga += d.fga; acc.pts += d.pts;
    for (const k of ["p2m", "p2a", "p3m", "p3a", "ftm", "fta", "reb", "ast", "stl", "blk", "to", "pf"]) {
      acc[k] += p[k];
    }
  }
  const pct = (m, a) => (a > 0 ? m / a : 0);
  return {
    ...acc,
    p2pct: pct(acc.p2m, acc.p2a),
    p3pct: pct(acc.p3m, acc.p3a),
    fgpct: pct(acc.fgm, acc.fga),
    ftpct: pct(acc.ftm, acc.fta),
  };
}

// 쿼터별 코트 위 인원 — 출전 쿼터 표시에서 뽑는다. 엑셀의 Play 줄이 이것이다.
//
// 등번호에는 # 을 붙인다. 안 붙이면 등번호 없는 선수(권혁남)의 이름이 번호들 사이에
// 그냥 섞여서 "26 4 권혁남 47" 처럼 나온다 — 47 이 사람 이름인지 등번호인지 알 수가 없다.
export function lineups(team) {
  return [1, 2, 3, 4].map((q) =>
    team.players.filter((p) => p.quarters.includes(q)).map((p) => (p.no == null ? p.name : `#${p.no}`))
  );
}

// ── MOM ──────────────────────────────────────────────────
// 이긴 팀에서 GameScore 가 가장 높은 선수. 동점이면 GameScore → 득점 → 어시스트 순.
// 비겼을 때는 이긴 팀이 없으니 두 팀을 통틀어 고른다.
export function momOf(game) {
  const w = winnerIndex(game);
  const pool = (w === -1 ? game.teams : [game.teams[w]])
    .flatMap((t) => t.players.map((p) => ({ p, team: t })));
  if (!pool.length) return null;

  const ranked = [...pool].sort((x, y) => {
    const g = gameScore(y.p) - gameScore(x.p);
    if (Math.abs(g) > 1e-9) return g;
    const pt = derive(y.p).pts - derive(x.p).pts;
    if (pt) return pt;
    return y.p.ast - x.p.ast;
  });
  return { ...ranked[0], score: gameScore(ranked[0].p), tied: w === -1 };
}

// ── 검증 ────────────────────────────────────────────────
// 사람이 옮겨 적을 때 새던 실수를 기계가 대신 잡는 자리다.
// 등급: "error"는 숫자가 확실히 틀린 것, "warn"은 사람이 확인만 하면 되는 것.
export function validate(game) {
  const issues = [];
  const add = (level, where, message) => issues.push({ level, where, message });

  game.teams.forEach((team, ti) => {
    const label = team.name || `${ti + 1}팀`;
    const scored = teamScore(team);
    const teamPts = teamTotals(team).pts;
    if (team.players.length && teamPts !== scored) {
      add("error", label,
        `쿼터 점수 합(${scored}점)과 선수 득점 합(${teamPts}점)이 ${Math.abs(scored - teamPts)}점 다릅니다.`);
    }
    if (team.q.some((v) => v < 0)) {
      add("error", label, "쿼터 점수가 뒤로 줄었습니다 — 누적 점수를 잘못 적었을 수 있어요.");
    }

    for (const p of team.players) {
      const who = `${label} ${p.name || `#${p.no}`}`;
      if (p.p2m > p.p2a) add("error", who, `2점 성공(${p.p2m})이 시도(${p.p2a})보다 많습니다.`);
      if (p.p3m > p.p3a) add("error", who, `3점 성공(${p.p3m})이 시도(${p.p3a})보다 많습니다.`);
      if (p.ftm > p.fta) add("error", who, `자유투 성공(${p.ftm})이 시도(${p.fta})보다 많습니다.`);
      if (!p.quarters.length && (derive(p).pts || p.reb || p.ast)) {
        add("warn", who, "출전 쿼터가 비어 있는데 기록이 있습니다.");
      }
      if (p.memo && p.memo.trim()) add("warn", who, `비고가 적혀 있습니다 — "${p.memo.trim()}"`);
    }

    const names = team.players.map((p) => p.name).filter(Boolean);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length) add("error", label, `같은 선수가 두 번 있습니다: ${[...new Set(dup)].join(", ")}`);

    lineups(team).forEach((five, i) => {
      if (five.length && five.length !== 5) {
        add("warn", `${label} ${i + 1}쿼터`, `코트 위 인원이 ${five.length}명입니다 (보통 5명).`);
      }
    });
  });

  // 한 사람이 양 팀에 다 들어가 있으면 옮겨 적다 줄을 헷갈린 것이다.
  const [a, b] = game.teams.map((t) => new Set(t.players.map((p) => p.name).filter(Boolean)));
  const both = [...a].filter((n) => b.has(n));
  if (both.length) add("error", "명단", `양 팀에 모두 있는 선수가 있습니다: ${both.join(", ")}`);

  if (game.teams[0].name && game.teams[0].name === game.teams[1].name) {
    add("error", "팀 이름", "두 팀 이름이 같습니다.");
  }

  return issues;
}

// ── 누적 시트용 한 줄 ────────────────────────────────────
// 팀에서 쓰던 누적 엑셀은 "선수-경기 한 줄"짜리 긴 표다. 그 열 순서를 그대로 따른다.
export const CUMULATIVE_HEADERS = [
  "게임유형", "날짜", "팀", "승패", "팀점수", "이름", "시간",
  "2점성공", "2점시도", "2점야투", "3점성공", "3점시도", "3점야투",
  "전체성공", "전체시도", "전체야투", "자유투성공", "자유투시도", "자유투확률",
  "득점", "리바", "어시", "스틸", "블락", "턴오버", "파울", "비고", "기타",
];

// 이미 들어 있는 경기를 찾을 때 쓰는 열 자리 (0부터).
export const COL_DATE = CUMULATIVE_HEADERS.indexOf("날짜");
export const COL_TEAM = CUMULATIVE_HEADERS.indexOf("팀");

// 확률 열(0부터 센 자리). 값은 0.545 같은 분수로 넣고, 엑셀에서 0.00% 서식으로 보이게 한다.
// 값을 54.5 로 넣어버리면 나중에 평균을 낼 때 100배 틀린 숫자가 나온다 — 서식만 바꾼다.
export const PERCENT_COLUMNS = [
  CUMULATIVE_HEADERS.indexOf("2점야투"),
  CUMULATIVE_HEADERS.indexOf("3점야투"),
  CUMULATIVE_HEADERS.indexOf("전체야투"),
  CUMULATIVE_HEADERS.indexOf("자유투확률"),
];

// 날짜 열은 YYMMDD_경기번호 형태를 쓰고 있었다 (예: 260103_1).
export function sheetDateKey(game) {
  const d = (game.date || "").replaceAll("-", "").slice(2);
  return `${d}_${game.gameNo}`;
}

export function cumulativeRows(game) {
  const key = sheetDateKey(game);
  return game.teams.flatMap((team, ti) => {
    const r = teamResult(game, ti);
    const score = teamScore(team);
    return team.players.map((p) => {
      const d = derive(p);
      return [
        game.gameType, key, team.name, r, score, p.name, d.min,
        p.p2m, p.p2a, roundPct(d.p2pct), p.p3m, p.p3a, roundPct(d.p3pct),
        d.fgm, d.fga, roundPct(d.fgpct), p.ftm, p.fta, roundPct(d.ftpct),
        d.pts, p.reb, p.ast, p.stl, p.blk, p.to, p.pf, p.memo || "", "",
      ];
    });
  });
}

// 퍼센트로 소수 둘째 자리까지 보이려면 분수는 넷째 자리까지 있어야 한다.
// (6/11 = 0.5454… → 0.5455 → 54.55%. 셋째 자리에서 자르면 54.50% 이 되어버린다.)
const roundPct = (v) => Math.round(v * 10000) / 10000;

// ── 글로 남기는 요약 ─────────────────────────────────────
// 이미지·엑셀과 별개로, 밴드에 붙여넣거나 눈으로 훑을 수 있는 텍스트.
export function summaryText(game) {
  const [A, B] = game.teams;
  const aS = teamScore(A), bS = teamScore(B);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const w = winnerIndex(game);

  const lines = [
    `[${game.date} ${game.gameNo}경기] ${A.name} ${aS} : ${bS} ${B.name}` +
      (w === -1 ? " — 무승부" : ` — ${game.teams[w].name} 승`),
    "",
    `쿼터  ${A.name} ${perQuarterToCumulative(A.q).join(" / ")}`,
    `      ${B.name} ${perQuarterToCumulative(B.q).join(" / ")}`,
  ];

  const mom = momOf(game);
  if (mom) {
    lines.push("", `MOM  ${mom.p.name} (${mom.team.name}) · GameScore ${mom.score.toFixed(1)}` +
      (mom.tied ? " — 무승부라 양 팀에서 골랐습니다" : ""));
  }

  for (const team of game.teams) {
    if (!team.players.length) continue;
    const t = teamTotals(team);
    const top = (key, label, unit) => {
      const best = [...team.players].sort((a, b) => (b[key] || 0) - (a[key] || 0))[0];
      return best && best[key] ? `${label} ${best.name} ${best[key]}${unit}` : null;
    };
    const byPts = [...team.players].sort((a, b) => derive(b).pts - derive(a).pts)[0];
    const highs = [
      byPts && derive(byPts).pts ? `득점 ${byPts.name} ${derive(byPts).pts}점` : null,
      top("reb", "리바운드", "개"),
      top("ast", "어시스트", "개"),
      top("stl", "스틸", "개"),
      top("blk", "블락", "개"),
    ].filter(Boolean);

    lines.push(
      "",
      `── ${team.name} ──`,
      `팀 기록  ${t.pts}점 · 리바 ${t.reb} · 어시 ${t.ast} · 스틸 ${t.stl} · 블락 ${t.blk} · 턴오버 ${t.to} · 파울 ${t.pf}`,
      `슛       2점 ${t.p2m}/${t.p2a} (${pct(t.p2pct)}) · 3점 ${t.p3m}/${t.p3a} (${pct(t.p3pct)}) · 자유투 ${t.ftm}/${t.fta} (${pct(t.ftpct)})`,
      `야투     ${t.fgm}/${t.fga} (${pct(t.fgpct)})`,
      highs.length ? `기록     ${highs.join(" · ")}` : "기록     (없음)",
    );
  }

  // 눈에 띄는 것 몇 가지만 짚는다 — 숫자를 다시 늘어놓지 않는다.
  const notes = [];
  for (const team of game.teams) {
    if (!team.players.length) continue;
    const t = teamTotals(team);
    if (t.fga >= 10 && t.fgpct >= 0.45) notes.push(`${team.name} 야투 ${pct(t.fgpct)}로 잘 들어간 경기`);
    if (t.fga >= 10 && t.fgpct <= 0.28) notes.push(`${team.name} 야투 ${pct(t.fgpct)}로 슛이 안 들어간 경기`);
    if (t.p3a >= 8 && t.p3pct >= 0.4) notes.push(`${team.name} 3점 ${t.p3m}/${t.p3a}로 외곽이 터짐`);
    if (t.to >= 15) notes.push(`${team.name} 턴오버 ${t.to}개로 많았음`);
  }
  const rebA = teamTotals(A).reb, rebB = teamTotals(B).reb;
  if (A.players.length && B.players.length && Math.abs(rebA - rebB) >= 8) {
    notes.push(`리바운드 ${Math.abs(rebA - rebB)}개 차로 ${(rebA > rebB ? A : B).name} 우세`);
  }
  const diff = Math.abs(aS - bS);
  if (diff && diff <= 3) notes.push(`${diff}점 차 접전`);
  else if (diff >= 20) notes.push(`${diff}점 차`);
  const qDiff = A.q.map((v, i) => v - B.q[i]);
  const bestQ = qDiff.indexOf(Math.max(...qDiff));
  const worstQ = qDiff.indexOf(Math.min(...qDiff));
  if (qDiff[bestQ] >= 6) notes.push(`${bestQ + 1}쿼터에 ${A.name}이 ${qDiff[bestQ]}점 앞섬`);
  if (qDiff[worstQ] <= -6) notes.push(`${worstQ + 1}쿼터에 ${B.name}이 ${-qDiff[worstQ]}점 앞섬`);

  if (notes.length) lines.push("", "짚어볼 점", "  " + notes.join("\n  "));
  return lines.join("\n");
}
