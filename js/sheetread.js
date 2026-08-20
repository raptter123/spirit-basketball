// 기록지 사진에서 칠해진 버블을 읽는다.
//
// 우리가 종이를 만들었으니 버블이 종이 어디에 있는지는 이미 안다(sheetform.js).
// 그래서 할 일은 사진 → 종이 좌표계로 되돌리는 것 하나뿐이다. 글자를 알아볼 필요도,
// 동그라미를 찾아다닐 필요도 없다.
//
//   1) 네 귀퉁이 표식을 찾는다 (못 찾으면 사람이 네 귀퉁이를 찍어 준다)
//   2) 그 네 점으로 원근 변환(호모그래피)을 풀어 종이 mm → 사진 px 로 옮긴다
//   3) 버블마다 안쪽 몇 점을 찍어 어둡기와 색을 잰다
//
// 조명이 고르지 않아도 되게, 버블 바로 바깥의 종이 색을 같이 재서 그것과 견준다.

import { SHEET_MM } from "./sheetform.js";

// ── 호모그래피 ───────────────────────────────────────────
// 네 점 대응으로 3×3 변환을 푼다. h33=1 로 고정하면 미지수 8개짜리 선형계가 된다.
function solveLinear(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    if (Math.abs(A[piv][i]) < 1e-12) return null;
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

/** src(종이 mm) 네 점 → dst(사진 px) 네 점. 순서는 둘 다 [tl, tr, br, bl]. */
export function solveHomography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return h && [...h, 1];
}

export function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
}

// ── 귀퉁이 표식 찾기 ─────────────────────────────────────
// 표식은 6mm 검은 사각형이다. 사진을 줄여서 어두운 덩어리를 모으고, 크기·모양이
// 맞는 것 중 네 귀퉁이에 가장 가까운 것을 하나씩 고른다.
//
// 못 찾으면 null 을 돌려준다 — 종이가 잘려 찍혔거나 그늘이 심한 경우다.
// 그때는 사람이 네 귀퉁이를 찍어 주는 쪽으로 넘어간다.
export function detectFiducials(imageData) {
  const { width: W, height: H, data } = imageData;

  // 밝기 히스토그램으로 문턱값을 정한다(오츠). 조명이 어두워도 따라간다.
  const hist = new Uint32Array(256);
  const gray = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const g = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000 | 0;
    gray[p] = g;
    hist[g]++;
  }
  const total = W * H;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  // 표식은 새까맣다. 문턱값을 더 낮게 잡아 글자·마킹이 덜 딸려오게 한다.
  thr = Math.max(20, Math.min(thr * 0.62, 110));

  // 이어진 어두운 덩어리 모으기
  const seen = new Uint8Array(W * H);
  const blobs = [];
  const stack = new Int32Array(W * H);
  for (let p = 0; p < W * H; p++) {
    if (seen[p] || gray[p] > thr) continue;
    let sp = 0;
    stack[sp++] = p;
    seen[p] = 1;
    let n = 0, minX = W, maxX = 0, minY = H, maxY = 0, sx = 0, sy = 0;
    while (sp) {
      const q = stack[--sp];
      const x = q % W, y = (q / W) | 0;
      n++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (n > 40000) break; // 배경이 통째로 어두우면 여기서 끊는다
      if (x > 0 && !seen[q - 1] && gray[q - 1] <= thr) { seen[q - 1] = 1; stack[sp++] = q - 1; }
      if (x < W - 1 && !seen[q + 1] && gray[q + 1] <= thr) { seen[q + 1] = 1; stack[sp++] = q + 1; }
      if (y > 0 && !seen[q - W] && gray[q - W] <= thr) { seen[q - W] = 1; stack[sp++] = q - W; }
      if (y < H - 1 && !seen[q + W] && gray[q + W] <= thr) { seen[q + W] = 1; stack[sp++] = q + W; }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    blobs.push({ n, cx: sx / n, cy: sy / n, bw, bh, fill: n / (bw * bh) });
  }

  // 표식 크기는 종이 폭의 약 2%(6mm / 297mm). 사진에 종이가 꽉 찼다고 보고 어림한다.
  const expect = W * 0.0202;
  const cands = blobs.filter((b) => {
    const side = (b.bw + b.bh) / 2;
    return side > expect * 0.45 && side < expect * 2.4 &&
      b.bw / b.bh > 0.6 && b.bw / b.bh < 1.7 &&
      b.fill > 0.62;
  });
  if (cands.length < 4) return null;

  // 네 귀퉁이에 가장 가까운 것을 하나씩. 같은 덩어리가 두 번 뽑히면 실패로 본다.
  const corners = { tl: [0, 0], tr: [W, 0], br: [W, H], bl: [0, H] };
  const picked = {};
  const used = new Set();
  for (const [key, [x, y]] of Object.entries(corners)) {
    let bestB = null, bestD = Infinity;
    for (const c of cands) {
      if (used.has(c)) continue;
      const d = (c.cx - x) ** 2 + (c.cy - y) ** 2;
      if (d < bestD) { bestD = d; bestB = c; }
    }
    if (!bestB) return null;
    used.add(bestB);
    picked[key] = { x: bestB.cx, y: bestB.cy };
  }

  // 네 점이 정말 네 귀퉁이인지 — 서로 너무 붙어 있으면 잘못 잡은 것이다.
  const span = Math.min(
    Math.hypot(picked.tr.x - picked.tl.x, picked.tr.y - picked.tl.y),
    Math.hypot(picked.bl.x - picked.tl.x, picked.bl.y - picked.tl.y)
  );
  if (span < Math.min(W, H) * 0.35) return null;
  return picked;
}

