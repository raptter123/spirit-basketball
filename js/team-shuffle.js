import { ROSTER } from "./roster.js";
import {
  getTeamBuilderDraft,
  saveTeamBuilderDraft,
  clearTeamBuilderDraft,
  saveSheetRoster,
  getLastAttendees,
  saveLastAttendees,
  getGuests,
  saveGuests,
} from "./storage.js";
import { sheetHTML, SHEET_CSS, PLAYER_ROWS, SHEET_MM } from "./sheetform.js";
import { getNextEventDate } from "./events.js";
import {
  jerseyHTML,
  hasNumber,
  JERSEY_PATH,
  JERSEY_COLLAR_PATH,
  JERSEY_VIEW,
  JERSEY_NUM_CY,
} from "./jersey.js";

const TEAM_LETTERS = ["A", "B", "C", "D"];
// 팀마다 확실히 다른 색이어야 배정 단추에서 헷갈리지 않는다.
// D 는 보라 — 주황·초록·파랑 어느 것과도 안 겹친다.
const TEAM_ACCENT = ["#f97316", "#22c55e", "#3b82f6", "#a855f7"];
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nameWithCaptain(p) {
  if (!p) return "";
  return p.captain ? `${p.name}(C)` : p.name;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-09-06" → "9/6". 지난번 명단이 언제 것인지 알려주는 용도라 연도는 뺀다.
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${Number(m[2])}/${Number(m[3])}` : "";
}

// 2팀 아니면 3팀이다. 4팀은 한 번 해 보고 접었다.
function teamCountChipsHTML(current) {
  return [2, 3]
    .map((n) => `<button type="button" class="chip ${current === n ? "chip-active" : ""}" data-count="${n}">${n}팀</button>`)
    .join("");
}

// 게스트는 이름만 있는 사람으로 만든다 — 로스터의 권혁남과 똑같은 모양이라
// 유니폼(번호 없는 모양)·이름표·예상 스탯 제외가 전부 이미 되던 대로 동작한다.
function guestPlayer(name) {
  return { name, guest: true };
}

function getAllPlayers(guests = []) {
  return [...ROSTER, ...guests.map(guestPlayer)];
}

// 주장은 (C), 게스트는 G. 같은 자리에 붙는 꼬리표라 새 규칙을 만들지 않는다.
// 기록지에는 이 꼬리표 없이 이름만 들어간다(판독 뒤 로스터와 짝을 맞춰야 해서).
function guestTagHTML(p) {
  return p && p.guest ? ` <span class="ts-guest-tag">G</span>` : "";
}

// 실제 경기에서는 한 팀에서 5명만 코트에 뛰기 때문에, 팀 인원이 늘어난다고 해서
// 팀 득점이 그만큼 같이 늘어나는 건 아니다 — 오히려 잘하는 선수가 뛰는 시간이
// 줄어들어서 개인 기록이 팀 득점에 기여하는 비중이 작아진다. 그래서 각 선수의
// 개인 평균(ppg 등)을 그대로 더한 값(rawSum)에 TYPICAL_TEAM_SIZE(우리 동호회 평균
// 팀 규모로 추정한 값) / 실제 인원수 비율을 곱해서, 인원이 기준보다 많으면 할인하고
// 적으면 할증한다. 기준 인원일 때는 기존 raw sum(실제 팀 득점 40점 안팎)과 값이 같다.
// 인당 평균(ppgAvg 등)은 이 보정과 무관하게 순수 평균을 그대로 보여준다.
const TYPICAL_TEAM_SIZE = 7;

function computeProjection(playerNames, playersByName) {
  const players = playerNames.map((n) => playersByName[n]).filter((p) => p && typeof p.ppg === "number");
  if (!players.length) return null;
  const statCount = players.length;
  // 나누는 값은 **팀에 실제로 있는 사람 수**여야 한다. 기록 있는 사람 수로 나누면,
  // 게스트나 기록 없는 선수가 낀 팀은 그만큼 작은 팀처럼 계산돼서 세 보인다.
  // (6명 + 게스트 4명 팀이 58.2점으로 나왔다 — 이 식대로면 34.9점이 맞다)
  // 게스트도 코트에서 뛰는 시간을 나눠 쓰므로, 기록이 없다고 인원에서 빼면 안 된다.
  const teamSize = playerNames.length || statCount;
  const sizeAdjust = TYPICAL_TEAM_SIZE / teamSize;
  const sum = (key) => players.reduce((acc, p) => acc + (typeof p[key] === "number" ? p[key] : 0), 0);
  const avgOf = (key) => {
    const withStat = players.filter((p) => typeof p[key] === "number");
    return withStat.length ? withStat.reduce((acc, p) => acc + p[key], 0) / withStat.length : null;
  };
  const topgPlayers = players.filter((p) => typeof p.topg === "number");
  const topgSum = topgPlayers.length ? topgPlayers.reduce((acc, p) => acc + p.topg, 0) : null;
  return {
    statCount,
    ppg: sum("ppg") * sizeAdjust,
    rpg: sum("rpg") * sizeAdjust,
    apg: sum("apg") * sizeAdjust,
    ppgAvg: sum("ppg") / statCount,
    rpgAvg: sum("rpg") / statCount,
    apgAvg: sum("apg") / statCount,
    topg: topgSum != null ? topgSum * sizeAdjust : null,
    topgAvg: topgSum != null ? topgSum / topgPlayers.length : null,
    topgCount: topgPlayers.length,
    fgPctAvg: avgOf("fgPct"),
  };
}

// 공지 이미지에도 로스터와 같은 유니폼을 그린다. HTML은 SVG, 여기는 캔버스라
// 그리는 방법만 다르고 좌표(js/jersey.js)는 하나를 같이 쓴다.
// ink는 테마마다 다르므로(밝은 칸/어두운 칸) 색을 받아서 그 색으로 그린다.
function drawJersey(ctx, x, y, h, p, ink) {
  const s = h / JERSEY_VIEW.h;
  ctx.save();
  // 번호가 아직 없는 선수는 옅게 — 자리는 지키되 눈에 덜 띄게.
  if (!hasNumber(p)) ctx.globalAlpha = 0.4;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-JERSEY_VIEW.x, -JERSEY_VIEW.y);
  const body = new Path2D(JERSEY_PATH);
  ctx.save();
  ctx.globalAlpha *= 0.14;
  ctx.fillStyle = ink;
  ctx.fill(body);
  ctx.restore();
  ctx.strokeStyle = ink;
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.6;
  ctx.stroke(body);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.stroke(new Path2D(JERSEY_COLLAR_PATH));
  ctx.restore();

  if (!hasNumber(p)) return;
  const twoDigit = String(p.number).length > 1;
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `800 ${((twoDigit ? 13.5 : 16) * s).toFixed(1)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(p.number), x + (20 - JERSEY_VIEW.x) * s, y + (JERSEY_NUM_CY - JERSEY_VIEW.y) * s);
  ctx.restore();
}

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

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 팀 색 위에 올릴 글자색을 색마다 자동으로 고른다. 어두운 글자와 밝은 글자 중
// 명암비가 높은 쪽을 쓴다. 고정하면 황금색 위 흰 글자가 2.04:1 로 안 읽힌다.
// 팀 색을 글씨에 그대로 쓰면 바탕에 묻는다 — 은행노랑이 크림 위에서 2.19:1 이었다.
// 화면 CSS 가 --accent 와 --accent-text 를 나눠 쓰는 것과 같은 이유로, 글씨용은
// 기준(4.5)을 넘길 때까지 색을 옮겨 쓴다. 선·면에는 원래 색을 그대로 쓴다.
//
// 옮기는 방향은 바탕 밝기에 따라 다르다. 밝은 바탕에서는 어둡게, 어두운 바탕에서는
// 밝게 가야 한다. 어둡게만 섞도록 두었더니 어두운 색표(은행)에서 주홍·청록·자주가
// 1.58:1 까지 떨어져 거의 안 보였다.
function readableOn(color, bg) {
  const v = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const s = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (h) => { const [r, g, b] = v(h); return 0.2126 * s(r) + 0.7152 * s(g) + 0.0722 * s(b); };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const [r0, g0, b0] = v(color);
  const 밝게 = lum(bg) < 0.5;
  let out = color;
  for (let t = 0; t <= 0.95 && cr(out, bg) < 4.5; t += 0.02) {
    const f = 밝게 ? (x) => Math.round(x + (255 - x) * t) : (x) => Math.round(x * (1 - t));
    out = "#" + [f(r0), f(g0), f(b0)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  return out;
}

function inkOn(bg) {
  const v = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const s = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (h) => { const [r, g, b] = v(h); return 0.2126 * s(r) + 0.7152 * s(g) + 0.0722 * s(b); };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  return cr("#241a10", bg) >= cr("#fff8ea", bg) ? "#241a10" : "#fff8ea";
}

// ── 선수 한 줄 정보 ────────────────────────────────────────────
// 이름 밑에 붙일 수 있는 것: 없음 / 별명 / 숫자.
//
// 별명은 기록에서 뽑는다. 항목마다 로스터 평균과 편차를 구하고, 그 사람이 어디서
// 가장 튀는지를 본다. 절대 순위로 고르면 잘하는 사람에게만 별명이 몰리므로,
// "자기 안에서 어디가 제일 나은가" 로 고른다. 그래서 나쁜 별명은 아무에게도
// 붙지 않고, 기록이 있는 사람은 모두 하나씩 받는다.
const TAG_STATS = [
  { key: "ppg", 별명: "해결사", 근거: "득점" },
  { key: "rpg", 별명: "리바운더", 근거: "리바운드" },
  { key: "apg", 별명: "지휘관", 근거: "어시스트" },
  { key: "spg", 별명: "인터셉트", 근거: "스틸" },
  { key: "fgPct", 별명: "효율왕", 근거: "야투" },
  { key: "games", 별명: "개근왕", 근거: "출전" },
  { key: "winRate", 별명: "복덩이", 근거: "승률" },
];

let TAG_NORM = null;
function tagNorm() {
  if (TAG_NORM) return TAG_NORM;
  TAG_NORM = {};
  const 있는 = ROSTER.filter((p) => typeof p.ppg === "number");
  for (const { key } of TAG_STATS) {
    const v = 있는.map((p) => p[key]).filter((x) => typeof x === "number");
    const m = v.reduce((a, c) => a + c, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, c) => a + (c - m) ** 2, 0) / v.length) || 1;
    TAG_NORM[key] = { m, sd };
  }
  return TAG_NORM;
}

