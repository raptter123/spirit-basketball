// 밴드에 올릴 결과 이미지 한 장, 그리고 엑셀에 박아 넣을 차트 그림.
//
// 두 쓰임이 한 파일에 있는 이유는 팔레트가 같아야 하기 때문이다. 밖으로 나가는
// 그림은 화면 테마를 따르면 안 되므로 색을 고정해 두는데, 그 고정 색이 여기 한
// 벌뿐이라 밴드 이미지와 엑셀 속 차트가 언제나 같은 모양으로 나온다.
//
// 왜 글이 아니라 그림인가
//   숫자를 줄글로 늘어놓으면 밴드에서 읽기 어렵다. 표는 칸이 맞아야 읽히는데
//   밴드는 고정폭 글꼴이 아니라 공백으로 맞춘 줄이 다 어긋난다. 그래서 표는
//   그림으로 그린다 — 기기·테마·글꼴에 상관없이 언제나 같은 모양이 나온다.
//   (js/gameimage.js 가 종이 기록지 쪽에서 같은 이유로 같은 길을 택했고,
//    색도 거기 쓰던 것을 그대로 가져와 밴드에 올라가는 두 그림이 한 짝으로 보인다.)
//
// 왜 한 장에 다 넣는가
//   샷 차트를 사람마다 따로 받으면 열 번을 받아야 하고, 밴드에 열 장을 올리면
//   아무도 안 본다. 결과 · 팀 효율 · 박스스코어 · 팀 샷차트 · 선수 샷차트를
//   한 장에 세로로 잇는다. 길어지지만 밴드는 세로로 넘기는 곳이다.
//
// 왜 테마를 안 따르는가
//   이 그림은 내 화면이 아니라 남이 볼 곳으로 간다. 어두운 테마에서 뽑아 올리면
//   밴드에서 배경이 검은 그림이 되므로, 색을 고정해 둔다.
import { boxScore, scoreOf, playCount, qLabel } from "./record.js";
import {
  효율, plusMinus, 팀지표, 자리별선수, 구역들, 구역집계, 슛모음, 대진표시, pct1, num1,
} from "./record-stats.js";
import { 차트속, CHART_VIEW, PNG만들기 } from "./record-chart.js";

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

// 고정 팔레트. js/gameimage.js 의 것과 같은 색이다.
const C = {
  bg: "#ffffff", band: "#151b33", bandText: "#ffffff",
  head: "#2c3557", headText: "#dfe4f5",
  ink: "#161b28", ink2: "#6a7288", line: "#d7dbe6",
  zebra: "#f5f7fb", total: "#eaeef7", win: "#e8590c", draw: "#7c7f8a",
  made: "#12833f", miss: "#c02626",
  team: ["#c2410c", "#15803d"],
};
// 코트 그림에 쓸 색 — 흰 바탕에 얹으므로 바닥을 옅게 둔다.
const COURT = {
  line: "#98a0b8", paint: "#eef1f8", floor: "#f7f9fd",
  rim: C.win, made: C.made, miss: C.miss, ink: C.ink,
};

const W = 1000;          // 그리는 좌표계 너비
const PAD = 24;
const INNER = W - PAD * 2;

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** 글자 한 줄. 기본은 왼쪽 정렬, 가운데·오른쪽은 anchor 로 옮긴다. */
function T(x, y, s, { size = 16, weight = 400, fill = C.ink, anchor = "start", op = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}"`
    + ` fill="${fill}" text-anchor="${anchor}"${op < 1 ? ` opacity="${op}"` : ""}>${esc(s)}</text>`;
}

