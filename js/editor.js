import { courtMarkingsSVG, playerColor, screenBarEndpoints, svgEl } from "./court.js";

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function pathD(path) {
  return path.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
}

// 공은 항상 오펜스 역할(team: "offense")인 선수만 들 수 있다 — 우리 팀이든 상대 공격수든 마찬가지.
function ballHolders(players) {
  return players.filter((p) => p.team === "offense");
}

// 상대 공격수는 등번호가 아니라 "O1" 같은 표기라서 "번"을 붙이면 어색하다.
function holderLabel(p) {
  return p.opponent ? p.number : `${p.number}번`;
}

function playerOptionsHTML(players, selected) {
  return ballHolders(players)
    .map((p) => `<option value="${p.number}" ${p.number === selected ? "selected" : ""}>${holderLabel(p)}</option>`)
    .join("");
}

// select 의 value 는 항상 문자열이라, 우리 팀 등번호(숫자)는 숫자로 되돌리고
// 상대 공격수 표기("O2")는 문자열 그대로 둔다. 무조건 Number() 하면 "O2" 가 NaN 이 된다.
function parseHolder(value) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

// 새로 추가한 선수가 기존 선수 위에 그대로 겹쳐 생기면 뒤에 깔려 보이지 않는다.
// 아무도 없는 자리를 골라 놓는다 (선수 원 지름이 28이라 34 이상 떨어지면 안 겹친다).
const SPAWN_SPOTS = [
  [250, 300], [250, 350], [250, 210], [330, 300], [170, 300],
  [340, 390], [160, 390], [410, 210], [90, 210], [250, 120],
];

function freeSpawn(players) {
  const taken = players.map((p) => p.path[0]);
  const spot =
    SPAWN_SPOTS.find((s) => taken.every(([x, y]) => Math.hypot(x - s[0], y - s[1]) > 34)) || SPAWN_SPOTS[0];
  return [spot[0], spot[1]];
}