// 공지 이미지에 넘어오는 이름에는 주장 꼬리표가 이미 붙어 있다("김성훈(C)").
// 로스터에는 꼬리표 없이 들어 있으므로 떼고 찾아야 한다. 안 그러면 주장만
// 늘 "기대주"로 나온다.
function baseName(n) {
  return String(n).replace(/\(C\)$/, "");
}

/** 별명과 그 근거. 라인업 그림의 오른쪽 빈 자리에 함께 적는다.
 *  근거를 같이 적어야 "왜 저 별명인지"가 보이고, 숫자만 있을 때보다 덜 딱딱하다. */
function playerBadge(p) {
  if (p.guest) return { 별명: "게스트", 근거: "오늘 함께" };
  const stat = ROSTER.find((r) => r.name === baseName(p.name));
  if (!stat || typeof stat.ppg !== "number") return { 별명: "기대주", 근거: "기록 준비 중" };
  const n = tagNorm();
  let best = null;
  for (const it of TAG_STATS) {
    const v = stat[it.key];
    if (typeof v !== "number") continue;
    const z = (v - n[it.key].m) / n[it.key].sd;
    if (!best || z > best.z) best = { ...it, z, v };
  }
  if (!best) return { 별명: "기대주", 근거: "기록 준비 중" };
  // 값만 적으면 그게 잘한 건지 알 수 없다. 로스터 평균을 나란히 적어 두면
  // "8.0 이 평균 4.0 의 두 배구나" 가 한눈에 보인다.
  const 적기 = (v) => best.key === "winRate" || best.key === "fgPct"
    ? `${Math.round(v * 100)}%`
    : best.key === "games" ? `${Math.round(v)}경기` : v.toFixed(1);
  return { 별명: best.별명, 근거: `${best.근거} ${적기(best.v)} · 평균 ${적기(n[best.key].m)}` };
}

// ── 세로형 시안 ────────────────────────────────────────────────
// 지금 가로형은 2팀 12명일 때 2044x464(4.41:1)이라, 폰 폭에 맞추면 35%로 줄고
// 이름 글씨가 7.0px 이 된다. 세로로 세워서 폰 화면을 채우는 쪽을 시험한다.
// 색은 '단풍' 하나로 고정한다 — 여기서 비교할 것은 색이 아니라 배치다.
const AUTUMN = {
  maple:  { team: ["#c0392b", "#e0a021", "#556b2f", "#6b3f5e"], paper: "#fdf3e0", card: "#fffaf0", ink: "#4a2a15", title: "#8c3113" },
  kraft:  { team: ["#8f5136", "#c08a3e", "#5a6b45", "#6b3f5e"], paper: "#e6d5b8", card: "#f5ead6", ink: "#3d2a18", title: "#4b3421" },
  ginkgo: { team: ["#e5a812", "#c2410c", "#0f766e", "#7c3f58"], paper: "#1e2436", card: "#2b3348", ink: "#f0ead8", title: "#f4c542" },
};
function pal(colorKey) {
  return AUTUMN[colorKey] || AUTUMN.maple;
}

