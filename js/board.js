// 작전판 — 저장된 전술과 별개로, 즉석에서 배치를 옮겨보며 이야기하는 화이트보드.
// 원본은 규철이 만든 독립 HTML 파일이고, 여기서는 사이트 규칙(테마 변수, 상대는 회색 속 빈 원,
// 클래스 이름 충돌 없음)에 맞춰 다시 옮겼다.
import { svgEl } from "./court.js";
import { getBoardState, saveBoardState, clearBoardState } from "./storage.js";
import { FORMATION_GROUPS, DEFAULT_FORMATION, getFormation } from "./formations.js";

// FIBA 28m × 15m 비율. 하프코트 전술 좌표(500×470)와는 다른 체계라 서로 섞이지 않는다.
const FULL_W = 1120;
const FULL_H = 600;

const VIEWS = {
  full: { label: "풀코트", box: `0 0 ${FULL_W} ${FULL_H}` },
  left: { label: "왼쪽 하프", box: `0 0 ${FULL_W / 2} ${FULL_H}` },
  right: { label: "오른쪽 하프", box: `${FULL_W / 2} 0 ${FULL_W / 2} ${FULL_H}` },
};

const PIECE_R = 27;
const BALL_R = 22;

// 대형 좌표는 오른쪽 하프코트 기준으로 적혀 있다.
// 왼쪽 하프를 보고 있으면 좌우를 뒤집어 그쪽에 놓아야 화면 안에 들어온다.
function placeFormation(id, view) {
  const f = getFormation(id);
  const mirror = view === "left";
  const at = ([x, y]) => ({ x: mirror ? FULL_W - x : x, y });
  const pieces = [];
  f.us.forEach((pt, i) => pieces.push({ id: `u${i + 1}`, side: "us", n: i + 1, ...at(pt) }));
  f.them.forEach((pt, i) => pieces.push({ id: `o${i + 1}`, side: "them", n: i + 1, ...at(pt) }));
  // 공은 공을 든 선수 옆에 살짝 띄워 놓는다. 우리가 공격하는 대형이면 우리 쪽이 든다.
  const holderSide = f.ballSide === "us" ? f.us : f.them;
  const holder = at(holderSide[(f.ballAt || 1) - 1]);
  pieces.push({
    id: "ball",
    side: "ball",
    n: "",
    x: holder.x + (mirror ? 40 : -40),
    y: holder.y - 38,
  });
  return pieces;
}

// 하프코트 코트 그림과 같은 클래스를 써서 테마가 그대로 따라오게 한다.
function fullCourtMarkings() {
  const half = (x0, dir) => {
    // dir 1 = 왼쪽 골대(오른쪽을 향함), -1 = 오른쪽 골대
    const sweepIn = dir === 1 ? 1 : 0;
    const ftX = x0 + dir * 232;
    const rimX = x0 + dir * 63;
    const boardX = x0 + dir * 48;
    const arc3End = x0 + dir * 120;
    return `
      <rect class="paint-fill" x="${dir === 1 ? x0 : x0 - 232}" y="202" width="232" height="196" />
      <rect class="court-line" x="${dir === 1 ? x0 : x0 - 232}" y="202" width="232" height="196" />
      <line class="court-line" x1="${ftX}" y1="228" x2="${ftX}" y2="372" />
      <path class="court-line" d="M ${ftX} 228 A 72 72 0 0 ${sweepIn} ${ftX} 372" />
      <path class="court-line is-dashed" d="M ${ftX} 228 A 72 72 0 0 ${1 - sweepIn} ${ftX} 372" />
      <line class="court-line" x1="${x0}" y1="36" x2="${arc3End}" y2="36" />
      <line class="court-line" x1="${x0}" y1="564" x2="${arc3End}" y2="564" />
      <path class="court-line" d="M ${arc3End} 36 A 270 270 0 0 ${sweepIn} ${arc3End} 564" />
      <path class="court-line" d="M ${rimX} 248 A 52 52 0 0 ${sweepIn} ${rimX} 352" />
      <line class="court-line" x1="${rimX}" y1="248" x2="${boardX}" y2="248" />
      <line class="court-line" x1="${rimX}" y1="352" x2="${boardX}" y2="352" />
      <line class="court-line is-board" x1="${boardX}" y1="264" x2="${boardX}" y2="336" />
      <circle class="rim" cx="${rimX}" cy="300" r="10" />
    `;
  };
  return `
    <rect class="court-boundary" x="2" y="2" width="${FULL_W - 4}" height="${FULL_H - 4}" rx="14" />
    <line class="court-line" x1="${FULL_W / 2}" y1="0" x2="${FULL_W / 2}" y2="${FULL_H}" />
    <circle class="court-line" cx="${FULL_W / 2}" cy="300" r="72" />
    ${half(0, 1)}
    ${half(FULL_W, -1)}
  `;
}

