import { ROSTER } from "./roster.js";
import { getTeamBuilderDraft, saveTeamBuilderDraft, clearTeamBuilderDraft } from "./storage.js";
import { getNextEventDate } from "./events.js";

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

function computeCanvasLayout(rows) {
  const cellW = 132;
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

    team.players.forEach((name, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeRect(x, y, cellW, cellH);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `20px ${FONT}`;
      ctx.fillText(name, x + cellW / 2, y + cellH / 2 + 1);
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

    team.players.forEach((name, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "#111827";
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 8);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 8);
      ctx.stroke();
      ctx.fillStyle = "#f8fafc";
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillText(name, x + (cellW - 8) / 2, y + cellH / 2 + 1);
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

    team.players.forEach((name, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRectPath(ctx, x, y + 6, cellW - 10, cellH - 12, cellH / 2 - 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRectPath(ctx, x, y + 6, cellW - 10, cellH - 12, cellH / 2 - 6);
      ctx.stroke();
      ctx.fillStyle = "#111827";
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillText(name, x + (cellW - 10) / 2, y + cellH / 2 + 1);
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

    team.players.forEach((name, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "#101018";
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 6);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, x, y + 4, cellW - 8, cellH - 8, 6);
      ctx.stroke();
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillText(name, x + (cellW - 8) / 2, y + cellH / 2 + 1);
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

    team.players.forEach((name, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = "#fff8ea";
      ctx.fillRect(x, y + 4, cellW - 8, cellH - 8);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(x, y + 4, cellW - 8, cellH - 8);
      ctx.setLineDash([]);
      ctx.fillStyle = "#3f2a1a";
      ctx.font = `bold 17px ${FONT}`;
      ctx.fillText(name, x + (cellW - 8) / 2, y + cellH / 2 + 1);
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
        <button type="button" class="link-btn" id="ts-clear-assign">배정 초기화</button>
        <button type="button" class="link-btn" id="ts-clear-all">전체 초기화</button>
      </div>
      <div class="ts-assign-list">
        ${
          selectedNames.length
            ? selectedNames
                .map(
                  (name) => `
          <div class="ts-assign-row">
            <span class="ts-assign-name">${escapeHtml(nameWithCaptain(playersByName[name]))}</span>
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
              teamNames.length ? teamNames.map((n) => escapeHtml(nameWithCaptain(playersByName[n]))).join(", ") : "아직 없음"
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
        players: teamsPlayers[i].map((n) => nameWithCaptain(playersByName[n])),
      })).filter((t) => t.players.length > 0);
      if (!rows.length) return;
      showTeamImageModal(rows, gameDate, teamCount);
    });
  }

  render();
}
