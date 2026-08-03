export const TEAM_COLOR = {
  offense: "#3b82f6",
  defense: "#ef4444",
};

// 상대 팀은 역할(공격/수비)과 상관없이 항상 이 회색. 우리 팀만 팀 색을 쓴다.
// 파랑/빨강 어느 쪽과도 겹치지 않고, 다크·라이트 코트 양쪽에서 다 보이는 값이다.
export const OPPONENT_COLOR = "#8b8a8f";

// 그 선수를 그릴 색. 상대면 무조건 회색.
export function playerColor(p) {
  return p.opponent ? OPPONENT_COLOR : TEAM_COLOR[p.team];
}

// marker-end 로 쓸 화살촉 id 조각.
export function arrowKind(p) {
  return p.opponent ? "opponent" : p.team;
}

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

function pathD(points) {
  return points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ");
}

// 경로에서 거리 d0~d1 구간만 잘라낸 폴리라인.
function slicePath(points, d0, d1) {
  const out = [pointAt(points, d0)];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (acc > d0 && acc < d1) out.push(points[i]);
  }
  out.push(pointAt(points, d1));
  return out;
}

// 드리블 구간은 물결선으로 그린다. 끝부분(tail)은 화살촉 방향이 흔들리지 않게 직선으로 남긴다.
function wavyD(points, amp = 6, wavelength = 22, tail = 14) {
  const total = pathLength(points);
  if (total < 6) return pathD(points);
  const out = [];
  for (let d = 0; d <= total; d += 3) {
    const p = pointAt(points, d);
    const q = pointAt(points, Math.min(d + 1, total));
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const m = Math.hypot(dx, dy) || 1;
    const k = d > total - tail ? 0 : amp * Math.sin((d / wavelength) * Math.PI * 2);
    out.push([p[0] + (-dy / m) * k, p[1] + (dx / m) * k]);
  }
  return pathD(out);
}

function tangentOnPath(points, dist) {
  const total = pathLength(points);
  const a = pointAt(points, Math.max(dist - 4, 0));
  const b = pointAt(points, Math.min(dist + 4, total));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const m = Math.hypot(dx, dy);
  return m < 0.01 ? null : [dx / m, dy / m];
}

// tactic.ball 을 [{from, to, holder}] 소유 구간으로 바꾼다 (진행률 0~1).
function possessionIntervals(ballSeq) {
  if (!ballSeq || !ballSeq.length) return [];
  return ballSeq.map((seg, i) => ({
    from: i === 0 ? 0 : seg.at,
    to: i + 1 < ballSeq.length ? ballSeq[i + 1].at : 1,
    holder: seg.holder,
  }));
}

// 공이 넘어가는 순간 두 선수가 이 거리보다 가까우면 패스가 아니라 핸드오프로 본다.
const HANDOFF_DIST = 58;

// 제자리에서 흔들리는 정도의 경로는 "달려오는 선수"로 보지 않는다.
// (엘리베이터 스크린처럼 스크리너끼리 붙어 있을 때 서로를 컷터로 오인하는 걸 막는다.)
const MIN_CUTTER_TRAVEL = 30;