// 상대 선수는 우리 로스터 선수가 아니므로 등번호 대신 표기 문자를 쓴다: 수비수는 X1, X2..., 공격수(볼 핸들러)는 O1, O2...
function nextOpponentLabel(players, prefix) {
  const used = new Set(players.filter((p) => p.opponent).map((p) => p.number));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

// tactic은 호출부에서 미리 깊은 복사한 것을 전달받아 그대로 변형(mutate)한다.
export function mountEditor(container, tactic, { onChange, onReset, onExport, onPreview, hideLocalNotice }) {
  let dragging = null;

  function svgPoint(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function commit() {
    onChange(tactic);
  }

  function render() {
    container.innerHTML = `
      <div class="editor">
        <svg viewBox="0 0 500 470" class="court-svg editor-svg">
          <defs>
            <radialGradient id="courtGradient" cx="50%" cy="32%" r="78%">
              <stop class="court-grad-a" offset="0%" />
              <stop class="court-grad-b" offset="100%" />
            </radialGradient>
          </defs>
        </svg>
        <div class="editor-panel">
          ${
            hideLocalNotice
              ? ""
              : `<p class="hint editor-local-notice">✎ 지금 여기서 고치는 내용은 <strong>이 브라우저에만</strong> 저장돼요. 팀 전체에 반영하려면 "내보내기"로 나온 내용을 전달해주세요.</p>`
          }
          <div class="editor-players"></div>
          <div class="editor-ball"></div>
          <div class="editor-actions">
            <button type="button" class="btn" data-action="reset">초기화</button>
            <button type="button" class="btn" data-action="preview">▶ 미리보기</button>
            <button type="button" class="btn btn-primary" data-action="export">내보내기</button>
          </div>
        </div>
      </div>
    `;

    const svg = container.querySelector(".editor-svg");
    const courtGroup = svgEl("g");
    courtGroup.innerHTML = courtMarkingsSVG();
    svg.appendChild(courtGroup);

    const pathGroup = svgEl("g");
    const screenGroup = svgEl("g");
    const handleGroup = svgEl("g");
    svg.appendChild(pathGroup);
    svg.appendChild(screenGroup);
    svg.appendChild(handleGroup);

    // 스크린 지점을 고르는 순간 코트에 막대가 바로 보이도록, 재생 화면과 같은 계산식으로 그린다.
    function drawScreenBars() {
      screenGroup.innerHTML = "";
      tactic.players.forEach((p) => {
        const bar = screenBarEndpoints(tactic.players, p);
        if (!bar) return;
        screenGroup.appendChild(
          svgEl("line", {
            x1: bar.x1,
            y1: bar.y1,
            x2: bar.x2,
            y2: bar.y2,
            class: "screen-bar",
            stroke: playerColor(p),
          })
        );
      });
    }

    tactic.players.forEach((p, playerIdx) => {
      if (p.path.length > 1) {
        pathGroup.appendChild(
          svgEl("path", {
            d: pathD(p.path),
            class: "editor-path",
            stroke: playerColor(p),
            "data-player-path": playerIdx,
          })
        );
      }
      // 재생 화면과 똑같이, 상대 선수는 회색 + 속이 빈 동그라미로 그린다.
      const opp = p.opponent ? " is-opponent" : "";
      p.path.forEach((pt, i) => {
        handleGroup.appendChild(
          svgEl("circle", {
            cx: pt[0],
            cy: pt[1],
            r: 10,
            class: `editor-handle${opp}`,
            fill: playerColor(p),
            "data-player": playerIdx,
            "data-index": i,
          })
        );
        if (i === 0) {
          const label = svgEl("text", {
            x: pt[0],
            y: pt[1],
            class: `editor-handle-label${opp}`,
            "text-anchor": "middle",
            dy: "0.35em",
            "data-player-label": playerIdx,
          });
          label.textContent = p.number;
          label.style.pointerEvents = "none";
          handleGroup.appendChild(label);
        }
      });
    });

    drawScreenBars();

    handleGroup.querySelectorAll(".editor-handle").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        handle.setPointerCapture(e.pointerId);
        dragging = {
          playerIdx: Number(handle.dataset.player),
          index: Number(handle.dataset.index),
          handle,
        };
      });
    });

    svg.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const p = svgPoint(svg, e.clientX, e.clientY);
      const x = clamp(Math.round(p.x), 10, 490);
      const y = clamp(Math.round(p.y), 10, 460);
      tactic.players[dragging.playerIdx].path[dragging.index] = [x, y];
      dragging.handle.setAttribute("cx", x);
      dragging.handle.setAttribute("cy", y);
      if (dragging.index === 0) {
        const label = handleGroup.querySelector(`[data-player-label="${dragging.playerIdx}"]`);
        if (label) {
          label.setAttribute("x", x);
          label.setAttribute("y", y);
        }
      }
      const pathEl = pathGroup.querySelector(`[data-player-path="${dragging.playerIdx}"]`);
      if (pathEl) pathEl.setAttribute("d", pathD(tactic.players[dragging.playerIdx].path));
      drawScreenBars();
      const row = container.querySelector(
        `.editor-point-row[data-player="${dragging.playerIdx}"][data-index="${dragging.index}"]`
      );
      if (row) {
        row.querySelector(".pt-x").value = x;
        row.querySelector(".pt-y").value = y;
      }
    });
    svg.addEventListener("pointerup", () => {
      if (dragging) {
        dragging = null;
        commit();
      }
    });
    svg.addEventListener("pointercancel", () => {
      dragging = null;
    });

    const playersPanel = container.querySelector(".editor-players");
    playersPanel.innerHTML =
      tactic.players
        .map(
          (p, playerIdx) => `
        <div class="editor-player-card">
          <div class="editor-player-title">
            <span class="badge ${
              p.opponent ? "badge-opponent" : p.team === "defense" ? "badge-defense" : "badge-offense"
            }">${p.opponent ? p.number : `${p.number}번`}</span>
            ${
              p.opponent
                ? `<span class="editor-opponent-tag">${p.team === "defense" ? "상대 수비" : "상대 공격수"}</span>`
                : ""
            }
          </div>
          <div class="editor-points">
            ${p.path
              .map(
                (pt, i) => `
              <div class="editor-point-row" data-player="${playerIdx}" data-index="${i}">
                <span class="editor-point-index">#${i + 1}</span>
                <input type="number" class="pt-x" value="${pt[0]}" min="10" max="490" />
                <input type="number" class="pt-y" value="${pt[1]}" min="10" max="460" />
                <button type="button" class="btn-icon" data-action="remove-point" ${
                  p.path.length <= 1 ? "disabled" : ""
                }>×</button>
              </div>
            `
              )
              .join("")}
          </div>
          <button type="button" class="btn btn-sm" data-action="add-point" data-player="${playerIdx}">+ 점 추가</button>
          ${
            p.opponent
              ? `<button type="button" class="btn btn-sm" data-action="remove-player" data-player="${playerIdx}">🗑 이 상대 선수 삭제</button>`
              : ""
          }
          <div class="editor-screen-row">
            <label for="screen-${playerIdx}">🧱 스크린 세우는 지점</label>
            <select id="screen-${playerIdx}" class="${p.screenAt != null ? "is-set" : ""}"
              data-action="screen-at" data-player="${playerIdx}">
              <option value="">없음</option>
              ${p.path
                .map((_, i) => `<option value="${i}" ${p.screenAt === i ? "selected" : ""}>#${i + 1}</option>`)
                .join("")}
            </select>
          </div>
        </div>
      `
        )
        .join("") +
      `<div class="editor-add-opponent-row">
        <button type="button" class="btn" data-action="add-defender">+ 상대 수비수 추가</button>
        <button type="button" class="btn" data-action="add-attacker">+ 상대 공격수 추가</button>
      </div>`;

    playersPanel.querySelectorAll(".pt-x, .pt-y").forEach((input) => {
      input.addEventListener("change", (e) => {
        const row = e.target.closest(".editor-point-row");
        const playerIdx = Number(row.dataset.player);
        const index = Number(row.dataset.index);
        const x = clamp(Math.round(Number(row.querySelector(".pt-x").value)), 10, 490);
        const y = clamp(Math.round(Number(row.querySelector(".pt-y").value)), 10, 460);
        tactic.players[playerIdx].path[index] = [x, y];
        render();
        commit();
      });
    });

    playersPanel.querySelectorAll('[data-action="remove-point"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const row = e.target.closest(".editor-point-row");
        const playerIdx = Number(row.dataset.player);
        const index = Number(row.dataset.index);
        const p = tactic.players[playerIdx];
        if (p.path.length <= 1) return;
        p.path.splice(index, 1);
        // 점을 지우면 뒤쪽 번호가 하나씩 당겨지므로 스크린 지점도 같이 맞춰준다.
        if (p.screenAt != null) {
          if (p.screenAt === index) delete p.screenAt;
          else if (p.screenAt > index) p.screenAt -= 1;
        }
        render();
        commit();
      });
    });

    playersPanel.querySelectorAll('[data-action="add-point"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const playerIdx = Number(btn.dataset.player);
        const path = tactic.players[playerIdx].path;
        const last = path[path.length - 1];
        path.push([clamp(last[0] + 15, 10, 490), clamp(last[1] + 15, 10, 460)]);
        render();
        commit();
      });
    });

    playersPanel.querySelectorAll('[data-action="screen-at"]').forEach((sel) => {
      sel.addEventListener("change", (e) => {
        const p = tactic.players[Number(e.target.dataset.player)];
        if (e.target.value === "") {
          delete p.screenAt;
        } else {
          p.screenAt = Number(e.target.value);
        }
        render();
        commit();
      });
    });

    playersPanel.querySelectorAll('[data-action="remove-player"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const playerIdx = Number(btn.dataset.player);
        tactic.players.splice(playerIdx, 1);
        render();
        commit();
      });
    });

    playersPanel.querySelector('[data-action="add-defender"]').addEventListener("click", () => {
      tactic.players.push({
        number: nextOpponentLabel(tactic.players, "X"),
        team: "defense",
        opponent: true,
        path: [freeSpawn(tactic.players)],
      });
      render();
      commit();
    });

    playersPanel.querySelector('[data-action="add-attacker"]').addEventListener("click", () => {
      tactic.players.push({
        number: nextOpponentLabel(tactic.players, "O"),
        team: "offense",
        opponent: true,
        path: [freeSpawn(tactic.players)],
      });
      if (!tactic.ball || !tactic.ball.length) {
        tactic.ball = [{ holder: tactic.players[tactic.players.length - 1].number, at: 0 }];
      }
      render();
      commit();
    });

    const ballPanel = container.querySelector(".editor-ball");
    if (tactic.ball && tactic.ball.length) {
      ballPanel.innerHTML = `
        <h4>공 소유 타이밍</h4>
        ${tactic.ball
          .map(
            (k, i) => `
          <div class="editor-ball-row" data-index="${i}">
            <select class="ball-holder">${playerOptionsHTML(tactic.players, k.holder)}</select>
            <input type="range" min="0" max="100" value="${Math.round(k.at * 100)}" class="ball-at" />
            <span class="ball-at-value">${Math.round(k.at * 100)}%</span>
            <button type="button" class="btn-icon" data-action="remove-keyframe">×</button>
          </div>
        `
          )
          .join("")}
        <button type="button" class="btn btn-sm" data-action="add-keyframe">+ 키프레임 추가</button>
      `;

      ballPanel.querySelectorAll(".ball-holder").forEach((sel) => {
        sel.addEventListener("change", (e) => {
          const i = Number(e.target.closest(".editor-ball-row").dataset.index);
          tactic.ball[i].holder = parseHolder(e.target.value);
          commit();
        });
      });
      ballPanel.querySelectorAll(".ball-at").forEach((range) => {
        range.addEventListener("input", (e) => {
          const row = e.target.closest(".editor-ball-row");
          row.querySelector(".ball-at-value").textContent = `${e.target.value}%`;
        });
        range.addEventListener("change", (e) => {
          const i = Number(e.target.closest(".editor-ball-row").dataset.index);
          tactic.ball[i].at = Number(e.target.value) / 100;
          tactic.ball.sort((a, b) => a.at - b.at);
          commit();
        });
      });
      ballPanel.querySelectorAll('[data-action="remove-keyframe"]').forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const i = Number(e.target.closest(".editor-ball-row").dataset.index);
          tactic.ball.splice(i, 1);
          render();
          commit();
        });
      });
      ballPanel.querySelector('[data-action="add-keyframe"]').addEventListener("click", () => {
        tactic.ball.push({ holder: (ballHolders(tactic.players)[0] || tactic.players[0]).number, at: 0.5 });
        tactic.ball.sort((a, b) => a.at - b.at);
        render();
        commit();
      });
    } else {
      ballPanel.innerHTML = `
        <h4>공 소유 타이밍</h4>
        <p class="hint">이 전술에는 공 표시가 없어요.</p>
        <button type="button" class="btn btn-sm" data-action="init-ball">+ 공 표시 추가</button>
      `;
      ballPanel.querySelector('[data-action="init-ball"]').addEventListener("click", () => {
        tactic.ball = [{ holder: (ballHolders(tactic.players)[0] || tactic.players[0]).number, at: 0 }];
        render();
        commit();
      });
    }

    container.querySelector('[data-action="reset"]').addEventListener("click", onReset);
    container.querySelector('[data-action="preview"]').addEventListener("click", onPreview);
    container.querySelector('[data-action="export"]').addEventListener("click", () => onExport(tactic));
  }

  render();
}
