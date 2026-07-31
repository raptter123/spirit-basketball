export const TEAM_COLOR = {
  offense: "#3b82f6",
  defense: "#ef4444",
};

export function courtMarkingsSVG() {
  return `
    <rect class="court-boundary" x="10" y="10" width="480" height="450" rx="18" />
    <rect class="paint-fill" x="170" y="270" width="160" height="190" />
    <path class="court-line" d="M 190 10 A 60 60 0 0 0 310 10" />
    <rect class="court-line" x="170" y="270" width="160" height="190" />
    <circle class="court-line" cx="250" cy="270" r="60" />
    <path class="court-line" d="M 210 442 A 40 40 0 0 1 290 442" />
    <path class="court-line" d="M 30 310 L 30 460" />
    <path class="court-line" d="M 470 310 L 470 460" />
    <path class="court-line" d="M 30 310 A 257 257 0 0 1 470 310" />
    <line class="court-line" x1="215" y1="428" x2="285" y2="428" />
    <circle class="rim" cx="250" cy="442" r="9" />
  `;
}

function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    len += Math.hypot(x1 - x0, y1 - y0);
  }
  return len;
}

function pointAt(points, dist) {
  if (points.length === 1) return points[0];
  let remaining = dist;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    if (segLen === 0) continue;
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
    }
    remaining -= segLen;
  }
  return points[points.length - 1];
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const BALL_OFFSET = [15, -15];
const PASS_WINDOW = 0.05;

function positionAtRaw(data, rawProgress) {
  const clamped = Math.min(Math.max(rawProgress, 0), 1);
  const eased = easeInOutQuad(clamped);
  return pointAt(data.path, eased * data.length);
}

function ballPositionAt(ballSeq, playersByNumber, rawProgress) {
  let current = ballSeq[0];
  let next = null;
  for (const seg of ballSeq) {
    if (seg.at <= rawProgress) current = seg;
    else {
      next = seg;
      break;
    }
  }
  if (next && rawProgress >= next.at - PASS_WINDOW) {
    const t = Math.min(1, Math.max(0, (rawProgress - (next.at - PASS_WINDOW)) / PASS_WINDOW));
    const p1 = positionAtRaw(playersByNumber[current.holder], next.at - PASS_WINDOW);
    const p2 = positionAtRaw(playersByNumber[next.holder], next.at);
    return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
  }
  return positionAtRaw(playersByNumber[current.holder], rawProgress);
}

export function mountCourt(container, tactic, duration = 4800) {
  container.innerHTML = "";

  const svg = svgEl("svg", {
    viewBox: "0 0 500 470",
    class: "court-svg",
    role: "img",
    "aria-label": `${tactic.name} 코트 다이어그램`,
  });

  const defs = svgEl("defs");
  defs.innerHTML = `
    <marker id="arrow-offense" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${TEAM_COLOR.offense}" />
    </marker>
    <marker id="arrow-defense" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${TEAM_COLOR.defense}" />
    </marker>
    <radialGradient id="courtGradient" cx="50%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#202c49" />
      <stop offset="100%" stop-color="#0e1526" />
    </radialGradient>
    <radialGradient id="ballGradient" cx="34%" cy="30%" r="72%">
      <stop offset="0%" stop-color="#f8ab53" />
      <stop offset="55%" stop-color="#e8730a" />
      <stop offset="100%" stop-color="#a84800" />
    </radialGradient>
  `;
  svg.appendChild(defs);

  const courtGroup = svgEl("g", { class: "court-markings" });
  courtGroup.innerHTML = courtMarkingsSVG();
  svg.appendChild(courtGroup);

  const arrowGroup = svgEl("g", { class: "arrow-layer" });
  const playerGroup = svgEl("g", { class: "player-layer" });

  const players = tactic.players.map((p) => {
    const hasMovement = p.path.length > 1 && pathLength(p.path) > 0;
    if (hasMovement) {
      const d = p.path.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
      const arrow = svgEl("path", {
        d,
        class: "arrow-path",
        stroke: TEAM_COLOR[p.team],
        "marker-end": `url(#arrow-${p.team})`,
      });
      arrowGroup.appendChild(arrow);
    }

    const g = svgEl("g", { class: "player", transform: `translate(${p.path[0][0]},${p.path[0][1]})` });
    const circle = svgEl("circle", { r: 14, class: `player-dot player-${p.team}` });
    const text = svgEl("text", { class: "player-number", "text-anchor": "middle", dy: "0.35em" });
    text.textContent = p.number;
    g.appendChild(circle);
    g.appendChild(text);
    if (p.displayName) {
      const nameLabel = svgEl("text", { class: "player-name-label", "text-anchor": "middle", dy: "26" });
      nameLabel.textContent = p.displayName;
      g.appendChild(nameLabel);
    }
    playerGroup.appendChild(g);

    return { el: g, path: p.path, length: pathLength(p.path), number: p.number };
  });

  const playersByNumber = {};
  for (const player of players) {
    playersByNumber[player.number] = { path: player.path, length: player.length };
  }

  let ballEl = null;
  if (tactic.ball && tactic.ball.length) {
    ballEl = svgEl("g", { class: "ball" });
    ballEl.appendChild(svgEl("circle", { r: 8, class: "ball-dot" }));
    ballEl.appendChild(svgEl("path", { d: "M 0 -8 L 0 8", class: "ball-seam" }));
    ballEl.appendChild(svgEl("path", { d: "M -8 0 L 8 0", class: "ball-seam" }));
    ballEl.appendChild(svgEl("path", { d: "M -3.4 -7.4 Q 3 0 -3.4 7.4", class: "ball-seam" }));
    ballEl.appendChild(svgEl("path", { d: "M 3.4 -7.4 Q -3 0 3.4 7.4", class: "ball-seam" }));
    ballEl.appendChild(svgEl("circle", { r: 8, class: "ball-outline" }));
  }

  svg.appendChild(arrowGroup);
  svg.appendChild(playerGroup);
  if (ballEl) svg.appendChild(ballEl);
  container.appendChild(svg);

  let rafId = null;
  let elapsed = 0;
  let lastTick = null;
  let playing = false;

  function render(progress) {
    const eased = easeInOutQuad(progress);
    for (const player of players) {
      const [x, y] = pointAt(player.path, eased * player.length);
      player.el.setAttribute("transform", `translate(${x},${y})`);
    }
    if (ballEl && tactic.ball) {
      const [bx, by] = ballPositionAt(tactic.ball, playersByNumber, progress);
      ballEl.setAttribute("transform", `translate(${bx + BALL_OFFSET[0]},${by + BALL_OFFSET[1]})`);
    }
  }

  function tick(now) {
    if (lastTick != null) elapsed += now - lastTick;
    lastTick = now;
    const progress = Math.min(elapsed / duration, 1);
    render(progress);
    if (progress >= 1) {
      playing = false;
      lastTick = null;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  render(0);

  return {
    play() {
      if (playing) return;
      if (elapsed >= duration) elapsed = 0;
      playing = true;
      lastTick = null;
      rafId = requestAnimationFrame(tick);
    },
    pause() {
      playing = false;
      if (rafId) cancelAnimationFrame(rafId);
      lastTick = null;
    },
    replay() {
      this.pause();
      elapsed = 0;
      render(0);
      this.play();
    },
    isPlaying() {
      return playing;
    },
  };
}