export function mountBoard(container) {
  const saved = getBoardState();
  // 폰에서 풀코트를 띄우면 세로가 200px밖에 안 돼서 말을 집기 어렵다. 좁은 화면은 하프로 시작한다.
  let view = saved?.view || (window.innerWidth < 700 ? "right" : "full");
  let formation = saved?.formation || DEFAULT_FORMATION;
  let pieces = saved?.pieces?.length ? saved.pieces.map((p) => ({ ...p })) : placeFormation(formation, view);
  let arrows = saved?.arrows ? saved.arrows.map((a) => [...a]) : [];
  let selected = null;
  let drawMode = false;

  let drag = null;
  let pendingArrow = null;

  function persist() {
    saveBoardState({ pieces, arrows, view, formation });
  }

  container.innerHTML = `
    <div class="board-toolbar">
      <label class="board-view">
        <span>대형</span>
        <select id="board-formation">
          ${FORMATION_GROUPS.map(
            (g) => `<optgroup label="${g.label}">${g.items
              .map((f) => `<option value="${f.id}" ${formation === f.id ? "selected" : ""}>${f.name}</option>`)
              .join("")}</optgroup>`
          ).join("")}
        </select>
      </label>
      <label class="board-view">
        <span>코트</span>
        <select id="board-view">
          ${Object.entries(VIEWS)
            .map(([k, v]) => `<option value="${k}" ${view === k ? "selected" : ""}>${v.label}</option>`)
            .join("")}
        </select>
      </label>
      <button type="button" class="btn btn-sm" id="board-draw">✏️ 이동선 그리기</button>
      <button type="button" class="btn btn-sm" id="board-undo">↩ 선 하나 지우기</button>
      <button type="button" class="btn btn-sm" id="board-swap">🔄 공수교대</button>
      <button type="button" class="btn btn-sm" id="board-flip">↔ 좌우 반전</button>
      <button type="button" class="btn btn-sm" id="board-reset">🧹 판 비우기</button>
    </div>
    <div class="board-brief">
      <p class="board-note" id="board-note"></p>
      <details class="board-why">
        <summary class="board-why-summary">이 대형의 장단점</summary>
        <p class="board-pro" id="board-pro"></p>
        <p class="board-con" id="board-con"></p>
      </details>
    </div>
    <div class="board-court"></div>
    <p class="board-status" id="board-status" role="status">선수나 공을 끌어서 옮기세요. 눌러서 고른 뒤 빈 곳을 눌러도 이동해요.</p>
    <div class="board-legend">
      <span class="board-legend-item"><span class="board-swatch is-us"></span>우리 팀</span>
      <span class="board-legend-item"><span class="board-swatch is-them"></span>상대 팀</span>
      <span class="board-legend-item"><span class="board-swatch is-ball"></span>공</span>
      <span class="board-legend-item"><span class="board-swatch is-arrow"></span>이동선</span>
    </div>
  `;

  const statusEl = container.querySelector("#board-status");
  const svg = svgEl("svg", {
    viewBox: VIEWS[view].box,
    class: "court-svg board-svg",
    role: "img",
    "aria-label": "드래그해서 배치를 옮기는 작전판",
  });
  const courtGroup = svgEl("g");
  courtGroup.innerHTML = fullCourtMarkings();
  const arrowGroup = svgEl("g", { class: "board-arrows" });
  const pieceGroup = svgEl("g", { class: "board-pieces" });
  svg.appendChild(courtGroup);
  svg.appendChild(arrowGroup);
  svg.appendChild(pieceGroup);
  container.querySelector(".board-court").appendChild(svg);

  function say(msg) {
    statusEl.textContent = msg;
  }

  function pieceName(p) {
    if (p.side === "ball") return "공";
    return `${p.side === "us" ? "우리 팀" : "상대 팀"} ${p.n}번`;
  }

  function pointFrom(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  function place(p, x, y) {
    const r = p.side === "ball" ? BALL_R : PIECE_R;
    p.x = Math.max(r, Math.min(FULL_W - r, Math.round(x)));
    p.y = Math.max(r, Math.min(FULL_H - r, Math.round(y)));
  }

  function drawArrows() {
    arrowGroup.innerHTML = "";
    arrows.forEach(([x1, y1, x2, y2]) => {
      arrowGroup.appendChild(
        svgEl("line", { x1, y1, x2, y2, class: "board-arrow", "marker-end": "url(#board-arrowhead)" })
      );
    });
  }

  function drawPieces() {
    pieceGroup.innerHTML = "";
    pieces.forEach((p) => {
      const g = svgEl("g", {
        class: `board-piece${selected === p.id ? " is-selected" : ""}`,
        transform: `translate(${p.x},${p.y})`,
        "data-id": p.id,
      });
      if (p.side === "ball") {
        g.appendChild(svgEl("circle", { r: BALL_R + 8, class: "board-ring" }));
        g.appendChild(svgEl("circle", { r: BALL_R, class: "board-ball" }));
        ["M 0 -22 L 0 22", "M -22 0 L 22 0", "M -17 -14 Q -5 0 -17 14", "M 17 -14 Q 5 0 17 14"].forEach((d) =>
          g.appendChild(svgEl("path", { d, class: "board-ball-seam" }))
        );
      } else {
        g.appendChild(svgEl("circle", { r: PIECE_R + 8, class: "board-ring" }));
        g.appendChild(svgEl("circle", { r: PIECE_R, class: `board-dot is-${p.side}` }));
        const t = svgEl("text", { class: `board-num is-${p.side}`, "text-anchor": "middle", dy: "0.35em" });
        t.textContent = p.n;
        g.appendChild(t);
      }
      pieceGroup.appendChild(g);
    });
  }

  // 화살촉은 이 SVG 안에만 있으면 되므로 여기서 만든다.
  const defs = svgEl("defs");
  defs.innerHTML = `
    <radialGradient id="courtGradient" cx="50%" cy="32%" r="78%">
      <stop class="court-grad-a" offset="0%" />
      <stop class="court-grad-b" offset="100%" />
    </radialGradient>
    <marker id="board-arrowhead" viewBox="0 0 10 10" refX="8" refY="5"
      markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" class="board-arrowhead" />
    </marker>`;
  svg.insertBefore(defs, svg.firstChild);

  svg.addEventListener("pointerdown", (e) => {
    const at = pointFrom(e);
    const hit = e.target.closest("[data-id]");

    if (drawMode) {
      pendingArrow = [at.x, at.y, at.x, at.y];
      arrows.push(pendingArrow);
      drawArrows();
      svg.setPointerCapture(e.pointerId);
      say("끝점까지 끌어주세요.");
      return;
    }

    if (hit) {
      const p = pieces.find((v) => v.id === hit.dataset.id);
      selected = p.id;
      drag = { id: p.id, dx: at.x - p.x, dy: at.y - p.y };
      svg.setPointerCapture(e.pointerId);
      drawPieces();
      say(`${pieceName(p)} 선택됨`);
      return;
    }

    if (selected) {
      const p = pieces.find((v) => v.id === selected);
      place(p, at.x, at.y);
      drawPieces();
      persist();
      say(`${pieceName(p)} 옮겼어요.`);
    }
  });

  svg.addEventListener("pointermove", (e) => {
    const at = pointFrom(e);
    if (pendingArrow) {
      pendingArrow[2] = at.x;
      pendingArrow[3] = at.y;
      drawArrows();
      return;
    }
    if (!drag) return;
    const p = pieces.find((v) => v.id === drag.id);
    place(p, at.x - drag.dx, at.y - drag.dy);
    drawPieces();
  });

  function endPointer() {
    if (pendingArrow) {
      // 손가락이 거의 안 움직였으면 점 하나짜리 선이 남으므로 버린다.
      const [x1, y1, x2, y2] = pendingArrow;
      if (Math.hypot(x2 - x1, y2 - y1) < 12) arrows.pop();
      else say("이동선을 그렸어요.");
      pendingArrow = null;
      drawArrows();
      persist();
      return;
    }
    if (drag) {
      const p = pieces.find((v) => v.id === drag.id);
      drag = null;
      persist();
      say(`${pieceName(p)} 옮겼어요.`);
    }
  }
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", () => {
    drag = null;
    pendingArrow = null;
    drawArrows();
  });

  const drawBtn = container.querySelector("#board-draw");
  drawBtn.addEventListener("click", () => {
    drawMode = !drawMode;
    drawBtn.classList.toggle("is-on", drawMode);
    drawBtn.setAttribute("aria-pressed", String(drawMode));
    selected = null;
    drawPieces();
    say(drawMode ? "이동선 그리기: 코트에서 시작점부터 끝점까지 끌어주세요." : "이동선 그리기를 껐어요.");
  });

  container.querySelector("#board-undo").addEventListener("click", () => {
    if (!arrows.length) return say("지울 이동선이 없어요.");
    arrows.pop();
    drawArrows();
    persist();
    say("이동선 하나를 지웠어요.");
  });

  // 공수교대 — 자리는 그대로 두고 우리 말과 상대 말만 맞바꾼다.
  // 같은 배치를 반대 입장에서 보게 되므로, 방금 그린 수비 대형을 그대로 공격 대형으로 읽을 수 있다.
  container.querySelector("#board-swap").addEventListener("click", () => {
    const us = pieces.filter((p) => p.side === "us");
    const them = pieces.filter((p) => p.side === "them");
    const n = Math.min(us.length, them.length);
    for (let i = 0; i < n; i++) {
      const tmp = { x: us[i].x, y: us[i].y };
      us[i].x = them[i].x;
      us[i].y = them[i].y;
      them[i].x = tmp.x;
      them[i].y = tmp.y;
    }
    drawPieces();
    persist();
    say("공수를 바꿨어요. 공은 그 자리에 그대로 있습니다.");
  });

  container.querySelector("#board-flip").addEventListener("click", () => {
    pieces = pieces.map((p) => ({ ...p, x: FULL_W - p.x }));
    arrows = arrows.map(([x1, y1, x2, y2]) => [FULL_W - x1, y1, FULL_W - x2, y2]);
    drawPieces();
    drawArrows();
    persist();
    say("좌우를 뒤집었어요.");
  });

  const noteEl = container.querySelector("#board-note");
  const proEl = container.querySelector("#board-pro");
  const conEl = container.querySelector("#board-con");
  function showNote() {
    const f = getFormation(formation);
    noteEl.textContent = f.note;
    proEl.textContent = f.strength || "";
    conEl.textContent = f.weakness || "";
    proEl.hidden = !f.strength;
    conEl.hidden = !f.weakness;
  }

  function applyFormation() {
    pieces = placeFormation(formation, view);
    selected = null;
    drawPieces();
    showNote();
    persist();
  }

  container.querySelector("#board-formation").addEventListener("change", (e) => {
    formation = e.target.value;
    applyFormation();
    say(`${getFormation(formation).name} 배치로 세웠어요.`);
  });

  container.querySelector("#board-reset").addEventListener("click", () => {
    arrows = [];
    drawMode = false;
    drawBtn.classList.remove("is-on");
    drawBtn.setAttribute("aria-pressed", "false");
    clearBoardState();
    applyFormation();
    drawArrows();
    say(`${getFormation(formation).name} 처음 배치로 되돌렸어요.`);
  });

  container.querySelector("#board-view").addEventListener("change", (e) => {
    const prev = view;
    view = e.target.value;
    svg.setAttribute("viewBox", VIEWS[view].box);
    // 반대쪽 하프로 넘어가면 선수들이 화면 밖에 남으므로 같이 옮겨준다.
    const flipped = (prev === "left") !== (view === "left");
    if (flipped) {
      pieces = pieces.map((p) => ({ ...p, x: FULL_W - p.x }));
      arrows = arrows.map(([x1, y1, x2, y2]) => [FULL_W - x1, y1, FULL_W - x2, y2]);
      drawPieces();
      drawArrows();
    }
    persist();
  });

  showNote();
  drawArrows();
  drawPieces();
}