// 스크린 막대의 양 끝점. 각도는 '스크린을 타고 지나갈 선수'(그 시점에 가장 가까우면서
// 실제로 움직이는 같은 팀 선수)의 진행 방향에 수직으로 자동 계산한다 — 막는 벽처럼 보이게.
// 재생 화면과 편집기가 같은 그림을 그리도록 여기 한 곳에서만 계산한다.
// half 은 막대 반길이. 선수 원(r=14)보다 확실히 길어야 "벽"으로 읽힌다.
export function screenBarEndpoints(allPlayers, p, half = 26) {
  if (p.screenAt == null) return null;
  const pt = p.path[p.screenAt];
  if (!pt) return null;
  const total = pathLength(p.path);
  const reachEased = total > 0 ? pathLength(p.path.slice(0, p.screenAt + 1)) / total : 0;

  let dir = null;
  let best = Infinity;
  allPlayers.forEach((other) => {
    // 스크린은 '같은 편'을 위해 서는 것이다. team(공격/수비 역할)만 보면 안 되는데,
    // 수비 전술에서는 우리 선수도 상대 선수도 team:"defense" 라 서로 같은 편으로 잡히기 때문이다.
    if (other === p || other.team !== p.team || !!other.opponent !== !!p.opponent) return;
    const otherTotal = pathLength(other.path);
    if (otherTotal < MIN_CUTTER_TRAVEL) return;
    const op = pointAt(other.path, reachEased * otherTotal);
    const dist = Math.hypot(op[0] - pt[0], op[1] - pt[1]);
    if (dist >= best) return;
    const t = tangentOnPath(other.path, reachEased * otherTotal);
    if (t) {
      best = dist;
      dir = t;
    }
  });
  if (!dir) dir = tangentOnPath(p.path, reachEased * total) || [1, 0];

  return {
    x1: pt[0] + dir[1] * half,
    y1: pt[1] - dir[0] * half,
    x2: pt[0] - dir[1] * half,
    y2: pt[1] + dir[0] * half,
    reachEased,
  };
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
    <marker id="arrow-opponent" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${OPPONENT_COLOR}" />
    </marker>
    <radialGradient id="courtGradient" cx="50%" cy="32%" r="78%">
      <stop class="court-grad-a" offset="0%" />
      <stop class="court-grad-b" offset="100%" />
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

  const possessions = possessionIntervals(tactic.ball);

  const players = tactic.players.map((p) => {
    const total = pathLength(p.path);
    const hasMovement = p.path.length > 1 && total > 0;
    if (hasMovement) {
      // 공을 가진 채로 움직이는 구간 = 드리블. 별도 표시 없이 공 소유 데이터에서 뽑아낸다.
      const dribble = possessions
        .filter((iv) => iv.holder === p.number)
        .map((iv) => [easeInOutQuad(iv.from) * total, easeInOutQuad(iv.to) * total])
        .filter(([a, b]) => b - a > 1);

      const cuts = [0, total];
      dribble.forEach(([a, b]) => cuts.push(a, b));
      const marks = [...new Set(cuts.map((v) => Math.max(0, Math.min(total, v))))].sort((x, y) => x - y);

      for (let i = 1; i < marks.length; i++) {
        const a = marks[i - 1];
        const b = marks[i];
        if (b - a < 0.5) continue;
        const mid = (a + b) / 2;
        const isDribble = dribble.some(([x, y]) => mid >= x && mid <= y);
        const seg = slicePath(p.path, a, b);
        const attrs = {
          d: isDribble ? wavyD(seg) : pathD(seg),
          class: isDribble ? "arrow-path is-dribble" : "arrow-path",
          stroke: playerColor(p),
        };
        if (i === marks.length - 1) attrs["marker-end"] = `url(#arrow-${arrowKind(p)})`;
        arrowGroup.appendChild(svgEl("path", attrs));
      }
    }

    // 상대 선수는 회색 + 속이 빈 동그라미. 우리 팀만 팀 색으로 꽉 채운다.
    // 색과 모양 두 가지로 구분해야 양쪽이 같은 역할일 때도 헷갈리지 않는다.
    const opp = p.opponent ? " is-opponent" : "";
    const g = svgEl("g", { class: "player", transform: `translate(${p.path[0][0]},${p.path[0][1]})` });
    const circle = svgEl("circle", { r: 14, class: `player-dot player-${p.team}${opp}` });
    const text = svgEl("text", {
      class: `player-number player-${p.team}${opp}`,
      "text-anchor": "middle",
      dy: "0.35em",
    });
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

  // 특정 진행률(eased)에서의 선수 위치
  const posAtEased = (number, eased) => {
    const d = playersByNumber[number];
    return d ? pointAt(d.path, eased * d.length) : null;
  };

  // --- 스크린 막대 ---
  // 좌표만으로는 "여기서 벽을 세운다"를 알 수 없어서 screenAt 으로 직접 지정받는다.
  // 막대의 위치·각도 계산은 screenBarEndpoints 한 곳에만 둔다(편집기와 공유).
  const screenGroup = svgEl("g", { class: "screen-layer" });
  const screenBars = [];
  tactic.players.forEach((p) => {
    const bar = screenBarEndpoints(tactic.players, p);
    if (!bar) return;
    const line = svgEl("line", {
      x1: bar.x1,
      y1: bar.y1,
      x2: bar.x2,
      y2: bar.y2,
      class: "screen-bar",
      stroke: playerColor(p),
      opacity: 0,
    });
    screenGroup.appendChild(line);
    screenBars.push({ el: line, reachEased: bar.reachEased });
  });

  // --- 핸드오프 ---
  // 공이 넘어가는 순간 두 선수가 붙어 있으면 패스가 아니라 손으로 건네준 것으로 본다.
  const handoffGroup = svgEl("g", { class: "handoff-layer" });
  const handoffs = [];
  if (tactic.ball && tactic.ball.length > 1) {
    for (let i = 1; i < tactic.ball.length; i++) {
      const prev = tactic.ball[i - 1];
      const cur = tactic.ball[i];
      if (prev.holder === cur.holder) continue;
      const eased = easeInOutQuad(cur.at);
      const a = posAtEased(prev.holder, eased);
      const b = posAtEased(cur.holder, eased);
      if (!a || !b) continue;
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (dist > HANDOFF_DIST) continue;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const g = svgEl("g", { class: "handoff-mark", transform: `translate(${mx},${my}) rotate(${angle})`, opacity: 0 });
      g.appendChild(svgEl("path", { d: "M -11 -4 Q 0 -12 11 -4" }));
      g.appendChild(svgEl("path", { d: "M -11 4 Q 0 12 11 4" }));
      handoffGroup.appendChild(g);
      handoffs.push({ el: g, at: cur.at });
    }
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
  svg.appendChild(screenGroup);
  svg.appendChild(playerGroup);
  svg.appendChild(handoffGroup);
  if (ballEl) svg.appendChild(ballEl);
  container.appendChild(svg);

  // 기호는 처음 보면 뜻을 모르니, 이 전술에 실제로 쓰인 것만 밑에 짧게 적어준다.
  const legendItems = [];
  if (tactic.players.some((p) => p.opponent)) {
    legendItems.push([`<circle class="legend-opponent" cx="20" cy="8" r="6" />`, "상대 팀"]);
  }
  if (arrowGroup.querySelector(".is-dribble")) {
    legendItems.push([`<path d="${wavyD([[3, 9], [37, 4]], 3, 11, 6)}" />`, "드리블"]);
  }
  if (screenBars.length) {
    legendItems.push([`<path d="M 4 9 L 26 5" stroke-dasharray="5 4" /><path d="M 30 1 L 34 15" stroke-width="4" />`, "스크린"]);
  }
  if (handoffs.length) {
    legendItems.push([`<path d="M 8 5 Q 20 -1 32 5" /><path d="M 8 11 Q 20 17 32 11" />`, "핸드오프"]);
  }
  if (legendItems.length) {
    const legend = document.createElement("div");
    legend.className = "court-legend";
    legend.innerHTML = legendItems
      .map(
        ([shape, label]) =>
          `<span class="court-legend-item"><svg viewBox="0 0 40 16" aria-hidden="true">${shape}</svg>${label}</span>`
      )
      .join("");
    container.appendChild(legend);
  }

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
    // 스크린 막대는 스크리너가 그 지점에 닿는 순간 나타나서 계속 남는다.
    for (const bar of screenBars) {
      bar.el.setAttribute("opacity", eased >= bar.reachEased - 0.01 ? 1 : 0);
    }
    // 핸드오프 기호는 주고받는 순간에만 잠깐 보인다.
    for (const h of handoffs) {
      const visible = progress >= h.at - PASS_WINDOW && progress <= h.at + 0.06;
      h.el.setAttribute("opacity", visible ? 1 : 0);
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
