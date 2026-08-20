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

  // 가운데 위·아래 표식은 네 귀퉁이를 잡은 뒤에 찾는다. 사진에 원근이 있으면 종이의
  // 가운데가 사진의 가운데가 아니라서, 귀퉁이 사이의 중점 근처를 뒤져야 맞는다.
  // 없으면 없는 대로 둔다 — 예전에 뽑은 기록지에는 이 표식이 없다.
  const near = (ax, ay, tol) => {
    let bestB = null, bestD = tol * tol;
    for (const c of cands) {
      if (used.has(c)) continue;
      const d = (c.cx - ax) ** 2 + (c.cy - ay) ** 2;
      if (d < bestD) { bestD = d; bestB = c; }
    }
    if (bestB) used.add(bestB);
    return bestB && { x: bestB.cx, y: bestB.cy };
  };
  const tol = span * 0.12;
  const tm = near((picked.tl.x + picked.tr.x) / 2, (picked.tl.y + picked.tr.y) / 2, tol);
  const bm = near((picked.bl.x + picked.br.x) / 2, (picked.bl.y + picked.br.y) / 2, tol);
  if (tm && bm) { picked.tm = tm; picked.bm = bm; }
  return picked;
}

// ── 버블 읽기 ────────────────────────────────────────────
//
// 기준값을 어디서 얻느냐가 전부다. 처음에는 버블 바로 바깥의 "종이"를 찍어 비교했는데,
// 버블 간격이 가로 4.1mm / 세로 3.5mm 인데 표본을 3.4mm / 3.1mm 떨어진 곳에서 찍고
// 있었다 — 이웃 버블 중심의 82~89% 지점, 사실상 이웃 버블 위였다. 그래서 옆 칸이
// 칠해졌는지에 따라 기준값이 널뛰었고, 어떤 사진은 넘치게 어떤 사진은 모자라게 읽혔다.
//
// 지금은 **이웃 버블들의 중앙값**을 기준으로 쓴다. 기록지는 대부분의 칸이 비어 있어서
// (한 장 1,728칸 중 칠하는 건 백 몇 개) 중앙값은 거의 항상 빈 칸이다. 조명이 한쪽만
// 어두워도 그 근처 중앙값이 같이 어두워지니 따라간다.
//
// 문턱값도 고정하지 않고 오츠로 정한다 — 잉크 짙기와 인쇄 농도가 종이마다 다르다.

// 이웃을 모으는 격자 칸 크기(mm). 한 칸에 수십 개가 들어가야 중앙값이 의미가 있다.
const CELL_MM = 22;

function otsuOn(values) {
  if (values.length < 8) return 0.8;
  const lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 0.06) return lo - 1; // 다 비슷하면 = 칠한 게 없다
  const B = 64;
  const hist = new Uint32Array(B);
  for (const v of values) hist[Math.min(B - 1, Math.floor(((v - lo) / (hi - lo)) * B))]++;
  const total = values.length;
  let sum = 0;
  for (let t = 0; t < B; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = -1, cut = 0;
  for (let t = 0; t < B; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; cut = t; }
  }
  return lo + ((cut + 1) / B) * (hi - lo);
}

const RED_MARGIN = 22; // R 이 G·B 평균보다 이만큼 크면 빨강

/**
 * corners: 사진 px 기준 {tl,tr,br,bl} — 표식의 중심.
 * geometry: sheetform.measureSheet() 결과.
 * 돌려주는 값: Map<버블 id, {v:"blank"|"black"|"red", ratio, x, y}>
 *   x,y 는 사진 위 좌표 — 판독 확인 그림을 그릴 때 쓴다.
 */
