// 경기 결과를 밴드에 올릴 이미지 한 장으로 그린다.
//
// 팀이 원래 밴드에 올리던 표(엑셀 화면을 캡처한 것)를 그대로 옮긴 모양이다.
// 열 순서와 이름을 바꾸지 않은 건 취향이 아니라, 보는 사람이 매번 새로 읽지
// 않아도 되게 하기 위해서다.
//
// 캔버스로 그리는 이유: 화면 캡처와 달리 기기·테마·글꼴에 상관없이 항상 같은
// 그림이 나오고, 클립보드로 바로 복사할 수 있다 (팀 편성 이미지와 같은 방식).

import { derive, teamTotals, usScore, themScore, result, perQuarterToCumulative, lineups } from "./gamestats.js";

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

const C = {
  bg: "#ffffff",
  band: "#151b33",
  bandText: "#ffffff",
  head: "#2c3557",
  headText: "#dfe4f5",
  ink: "#161b28",
  ink2: "#6a7288",
  line: "#d7dbe6",
  zebra: "#f5f7fb",
  total: "#eaeef7",
  win: "#e8590c",
  lose: "#4c6ef5",
  draw: "#7c7f8a",
};

// 열 정의 — w는 px. 합계가 이미지 너비를 정한다.
const COLS = [
  { key: "no", label: "No", w: 42, align: "center" },
  { key: "name", label: "이름", w: 92, align: "left" },
  { key: "min", label: "MIN", w: 46, group: null },
  { key: "p2m", label: "성공", w: 44, group: "2점" },
  { key: "p2a", label: "시도", w: 44, group: "2점" },
  { key: "p2pct", label: "%", w: 50, group: "2점", pct: true },
  { key: "p3m", label: "성공", w: 44, group: "3점" },
  { key: "p3a", label: "시도", w: 44, group: "3점" },
  { key: "p3pct", label: "%", w: 50, group: "3점", pct: true },
  { key: "fgm", label: "성공", w: 44, group: "야투" },
  { key: "fga", label: "시도", w: 44, group: "야투" },
  { key: "fgpct", label: "%", w: 50, group: "야투", pct: true },
  { key: "ftm", label: "성공", w: 44, group: "자유투" },
  { key: "fta", label: "시도", w: 44, group: "자유투" },
  { key: "ftpct", label: "%", w: 50, group: "자유투", pct: true },
  { key: "pts", label: "득점", w: 52, strong: true },
  { key: "reb", label: "리바", w: 46 },
  { key: "ast", label: "어시", w: 46 },
  { key: "stl", label: "스틸", w: 46 },
  { key: "blk", label: "블락", w: 46 },
  { key: "to", label: "턴오버", w: 52 },
  { key: "pf", label: "파울", w: 46 },
  { key: "memo", label: "비고", w: 128, align: "left" },
];

const PAD = 26;
const ROW_H = 32;
const HEAD_H = 44;
const GROUP_H = 22;

function createScaledCanvas(width, height, scale = 2) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 확률은 0.375 → ".375"로. 앞의 0을 떼는 건 농구 기록지의 오랜 관습이고,
// 좁은 칸에서 숫자가 잘 읽힌다. 0과 1은 예외로 그대로 쓴다.
function pctText(v) {
  if (!v) return "-";
  if (v >= 1) return "1.00";
  return v.toFixed(3).slice(1);
}

function cellText(col, row) {
  const v = row[col.key];
  if (col.pct) return pctText(v);
  if (col.key === "memo") return v || "";
  if (col.key === "name") return v || "";
  if (col.key === "no") return v == null || v === "" ? "" : String(v);
  return v ? String(v) : "-";
}

function tableWidth() {
  return COLS.reduce((a, c) => a + c.w, 0);
}

