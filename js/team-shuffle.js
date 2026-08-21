import { ROSTER } from "./roster.js";
import { getTeamBuilderDraft, saveTeamBuilderDraft, clearTeamBuilderDraft, saveSheetRoster } from "./storage.js";
import { sheetHTML, SHEET_CSS, PLAYER_ROWS } from "./sheetform.js";
import { getNextEventDate } from "./events.js";
import {
  jerseyHTML,
  hasNumber,
  JERSEY_PATH,
  JERSEY_COLLAR_PATH,
  JERSEY_VIEW,
  JERSEY_NUM_CY,
} from "./jersey.js";

const TEAM_LETTERS = ["A", "B", "C"];
const TEAM_ACCENT = ["#f97316", "#22c55e", "#3b82f6"];
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

function teamCountChipsHTML(current) {
  return [2, 3]
    .map((n) => `<button type="button" class="chip ${current === n ? "chip-active" : ""}" data-count="${n}">${n}팀</button>`)
    .join("");
}

function getAllPlayers() {
  return [...ROSTER];
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
  const sizeAdjust = TYPICAL_TEAM_SIZE / statCount;
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
    topg: topgSum != null ? topgSum * (TYPICAL_TEAM_SIZE / topgPlayers.length) : null,
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

// [유니폼][이름]을 한 덩어리로 묶어 칸 가운데에 놓는다.
// 덩어리 전체 폭을 재서 배치해야 이름만 있던 때와 가운데가 어긋나지 않는다.
function drawPlayerCell(ctx, p, cx, cy, font, ink) {
  const jerseyH = 34;
  const jerseyW = (jerseyH * JERSEY_VIEW.w) / JERSEY_VIEW.h;
  const gap = 7;
  ctx.font = font;
  const nameW = ctx.measureText(p.name).width;
  const left = cx - (jerseyW + gap + nameW) / 2;
  drawJersey(ctx, left, cy - jerseyH / 2, jerseyH, p, ink);
  ctx.font = font;
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(p.name, left + jerseyW + gap, cy + 1);
  // 다음 칸이 가운데 정렬을 기대하고 있으므로 되돌려 놓는다.
  ctx.textAlign = "center";
}

function computeCanvasLayout(rows) {
  // 유니폼이 이름 앞에 붙는 만큼 칸이 넓어야 한다(예전 132).
  // 가장 긴 조합이 "유니폼 + 김성훈(C)" 118px(클래식 20px 기준)이라 양옆에 16px씩 남는다.
  const cellW = 150;
  const cellH = 58;
  const labelW = 70;
  const padding = 26;
  const titleH = 64;
  const maxCols = Math.max(1, ...rows.map((t) => t.players.length));
  const width = padding * 2 + labelW + maxCols * cellW;
  const height = padding * 2 + titleH + rows.length * cellH;
  return { cellW, cellH, labelW, padding, titleH, width, height };
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

function drawClassicTheme(rows, gameDate, teamCount) {
  const { padding, titleH, cellW, cellH, labelW, width, height } = computeCanvasLayout(rows);
  const { canvas, ctx } = createScaledCanvas(width, height);
  const palette = ["#fbe0c4", "#d9f0dc", "#d7e6f7"];

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  ctx.fillStyle = "#3b5bdb";
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`[${dateLabel}_자체${teamCount}파전 팀공지]`, padding, padding + 26);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#c9c9c9";
  ctx.lineWidth = 1;

  rows.forEach((team, r) => {
    const color = palette[r % palette.length];
    const y = padding + titleH + r * cellH;
    ctx.fillStyle = color;
    ctx.fillRect(padding, y, labelW, cellH);
    ctx.strokeRect(padding, y, labelW, cellH);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(team.letter, padding + labelW / 2, y + cellH / 2 + 1);

    team.players.forEach((p, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeRect(x, y, cellW, cellH);
      drawPlayerCell(ctx, p, x + cellW / 2, y + cellH / 2, `20px ${FONT}`, "#1a1a1a");
    });
  });

  return canvas;
}

function drawNbaTheme(rows, gameDate, teamCount) {
  const { padding, titleH, cellW, cellH, labelW, width, height } = computeCanvasLayout(rows);
  const { canvas, ctx } = createScaledCanvas(width, height);
  const palette = ["#f97316", "#38bdf8", "#facc15"];

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#111a30");
  grad.addColorStop(1, "#05070d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(249,115,22,0.55)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#f97316";
  ctx.font = `900 26px ${FONT}`;
  ctx.fillText(`${dateLabel} 자체${teamCount}파전`, padding, padding + 28);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#94a3b8";
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText("TEAM ANNOUNCEMENT", padding, padding + 48);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  rows.forEach((team, r) => {
    const color = palette[r % palette.length];
    const y = padding + titleH + r * cellH;
    ctx.fillStyle = color;
    roundRectPath(ctx, padding, y + 4, labelW - 8, cellH - 8, 8);
    ctx.fill();
    ctx.fillStyle = "#05070d";
    ctx.font = `900 18px ${FONT}`;
    ctx.fillText(team.letter, padding + (labelW - 8) / 2, y + cellH / 2 + 1);

    team.players.forEach((p, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "#111827";
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 8);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 8);
      ctx.stroke();
      drawPlayerCell(ctx, p, x + (cellW - 8) / 2, y + cellH / 2, `bold 17px ${FONT}`, "#f8fafc");
    });
  });

  return canvas;
}