// 왼쪽에 유니폼, 오른쪽에 이름. 세로 배치에서는 가운데 정렬보다 왼쪽 정렬이
// 이름 첫 글자가 세로로 맞아떨어져서 훑어보기 쉽다.
function drawPlayerLeft(ctx, p, x, cy, font, ink, jerseyH, sub) {
  const jerseyW = (jerseyH * JERSEY_VIEW.w) / JERSEY_VIEW.h;
  drawJersey(ctx, x, cy - jerseyH / 2, jerseyH, p, ink);
  const tx = x + jerseyW + 8;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ctx.fillStyle = ink;
  // 아랫줄이 있으면 이름을 살짝 올려 두 줄이 세로 가운데에 오게 한다.
  ctx.fillText(p.name, tx, cy + (sub ? -8 : 1));
  if (!sub) return;
  ctx.font = `600 13px ${FONT}`;
  ctx.globalAlpha = 0.62;
  ctx.fillText(sub, tx, cy + 11);
  ctx.globalAlpha = 1;
}

function drawTitle(ctx, gameDate, teamCount, x, y, color, size) {
  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(`${dateLabel} 자체${teamCount}파전`, x, y);
}

// V1. 세로 칼럼 — 팀이 가로로 나란히 서고, 선수가 그 안에서 세로로 쌓인다.
function drawColumnTheme(rows, gameDate, teamCount, colorKey) {
  const P = pal(colorKey);
  const pad = 24, titleH = 58, headH = 38, rowH = 62, gap = 12;
  const colW = rows.length <= 2 ? 190 : rows.length === 3 ? 165 : 150;
  const maxRows = Math.max(...rows.map((t) => t.players.length));
  const width = pad * 2 + rows.length * colW + (rows.length - 1) * gap;
  const height = pad * 2 + titleH + headH + maxRows * rowH;
  const { canvas, ctx } = createScaledCanvas(width, height);

  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, gameDate, teamCount, pad, pad + 30, P.title, 26);

  rows.forEach((team, r) => {
    const color = P.team[r % P.team.length];
    const x = pad + r * (colW + gap);
    const top = pad + titleH;

    roundRectPath(ctx, x, top, colW, headH + maxRows * rowH, 14);
    ctx.fillStyle = P.card;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRectPath(ctx, x, top, colW, headH, 14);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillRect(x, top + headH - 14, colW, 14);
    ctx.fillStyle = inkOn(color);
    ctx.font = `900 19px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${team.letter}팀 · ${team.players.length}명`, x + colW / 2, top + headH / 2 + 1);

    team.players.forEach((p, i) => {
      const cy = top + headH + i * rowH + rowH / 2;
      if (i % 2 === 1) {
        ctx.fillStyle = colorKey === "ginkgo" ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.035)";
        ctx.fillRect(x + 2, cy - rowH / 2, colW - 4, rowH);
      }
      drawPlayerLeft(ctx, p, x + 14, cy, `bold 19px ${FONT}`, P.ink, 30);
    });
  });
  return canvas;
}

// V2. 팀 블록 — 팀이 세로로 쌓이고, 한 팀 안에서 선수가 두 줄로 들어간다.
// 팀이 몇 개든 가로 폭이 그대로라, 폰에서 항상 같은 크기로 읽힌다.
function drawBlockTheme(rows, gameDate, teamCount, colorKey) {
  const P = pal(colorKey);
  const pad = 22, titleH = 58, headH = 36, rowH = 58, blockGap = 12;
  const width = 460;
  const colW = (width - pad * 2 - 12) / 2;
  const blockH = (t) => headH + Math.ceil(t.players.length / 2) * rowH + 8;
  const height = pad * 2 + titleH + rows.reduce((a, t) => a + blockH(t) + blockGap, 0) - blockGap;
  const { canvas, ctx } = createScaledCanvas(width, height);

  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, gameDate, teamCount, pad, pad + 32, P.title, 27);

  let y = pad + titleH;
  rows.forEach((team, r) => {
    const color = P.team[r % P.team.length];
    const h = blockH(team);

    roundRectPath(ctx, pad, y, width - pad * 2, h, 14);
    ctx.fillStyle = P.card;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRectPath(ctx, pad, y, width - pad * 2, headH, 14);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillRect(pad, y + headH - 14, width - pad * 2, 14);
    ctx.fillStyle = inkOn(color);
    ctx.font = `900 18px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${team.letter}팀`, pad + 14, y + headH / 2 + 1);
    ctx.textAlign = "right";
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(`${team.players.length}명`, width - pad - 14, y + headH / 2 + 1);

    team.players.forEach((p, i) => {
      const cx = pad + 10 + (i % 2) * (colW + 12);
      const cy = y + headH + Math.floor(i / 2) * rowH + rowH / 2 + 4;
      drawPlayerLeft(ctx, p, cx, cy, `bold 19px ${FONT}`, P.ink, 30);
    });
    y += h + blockGap;
  });
  return canvas;
}

// V3. 라인업 — 한 줄에 한 명. 이름 왼쪽, 오른쪽 빈 자리에 별명과 그 근거를 적는다.
// 별명만 있으면 "왜?" 가 남고, 숫자만 있으면 딱딱하다. 둘을 같이 두면 서로를 설명한다.
function drawLineupTheme(rows, gameDate, teamCount, colorKey) {
  const P = pal(colorKey);
  const pad = 20, titleH = 56, headH = 34, rowH = 56, blockGap = 10;
  const width = 440;
  const blockH = (t) => headH + t.players.length * rowH + 6;
  const height = pad * 2 + titleH + rows.reduce((a, t) => a + blockH(t) + blockGap, 0) - blockGap;
  const { canvas, ctx } = createScaledCanvas(width, height);

  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, width, height);
  drawTitle(ctx, gameDate, teamCount, pad, pad + 32, P.title, 26);

  let y = pad + titleH;
  rows.forEach((team, r) => {
    const color = P.team[r % P.team.length];
    const h = blockH(team);
    const right = width - pad - 12;

    roundRectPath(ctx, pad, y, width - pad * 2, h, 12);
    ctx.fillStyle = P.card;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRectPath(ctx, pad, y, width - pad * 2, headH, 12);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillRect(pad, y + headH - 12, width - pad * 2, 12);
    ctx.fillStyle = inkOn(color);
    ctx.font = `900 17px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${team.letter}팀`, pad + 12, y + headH / 2 + 1);
    ctx.textAlign = "right";
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(`${team.players.length}명`, right, y + headH / 2 + 1);

    team.players.forEach((p, i) => {
      const cy = y + headH + i * rowH + rowH / 2 + 3;
      if (i % 2 === 1) {
        ctx.fillStyle = colorKey === "ginkgo" ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.035)";
        ctx.fillRect(pad + 2, cy - rowH / 2, width - pad * 2 - 4, rowH);
      }
      drawPlayerLeft(ctx, p, pad + 14, cy, `bold 21px ${FONT}`, P.ink, 32);

      // 오른쪽 빈 자리 — 위에 별명, 아래에 그 근거.
      const { 별명, 근거 } = playerBadge(p);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = `900 15px ${FONT}`;
      ctx.fillStyle = readableOn(color, P.card);
      ctx.fillText(별명, right, cy - 9);
      ctx.font = `600 12px ${FONT}`;
      ctx.fillStyle = P.ink;
      ctx.globalAlpha = 0.55;
      ctx.fillText(근거, right, cy + 10);
      ctx.globalAlpha = 1;
    });
    y += h + blockGap;
  });
  return canvas;
}

