// 한 경기 기록을 다루는 계산·검증·내보내기 로직만 모아둔다 (화면 코드는 statspage.js).
//
// 기록지 한 장 = 한 팀의 한 경기다. 그래서 이 파일의 "경기"는 항상 우리 팀 시점이고,
// 상대 팀 기록지는 별개의 경기 객체가 된다 (3파전이면 6장 = 6개).

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

export function emptyGame() {
  return {
    date: "",          // YYYY-MM-DD
    gameNo: 1,
    gameType: "자체전",
    us: "혼 A",
    them: "혼 B",
    // 쿼터별 "구간" 점수. 기록지에는 누적으로 적지만 저장은 구간으로 한다.
    usQ: [0, 0, 0, 0],
    themQ: [0, 0, 0, 0],
    players: [],
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

// 그날의 MOM. 동점이면 GameScore → 득점 → 어시스트 순으로 가린다.
// 원래 규칙은 "이긴 팀에서" 뽑는 것인데, 기록지 한 장은 한 팀뿐이라 여기서는
// 우리 팀 안에서만 고른다. 졌을 때는 부르는 이름을 바꿔서 쓰면 된다.
export function momOf(players) {
  const ranked = [...players].sort((a, b) => {
    const g = gameScore(b) - gameScore(a);
    if (Math.abs(g) > 1e-9) return g;
    const p = derive(b).pts - derive(a).pts;
    if (p) return p;
    return b.ast - a.ast;
  });
  return ranked[0] || null;
}

export function teamTotals(game) {
  const acc = {
    min: 0, p2m: 0, p2a: 0, p3m: 0, p3a: 0, fgm: 0, fga: 0, ftm: 0, fta: 0,
    pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
  };
  for (const p of game.players) {
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

export const usScore = (g) => g.usQ.reduce((a, b) => a + b, 0);
export const themScore = (g) => g.themQ.reduce((a, b) => a + b, 0);
export const result = (g) => (usScore(g) > themScore(g) ? "승" : usScore(g) < themScore(g) ? "패" : "무");

// 쿼터별 코트 위 인원 — 출전 쿼터 표시에서 뽑는다. 엑셀의 Play 줄이 이것이다.
export function lineups(game) {
  return [1, 2, 3, 4].map((q) =>
    game.players.filter((p) => p.quarters.includes(q)).map((p) => (p.no == null ? p.name : p.no))
  );
}

// ── 검증 ────────────────────────────────────────────────
// 사람이 옮겨 적을 때 새던 실수를 기계가 대신 잡는 자리다.
// 등급: "error"는 숫자가 확실히 틀린 것, "warn"은 사람이 확인만 하면 되는 것.
export function validate(game) {
  const issues = [];
  const add = (level, where, message) => issues.push({ level, where, message });

  const teamPts = teamTotals(game).pts;
  const scored = usScore(game);
  if (game.players.length && teamPts !== scored) {
    add("error", "점수",
      `쿼터 점수 합(${scored}점)과 선수 득점 합(${teamPts}점)이 ${Math.abs(scored - teamPts)}점 다릅니다.`);
  }

  if (game.usQ.some((v) => v < 0) || game.themQ.some((v) => v < 0)) {
    add("error", "점수", "쿼터 점수가 뒤로 줄었습니다 — 누적 점수를 잘못 적었을 수 있어요.");
  }

  for (const p of game.players) {
    const who = p.name || `#${p.no}`;
    if (p.p2m > p.p2a) add("error", who, `2점 성공(${p.p2m})이 시도(${p.p2a})보다 많습니다.`);
    if (p.p3m > p.p3a) add("error", who, `3점 성공(${p.p3m})이 시도(${p.p3a})보다 많습니다.`);
    if (p.ftm > p.fta) add("error", who, `자유투 성공(${p.ftm})이 시도(${p.fta})보다 많습니다.`);
    if (!p.quarters.length && (derive(p).pts || p.reb || p.ast)) {
      add("warn", who, "출전 쿼터가 비어 있는데 기록이 있습니다.");
    }
    if (p.memo && p.memo.trim()) add("warn", who, `비고가 적혀 있습니다 — "${p.memo.trim()}"`);
  }

  const names = game.players.map((p) => p.name).filter(Boolean);
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  if (dup.length) add("error", "명단", `같은 선수가 두 번 있습니다: ${[...new Set(dup)].join(", ")}`);

  lineups(game).forEach((five, i) => {
    if (five.length && five.length !== 5) {
      add("warn", `${i + 1}쿼터`, `코트 위 인원이 ${five.length}명입니다 (보통 5명).`);
    }
  });

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
  const r = result(game);
  const score = usScore(game);
  return game.players.map((p) => {
    const d = derive(p);
    return [
      game.gameType, sheetDateKey(game), game.us, r, score, p.name, d.min,
      p.p2m, p.p2a, roundPct(d.p2pct), p.p3m, p.p3a, roundPct(d.p3pct),
      d.fgm, d.fga, roundPct(d.fgpct), p.ftm, p.fta, roundPct(d.ftpct),
      d.pts, p.reb, p.ast, p.stl, p.blk, p.to, p.pf, p.memo || "", "",
    ];
  });
}

// 퍼센트로 소수 둘째 자리까지 보이려면 분수는 넷째 자리까지 있어야 한다.
// (6/11 = 0.5454… → 0.5455 → 54.55%. 셋째 자리에서 자르면 54.50% 이 되어버린다.)
const roundPct = (v) => Math.round(v * 10000) / 10000;

// ── 글로 남기는 요약 ─────────────────────────────────────
// 이미지·엑셀과 별개로, 밴드에 붙여넣거나 눈으로 훑을 수 있는 텍스트.
export function summaryText(game) {
  const t = teamTotals(game);
  const uS = usScore(game), tS = themScore(game);
  const pct = (v) => `${Math.round(v * 100)}%`;
  const byPts = [...game.players].sort((a, b) => derive(b).pts - derive(a).pts);
  const top = (key, label, unit) => {
    const sorted = [...game.players].sort((a, b) => (b[key] || 0) - (a[key] || 0));
    const best = sorted[0];
    return best && best[key] ? `${label} ${best.name} ${best[key]}${unit}` : null;
  };

  const lines = [
    `[${game.date} ${game.gameNo}경기] ${game.us} ${uS} : ${tS} ${game.them} — ${result(game)}`,
    "",
    `쿼터  ${game.us} ${perQuarterToCumulative(game.usQ).join(" / ")}`,
    `      ${game.them} ${perQuarterToCumulative(game.themQ).join(" / ")}`,
    "",
    `팀 기록  ${t.pts}점 · 리바 ${t.reb} · 어시 ${t.ast} · 스틸 ${t.stl} · 블락 ${t.blk} · 턴오버 ${t.to} · 파울 ${t.pf}`,
    `슛       2점 ${t.p2m}/${t.p2a} (${pct(t.p2pct)}) · 3점 ${t.p3m}/${t.p3a} (${pct(t.p3pct)}) · 자유투 ${t.ftm}/${t.fta} (${pct(t.ftpct)})`,
    `야투     ${t.fgm}/${t.fga} (${pct(t.fgpct)})`,
    "",
    "오늘의 기록",
  ];

  const best = momOf(game.players);
  if (best && game.players.length) {
    // 원래 MOM 은 "이긴 팀에서" 뽑는다. 기록지 한 장은 우리 팀뿐이라, 졌을 때는
    // MOM 이라고 부르지 않고 우리 팀 최고 활약으로만 적는다.
    const label = result(game) === "승" ? "MOM" : "우리 팀 최고";
    lines.push(`  ${label} ${best.name} (GameScore ${gameScore(best).toFixed(1)})`);
  }

  const highs = [
    byPts[0] && derive(byPts[0]).pts ? `득점 ${byPts[0].name} ${derive(byPts[0]).pts}점` : null,
    top("reb", "리바운드", "개"),
    top("ast", "어시스트", "개"),
    top("stl", "스틸", "개"),
    top("blk", "블락", "개"),
  ].filter(Boolean);
  lines.push(highs.length ? "  " + highs.join(" · ") : "  (기록 없음)");

  // 눈에 띄는 것 몇 가지만 짚는다 — 숫자를 다시 늘어놓지 않는다.
  const notes = [];
  if (t.fga >= 10 && t.fgpct >= 0.45) notes.push(`야투 ${pct(t.fgpct)}로 잘 들어간 경기`);
  if (t.fga >= 10 && t.fgpct <= 0.28) notes.push(`야투 ${pct(t.fgpct)}로 슛이 안 들어간 경기`);
  if (t.p3a >= 8 && t.p3pct >= 0.4) notes.push(`3점 ${t.p3m}/${t.p3a}로 외곽이 터짐`);
  if (t.to >= 15) notes.push(`턴오버 ${t.to}개로 많았음`);
  if (t.reb >= 35) notes.push(`리바운드 ${t.reb}개로 우세`);
  const diff = Math.abs(uS - tS);
  if (diff <= 3) notes.push(`${diff}점 차 접전`);
  else if (diff >= 20) notes.push(`${diff}점 차`);
  const qDiff = game.usQ.map((v, i) => v - game.themQ[i]);
  const bestQ = qDiff.indexOf(Math.max(...qDiff));
  const worstQ = qDiff.indexOf(Math.min(...qDiff));
  if (qDiff[bestQ] >= 6) notes.push(`${bestQ + 1}쿼터에 ${qDiff[bestQ]}점 앞섬`);
  if (qDiff[worstQ] <= -6) notes.push(`${worstQ + 1}쿼터에 ${-qDiff[worstQ]}점 밀림`);

  if (notes.length) {
    lines.push("", "짚어볼 점", "  " + notes.join("\n  "));
  }
  return lines.join("\n");
}