function drawSoccerTheme(rows, gameDate, teamCount) {
  const { padding, titleH, cellW, cellH, labelW, width, height } = computeCanvasLayout(rows);
  const { canvas, ctx } = createScaledCanvas(width, height);
  const palette = ["#ef4444", "#eab308", "#3b82f6"];

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0f3d1e");
  grad.addColorStop(1, "#1c6b32");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  const stripeH = 24;
  for (let y = 0; y < height; y += stripeH * 2) {
    ctx.fillRect(0, y, width, stripeH);
  }

  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 24px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${dateLabel} 자체${teamCount}파전 라인업`, padding, padding + 26);
  ctx.strokeStyle = "#eab308";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding + 36);
  ctx.lineTo(padding + 220, padding + 36);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  rows.forEach((team, r) => {
    const color = palette[r % palette.length];
    const y = padding + titleH + r * cellH;
    const labelR = (labelW - 16) / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(padding + labelR, y + cellH / 2, labelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(team.letter, padding + labelR, y + cellH / 2 + 1);

    team.players.forEach((p, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRectPath(ctx, x, y + 6, cellW - 10, cellH - 12, cellH / 2 - 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRectPath(ctx, x, y + 6, cellW - 10, cellH - 12, cellH / 2 - 6);
      ctx.stroke();
      drawPlayerCell(ctx, p, x + (cellW - 10) / 2, y + cellH / 2, `bold 17px ${FONT}`, "#111827");
    });
  });

  return canvas;
}

function drawEsportsTheme(rows, gameDate, teamCount) {
  const { padding, titleH, cellW, cellH, labelW, width, height } = computeCanvasLayout(rows);
  const { canvas, ctx } = createScaledCanvas(width, height);
  const palette = ["#22d3ee", "#f472b6", "#a3e635"];

  ctx.fillStyle = "#08080f";
  ctx.fillRect(0, 0, width, height);

  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  const titleGrad = ctx.createLinearGradient(padding, 0, padding + 260, 0);
  titleGrad.addColorStop(0, "#22d3ee");
  titleGrad.addColorStop(1, "#f472b6");
  ctx.fillStyle = titleGrad;
  ctx.font = `900 26px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${dateLabel}_자체${teamCount}파전`.toUpperCase(), padding, padding + 28);
  ctx.fillStyle = "#64748b";
  ctx.font = `600 12px ${FONT}`;
  ctx.fillText("SPIRIT ROSTER LOCK-IN", padding, padding + 48);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  rows.forEach((team, r) => {
    const color = palette[r % palette.length];
    const y = padding + titleH + r * cellH;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    roundRectPath(ctx, padding, y + 4, labelW - 8, cellH - 8, 6);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `900 18px ${FONT}`;
    ctx.fillText(team.letter, padding + (labelW - 8) / 2, y + cellH / 2 + 1);

    team.players.forEach((p, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "#101018";
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 6);
      ctx.stroke();
      drawPlayerCell(ctx, p, x + (cellW - 8) / 2, y + cellH / 2, `bold 17px ${FONT}`, "#f1f5f9");
    });
  });

  return canvas;
}

function drawRetroTheme(rows, gameDate, teamCount) {
  const { padding, titleH, cellW, cellH, labelW, width, height } = computeCanvasLayout(rows);
  const { canvas, ctx } = createScaledCanvas(width, height);
  const palette = ["#c1440e", "#7a8c3a", "#c9971e"];

  ctx.fillStyle = "#f3e6c8";
  ctx.fillRect(0, 0, width, height);

  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 26px ${FONT}`;
  ctx.fillStyle = "#3f2a1a";
  ctx.fillText(`${dateLabel} 자체${teamCount}파전 팀공지`, padding + 2, padding + 30);
  ctx.fillStyle = "#7f1d1d";
  ctx.fillText(`${dateLabel} 자체${teamCount}파전 팀공지`, padding, padding + 28);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  rows.forEach((team, r) => {
    const color = palette[r % palette.length];
    const y = padding + titleH + r * cellH;

    ctx.fillStyle = color;
    ctx.fillRect(padding, y + 4, labelW - 8, cellH - 8);
    ctx.fillStyle = "#fff8ea";
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(team.letter, padding + (labelW - 8) / 2, y + cellH / 2 + 1);

    team.players.forEach((p, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "#fff8ea";
      ctx.fillRect(x, y + 4, cellW - 8, cellH - 8);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x, y + 4, cellW - 8, cellH - 8);
      ctx.setLineDash([]);
      drawPlayerCell(ctx, p, x + (cellW - 8) / 2, y + cellH / 2, `bold 17px ${FONT}`, "#3f2a1a");
    });
  });

  return canvas;
}