// 세로형은 팀 수에 따라 배치를 바꾼다. 2팀이면 좌우로 나란히 세우는 쪽이 대칭이
// 살아서 보기 좋고, 3팀부터는 칼럼이 좁아져 글씨가 작아지므로(4팀 9.9px) 위아래로
// 쌓는 쪽이 낫다. 블록형은 팀이 몇이든 가로 폭이 같아 글씨 크기가 변하지 않는다.
function drawVerticalTheme(rows, gameDate, teamCount, colorKey) {
  return rows.length <= 2
    ? drawColumnTheme(rows, gameDate, teamCount, colorKey)
    : drawBlockTheme(rows, gameDate, teamCount, colorKey);
}

// 남은 스타일은 둘뿐이다. 둘 다 세로로 세운 명단이고, 다른 건 선수 옆에 무엇이
// 붙느냐다. 색은 세 가지 중에 고른다.
//
// 예전에는 가로로 눕힌 스타일이 다섯 개 더 있었는데(클래식·NBA·축구·e스포츠·
// 레트로), 2팀 12명 기준으로 2044x464(4.41:1)이라 폰 폭에 맞추면 35%로 줄고
// 이름 글씨가 7.0px 이 됐다. 확대하지 않으면 읽을 수 없어서 전부 걷어냈다.
const IMAGE_THEMES = [
  { key: "lineup1", label: "라인업1", draw: drawVerticalTheme },
  { key: "lineup2", label: "라인업2 · 별명", draw: drawLineupTheme },
];

const VERT_COLORS = [
  { key: "maple", label: "\u{1F341} 단풍" },
  { key: "kraft", label: "\u{1F342} 낙엽" },
  { key: "ginkgo", label: "\u{1F33E} 은행" },
];

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

function copyCanvasToClipboard(canvas) {
  return new Promise((resolve, reject) => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      reject(new Error("clipboard image write unsupported"));
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error("no blob"));
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, "image/png");
  });
}

function showTeamImageModal(rows, gameDate, teamCount) {
  let theme = IMAGE_THEMES[0];
  let colorKey = "maple";
  let canvas = theme.draw(rows, gameDate, teamCount, colorKey);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  document.body.appendChild(backdrop);

  function renderModal() {
    const dataUrl = canvas.toDataURL("image/png");
    backdrop.innerHTML = `
      <div class="modal ts-image-modal">
        <h3>팀 공지 이미지</h3>
        <div class="ts-style-row" role="group" aria-label="이미지 스타일">
          ${IMAGE_THEMES.map((t) => `<button type="button" class="chip ts-style-chip${t.key === theme.key ? " chip-active" : ""}" data-style="${t.key}">${t.label}</button>`).join("")}
        </div>
        <div class="ts-style-row" role="group" aria-label="색">
          ${VERT_COLORS.map((c) => `<button type="button" class="chip ts-color-chip${c.key === colorKey ? " chip-active" : ""}" data-color="${c.key}">${c.label}</button>`).join("")}
        </div>
        <div class="ts-image-preview"><img src="${dataUrl}" alt="팀 공지 이미지 (${theme.label} 스타일)" /></div>
        <p class="hint">이미지를 길게 눌러 저장하거나, 아래 버튼으로 복사/다운로드해서 밴드나 카톡에 붙여넣어주세요.</p>
        <div class="modal-actions">
          <button type="button" class="btn" id="ts-image-close">닫기</button>
          <button type="button" class="btn" id="ts-image-download">다운로드</button>
          <button type="button" class="btn btn-primary" id="ts-image-copy">클립보드에 복사</button>
        </div>
      </div>
    `;

    backdrop.querySelector("#ts-image-close").addEventListener("click", () => backdrop.remove());
    for (const el of backdrop.querySelectorAll(".ts-style-chip")) {
      el.addEventListener("click", () => {
        theme = IMAGE_THEMES.find((t) => t.key === el.dataset.style) || theme;
        canvas = theme.draw(rows, gameDate, teamCount, colorKey);
        renderModal();
      });
    }
    for (const el of backdrop.querySelectorAll(".ts-color-chip")) {
      el.addEventListener("click", () => {
        colorKey = el.dataset.color;
        canvas = theme.draw(rows, gameDate, teamCount, colorKey);
        renderModal();
      });
    }
    backdrop.querySelector("#ts-image-download").addEventListener("click", () =>
      downloadCanvas(canvas, `spirit-team-${gameDate || "today"}-${theme.key}.png`)
    );
    backdrop.querySelector("#ts-image-copy").addEventListener("click", async () => {
      const btn = backdrop.querySelector("#ts-image-copy");
      try {
        await copyCanvasToClipboard(canvas);
        btn.textContent = "복사됨!";
      } catch {
        btn.textContent = "복사 실패, 다운로드를 이용해주세요";
      }
      setTimeout(() => {
        btn.textContent = "클립보드에 복사";
      }, 1800);
    });
  }

  renderModal();
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
}