// ── 상단: 점수판 ──────────────────────────────────────────
function drawScoreboard(ctx, game, x, y, w) {
  const uS = usScore(game), tS = themScore(game), r = result(game);
  const h = 92;
  ctx.fillStyle = C.band;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();

  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = `600 15px ${FONT}`;
  ctx.textAlign = "left";
  const dateLabel = (game.date || "").replaceAll("-", ".");
  ctx.fillText(`${dateLabel}  ·  ${game.gameNo}경기  ·  ${game.gameType}`, x + 22, y + 26);

  // [우리팀 45 : 38 상대팀] 을 한 덩어리로 재서 가운데에 놓는다.
  // 칸마다 따로 계산하면 팀 이름 길이나 점수 자릿수가 바뀔 때마다 글자가 겹친다.
  const cx = x + w / 2;
  const baseline = y + 61;
  const NAME_GAP = 16;
  const COLON_GAP = 14;
  // 좌우로 날짜(왼쪽)와 승패 배지(오른쪽)가 있으니 그만큼은 비워둔다.
  const avail = w - 2 * 190;

  let scoreSize = 40;
  let nameSize = 20;
  const measure = () => {
    ctx.font = `900 ${scoreSize}px ${FONT}`;
    const uW = ctx.measureText(String(uS)).width;
    const tW = ctx.measureText(String(tS)).width;
    const cW = ctx.measureText(":").width;
    ctx.font = `700 ${nameSize}px ${FONT}`;
    const unW = ctx.measureText(game.us).width;
    const tnW = ctx.measureText(game.them).width;
    return { uW, tW, cW, unW, tnW, total: unW + NAME_GAP + uW + COLON_GAP + cW + COLON_GAP + tW + NAME_GAP + tnW };
  };
  let m = measure();
  // 팀 이름이 길면 통째로 줄인다 — 잘라내면 어느 팀인지 못 읽는다.
  while (m.total > avail && scoreSize > 24) {
    scoreSize -= 2;
    nameSize = Math.max(13, nameSize - 1);
    m = measure();
  }

  let px = cx - m.total / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.font = `700 ${nameSize}px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(game.us, px, baseline);
  px += m.unW + NAME_GAP;

  ctx.font = `900 ${scoreSize}px ${FONT}`;
  ctx.fillStyle = C.bandText;
  ctx.fillText(String(uS), px, baseline);
  px += m.uW + COLON_GAP;

  ctx.fillStyle = "rgba(255,255,255,.4)";
  ctx.fillText(":", px, baseline);
  px += m.cW + COLON_GAP;

  ctx.fillStyle = C.bandText;
  ctx.fillText(String(tS), px, baseline);
  px += m.tW + NAME_GAP;

  ctx.font = `700 ${nameSize}px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText(game.them, px, baseline);

  // 승/패 배지
  const badge = { 승: C.win, 패: C.lose, 무: C.draw }[r];
  ctx.font = `900 17px ${FONT}`;
  const bw = 52, bh = 28;
  ctx.fillStyle = badge;
  roundRect(ctx, x + w - 22 - bw, y + 20, bw, bh, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(r, x + w - 22 - bw / 2, y + 20 + bh / 2 + 1);

  return h;
}

// ── 쿼터 점수 + 코트 위 5명 ───────────────────────────────
function drawQuarterBlock(ctx, game, x, y, w) {
  const labelW = 96;
  const colW = (w - labelW) / 4;
  const rows = [
    { label: game.us, values: perQuarterToCumulative(game.usQ), strong: true },
    { label: game.them, values: perQuarterToCumulative(game.themQ) },
  ];
  const five = lineups(game);
  const rowH = 30;
  const h = 26 + rows.length * rowH + 34;

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;

  ctx.textBaseline = "middle";
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = C.ink2;
  ctx.textAlign = "center";
  for (let q = 0; q < 4; q++) {
    ctx.fillText(`${q + 1}Q`, x + labelW + colW * (q + 0.5), y + 13);
  }
  ctx.textAlign = "left";
  ctx.fillText("누적 점수", x + 2, y + 13);

  rows.forEach((row, i) => {
    const ry = y + 26 + i * rowH;
    if (i % 2 === 0) {
      ctx.fillStyle = C.zebra;
      ctx.fillRect(x, ry, w, rowH);
    }
    ctx.fillStyle = C.ink;
    ctx.font = `${row.strong ? 800 : 600} 15px ${FONT}`;
    ctx.textAlign = "left";
    ctx.fillText(row.label, x + 6, ry + rowH / 2);
    ctx.textAlign = "center";
    ctx.font = `${row.strong ? 800 : 600} 16px ${FONT}`;
    row.values.forEach((v, q) => {
      ctx.fillText(String(v), x + labelW + colW * (q + 0.5), ry + rowH / 2);
    });
    ctx.beginPath();
    ctx.moveTo(x, ry + rowH);
    ctx.lineTo(x + w, ry + rowH);
    ctx.stroke();
  });

  // Play 줄 — 그 쿼터에 코트에 있던 등번호. 엑셀에서 쓰던 이름 그대로 둔다.
  const py = y + 26 + rows.length * rowH;
  ctx.fillStyle = C.ink2;
  ctx.font = `700 12px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("Play", x + 6, py + 17);
  ctx.textAlign = "center";
  ctx.font = `600 12px ${FONT}`;
  five.forEach((list, q) => {
    ctx.fillText(list.length ? list.join(" ") : "-", x + labelW + colW * (q + 0.5), py + 17);
  });

  return h;
}

// ── 기록표 ────────────────────────────────────────────────
function drawTable(ctx, game, x, y, w) {
  const players = game.players.map((p) => ({ ...p, ...derive(p) }));
  const totals = teamTotals(game);
  const totalRow = { ...totals, no: "", name: "TEAM", memo: "" };

  // 머리 — 위는 묶음 이름(2점/3점/…), 아래는 개별 열
  let cx = x;
  ctx.fillStyle = C.head;
  ctx.fillRect(x, y, w, GROUP_H + HEAD_H);

  ctx.textBaseline = "middle";
  let i = 0;
  while (i < COLS.length) {
    const g = COLS[i].group;
    if (g) {
      let span = 0, gw = 0;
      while (i + span < COLS.length && COLS[i + span].group === g) { gw += COLS[i + span].w; span++; }
      ctx.fillStyle = C.bandText;
      ctx.font = `800 14px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillText(g, cx + gw / 2, y + GROUP_H / 2);
      ctx.strokeStyle = "rgba(255,255,255,.22)";
      ctx.beginPath();
      ctx.moveTo(cx + 6, y + GROUP_H - 1);
      ctx.lineTo(cx + gw - 6, y + GROUP_H - 1);
      ctx.stroke();
      cx += gw;
      i += span;
    } else {
      cx += COLS[i].w;
      i++;
    }
  }

  cx = x;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = C.headText;
  COLS.forEach((col) => {
    ctx.textAlign = "center";
    ctx.fillText(col.label, cx + col.w / 2, y + GROUP_H + HEAD_H / 2);
    cx += col.w;
  });

  // 몸통
  const bodyTop = y + GROUP_H + HEAD_H;
  const drawRow = (row, ry, opts = {}) => {
    if (opts.fill) {
      ctx.fillStyle = opts.fill;
      ctx.fillRect(x, ry, w, ROW_H);
    }
    let px = x;
    COLS.forEach((col) => {
      const text = cellText(col, row);
      const strong = col.strong || opts.strong;
      ctx.font = `${strong ? 800 : 600} ${col.key === "memo" ? 12 : 14}px ${FONT}`;
      ctx.fillStyle = text === "-" ? "#b9bfcd" : col.key === "memo" ? C.ink2 : C.ink;
      const align = col.align || "center";
      ctx.textAlign = align;
      const tx = align === "left" ? px + 8 : px + col.w / 2;
      ctx.fillText(text, tx, ry + ROW_H / 2, col.w - 10);
      px += col.w;
    });
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, ry + ROW_H);
    ctx.lineTo(x + w, ry + ROW_H);
    ctx.stroke();
  };

  players.forEach((p, r) => {
    drawRow(p, bodyTop + r * ROW_H, { fill: r % 2 ? C.zebra : null });
  });
  const totalY = bodyTop + players.length * ROW_H;
  drawRow(totalRow, totalY, { fill: C.total, strong: true });

  // 이름 칸과 기록 칸 사이 세로선 하나만 — 표가 두 덩어리로 읽힌다.
  const splitX = x + COLS[0].w + COLS[1].w;
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(splitX, bodyTop);
  ctx.lineTo(splitX, totalY + ROW_H);
  ctx.stroke();

  return GROUP_H + HEAD_H + (players.length + 1) * ROW_H;
}

export function drawGameImage(game) {
  const w = tableWidth();
  const width = w + PAD * 2;
  const scoreH = 92;
  const quarterH = 26 + 2 * 30 + 34;
  const tableH = GROUP_H + HEAD_H + (game.players.length + 1) * ROW_H;
  const height = PAD + scoreH + 18 + quarterH + 14 + tableH + 16 + 30 + PAD;

  const { canvas, ctx } = createScaledCanvas(width, height);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, width, height);

  let y = PAD;
  y += drawScoreboard(ctx, game, PAD, y, w) + 18;
  y += drawQuarterBlock(ctx, game, PAD, y, w) + 14;
  y += drawTable(ctx, game, PAD, y, w) + 16;

  const t = teamTotals(game);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = C.ink2;
  ctx.fillText(
    `야투 ${t.fgm}/${t.fga} · 3점 ${t.p3m}/${t.p3a} · 자유투 ${t.ftm}/${t.fta} · 리바 ${t.reb} · 어시 ${t.ast} · 턴오버 ${t.to}`,
    PAD, y + 14
  );
  ctx.textAlign = "right";
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = "#aeb4c4";
  ctx.fillText("혼 SPIRIT", PAD + w, y + 14);

  return canvas;
}