const IMAGE_THEMES = [
  { key: "classic", label: "클래식", draw: drawClassicTheme },
  { key: "nba", label: "NBA 스코어보드", draw: drawNbaTheme },
  { key: "soccer", label: "축구 라인업", draw: drawSoccerTheme },
  { key: "esports", label: "e스포츠 네온", draw: drawEsportsTheme },
  { key: "retro", label: "레트로 포스터", draw: drawRetroTheme },
];

function pickTheme(excludeKey) {
  const pool = excludeKey ? IMAGE_THEMES.filter((t) => t.key !== excludeKey) : IMAGE_THEMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

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
  let theme = pickTheme();
  let canvas = theme.draw(rows, gameDate, teamCount);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  document.body.appendChild(backdrop);

  function renderModal() {
    const dataUrl = canvas.toDataURL("image/png");
    backdrop.innerHTML = `
      <div class="modal ts-image-modal">
        <h3>팀 공지 이미지 <span class="ts-image-theme-tag">${theme.label}</span></h3>
        <p class="hint">이미지를 길게 눌러 저장하거나, 아래 버튼으로 복사/다운로드해서 밴드나 카톡에 붙여넣어주세요.</p>
        <div class="ts-image-preview"><img src="${dataUrl}" alt="팀 공지 이미지 (${theme.label} 스타일)" /></div>
        <div class="modal-actions">
          <button type="button" class="btn" id="ts-image-close">닫기</button>
          <button type="button" class="btn" id="ts-image-reroll">🎲 다른 스타일로</button>
          <button type="button" class="btn" id="ts-image-download">다운로드</button>
          <button type="button" class="btn btn-primary" id="ts-image-copy">클립보드에 복사</button>
        </div>
      </div>
    `;

    backdrop.querySelector("#ts-image-close").addEventListener("click", () => backdrop.remove());
    backdrop.querySelector("#ts-image-reroll").addEventListener("click", () => {
      theme = pickTheme(theme.key);
      canvas = theme.draw(rows, gameDate, teamCount);
      renderModal();
    });
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
      <p class="hint">인쇄 창에서 <b>배율 100%</b>, <b>여백 없음</b>, 그리고 <b>배경 그래픽 켜기</b>를
        확인해주세요 — 배경 그래픽이 꺼져 있으면 <b>검은 표식이 안 찍혀서</b> 사진 판독이 아예 안 됩니다.
        용지는 <b>A4 세로 그대로</b> 두시면 됩니다 — 기록지가 <b>옆으로 누워서</b> 찍힙니다.
        나온 종이를 90° 돌려서 쓰시면 됩니다. (가로로 맞추려 하면 아이폰에서는 오른쪽이 잘립니다.)
        종이 <b>네 변을 따라 작은 검은 사각형</b>이 줄지어 찍히는지 꼭 확인해주세요 — 판독기가 이걸로
        종이 안쪽이 밀린 것까지 바로잡습니다. 이게 없으면 안쪽 칸을 한 줄씩 밀려 읽습니다.
        선수 이름은 <b>종이에 같이 찍혀 나갑니다</b> — 이름 밑의 작은 점 일곱 개가 그것입니다.
        그래서 나중에 <b>누가 어느 기기에서 사진을 올려도</b> 이름이 자동으로 채워집니다.</p>
      <div class="sheet-print-preview">${pages.map((p) => `<div class="sheet-page">${p}</div>`).join("")}</div>
      <div class="modal-actions">
        <button type="button" class="btn" id="sp-close">닫기</button>
        <button type="button" class="btn btn-primary" id="sp-print">인쇄</button>
      </div>
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
  const printCss = document.createElement("style");
  printCss.textContent = `
  @page{size:A4 portrait;margin:0}
  @media print{
    html,body{width:210mm;margin:0!important;padding:0!important;background:#fff!important}
    body>*{display:none!important}
    body>.modal-backdrop{display:block!important;position:static!important;background:#fff!important;
      padding:0!important;margin:0!important;overflow:visible!important}
    .modal-backdrop .modal{max-width:none!important;width:auto!important;background:#fff!important;
      box-shadow:none!important;padding:0!important;border:0!important;margin:0!important}
    .sheet-print-modal h3,.sheet-print-modal .hint,.sheet-print-modal .modal-actions{display:none!important}
    .sheet-print-preview{display:block!important;overflow:visible!important;max-height:none!important;
      background:#fff!important;padding:0!important;margin:0!important;gap:0!important}
    /* 한 장 = 세로 A4 한 면. 그 안에서 기록지를 90° 돌려 딱 채운다. */
    .sheet-page{zoom:1!important;transform:none!important;
      width:210mm!important;height:297mm!important;position:relative!important;
      overflow:visible!important;margin:0!important;page-break-after:always;break-after:page}
    .sheet-page:last-child{page-break-after:auto;break-after:auto}
    /* 좌상단을 축으로 90° 돌리면 x 가 -210~0 으로 가므로 210mm 만큼 오른쪽으로 민다.
       결과: 정확히 210×297 세로 면을 채운다. */
    .sheet-page .sheet{position:absolute!important;top:0!important;left:0!important;
      width:297mm!important;height:210mm!important;
      transform:translateX(210mm) rotate(90deg)!important;transform-origin:top left!important;
      -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  }`;
  document.head.appendChild(printCss);

  const close = () => { backdrop.remove(); printCss.remove(); };
  backdrop.querySelector("#sp-close").addEventListener("click", close);
  backdrop.querySelector("#sp-print").addEventListener("click", () => window.print());
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
}

export function mountTeamBuilder(container) {
  const draft = getTeamBuilderDraft();
  const knownNames = new Set(getAllPlayers().map((p) => p.name));

  let teamCount = draft?.teamCount === 3 ? 3 : 2;
  let gameDate = draft?.gameDate || getNextEventDate("자체전", todayStr()) || todayStr();
  let search = "";
  let selected = new Set((draft?.selected || []).filter((n) => knownNames.has(n)));
  let assignments = {};
  if (draft?.assignments) {
    Object.entries(draft.assignments).forEach(([name, team]) => {
      if (selected.has(name) && Number.isInteger(team) && team < teamCount) assignments[name] = team;
    });
  }

  function persist() {
    saveTeamBuilderDraft({ teamCount, gameDate, selected: [...selected], assignments });
  }

  function render() {
    const players = getAllPlayers();
    const playersByName = Object.fromEntries(players.map((p) => [p.name, p]));
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
      <input type="text" id="ts-search" class="search-input" placeholder="이름 검색" value="${escapeHtml(search)}" />
      <div class="ts-roster-grid">
        ${
          filtered.length
            ? filtered
                .map(
                  (p) => `
          <label class="ts-roster-chip ${selected.has(p.name) ? "is-checked" : ""}">
            <input type="checkbox" data-name="${escapeHtml(p.name)}" ${selected.has(p.name) ? "checked" : ""} />
            ${escapeHtml(nameWithCaptain(p))}
          </label>`
                )
                .join("")
            : `<p class="hint">검색 결과가 없어요.</p>`
        }
      </div>

      <h3 class="section-title">팀 배정</h3>
      <p class="hint">이름 옆 팀 글자를 눌러 배정해주세요.</p>
      <div class="ts-assign-toolbar">
        <button type="button" class="btn btn-sm" id="ts-auto-assign">🔀 미배정 인원 자동 배정</button>
        <button type="button" class="link-btn tap-wide" id="ts-clear-assign">배정 초기화</button>
        <button type="button" class="link-btn tap-wide" id="ts-clear-all">전체 초기화</button>
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
                  )}</span>
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
      gameDate = e.target.value;
      persist();
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

    document.getElementById("ts-clear-all").addEventListener("click", () => {
      selected = new Set();
      assignments = {};
      clearTeamBuilderDraft();
      render();
    });

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
        roster: teamsPlayers[i].map((n) => [
          typeof playersByName[n]?.number === "number" ? playersByName[n].number : null, n,
          ROSTER.findIndex((p) => p.name === n),
        ]),
      })).filter((t) => t.roster.length > 0);
      if (!teams.length) return;
      showSheetPrintModal(teams, gameDate);
    });
  }

  render();
}