const 사각 = (x, y, w, h, fill, r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${r ? ` rx="${r}"` : ""} />`;

// ── 박스스코어 열 ────────────────────────────────────────
// 칸 자리를 고정해 두고 숫자는 가운데 맞춘다. SVG 안에서는 글자 너비를 잴 수 없어
// 자동 정렬이 안 되므로, 가장 긴 값("10/12")이 들어가도 넘치지 않게 넓이를 잡았다.
// 글자는 PAD + 12 (=36) 에서 시작하고 표 오른쪽 끝은 976 이므로, 가운데 맞춘 칸의
// x 는 940 을 넘으면 안 된다. 처음에 +/- 를 944 에 두어 오른쪽이 잘렸다.
const COLS = [
  { k: "name", t: "선수", x: 0, a: "start" },
  { k: "pts", t: "득점", x: 148, a: "middle" },
  { k: "p2", t: "2점", x: 210, a: "middle" },
  { k: "p3", t: "3점", x: 278, a: "middle" },
  { k: "ft", t: "자유투", x: 350, a: "middle" },
  { k: "reb", t: "리바", x: 440, a: "middle" },
  { k: "ast", t: "어시", x: 528, a: "middle" },
  { k: "stl", t: "스틸", x: 584, a: "middle" },
  { k: "blk", t: "블락", x: 640, a: "middle" },
  { k: "to", t: "턴오버", x: 700, a: "middle" },
  { k: "pf", t: "파울", x: 762, a: "middle" },
  { k: "efg", t: "eFG%", x: 838, a: "middle" },
  { k: "pm", t: "+/-", x: 908, a: "middle" },
];
const ROW_H = 34;

function 박스스코어(rows, pm, ti, 팀이름, y) {
  const 줄 = rows.filter((r) => r.team === ti);
  const out = [];
  out.push(사각(PAD, y, INNER, 30, C.team[ti], 6));
  out.push(T(PAD + 12, y + 21, 팀이름, { size: 16, weight: 800, fill: "#ffffff" }));
  let cy = y + 30;

  out.push(사각(PAD, cy, INNER, 28, C.head));
  for (const c of COLS) {
    out.push(T(PAD + 12 + c.x, cy + 19, c.t, { size: 13, weight: 700, fill: C.headText, anchor: c.a }));
  }
  cy += 28;

  줄.forEach((r, i) => {
    if (i % 2) out.push(사각(PAD, cy, INNER, ROW_H, C.zebra));
    const e = 효율(r);
    const p = pm[`${ti}|${r.name}`] ?? 0;
    const 값 = {
      name: r.name, pts: String(r.pts),
      p2: `${r.p2m}/${r.p2a}`, p3: `${r.p3m}/${r.p3a}`, ft: `${r.ftm}/${r.fta}`,
      reb: r.rebO + r.rebD ? `${r.reb} (${r.rebO}/${r.rebD})` : String(r.reb),
      ast: String(r.ast), stl: String(r.stl), blk: String(r.blk),
      to: String(r.to), pf: String(r.pf),
      efg: pct1(e.efg), pm: p > 0 ? `+${p}` : String(p),
    };
    for (const c of COLS) {
      const 굵게 = c.k === "name" || c.k === "pts";
      const 색 = c.k === "pm" ? (p > 0 ? C.made : p < 0 ? C.miss : C.ink2) : C.ink;
      out.push(T(PAD + 12 + c.x, cy + 23, 값[c.k],
        { size: c.k === "reb" ? 13 : 14, weight: 굵게 ? 800 : 500, fill: 색, anchor: c.a }));
    }
    out.push(`<line x1="${PAD}" y1="${cy + ROW_H}" x2="${PAD + INNER}" y2="${cy + ROW_H}" stroke="${C.line}" stroke-width="1" />`);
    cy += ROW_H;
  });
  return { svg: out.join(""), 높이: cy - y + 10 };
}

// ── 코트 한 칸 ──────────────────────────────────────────
// 제목줄 + 코트. 자리별 요약을 코트 아래 한 줄로 붙인다.
const 칸제목 = 26;
const 칸밑 = 22;

/** 팀 딱지 너비. SVG 안에서는 글자 너비를 잴 수 없어 글자 수로 어림잡는다.
 *  12px 굵은 한글 한 자가 12px 안쪽이므로 한 자 12 + 좌우 여백 14 로 둔다. */
const 딱지폭 = (이름) => 이름.length * 12 + 14;

/** 팀 딱지. 이름만 있으면 차트 열 장이 늘어섰을 때 누가 어느 팀인지 알 수 없다.
 *  색만으로 가르지 않고 팀 이름을 글자로 같이 적는다 — 색을 잘 못 가리는 사람에게
 *  색칠한 이름은 그냥 검은 이름이다. (코트 안의 ● / ✕ 를 모양으로도 가른 것과 같다.) */
function 팀딱지(x, 글줄y, ti, 이름) {
  const w = 딱지폭(이름);
  return 사각(x, 글줄y - 14, w, 20, C.team[ti], 4)
    + T(x + w / 2, 글줄y, 이름, { size: 12, weight: 800, fill: "#ffffff", anchor: "middle" });
}

/** 팀을 주면 제목을 팀 색으로 쓴다. 팀 = { ti, 이름 } | null.
 *  이름까지 주면(선수 차트) 제목 앞에 팀 딱지도 단다. 팀 차트는 제목이 곧 팀 이름이라
 *  딱지를 달면 "A팀 A팀" 이 되므로 이름을 안 준다. */
function 차트칸(x, y, w, shots, 제목, 오른쪽, 팀 = null) {
  const 코트높이 = (w * CHART_VIEW.h) / CHART_VIEW.w;
  const z = 구역집계(shots);
  const 요약 = 구역들.filter((k) => z[k].a > 0)
    .map((k) => `${k} ${z[k].m}/${z[k].a}`).join("  ") || "슛 없음";
  const 딱지 = 팀?.이름 ? 딱지폭(팀.이름) + 6 : 0;
  return {
    svg: (팀?.이름 ? 팀딱지(x, y + 18, 팀.ti, 팀.이름) : "")
      + T(x + 딱지, y + 18, 제목, { size: 16, weight: 800, fill: 팀 ? C.team[팀.ti] : C.ink })
      + (오른쪽 ? T(x + w, y + 18, 오른쪽, { size: 14, weight: 700, fill: C.ink2, anchor: "end" }) : "")
      + `<g transform="translate(${x} ${y + 칸제목 - (CHART_VIEW.y * w) / CHART_VIEW.w}) scale(${w / CHART_VIEW.w})">`
      + 차트속(shots, COURT) + `</g>`
      + T(x, y + 칸제목 + 코트높이 + 16, 요약, { size: 13, weight: 700, fill: C.ink2 }),
    높이: 칸제목 + 코트높이 + 칸밑,
  };
}

/** 차트칸 하나를 그대로 독립된 그림 한 장으로. 엑셀에 박아 넣을 때 쓴다.
 *
 *  엑셀 시트 안의 그림은 셀 서식도 테마도 못 따른다. 그래서 화면용 var(--…) 가
 *  아니라 여기 고정 팔레트로 그리고, 제목과 자리별 요약까지 그림 안에 넣는다 —
 *  그림만 떼어 봐도 누구 것인지 알 수 있어야 한다. */
export function 차트한장SVG(shots, 제목, 오른쪽, w = 460, 팀 = null) {
  const c = 차트칸(0, 0, w, shots, 제목, 오른쪽, 팀);
  const h = Math.ceil(c.높이);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
      + 사각(0, 0, w, h, C.bg) + c.svg + `</svg>`,
    width: w, height: h,
  };
}

/** 밴드에 올릴 결과 이미지 전체. SVG 문자열과 크기를 돌려준다. */
export function 결과이미지SVG(game, 경기들 = [game]) {
  const [sa, sb] = scoreOf(game.events);
  const 이름 = game.teams.map((t) => t.name);
  const 이긴팀 = sa === sb ? -1 : sa > sb ? 0 : 1;
  const rows = boxScore(game);
  const pm = plusMinus(game);
  const T2 = 팀지표(game);
  const 쿼터들 = [...new Set(game.events.map((e) => e.q || 1))].sort((a, b) => a - b);
  const out = [];
  let y = 0;

  // ── 머리 ──────────────────────────────────────────────
  out.push(사각(0, 0, W, 108, C.band));
  out.push(T(PAD, 38, `${game.date} · ${qLabel(쿼터들[쿼터들.length - 1] || 1, game.quarters)}까지 · 기록 ${playCount(game.events)}개`,
    { size: 15, weight: 600, fill: C.bandText, op: 0.72 }));
  out.push(T(PAD, 80, `${이름[0]}  ${sa} : ${sb}  ${이름[1]}`, { size: 30, weight: 900, fill: C.bandText }));
  out.push(T(W - PAD, 80, 이긴팀 === -1 ? "무승부" : `${이름[이긴팀]} 승`,
    { size: 20, weight: 900, fill: 이긴팀 === -1 ? C.draw : C.win, anchor: "end" }));
  y = 108 + 20;

  // ── 쿼터별 · 팀 효율 ──────────────────────────────────
  if (쿼터들.length > 1) {
    out.push(T(PAD, y + 14, "쿼터별", { size: 14, weight: 800, fill: C.ink2 }));
    [0, 1].forEach((ti) => {
      const 점 = 쿼터들.map((q) => scoreOf(game.events.filter((e) => (e.q || 1) === q))[ti]);
      out.push(T(PAD + 74, y + 14 + ti * 22, `${이름[ti]}   ${점.join("  /  ")}`,
        { size: 14, weight: 700, fill: C.team[ti] }));
    });
    y += 22 * 2 + 10;
  }
  if (T2[0].넉넉) {
    const 칸w = (INNER - 16) / 2;
    [0, 1].forEach((ti) => {
      const t = T2[ti];
      const x = PAD + ti * (칸w + 16);
      out.push(사각(x, y, 칸w, 84, C.total, 8));
      out.push(T(x + 14, y + 26, 이름[ti], { size: 15, weight: 900, fill: C.team[ti] }));
      out.push(T(x + 칸w - 14, y + 26,
        `공격 ${num1(t.ortg)} · 수비 ${num1(t.drtg)} · Net ${t.net > 0 ? "+" : ""}${num1(t.net)}`,
        { size: 14, weight: 800, anchor: "end" }));
      out.push(T(x + 14, y + 56, `eFG ${pct1(t.efg)}   TS ${pct1(t.ts)}`, { size: 13, weight: 700, fill: C.ink2 }));
      out.push(T(x + 14, y + 74, `턴오버율 ${num1(t.tov)}%   공격리바 ${pct1(t.orbPct)}`,
        { size: 13, weight: 700, fill: C.ink2 }));
    });
    y += 84 + 20;
  }

  // ── 박스스코어 ────────────────────────────────────────
  for (const ti of [0, 1]) {
    const b = 박스스코어(rows, pm, ti, 이름[ti], y);
    out.push(b.svg);
    y += b.높이 + 10;
  }
  y += 10;

  // ── 샷 차트 ──────────────────────────────────────────
  const 누적 = 경기들.length > 1;
  out.push(T(PAD, y + 18, "샷 차트", { size: 20, weight: 900 }));
  out.push(T(W - PAD, y + 18, `● 들어감   ✕ 빗나감${누적 ? `   ·   ${경기들.length}경기 누적` : ""}`,
    { size: 13, weight: 700, fill: C.ink2, anchor: "end" }));
  y += 34;

  // 팀 샷차트 둘을 나란히
  const 팀w = (INNER - 20) / 2;
  let 팀높이 = 0;
  [0, 1].forEach((ti) => {
    const shots = 슛모음([game], null, ti);
    const c = 차트칸(PAD + ti * (팀w + 20), y, 팀w, shots,
      이름[ti], `${shots.filter((s) => s.made).length}/${shots.length}`, { ti, 이름: null });
    out.push(c.svg);
    팀높이 = c.높이;
  });
  y += 팀높이 + 16;

  // 선수 샷차트 — 슛을 쏜 사람만, 팀 순서 · 많이 쏜 순
  const 사람들 = 자리별선수(game)
    .filter((r) => r.총.a > 0)
    .sort((x2, y2) => x2.team - y2.team || y2.총.a - x2.총.a);
  const 열 = 3;
  const 칸w = (INNER - 16 * (열 - 1)) / 열;
  사람들.forEach((r, i) => {
    const 줄 = Math.floor(i / 열);
    const x = PAD + (i % 열) * (칸w + 16);
    const shots = 슛모음(경기들, r.name);
    const c = 차트칸(x, y + 줄 * (칸제목 + (칸w * CHART_VIEW.h) / CHART_VIEW.w + 칸밑 + 12),
      칸w, shots, r.name, `${shots.filter((s) => s.made).length}/${shots.length}`,
      { ti: r.team, 이름: 이름[r.team] });
    out.push(c.svg);
  });
  const 줄수 = Math.ceil(사람들.length / 열);
  y += 줄수 * (칸제목 + (칸w * CHART_VIEW.h) / CHART_VIEW.w + 칸밑 + 12);

  // ── 꼬리 ─────────────────────────────────────────────
  y += 6;
  out.push(`<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${C.line}" stroke-width="1" />`);
  out.push(T(PAD, y + 24, "혼(Spirit) · 기록 탭에서 만든 그림", { size: 13, weight: 700, fill: C.ink2 }));
  y += 40;

  const H = Math.ceil(y);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
      + 사각(0, 0, W, H, C.bg) + out.join("") + `</svg>`,
    width: W, height: H,
  };
}

/** 버튼에서 부르는 것. 이미지를 만들어 바로 내려받는다. */
export async function 결과이미지받기(game, 경기들 = [game]) {
  const { svg } = 결과이미지SVG(game, 경기들);
  const blob = await PNG만들기(svg, 2);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // 크로미움은 파일명에 한글이 섞이면 이름을 통째로 버린다. 아스키만 쓴다.
  a.download = `spirit-result-${game.date}-${대진표시(game)}.png`;
  a.click();
  URL.revokeObjectURL(url);
  return blob;
}