// 기록지 인쇄. 뽑는 김에 그 종이에 인쇄한 명단을 적어 둔다 — 나중에 사진을 올리면
// 판독기가 줄 번호로 이름을 되찾을 수 있다(판독기는 인쇄된 글자를 못 읽는다).
function showSheetPrintModal(teams, gameDate) {
  const date = gameDate || "";
  const key = `${date.replaceAll("-", "").slice(2)}_1`;

  if (!document.getElementById("sheet-css")) {
    const st = document.createElement("style");
    st.id = "sheet-css";
    st.textContent = SHEET_CSS;
    document.head.appendChild(st);
  }

  const pages = teams.map((t, i) => {
    saveSheetRoster(`${key}|${t.name}`, t.roster);
    const them = teams.length === 2 ? teams[1 - i].name : teams.filter((x) => x !== t).map((x) => x.name).join(" / ");
    return sheetHTML({
      date, gameNo: 1, us: t.name, them,
      roster: t.roster,
      // 명단을 저장한 열쇠를 그대로 코드로 쓴다. 종이에 이 코드가 버블로도 찍히므로
      // 나중에 사진만 보고 "이건 어느 기록지"인지 판독기가 스스로 알아본다.
      code: `${key}|${t.name}`,
    });
  });

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal sheet-print-modal">
      <h3>기록지 ${teams.length}장</h3>
      <!-- 안내는 **인쇄 창에서 실제로 눌러야 하는 것**만 남긴다. 고칠 때마다 한 줄씩
           덧붙였더니 휴대폰 화면을 다 잡아먹어서 인쇄 단추가 화면 밖으로 밀려났었다.
           설명은 접어 두고, 필요한 사람만 펴 보면 된다. -->
      <p class="hint"><b>배경 그래픽 켜기</b> · 배율 100% · 여백 없음.
        용지는 <b>A4 세로</b> 그대로 — 기록지는 옆으로 누워 나옵니다.</p>

      <!-- 인쇄 전에 정작 확인해야 하는 건 "누가 어느 팀 종이에 찍히는가" 다.
           기록지를 통째로 줄여 보여주던 건 휴대폰에서 우표만 해서 아무것도 안 보였다
           (390px 화면에서 한 장이 290×205px). 그래서 글로 보여주고, 기록지 그림은
           보고 싶을 때만 펴게 했다. -->
      <ul class="sheet-print-list">
        ${teams.map((t) => `<li>
          <b>${escapeHtml(t.name)}</b>
          <span class="spl-count">${t.roster.length}명</span>
          <span class="spl-names">${t.roster
            .map(([no, name]) => `${no == null ? "" : `<i>#${no}</i>`}${escapeHtml(name)}`)
            .join("<em>·</em>")}</span>
        </li>`).join("")}
      </ul>
      <p class="stats-note sheet-print-when">${escapeHtml(date || "날짜 미정")} · 1경기</p>

      <button type="button" class="btn btn-sm" id="sp-toggle" aria-expanded="false">기록지 모양 보기</button>
      <div class="sheet-print-preview is-folded" id="sp-preview">${
        pages.map((p) => `<div class="sheet-page">${p}</div>`).join("")}</div>

      <div class="modal-actions">
        <button type="button" class="btn" id="sp-close">닫기</button>
        <button type="button" class="btn btn-primary" id="sp-print">인쇄</button>
      </div>
      <details class="sheet-print-why">
        <summary>왜 이렇게 하나요?</summary>
        <p><b>배경 그래픽이 꺼져 있으면</b> 종이의 검은 표식이 아예 안 찍힙니다. 표식이 없으면
          사진 판독이 원천적으로 안 되니 이것만은 꼭 켜주세요.</p>
        <p><b>용지를 가로로 맞추려 하면</b> 아이폰에서는 오른쪽이 잘립니다. 세로로 두면
          기록지가 알아서 누워 나오니, 나온 종이를 90° 돌려 쓰시면 됩니다.</p>
        <p><b>종이 네 변의 작은 검은 사각형</b>이 줄지어 찍혔는지 봐주세요. 판독기가 이걸로
          종이 안쪽이 밀린 것까지 바로잡습니다. 없으면 안쪽 칸을 한 줄씩 밀려 읽습니다.</p>
        <p><b>이름 밑의 작은 점 일곱 개</b>는 선수 이름입니다. 덕분에 누가 어느 기기에서
          사진을 올려도 이름이 자동으로 채워집니다.</p>
      </details>
    </div>`;
  document.body.appendChild(backdrop);

  // 인쇄할 때는 기록지만 남기고 나머지 화면은 감춘다.
  //
  // 여기서 세 가지를 놓쳐서 처음에 인쇄가 통째로 망가졌다. 다 다시 밟기 쉬운 것들이라
  // 적어 둔다.
  //   1) 미리보기를 zoom 으로 줄여 놨는데 인쇄에서 zoom 을 되돌리지 않았다.
  //      transform 만 지웠더니 종이가 34% 크기로 찍혔다. zoom 은 transform 이 아니다.
  //   2) @page{size:A4 landscape} 가 안 먹어서 210×297 세로로 나왔다. 치수를 직접
  //      적으면(297mm 210mm) 크롬 데스크톱에서는 먹는데, **iOS 사파리는 @page 의
  //      size 를 아예 안 본다.** 아이폰에서 뽑은 PDF 가 210×297 세로로 나와서
  //      기록지(가로 297mm) 오른쪽 87mm 가 통째로 잘렸다.
  //      → 그래서 이제 @page 에 기대지 않는다. **세로 A4 에 90° 돌려서** 찍는다.
  //        세로 A4 는 어디서나 기본값이라 브라우저 지원을 안 탄다. 종이를 옆으로
  //        돌려 쓰면 된다 — 폭 넓은 서식은 원래 그렇게 뽑는다.
  //   3) 네 귀퉁이 표식은 CSS background 다. 크롬은 "배경 그래픽"이 기본으로 꺼져 있어서
  //      그냥 두면 **표식이 아예 안 찍힌다** — 그러면 사진 판독이 원천적으로 불가능하다.
  //      print-color-adjust:exact 로 강제한다.
  //   4) 세로 A4 를 **꽉 채우면** 안 된다. 종이가 210×297 이어도 실제로 찍히는 영역은
  //      그보다 훨씬 작다 — iOS 사파리는 위아래에 주소·날짜·쪽번호를 넣고(끌 수 없다),
  //      프린터마다 물리적 여백도 있다.
  //
  //      처음엔 딱 맞췄다가 2장이 4페이지가 됐고, 0.85 로 줄였는데도 그대로였다.
  //      그래서 아이폰에서 뽑은 PDF 를 열어 **쪽마다 내용이 밀려나는 간격**을 쟀다:
  //      248.7 / 248.6 / 248.6mm. 즉 **아이폰이 실제로 찍는 세로는 248.6mm** 다.
  //      0.85 일 때 상자가 253.0mm 였으니 딱 4.4mm 초과해서 매 장 자투리가 넘어갔다.
  //      이 값은 추측이 아니라 실물에서 잰 것이다 — 고칠 일이 있으면 같은 방법으로
  //      다시 재고 고칠 것(PDF 를 pymupdf 로 열어 get_drawings() 범위를 보면 된다).
  const FIT = 0.78;
  const pw = (210 * FIT).toFixed(2);             // 회전 뒤 가로 = 178.50mm
  const ph = (297 * FIT).toFixed(2);             // 회전 뒤 세로 = 252.45mm
  // 상자는 0.6mm 크게 잡는다. 딱 맞추면 반올림 때문에 0.1mm 가 밖으로 나가고,
  // 상자를 잘라내게(overflow:hidden) 해 두면 **맨 아래 눈금 표식 줄이 잘린다**.
  // 표식이 잘리면 판독이 통째로 망가지므로 자르지 않고 여유를 준다.
  const bw = (210 * FIT + 0.6).toFixed(2);
  const bh = (297 * FIT + 0.6).toFixed(2);
  const printCss = document.createElement("style");
  printCss.textContent = `
  @page{size:A4 portrait;margin:0}
  @media print{
    html,body{width:auto!important;margin:0!important;padding:0!important;background:#fff!important}
    body>*{display:none!important}
    body>.modal-backdrop{display:block!important;position:static!important;background:#fff!important;
      padding:0!important;margin:0!important;overflow:visible!important}
    .modal-backdrop .modal{max-width:none!important;width:auto!important;max-height:none!important;
      background:#fff!important;box-shadow:none!important;padding:0!important;border:0!important;
      margin:0!important;display:block!important}
    .sheet-print-modal h3,.sheet-print-modal .hint,.sheet-print-modal .modal-actions,
    .sheet-print-why,.sheet-print-list,.sheet-print-when,#sp-toggle{display:none!important}
    /* 화면에서 접어 뒀어도 **인쇄에는 반드시 나와야 한다** */
    .sheet-print-preview,.sheet-print-preview.is-folded{
      display:block!important;visibility:visible!important;height:auto!important;
      overflow:visible!important;max-height:none!important;
      background:#fff!important;padding:0!important;margin:0!important;gap:0!important}
    /* 한 장 = 한 면. 상자는 **줄여 앉힌 기록지가 차지하는 만큼만** 잡는다 —
       210×297 로 잡으면 그 자체가 인쇄 영역을 넘겨 빈 면이 하나씩 더 생긴다. */
    .sheet-page{zoom:1!important;transform:none!important;
      width:${bw}mm!important;height:${bh}mm!important;position:relative!important;
      overflow:visible!important;margin:0 auto!important;
      page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}
    .sheet-page:last-child{page-break-after:auto;break-after:auto}
    /* 좌상단을 축으로 축소 → 90° 회전 → 오른쪽으로 밀기 (오른쪽부터 적용된다).
       결과가 정확히 ${pw}×${ph}mm 를 채운다. 균일 축소라 판독에는 영향이 없다 —
       판독기는 표식 네 점으로 좌표를 다시 잡으므로 종이가 몇 % 작아도 그대로 읽는다. */
    .sheet-page .sheet{position:absolute!important;top:0!important;left:0!important;
      width:297mm!important;height:210mm!important;
      transform:translateX(${pw}mm) rotate(90deg) scale(${FIT})!important;
      transform-origin:top left!important;
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  }`;
  document.head.appendChild(printCss);

  // 미리보기 축소 비율은 상자 폭을 재서 정한다. 고정값(0.34)으로 두면 좁은 화면에서
  // 기록지 오른쪽 열들이 상자 밖으로 나가 안 보인다 — 미리보기인데 못 보면 소용이 없다.
  const PX_PER_MM = 96 / 25.4;
  const preview = backdrop.querySelector(".sheet-print-preview");
  const fitPreview = () => {
    if (preview.classList.contains("is-folded")) return; // 접혀 있으면 폭이 0 이라 못 잰다
    const avail = preview.clientWidth - 20; // 좌우 padding
    if (avail <= 0) return;
    const z = Math.max(0.12, Math.min(0.8, avail / (SHEET_MM.w * PX_PER_MM)));
    backdrop.style.setProperty("--sheet-zoom", z.toFixed(3));
  };
  window.addEventListener("resize", fitPreview);

  const toggle = backdrop.querySelector("#sp-toggle");
  toggle.addEventListener("click", () => {
    const folded = preview.classList.toggle("is-folded");
    toggle.textContent = folded ? "기록지 모양 보기" : "기록지 모양 접기";
    toggle.setAttribute("aria-expanded", String(!folded));
    if (!folded) fitPreview(); // 펼친 **뒤에** 재야 폭이 나온다
  });

  const close = () => {
    window.removeEventListener("resize", fitPreview);
    backdrop.remove();
    printCss.remove();
  };
  backdrop.querySelector("#sp-close").addEventListener("click", close);
  backdrop.querySelector("#sp-print").addEventListener("click", () => window.print());
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
}

export function mountTeamBuilder(container) {
  const draft = getTeamBuilderDraft();

  // 예전에 4팀으로 저장해 둔 초안이 있을 수 있다. 고를 수 없는 값이 되살아나면
  // 화면과 어긋나므로 2팀으로 되돌린다.
  let teamCount = [2, 3].includes(draft?.teamCount) ? draft.teamCount : 2;
  let gameDate = draft?.gameDate || getNextEventDate("자체전", todayStr()) || todayStr();
  let search = "";
  // 게스트는 날짜에 묶여 있다. 날짜를 바꾸면 그 날짜의 목록으로 통째로 갈아탄다.
  let guests = getGuests(gameDate);
  const rosterNames = new Set(ROSTER.map((p) => p.name));
  const knownNames = () => new Set(getAllPlayers(guests).map((p) => p.name));
  let selected = new Set((draft?.selected || []).filter((n) => knownNames().has(n)));
  let assignments = {};
  if (draft?.assignments) {
    Object.entries(draft.assignments).forEach(([name, team]) => {
      if (selected.has(name) && Number.isInteger(team) && team < teamCount) assignments[name] = team;
    });
  }

  function persist() {
    saveTeamBuilderDraft({ teamCount, gameDate, selected: [...selected], assignments });
    // 다음 주에 불러올 수 있게 따로도 남긴다. 빈 명단은 저장하지 않으므로
    // '전체 초기화'를 눌러도 지난번 기록은 그대로 남는다.
    // 게스트는 여기 안 담는다 — 다음 주에 되살아나면 안 된다.
    saveLastAttendees([...selected].filter((n) => rosterNames.has(n)), gameDate);
    saveGuests(gameDate, guests);
  }

  // 겹치지 않는 다음 게스트 이름. 이름을 모르는 채로 편성부터 해야 할 때가 많다.
  function nextGuestName() {
    for (let i = 1; ; i++) {
      const n = `게스트 ${i}`;
      if (!guests.includes(n) && !rosterNames.has(n)) return n;
    }
  }

  // 날짜가 바뀌면 그 날의 게스트로 갈아탄다. 전에 뽑았던 게스트가 선택에 남아 있으면
  // 명단에 없는 이름이 되므로 같이 걷어낸다.
  function switchDate(next) {
    gameDate = next;
    guests = getGuests(gameDate);
    const known = knownNames();
    for (const n of [...selected]) {
      if (!known.has(n)) {
        selected.delete(n);
        delete assignments[n];
      }
    }
  }

  function render() {
    const players = getAllPlayers(guests);
    const playersByName = Object.fromEntries(players.map((p) => [p.name, p]));
    // 지난번 명단에서 그 사이 로스터에서 빠진 사람은 걸러낸다.
    const saved = getLastAttendees();
    const savedNames = saved ? saved.names.filter((n) => rosterNames.has(n)) : [];
    const lastAttendees = savedNames.length ? { names: savedNames, savedFor: saved.savedFor } : null;
    const q = search.trim();
    const filtered = q ? players.filter((p) => p.name.includes(q)) : players;
    const selectedNames = [...selected];

    const teamsPlayers = Array.from({ length: teamCount }, (_, i) => selectedNames.filter((n) => assignments[n] === i));
    const anyAssigned = teamsPlayers.some((t) => t.length > 0);

    container.innerHTML = `
      <div class="ts-toprow">
        <label class="ts-date-label">경기 날짜
          <input type="date" id="ts-date" value="${gameDate}" />
        </label>
        <div class="team-count-select">
          <span>팀 수:</span>
          ${teamCountChipsHTML(teamCount)}
        </div>
      </div>

      <h3 class="section-title">참석자 선택 (${selected.size}명)</h3>
      <!-- 명단을 통째로 다루는 단추는 명단 바로 위에 둔다. '전체 초기화'는 원래 저 아래
           팀 배정 줄에 있었는데, 정작 지우는 건 이 위의 참석자 선택이라 스크롤을 내려갔다
           와야 했다. 아래에는 배정만 건드리는 '배정 초기화'를 남긴다.

           둘이 같이 필요한 상태가 있다: 화면을 나갔다 오면 초안이 지워져 선택은 비지만
           게스트는 날짜에 묶여 남는다. 그때 '지난번 그대로'로 명단을 채우면서
           '전체 초기화'로 게스트까지 지울 수도 있어야 한다. 그래서 조건을 따로 건다. -->
      ${
        (() => {
          // 줄 자체를 조건부로 만든다. div 를 늘 두고 :empty 로 접으려 했더니,
          // 템플릿 안의 줄바꿈이 공백 텍스트 노드로 남아 :empty 가 안 먹고
          // 아래 여백 10px 만 덩그러니 남았다.
          const btns = [];
          if (selected.size === 0 && lastAttendees) {
            btns.push(`<button type="button" class="btn btn-sm" id="ts-recall">↩ 지난번 그대로 (${lastAttendees.names.length}명${
              lastAttendees.savedFor ? ` · ${shortDate(lastAttendees.savedFor)}` : ""
            })</button>`);
          }
          if (selected.size > 0 || guests.length) {
            btns.push(`<button type="button" class="btn btn-sm" id="ts-clear-all">전체 초기화</button>`);
          }
          return btns.length ? `<div class="ts-pick-actions">${btns.join("")}</div>` : "";
        })()
      }
      <input type="text" id="ts-search" class="search-input" placeholder="이름 검색" value="${escapeHtml(search)}" />
      <div class="ts-roster-grid">
        ${
          filtered.length
            ? filtered
                .map(
                  (p) => `
          <label class="ts-roster-chip ${selected.has(p.name) ? "is-checked" : ""}">
            <input type="checkbox" data-name="${escapeHtml(p.name)}" ${selected.has(p.name) ? "checked" : ""} />
            <span class="ts-roster-mark" aria-hidden="true"></span>
            <span class="ts-roster-name">${escapeHtml(nameWithCaptain(p))}${guestTagHTML(p)}</span>
          </label>`
                )
                .join("")
            : `<p class="hint">검색 결과가 없어요.</p>`
        }
      </div>

      <!-- 게스트는 그날만 뛰는 사람이라 로스터에 넣지 않는다.
           경기 날짜에 묶여 있어서, 날짜를 다음 주로 바꾸면 저절로 빈 목록이 된다. -->
      <div class="ts-guests">
        <div class="ts-guest-head">
          <span class="ts-guest-title">오늘 게스트${guests.length ? ` (${guests.length}명)` : ""}</span>
          <button type="button" class="btn btn-sm" id="ts-guest-add">＋ 게스트</button>
        </div>
        ${
          guests.length
            ? `<div class="ts-guest-list">${guests
                .map(
                  (name, i) => `
            <div class="ts-guest-row">
              <input type="text" class="ts-guest-input" data-guest="${i}" value="${escapeHtml(name)}"
                     placeholder="게스트 이름" aria-label="게스트 ${i + 1} 이름" />
              <button type="button" class="btn-icon ts-guest-del" data-guest-del="${i}" aria-label="${escapeHtml(name)} 빼기">×</button>
            </div>`
                )
                .join("")}</div>
             <p class="hint ts-guest-note">${escapeHtml(shortDate(gameDate) || "이 날")} 경기에만 쓰입니다. 날짜를 바꾸면 사라지고, 「지난번 그대로」에도 안 들어가요.</p>`
            : `<p class="hint ts-guest-note">로스터에 없는 사람은 여기에 추가하세요. 그날 경기에만 쓰이고 로스터는 그대로예요.</p>`
        }
      </div>

      <h3 class="section-title">팀 배정</h3>
      <p class="hint">이름 옆 팀 글자를 눌러 배정해주세요.</p>
      <div class="ts-assign-toolbar">
        <button type="button" class="btn btn-sm" id="ts-auto-assign">🔀 미배정 인원 자동 배정</button>
        <button type="button" class="link-btn tap-wide" id="ts-clear-assign">배정 초기화</button>
      </div>
      <div class="ts-assign-list">
        ${
          selectedNames.length
            ? selectedNames
                .map(
                  (name) => `
          <div class="ts-assign-row">
            <span class="ts-assign-name">${jerseyHTML(playersByName[name], "is-sm")}${escapeHtml(
                    nameWithCaptain(playersByName[name])
                  )}${guestTagHTML(playersByName[name])}</span>
            <div class="ts-team-buttons">
              ${Array.from(
                { length: teamCount },
                (_, i) => `
                <button type="button" class="ts-team-btn ${assignments[name] === i ? "is-active" : ""}" style="--team-color:${
                  TEAM_ACCENT[i]
                }" data-name="${escapeHtml(name)}" data-team="${i}">${TEAM_LETTERS[i]}</button>`
              ).join("")}
            </div>
          </div>`
                )
                .join("")
            : `<p class="hint">위에서 참석자를 먼저 선택해주세요.</p>`
        }
      </div>

      <h3 class="section-title">팀 구성 미리보기</h3>
      <p class="hint ts-preview-hint">실제 경기는 5명만 코트에 뛰기 때문에, 인원이 많고 적음에 상관없이 공정하게 비교할 수 있도록 ${TYPICAL_TEAM_SIZE}인 팀 기준으로 환산한 예상치예요.</p>
      <div class="ts-preview-grid">
        ${Array.from({ length: teamCount }, (_, i) => {
          const teamNames = teamsPlayers[i];
          const proj = computeProjection(teamNames, playersByName);
          return `
          <div class="ts-preview-card" style="--team-color:${TEAM_ACCENT[i]}">
            <h4>${TEAM_LETTERS[i]}팀 (${teamNames.length}명)</h4>
            <div class="ts-preview-names">${
              teamNames.length
                ? teamNames
                    .map(
                      (n) =>
                        `<span class="ts-preview-player">${jerseyHTML(playersByName[n], "is-sm")}${escapeHtml(
                          nameWithCaptain(playersByName[n])
                        )}</span>`
                    )
                    .join("")
                : "아직 없음"
            }</div>
            ${
              proj
                ? `<div class="ts-preview-stats">예상 득점 <strong>${proj.ppg.toFixed(1)}</strong>점 (인당 평균 ${proj.ppgAvg.toFixed(
                    1
                  )})</div>
                   <div class="ts-preview-stats">리바운드 ${proj.rpg.toFixed(1)} (평균 ${proj.rpgAvg.toFixed(
                    1
                  )}) · 어시스트 ${proj.apg.toFixed(1)} (평균 ${proj.apgAvg.toFixed(1)})${
                    proj.topg != null ? ` · 턴오버 ${proj.topg.toFixed(1)} (평균 ${proj.topgAvg.toFixed(1)})` : ""
                  }${proj.fgPctAvg != null ? ` · 야투율 ${Math.round(proj.fgPctAvg * 100)}%` : ""}</div>`
                : ""
            }
            ${
              proj && proj.statCount < teamNames.length
                ? `<div class="hint ts-preview-note">${teamNames.length - proj.statCount}명은 기록 데이터가 없어 통계에서 제외했어요.</div>`
                : ""
            }
          </div>`;
        }).join("")}
      </div>

      <button type="button" class="btn btn-primary" id="ts-image-btn" ${anyAssigned ? "" : "disabled"}>🖼 공지 이미지 만들기</button>
      <button type="button" class="btn" id="ts-sheet-btn" ${anyAssigned ? "" : "disabled"}>📄 기록지 출력</button>
    `;

    document.getElementById("ts-date").addEventListener("input", (e) => {
      switchDate(e.target.value);
      persist();
      render();
    });

    container.querySelectorAll(".team-count-select .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        teamCount = Number(btn.dataset.count);
        Object.keys(assignments).forEach((name) => {
          if (assignments[name] >= teamCount) delete assignments[name];
        });
        persist();
        render();
      });
    });

    const searchInput = document.getElementById("ts-search");
    searchInput.addEventListener("input", (e) => {
      search = e.target.value;
      const caret = e.target.selectionStart;
      render();
      const el = document.getElementById("ts-search");
      el.focus();
      el.setSelectionRange(caret, caret);
    });

    document.getElementById("ts-guest-add").addEventListener("click", () => {
      const name = nextGuestName();
      guests.push(name);
      selected.add(name);          // 게스트를 넣는 순간 참석이다 — 또 고르게 하지 않는다
      persist();
      render();
      const last = container.querySelector(`[data-guest="${guests.length - 1}"]`);
      if (last) { last.focus(); last.select(); }
    });

    // 이름은 칸을 벗어날 때 반영한다. 한 글자마다 다시 그리면 커서가 튀고,
    // 이름이 바뀌면 선택·배정에 담긴 열쇠도 같이 갈아끼워야 한다.
    container.querySelectorAll("[data-guest]").forEach((input) => {
      input.addEventListener("change", () => {
        const i = Number(input.dataset.guest);
        const before = guests[i];
        const after = input.value.trim();
        // 빈 이름이나 이미 있는 이름은 되돌린다 — 두 사람이 같은 이름이면 배정이 엉킨다.
        if (!after || after !== before && (guests.includes(after) || rosterNames.has(after))) {
          input.value = before;
          return;
        }
        guests[i] = after;
        if (selected.delete(before)) selected.add(after);
        if (before in assignments) {
          assignments[after] = assignments[before];
          delete assignments[before];
        }
        persist();
        render();
      });
    });

    container.querySelectorAll("[data-guest-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.guestDel);
        const [gone] = guests.splice(i, 1);
        selected.delete(gone);
        delete assignments[gone];
        persist();
        render();
      });
    });

    const recall = document.getElementById("ts-recall");
    if (recall) {
      recall.addEventListener("click", () => {
        lastAttendees.names.forEach((n) => selected.add(n));
        persist();
        render();
      });
    }

    container.querySelectorAll(".ts-roster-chip input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const name = e.target.dataset.name;
        if (e.target.checked) {
          selected.add(name);
        } else {
          selected.delete(name);
          delete assignments[name];
        }
        persist();
        render();
      });
    });

    container.querySelectorAll(".ts-team-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.name;
        const team = Number(btn.dataset.team);
        if (assignments[name] === team) {
          delete assignments[name];
        } else {
          assignments[name] = team;
        }
        persist();
        render();
      });
    });

    document.getElementById("ts-auto-assign").addEventListener("click", () => {
      const unassigned = shuffle(selectedNames.filter((n) => !(n in assignments)));
      unassigned.forEach((name) => {
        const counts = Array.from({ length: teamCount }, (_, i) => Object.values(assignments).filter((t) => t === i).length);
        let minTeam = 0;
        for (let i = 1; i < teamCount; i++) if (counts[i] < counts[minTeam]) minTeam = i;
        assignments[name] = minTeam;
      });
      persist();
      render();
    });

    document.getElementById("ts-clear-assign").addEventListener("click", () => {
      assignments = {};
      persist();
      render();
    });

    const clearAll = document.getElementById("ts-clear-all");
    if (clearAll) {
      clearAll.addEventListener("click", () => {
        selected = new Set();
        assignments = {};
        guests = [];              // '전체'니까 게스트도 같이 비운다
        saveGuests(gameDate, []);
        clearTeamBuilderDraft();
        render();
      });
    }

    document.getElementById("ts-image-btn").addEventListener("click", () => {
      const rows = Array.from({ length: teamCount }, (_, i) => ({
        letter: TEAM_LETTERS[i],
        // 유니폼을 그리려면 번호가 필요하니 이름만 넘기지 않고 선수를 통째로 넘긴다.
        players: teamsPlayers[i].map((n) => ({
          name: nameWithCaptain(playersByName[n]),
          number: playersByName[n]?.number,
        })),
      })).filter((t) => t.players.length > 0);
      if (!rows.length) return;
      showTeamImageModal(rows, gameDate, teamCount);
    });

    document.getElementById("ts-sheet-btn").addEventListener("click", () => {
      const teams = Array.from({ length: teamCount }, (_, i) => ({
        name: `혼 ${TEAM_LETTERS[i]}`,
        // 기록지에는 (C) 같은 꼬리표 없이 이름만 — 판독 뒤 로스터와 짝을 맞춰야 한다.
        // 세 번째 값은 로스터에서 몇 번째인지. 이게 종이에 버블로 같이 찍혀서,
        // 사진을 올리는 사람이 누구든 이름이 나온다.
        // 세 번째 값은 로스터에서 몇 번째인지. 게스트는 로스터에 없으므로 null 을 준다 —
        // 그러면 이름 칸 버블이 빈 줄로 찍히고, 판독 뒤 그 줄만 사람이 골라 주면 된다.
        // (findIndex 의 -1 을 그대로 흘려도 결과는 같지만, 뜻이 다른 값이라 구분해 둔다)
        roster: teamsPlayers[i].map((n) => {
          const idx = ROSTER.findIndex((p) => p.name === n);
          return [
            typeof playersByName[n]?.number === "number" ? playersByName[n].number : null, n,
            idx >= 0 ? idx : null,
          ];
        }),
      })).filter((t) => t.roster.length > 0);
      if (!teams.length) return;
      showSheetPrintModal(teams, gameDate);
    });
  }

  render();
}
