import { ROSTER } from "./roster.js";
import { getCustomRoster, getTeamBuilderDraft, saveTeamBuilderDraft, clearTeamBuilderDraft } from "./storage.js";

const TEAM_LETTERS = ["A", "B", "C"];
const TEAM_ACCENT = ["#f97316", "#22c55e", "#3b82f6"];
const TEAM_IMAGE_BG = ["#fbe0c4", "#d9f0dc", "#d7e6f7"];

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
  return [...ROSTER, ...getCustomRoster()];
}

function computeProjection(playerNames, playersByName) {
  const players = playerNames.map((n) => playersByName[n]).filter((p) => p && typeof p.ppg === "number");
  if (!players.length) return null;
  const statCount = players.length;
  const sum = (key) => players.reduce((acc, p) => acc + p[key], 0);
  return {
    statCount,
    ppg: (sum("ppg") / statCount) * 5,
    rpg: (sum("rpg") / statCount) * 5,
    apg: (sum("apg") / statCount) * 5,
  };
}

function generateTeamCanvas(teamsRows, gameDate, teamCount) {
  const cellW = 132;
  const cellH = 56;
  const labelW = 64;
  const padding = 24;
  const titleH = 56;
  const maxCols = Math.max(1, ...teamsRows.map((t) => t.players.length));
  const width = padding * 2 + labelW + maxCols * cellW;
  const height = padding * 2 + titleH + teamsRows.length * cellH;

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const dateLabel = gameDate ? gameDate.replaceAll("-", ".") : "";
  ctx.fillStyle = "#3b5bdb";
  ctx.font = "bold 24px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`[${dateLabel}_자체${teamCount}파전 팀공지]`, padding, padding + 28);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#c9c9c9";
  ctx.lineWidth = 1;

  teamsRows.forEach((team, r) => {
    const y = padding + titleH + r * cellH;

    ctx.fillStyle = team.bg;
    ctx.fillRect(padding, y, labelW, cellH);
    ctx.strokeRect(padding, y, labelW, cellH);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 20px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
    ctx.fillText(team.letter, padding + labelW / 2, y + cellH / 2 + 1);

    team.players.forEach((name, i) => {
      const x = padding + labelW + i * cellW;
      ctx.fillStyle = team.bg;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.strokeRect(x, y, cellW, cellH);
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "20px 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
      ctx.fillText(name, x + cellW / 2, y + cellH / 2 + 1);
    });
  });

  return canvas;
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

function showTeamImageModal(canvas, filename) {
  const dataUrl = canvas.toDataURL("image/png");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal ts-image-modal">
      <h3>팀 공지 이미지</h3>
      <p class="hint">이미지를 길게 눌러 저장하거나, 아래 버튼으로 복사/다운로드해서 밴드나 카톡에 붙여넣어주세요.</p>
      <div class="ts-image-preview"><img src="${dataUrl}" alt="팀 공지 이미지" /></div>
      <div class="modal-actions">
        <button type="button" class="btn" id="ts-image-close">닫기</button>
        <button type="button" class="btn" id="ts-image-download">다운로드</button>
        <button type="button" class="btn btn-primary" id="ts-image-copy">클립보드에 복사</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.getElementById("ts-image-close").addEventListener("click", () => backdrop.remove());
  document.getElementById("ts-image-download").addEventListener("click", () => downloadCanvas(canvas, filename));
  document.getElementById("ts-image-copy").addEventListener("click", async () => {
    const btn = document.getElementById("ts-image-copy");
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

export function mountTeamBuilder(container) {
  const draft = getTeamBuilderDraft();
  const knownNames = new Set(getAllPlayers().map((p) => p.name));

  let teamCount = draft?.teamCount === 3 ? 3 : 2;
  let gameDate = draft?.gameDate || todayStr();
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
            ${escapeHtml(p.name)}
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
            <span class="ts-assign-name">${escapeHtml(name)}</span>
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
      <div class="ts-preview-grid">
        ${Array.from({ length: teamCount }, (_, i) => {
          const teamNames = teamsPlayers[i];
          const proj = computeProjection(teamNames, playersByName);
          return `
          <div class="ts-preview-card" style="--team-color:${TEAM_ACCENT[i]}">
            <h4>${TEAM_LETTERS[i]}팀 (${teamNames.length}명)</h4>
            <div class="ts-preview-names">${teamNames.length ? teamNames.map((n) => escapeHtml(n)).join(", ") : "아직 없음"}</div>
            ${
              proj
                ? `<div class="ts-preview-stats">5인 환산 예상 · 득점 ${proj.ppg.toFixed(1)} · 리바운드 ${proj.rpg.toFixed(
                    1
                  )} · 어시스트 ${proj.apg.toFixed(1)}</div>`
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
        bg: TEAM_IMAGE_BG[i],
        players: teamsPlayers[i],
      })).filter((t) => t.players.length > 0);
      if (!rows.length) return;
      const canvas = generateTeamCanvas(rows, gameDate, teamCount);
      showTeamImageModal(canvas, `spirit-team-${gameDate || "today"}.png`);
    });
  }

  render();
}
