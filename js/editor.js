import { TEAM_COLOR, courtMarkingsSVG, svgEl } from "./court.js";

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function pathD(path) {
  return path.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
}

function playerOptionsHTML(players, selected) {
  return players
    .map((p) => `<option value="${p.number}" ${p.number === selected ? "selected" : ""}>${p.number}번</option>`)
    .join("");
}

// tactic은 호출부에서 미리 깊은 복사한 것을 전달받아 그대로 변형(mutate)한다.
export function mountEditor(container, tactic, { onChange, onReset, onExport, onPreview }) {
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
              <stop offset="0%" stop-color="#202c49" />
              <stop offset="100%" stop-color="#0e1526" />
            </radialGradient>
          </defs>
        </svg>
        <div class="editor-panel">
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
    const handleGroup = svgEl("g");
    svg.appendChild(pathGroup);
    svg.appendChild(handleGroup);

    tactic.players.forEach((p, playerIdx) => {
      if (p.path.length > 1) {
        pathGroup.appendChild(
          svgEl("path", {
            d: pathD(p.path),
            class: "editor-path",
            stroke: TEAM_COLOR[p.team],
            "data-player-path": playerIdx,
          })
        );
      }
      p.path.forEach((pt, i) => {
        handleGroup.appendChild(
          svgEl("circle", {
            cx: pt[0],
            cy: pt[1],
            r: 10,
            class: "editor-handle",
            fill: TEAM_COLOR[p.team],
            "data-player": playerIdx,
            "data-index": i,
          })
        );
        if (i === 0) {
          const label = svgEl("text", {
            x: pt[0],
            y: pt[1],
            class: "editor-handle-label",
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
    playersPanel.innerHTML = tactic.players
      .map(
        (p, playerIdx) => `
        <div class="editor-player-card">
          <div class="editor-player-title">
            <span class="badge ${p.team === "defense" ? "badge-defense" : "badge-offense"}">${p.number}번</span>
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
        </div>
      `
      )
      .join("");

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
        if (tactic.players[playerIdx].path.length <= 1) return;
        tactic.players[playerIdx].path.splice(index, 1);
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
          tactic.ball[i].holder = Number(e.target.value);
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
        tactic.ball.push({ holder: tactic.players[0].number, at: 0.5 });
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
        tactic.ball = [{ holder: tactic.players[0].number, at: 0 }];
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