export function readBubbles(imageData, corners, geometry) {
  const { width: W, height: H, data } = imageData;
  const f = geometry.fiducials;
  const P = (k) => ({ x: f[k].cx, y: f[k].cy });

  // 종이를 반으로 접었다 펴면 접힌 선을 경계로 좌우가 서로 다른 면이 된다. 네 귀퉁이
  // 하나로만 펴면 가운데가 몇 mm씩 어긋나 옆 칸을 읽는다. 가운데 표식이 있으면
  // 왼쪽·오른쪽을 따로 편다 — 접힌 선이 곧 경계라 딱 맞는다.
  const split = corners.tm && corners.bm && f.tm && f.bm;
  const hL = solveHomography(
    split ? [P("tl"), P("tm"), P("bm"), P("bl")] : [P("tl"), P("tr"), P("br"), P("bl")],
    split ? [corners.tl, corners.tm, corners.bm, corners.bl]
          : [corners.tl, corners.tr, corners.br, corners.bl]
  );
  const hR = split
    ? solveHomography([P("tm"), P("tr"), P("br"), P("bm")],
                      [corners.tm, corners.tr, corners.br, corners.bm])
    : hL;
  if (!hL || !hR) throw new Error("네 귀퉁이로 종이 모양을 잡지 못했습니다.");
  const midX = split ? f.tm.cx : Infinity;
  const hAt = (mmX) => (mmX < midX ? hL : hR);

  const at = (x, y) => {
    const px = Math.round(x), py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return null;
    const i = (py * W + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const lum = (c) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;

  // 1단계 — 버블마다 안쪽 밝기와 색을 잰다. 인쇄된 테두리에 닿지 않게 안쪽만 본다.
  const OFFSETS = [[0, 0], [-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45],
                   [-0.3, -0.3], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3]];
  const cells = new Map();
  const items = geometry.bubbles.map((b) => {
    const hb = hAt(b.cx);
    const px = [];
    for (const [dx, dy] of OFFSETS) {
      const p = applyHomography(hb, b.cx + dx * b.rx, b.cy + dy * b.ry);
      const c = at(p.x, p.y);
      if (c) px.push(c);
    }
    const center = applyHomography(hb, b.cx, b.cy);
    if (!px.length) return { b, L: null, rgb: null, x: center.x, y: center.y };
    const rgb = px.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map((v) => v / px.length);
    const item = { b, L: lum(rgb), rgb, x: center.x, y: center.y };
    const key = `${Math.floor(b.cx / CELL_MM)},${Math.floor(b.cy / CELL_MM)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(item);
    return item;
  });

  // 2단계 — 근처 버블들의 중앙값을 "빈 칸" 기준으로 삼는다.
  const median = (arr) => {
    const a = [...arr].sort((x, y) => x - y);
    return a[a.length >> 1];
  };
  // 표본이 모자라면 칸을 한 겹씩 넓혀 가며 모은다. 출전 열처럼 버블이 성긴 곳
  // (22mm 칸에 다섯 개뿐)에서 기준값을 못 구해 통째로 빈 칸으로 읽히던 것을 고친다.
  const NEED = 24;
  const allL = items.map((it) => it.L).filter((v) => v != null);
  const globalRef = allL.length ? median(allL) : null;
  const refOf = (b) => {
    const gx = Math.floor(b.cx / CELL_MM), gy = Math.floor(b.cy / CELL_MM);
    const pool = [];
    for (let ring = 1; ring <= 4; ring++) {
      pool.length = 0;
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          const c = cells.get(`${gx + dx},${gy + dy}`);
          if (c) for (const it of c) if (it.L != null) pool.push(it.L);
        }
      }
      if (pool.length >= NEED) return median(pool);
    }
    return pool.length >= 6 ? median(pool) : globalRef;
  };

  const refCache = new Map();
  for (const it of items) {
    if (it.L == null) { it.ratio = 1; continue; }
    const key = `${Math.floor(it.b.cx / CELL_MM)},${Math.floor(it.b.cy / CELL_MM)}`;
    if (!refCache.has(key)) refCache.set(key, refOf(it.b));
    const ref = refCache.get(key);
    it.ratio = ref && ref > 1 ? it.L / ref : 1;
  }

  // 3단계 — 문턱값은 오츠로. 칠한 칸은 확실히 어두운 쪽에 몰린다.
  const ratios = items.filter((it) => it.L != null).map((it) => it.ratio);
  // 빈 칸이 압도적이라 오츠가 잡음을 자를 수 있다. 0.62~0.90 밖으로는 안 나가게 묶는다.
  const cut = Math.max(0.62, Math.min(otsuOn(ratios), 0.90));

  const out = new Map();
  for (const it of items) {
    let v = "blank";
    if (it.L != null && it.ratio < cut) {
      v = it.rgb[0] - (it.rgb[1] + it.rgb[2]) / 2 > RED_MARGIN ? "red" : "black";
    }
    out.set(it.b.id, { v, ratio: it.ratio, x: it.x, y: it.y });
  }
  out.threshold = cut;
  out.split = !!split;
  return out;
}

/**
 * 판독이 어디를 봤는지 그림으로 보여준다. 안 맞을 때 원인을 눈으로 찾기 위한 것.
 * 초록 = 빈 칸으로 봄, 빨강/파랑 = 칠한 것으로 봄, 노랑 큰 원 = 귀퉁이로 잡은 자리.
 */
export function debugOverlay(imageData, corners, readings) {
  const cv = document.createElement("canvas");
  cv.width = imageData.width;
  cv.height = imageData.height;
  const ctx = cv.getContext("2d");
  ctx.putImageData(imageData, 0, 0);

  const r = Math.max(2, imageData.width / 500);
  for (const [, b] of readings) {
    if (b.x == null) continue;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    if (b.v === "blank") { ctx.strokeStyle = "rgba(0,220,90,0.55)"; ctx.lineWidth = 1; ctx.stroke(); }
    else { ctx.fillStyle = b.v === "red" ? "rgba(255,60,60,0.9)" : "rgba(40,120,255,0.9)"; ctx.fill(); }
  }
  ctx.lineWidth = Math.max(3, imageData.width / 300);
  ctx.strokeStyle = "#ffd400";
  for (const k of ["tl", "tr", "br", "bl", "tm", "bm"]) {
    const c = corners[k];
    if (!c) continue;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 네 귀퉁이를 이어 종이 테두리가 맞는지 보여준다
  ctx.beginPath();
  ctx.moveTo(corners.tl.x, corners.tl.y);
  for (const k of ["tr", "br", "bl"]) ctx.lineTo(corners[k].x, corners[k].y);
  ctx.closePath();
  ctx.stroke();
  return cv;
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