// ── 버블 읽기 ────────────────────────────────────────────
const BLANK_RATIO = 0.78;  // 주변 종이 대비 이보다 밝으면 빈 칸
const RED_MARGIN = 26;     // R 이 G·B 평균보다 이만큼 크면 빨강

/**
 * corners: 사진 px 기준 {tl,tr,br,bl} — 표식의 중심.
 * geometry: sheetform.measureSheet() 결과.
 * 돌려주는 값: Map<버블 id, {v:"blank"|"black"|"red", ink:0~1}>
 */
export function readBubbles(imageData, corners, geometry) {
  const { width: W, height: H, data } = imageData;
  const f = geometry.fiducials;
  const src = [
    { x: f.tl.cx, y: f.tl.cy }, { x: f.tr.cx, y: f.tr.cy },
    { x: f.br.cx, y: f.br.cy }, { x: f.bl.cx, y: f.bl.cy },
  ];
  const dst = [corners.tl, corners.tr, corners.br, corners.bl];
  const h = solveHomography(src, dst);
  if (!h) throw new Error("네 귀퉁이로 종이 모양을 잡지 못했습니다.");

  const at = (x, y) => {
    const px = Math.round(x), py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return null;
    const i = (py * W + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const lum = (c) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;

  const out = new Map();
  for (const b of geometry.bubbles) {
    // 버블 안쪽 — 인쇄된 테두리에 닿지 않게 60%만 본다.
    const inside = [];
    for (const [dx, dy] of [[0, 0], [-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5], [-0.35, -0.35], [0.35, 0.35], [-0.35, 0.35], [0.35, -0.35]]) {
      const p = applyHomography(h, b.cx + dx * b.rx * 1.2, b.cy + dy * b.ry * 1.2);
      const c = at(p.x, p.y);
      if (c) inside.push(c);
    }
    // 버블 바깥쪽 종이 — 그늘이 져도 그 자리 종이와 견주면 된다.
    const paper = [];
    for (const [dx, dy] of [[-2.1, 0], [2.1, 0], [0, -2.4], [0, 2.4]]) {
      const p = applyHomography(h, b.cx + dx * b.rx, b.cy + dy * b.ry);
      const c = at(p.x, p.y);
      if (c) paper.push(c);
    }
    if (!inside.length) { out.set(b.id, { v: "blank", ink: 0 }); continue; }

    const mean = (arr) => arr.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map((v) => v / arr.length);
    const mi = mean(inside);
    // 종이 밝기는 네 점 중 가장 밝은 값을 쓴다 — 옆 칸 마킹이 걸려 어두워지는 걸 피한다.
    const paperL = paper.length ? Math.max(...paper.map(lum)) : 255;
    const ratio = lum(mi) / Math.max(paperL, 1);

    let v = "blank";
    if (ratio < BLANK_RATIO) {
      v = mi[0] - (mi[1] + mi[2]) / 2 > RED_MARGIN ? "red" : "black";
    }
    out.set(b.id, { v, ink: Math.max(0, Math.min(1, 1 - ratio)) });
  }
  return out;
}

// ── 읽은 값 → 한 팀 기록 ─────────────────────────────────
// 색이 쿼터를 알려준다: 검정 = 홀수 쿼터, 빨강 = 짝수 쿼터.
// 전반 줄이면 검정 1Q · 빨강 2Q, 후반 줄이면 검정 3Q · 빨강 4Q.
export function quarterOf(half, color) {
  if (color === "black") return half === 1 ? 1 : 3;
  if (color === "red") return half === 1 ? 2 : 4;
  return null;
}

/**
 * readings: readBubbles() 결과
 * roster: [[등번호|null, 이름], ...] — 종이에 인쇄된 순서 그대로
 * 돌려주는 값: { players, filled, quarterPoints }
 *
 * quarterPoints 는 쿼터별 팀 득점이다. 넣은 슛마다 어느 쿼터인지가 색(검정/빨강)과
 * 줄(전반/후반)에 이미 적혀 있으니, 손글씨 쿼터 점수표를 읽지 않아도 계산된다.
 * 종이 위쪽 손글씨 표는 이 계산이 맞는지 대조하는 용도로만 쓰면 된다.
 */
export function readingsToTeam(readings, roster) {
  const players = roster.map(([no, name]) => ({
    no, name,
    quarters: [],
    p2m: 0, p2a: 0, p3m: 0, p3a: 0, ftm: 0, fta: 0,
    reb: 0, ast: 0, stl: 0, blk: 0, to: 0, pf: 0,
    memo: "",
  }));
  const quarterPoints = [0, 0, 0, 0];
  const POINTS = { p2: 2, p3: 3, ft: 1 };

  let filled = 0;
  for (const [id, r] of readings) {
    if (r.v === "blank") continue;
    filled++;
    const t = id.split(":");
    const pi = +t[1];
    const p = players[pi];
    if (!p) continue;

    if (t[0] === "q") {
      const q = +t[2];
      if (!p.quarters.includes(q)) p.quarters.push(q);
    } else if (t[0] === "s") {
      const stat = t[2], half = +t[3], made = t[5] === "m";
      p[`${stat}a`]++;
      if (made) {
        p[`${stat}m`]++;
        const q = quarterOf(half, r.v);
        if (q) quarterPoints[q - 1] += POINTS[stat];
      }
    } else if (t[0] === "c") {
      p[t[2]]++;
    }
  }
  for (const p of players) p.quarters.sort();
  return { players, filled, quarterPoints };
}
