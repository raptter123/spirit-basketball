// 기록지 사진에서 칠해진 버블을 읽는다.
//
// 우리가 종이를 만들었으니 버블이 종이 어디에 있는지는 이미 안다(sheetform.js).
// 그래서 할 일은 사진 → 종이 좌표계로 되돌리는 것 하나뿐이다. 글자를 알아볼 필요도,
// 동그라미를 찾아다닐 필요도 없다.
//
//   1) 네 귀퉁이 표식을 찾는다 (못 찾으면 사람이 네 귀퉁이를 찍어 준다)
//   2) 그 네 점으로 원근 변환(호모그래피)을 풀어 종이 mm → 사진 px 로 옮긴다
//   3) 네 변의 눈금 표식을 찾아 종이 **안쪽**의 밀림을 마저 잡는다
//   4) 버블마다 안쪽 몇 점을 찍어 어둡기와 색을 잰다
//
// 조명이 고르지 않아도 되게, 버블 바로 바깥의 종이 색을 같이 재서 그것과 견준다.
//
// 3) 이 왜 필요한가 — 실제로 찍어 온 사진을 재 봤다. 귀퉁이 네 점만으로 편 좌표는
// 종이 가장자리에서는 맞지만 안쪽으로 들어갈수록 밀렸다. 가로 -4~+12px, 세로 -13~+12px.
// 버블 세로 반지름이 9.4px 이니 그만큼이면 **옆 줄을 읽는다**. 종이가 완전히 평평하지
// 않고, 휴대폰 렌즈가 가장자리를 휘고, 인쇄 배율도 딱 맞지 않아서 생기는 것이라
// 문턱값을 아무리 손봐도 고쳐지지 않는다. 표식을 네 변에 깔아 잡는 수밖에 없다.

import { SHEET_MM, CODE_BITS, sheetCodeBits, ROW_CODE_BITS, rowCodeValue, PLAYER_ROWS } from "./sheetform.js";

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

// ── 어두운 덩어리 모으기 ─────────────────────────────────
// 귀퉁이 표식도 눈금 표식도 여기서 나온 것 중에 크기와 자리로 골라 쓴다.
// 한 사진에 한 번만 하면 되므로 결과를 붙여 둔다.
export function darkBlobs(imageData) {
  if (imageData.__blobs) return imageData.__blobs;
  const out = blobScan(imageData);
  try { Object.defineProperty(imageData, "__blobs", { value: out, enumerable: false }); } catch { /* 못 붙이면 그냥 다시 센다 */ }
  return out;
}

function blobScan(imageData) {
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
    let n = 0, minX = W, maxX = 0, minY = H, maxY = 0, sx = 0, sy = 0, sxx = 0, syy = 0;
    while (sp) {
      const q = stack[--sp];
      const x = q % W, y = (q / W) | 0;
      n++; sx += x; sy += y; sxx += x * x; syy += y * y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (n > 40000) break; // 배경이 통째로 어두우면 여기서 끊는다
      if (x > 0 && !seen[q - 1] && gray[q - 1] <= thr) { seen[q - 1] = 1; stack[sp++] = q - 1; }
      if (x < W - 1 && !seen[q + 1] && gray[q + 1] <= thr) { seen[q + 1] = 1; stack[sp++] = q + 1; }
      if (y > 0 && !seen[q - W] && gray[q - W] <= thr) { seen[q - W] = 1; stack[sp++] = q - W; }
      if (y < H - 1 && !seen[q + W] && gray[q + W] <= thr) { seen[q + W] = 1; stack[sp++] = q + W; }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const cx = sx / n, cy = sy / n;
    // 가로·세로 길이를 **바깥 네모가 아니라 퍼진 정도**로 잰다. 속이 꽉 찬 정사각형은
    // 좌표의 표준편차가 한 변의 1/√12 이므로 √12·σ 가 곧 한 변이다.
    //
    // 왜 바꿨나: IMG_2182 의 왼쪽 아래 귀퉁이 표식은 초점이 나가 흐릿하게 찍혔다.
    // 번진 꼬리가 바깥 네모를 79×70 으로 부풀려 채움률이 0.538 로 떨어졌고,
    // 0.62 문턱에 걸려 **표식이 통째로 사라졌다**. 그래서 판독기가 왼쪽 아래
    // 귀퉁이 대신 그 위의 눈금 표식을 집었고, 종이 안쪽이 한 줄씩 밀려 읽혔다.
    // 퍼진 정도는 꼬리에 거의 흔들리지 않는다 — 흐릿해도 정사각형은 정사각형이다.
    const ex = n >= 8 ? Math.sqrt(Math.max(1, 12 * (sxx / n - cx * cx))) : bw;
    const ey = n >= 8 ? Math.sqrt(Math.max(1, 12 * (syy / n - cy * cy))) : bh;
    blobs.push({ n, cx, cy, bw, bh, ex, ey, fill: n / (bw * bh), solid: n / (ex * ey) });
  }

  // 네모지고 속이 꽉 찬 것만 남긴다. 크기로 거르는 일은 부르는 쪽에서 한다 —
  // 귀퉁이 표식은 5mm, 눈금 표식은 3.4mm 로 서로 다르기 때문이다.
  // solid 는 꽉 찬 네모면 1.0, 원이면 1.05, 속 빈 동그라미(버블 테두리)면 0.2 근처다.
  return blobs.filter((b) =>
    b.ex / b.ey > 0.6 && b.ex / b.ey < 1.7 && b.solid > 0.7 && b.solid < 1.4);
}

// ── 귀퉁이 표식 찾기 ─────────────────────────────────────
// 표식은 6mm 검은 사각형이다. 사진을 줄여서 어두운 덩어리를 모으고, 크기·모양이
// 맞는 것 중 네 귀퉁이에 가장 가까운 것을 하나씩 고른다.
//
// 못 찾으면 null 을 돌려준다 — 종이가 잘려 찍혔거나 그늘이 심한 경우다.
// 그때는 사람이 네 귀퉁이를 찍어 주는 쪽으로 넘어간다.
export function detectFiducials(imageData, geometry) {
  const { width: W, height: H } = imageData;
  const all = darkBlobs(imageData);

  // 표식 크기를 종이 폭에서 어림하던 것을 **넓게** 잡는다. 예전에는 "사진에 종이가
  // 꽉 찼다"고 보고 6mm/297mm = 2% 를 썼는데, 기록지를 78% 로 줄여 인쇄하면서
  // 그 가정이 깨졌다 — 종이 안에서 기록지가 차지하는 비율이 달라지면 이 값도 달라진다.
  const expect = W * 0.0202;
  const cands = all.filter((b) => {
    const side = (b.ex + b.ey) / 2;
    return side > expect * 0.3 && side < expect * 2.4;
  });
  if (cands.length < 4) return null;

  // 귀퉁이 후보를 **하나만** 고르지 않는다. 실제 사진에서 왼쪽 아래 표식 대신
  // 사진 한가운데의 엉뚱한 덩어리를 집어 판독이 통째로 망가진 적이 있다.
  // 그래서 귀퉁이마다 후보를 몇 개씩 두고, **눈금 표식을 가장 많이 설명하는 조합**을
  // 고른다. 종이가 스스로 답을 갖고 있으니 그걸로 채점하면 된다.
  const CORNERS = { tl: [0, 0], tr: [W, 0], br: [W, H], bl: [0, H] };
  const TOP_N = 4;
  const shortlist = {};
  for (const [key, [x, y]] of Object.entries(CORNERS)) {
    shortlist[key] = cands
      .map((c) => {
        const side = (c.ex + c.ey) / 2;
        const miss = Math.abs(side - expect) / expect;
        return { c, d: Math.hypot(c.cx - x, c.cy - y) * (1 + miss * 1.5) };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, TOP_N)
      .map((v) => ({ x: v.c.cx, y: v.c.cy }));
    if (!shortlist[key].length) return null;
  }

  const spanOK = (p) => {
    const span = Math.min(
      Math.hypot(p.tr.x - p.tl.x, p.tr.y - p.tl.y),
      Math.hypot(p.bl.x - p.tl.x, p.bl.y - p.tl.y)
    );
    return span >= Math.min(W, H) * 0.35;
  };

  // 눈금 표식을 셀 수 없으면(옛 양식이거나 좌표를 안 넘겨줬으면) 예전처럼 가장 가까운
  // 것 하나씩으로 간다.
  if (!geometry || !geometry.ticks) {
    const first = { tl: shortlist.tl[0], tr: shortlist.tr[0], br: shortlist.br[0], bl: shortlist.bl[0] };
    return spanOK(first) ? first : null;
  }

  let best = null, bestHits = -1;
  for (const tl of shortlist.tl) {
    for (const tr of shortlist.tr) {
      for (const br of shortlist.br) {
        for (const bl of shortlist.bl) {
          const p = { tl, tr, br, bl };
          if (!spanOK(p)) continue;
          let h;
          try { h = buildWarp(geometry, p, null).h; } catch { continue; }
          const t = detectTicks(imageData, p, geometry, h);
          const hits = t ? t.hits : 0;
          if (hits > bestHits) { bestHits = hits; best = p; }
        }
      }
    }
  }
  return best;
}

// ── 눈금 표식으로 종이 안쪽 밀림 잡기 ────────────────────
//
// 귀퉁이 네 점으로 푼 호모그래피는 **가장자리에서만** 맞는다. 종이가 조금 말리거나
// 렌즈가 휘면 안쪽이 1~2mm 밀리는데, 버블 반지름이 1.3mm 이라 그 정도면 옆 줄을 읽는다.
//
// 그래서 네 변에 박아 둔 눈금 표식을 사진에서 찾아, "예상 자리 → 실제 자리" 차이를
// 잰다. 그 차이를 네 변에서 안쪽으로 부드럽게 이어 붙이면(쿤스 패치) 종이 전체의
// 밀림 지도가 나온다. 표식을 못 찾으면 차이 0 — 지금까지와 똑같이 동작한다.

/** 눈금 표식을 사진에서 찾는다. 돌려주는 값은 geometry.ticks 와 같은 모양(px). */
export function detectTicks(imageData, corners, geometry, h) {
  const { width: W } = imageData;
  if (!geometry.ticks) return null;
  const all = darkBlobs(imageData);
  const expect = W * 0.0114; // 3.4mm / 297mm
  const cands = all.filter((b) => {
    const side = (b.ex + b.ey) / 2;
    return side > expect * 0.4 && side < expect * 2.0;
  });

  // 표식 사이 간격의 절반보다 좁게 찾는다 — 옆 표식을 잘못 집지 않게.
  const span = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
  const tol = span * 0.035;

  const found = { l: [], r: [], t: [], b: [] };
  let hits = 0;
  for (const side of ["l", "r", "t", "b"]) {
    for (const mm of geometry.ticks[side]) {
      if (!mm) { found[side].push(null); continue; }
      const want = applyHomography(h, mm.cx, mm.cy);
      let best = null, bestD = tol;
      for (const c of cands) {
        const d = Math.hypot(c.cx - want.x, c.cy - want.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      found[side].push(best ? { x: best.cx, y: best.cy } : null);
      if (best) hits++;
    }
  }
  found.hits = hits;
  found.total = ["l", "r", "t", "b"].reduce((n, s) => n + geometry.ticks[s].length, 0);
  return found;
}

// 한 변을 따라 잰 밀림을, 그 변 위의 아무 자리에서나 꺼내 쓸 수 있게 한다.
// 표식이 없는 자리는 양옆 것으로 이어 붙이고, 양 끝은 귀퉁이(밀림 0)로 묶는다.
function railFn(mmList, pxList, keyOf, lo, hi) {
  const pts = [{ t: lo, dx: 0, dy: 0 }];
  mmList.forEach((mm, i) => {
    const px = pxList[i];
    if (!mm || !px) return;
    pts.push({ t: keyOf(mm), dx: px.dx, dy: px.dy });
  });
  pts.push({ t: hi, dx: 0, dy: 0 });
  pts.sort((a, b) => a.t - b.t);
  return (t) => {
    if (t <= pts[0].t) return pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].t) {
        const a = pts[i - 1], b = pts[i];
        const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
        return { dx: a.dx + (b.dx - a.dx) * f, dy: a.dy + (b.dy - a.dy) * f };
      }
    }
    return pts[pts.length - 1];
  };
}

/**
 * mm → 사진 px 로 옮기는 함수를 만든다. 눈금 표식이 잡히면 밀림까지 보정한다.
 * 돌려주는 값: { at(mmX, mmY) → {x,y}, corrected: boolean, hits, total }
 */
export function buildWarp(geometry, corners, ticksPx) {
  const f = geometry.fiducials;
  const P = (k) => ({ x: f[k].cx, y: f[k].cy });
  const h = solveHomography(
    [P("tl"), P("tr"), P("br"), P("bl")],
    [corners.tl, corners.tr, corners.br, corners.bl]
  );
  if (!h) throw new Error("네 귀퉁이로 종이 모양을 잡지 못했습니다.");

  const plain = { at: (x, y) => applyHomography(h, x, y), corrected: false, hits: 0, total: 0, h };
  if (!ticksPx || !geometry.ticks) return plain;

  // 표식이 절반도 안 잡히면 밀림 지도를 믿을 수 없다 — 그냥 호모그래피로 간다.
  if (ticksPx.hits < ticksPx.total * 0.5) return { ...plain, hits: ticksPx.hits, total: ticksPx.total };

  // 변마다 "예상과 실제의 차이"를 모은다
  const resid = {};
  for (const side of ["l", "r", "t", "b"]) {
    resid[side] = geometry.ticks[side].map((mm, i) => {
      const px = ticksPx[side][i];
      if (!mm || !px) return null;
      const want = applyHomography(h, mm.cx, mm.cy);
      return { dx: px.x - want.x, dy: px.y - want.y };
    });
  }

  const x0 = f.tl.cx, x1 = f.tr.cx, y0 = f.tl.cy, y1 = f.bl.cy;
  const L = railFn(geometry.ticks.l, resid.l, (mm) => mm.cy, y0, y1);
  const R = railFn(geometry.ticks.r, resid.r, (mm) => mm.cy, y0, y1);
  const T = railFn(geometry.ticks.t, resid.t, (mm) => mm.cx, x0, x1);
  const B = railFn(geometry.ticks.b, resid.b, (mm) => mm.cx, x0, x1);

  // 쿤스 패치. 네 변의 값은 그대로 살리고 안쪽은 부드럽게 잇는다.
  // 귀퉁이의 밀림은 0 이라(호모그래피가 거기에 딱 맞춰져 있다) 빼 줄 항이 사라진다.
  return {
    at: (mx, my) => {
      const p = applyHomography(h, mx, my);
      const u = Math.max(0, Math.min(1, (mx - x0) / (x1 - x0)));
      const v = Math.max(0, Math.min(1, (my - y0) / (y1 - y0)));
      const t = T(mx), b = B(mx), l = L(my), r = R(my);
      return {
        x: p.x + (1 - v) * t.dx + v * b.dx + (1 - u) * l.dx + u * r.dx,
        y: p.y + (1 - v) * t.dy + v * b.dy + (1 - u) * l.dy + u * r.dy,
      };
    },
    corrected: true,
    hits: ticksPx.hits,
    total: ticksPx.total,
    h,
  };
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

// ── 인쇄된 동그라미에 맞춰 마지막으로 미세 조정 ──────────
//
// 눈금 표식은 종이 **네 변**에 있다. 그래서 변 근처는 정확한데 한가운데는 여전히
// 조금 남는다(위쪽 선수 줄에서 특히). 다행히 종이에는 이미 훌륭한 기준이 잔뜩
// 인쇄되어 있다 — 버블 동그라미 자체다.
//
// 제대로 맞은 자리에서는 **테두리는 어둡고 안쪽은 밝다**. 이 차이가 가장 큰 자리를
// 찾으면 된다. 한 칸에 수십 개를 한꺼번에 보므로 그중 몇 개가 칠해져 있어도 흔들리지
// 않는다. 찾는 범위는 버블 간격의 절반보다 훨씬 좁게 묶는다 — 넓히면 **옆 줄**에
// 들러붙어 오히려 망가진다(그렇게 한 번 망가뜨려 봤다).
//
// 찾는 범위는 px 가 아니라 **줄 간격에 대한 비율**로 잡는다. 사진 해상도는 제각각이고,
// 위험한 건 "옆 줄에 닿는 것"이므로 기준이 되어야 할 것은 버블 크기가 아니라 줄 간격이다.
//
// 예전엔 버블 세로 반지름의 0.35배(= 줄 간격의 0.13배)로 묶어 뒀는데 너무 좁았다.
// 실제 사진에서 눈금 보정을 다 하고도 세로로 -9~+9px 이 남았는데(버블 반지름 10.2px),
// 찾는 범위가 3.6px 이라 손도 못 댔다. 줄 간격의 절반보다만 좁으면 옆 줄에는 안 닿는다.
const SNAP_RATIO = 0.38; // 줄 간격의 이만큼까지 (0.5 미만이어야 옆 줄에 안 닿는다)

// 세로로 이웃한 버블 사이가 사진에서 몇 px 인지 — 스냅 범위의 기준이 되는 값이다.
// 같은 열(mm 가로가 같은) 버블들을 모아 세로 간격을 보고, 그중 촘촘한 쪽을 쓴다.
function rowPitchPx(placed) {
  const cols = new Map();
  for (const o of placed) {
    const k = o.mx.toFixed(1);
    if (!cols.has(k)) cols.set(k, []);
    cols.get(k).push(o);
  }
  const px = [];
  for (const list of cols.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.my - b.my);
    for (let i = 1; i < list.length; i++) {
      if (list[i].my - list[i - 1].my > 0.01) {
        px.push(Math.hypot(list[i].x - list[i - 1].x, list[i].y - list[i - 1].y));
      }
    }
  }
  if (!px.length) return placed[0].ry * 2.7;
  px.sort((a, b) => a - b);
  // 아래쪽 10% 를 쓴다 — 칸 경계를 건너뛴 큰 간격에 끌려가지 않게.
  return px[Math.floor(px.length * 0.1)];
}

function ringSnap(imageData, warp, geometry) {
  const { width: W, height: H, data } = imageData;
  const lum = (x, y) => {
    const px = x | 0, py = y | 0;
    if (px < 0 || py < 0 || px >= W || py >= H) return 255;
    const i = (py * W + px) * 4;
    return (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
  };
  const RING = [];
  for (let a = 0; a < 16; a++) RING.push([Math.cos(a * Math.PI / 8), Math.sin(a * Math.PI / 8)]);

  // 이름 칸(r)도 인쇄된 동그라미라 같이 쓴다. 빼 놓으면 표 왼쪽 끝에 표본이 없어
  // 그 근처 보정이 바깥값으로 밀려나고, 정작 이름 칸이 어긋나 읽힌다.
  // 코드 칸(k)은 꼬리글에 따로 떨어져 있어 격자 범위만 늘리므로 계속 뺀다.
  const bs = geometry.bubbles.filter((b) => b.id[0] !== "k").map((b) => {
    const c = warp.at(b.cx, b.cy);
    const ex = warp.at(b.cx + b.rx, b.cy), ey = warp.at(b.cx, b.cy + b.ry);
    return { mx: b.cx, my: b.cy, x: c.x, y: c.y,
             rx: Math.hypot(ex.x - c.x, ex.y - c.y), ry: Math.hypot(ey.x - c.x, ey.y - c.y) };
  });
  if (bs.length < 100) return null;

  // 테두리가 얼마나 어두운지만 본다. 안쪽 밝기까지 같이 보면 **칠해진 칸**이 발목을
  // 잡는다(칠한 칸은 안쪽도 까맣다). 테두리만 보면, 칠한 칸은 어느 쪽으로 밀어도
  // 비슷하게 어두워서 그냥 상수처럼 얹힐 뿐 최저점을 옮기지 않는다.
  const cost = (o, dx, dy) => {
    let r = 0;
    for (const [ux, uy] of RING) r += lum(o.x + dx + ux * o.rx, o.y + dy + uy * o.ry);
    return r / RING.length;
  };

  // 줄 간격을 재서 찾는 범위를 정한다. 같은 열에서 세로로 이웃한 버블 사이 거리다.
  const pitch = rowPitchPx(bs);
  const R = Math.max(2, Math.round(pitch * SNAP_RATIO));

  const xs = bs.map((o) => o.mx), ys = bs.map((o) => o.my);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const LX = 6, LY = 6;
  const lat = [];
  for (let ly = 0; ly < LY; ly++) {
    lat.push([]);
    for (let lx = 0; lx < LX; lx++) {
      const mx = x0 + (x1 - x0) * (lx / (LX - 1)), my = y0 + (y1 - y0) * (ly / (LY - 1));
      const wx = (x1 - x0) / (LX - 1) * 1.2, wy = (y1 - y0) / (LY - 1) * 1.2;
      let pool = bs.filter((o) => Math.abs(o.mx - mx) <= wx && Math.abs(o.my - my) <= wy);
      if (pool.length < 30) { lat[ly].push({ dx: 0, dy: 0 }); continue; }
      if (pool.length > 120) { const step = Math.ceil(pool.length / 120); pool = pool.filter((_, k) => k % step === 0); }
      let best = null;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          let s = 0;
          for (const o of pool) s += cost(o, dx, dy);
          s /= pool.length;
          if (!best || s < best.s) best = { s, dx, dy };
        }
      }
      lat[ly].push({ dx: best.dx, dy: best.dy });
    }
  }
  return (mx, my) => {
    const fx = Math.max(0, Math.min(LX - 1.001, (mx - x0) / (x1 - x0) * (LX - 1)));
    const fy = Math.max(0, Math.min(LY - 1.001, (my - y0) / (y1 - y0) * (LY - 1)));
    const ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
    const A = lat[iy][ix], B = lat[iy][ix + 1], C = lat[iy + 1][ix], D = lat[iy + 1][ix + 1];
    return {
      dx: (A.dx * (1 - tx) + B.dx * tx) * (1 - ty) + (C.dx * (1 - tx) + D.dx * tx) * ty,
      dy: (A.dy * (1 - tx) + B.dy * tx) * (1 - ty) + (C.dy * (1 - tx) + D.dy * tx) * ty,
    };
  };
}

/**
 * corners: 사진 px 기준 {tl,tr,br,bl} — 표식의 중심.
 * geometry: sheetform.measureSheet() 결과.
 * 돌려주는 값: Map<버블 id, {v:"blank"|"black"|"red", ratio, x, y}>
 *   x,y 는 사진 위 좌표 — 판독 확인 그림을 그릴 때 쓴다.
 */
export function readBubbles(imageData, corners, geometry) {
  const { width: W, height: H, data } = imageData;

  // 귀퉁이로 대충 편 다음, 네 변의 눈금 표식으로 안쪽 밀림까지 잡는다.
  const rough = buildWarp(geometry, corners, null);
  const ticksPx = detectTicks(imageData, corners, geometry, rough.h);
  const railed = buildWarp(geometry, corners, ticksPx);
  // 인쇄된 동그라미로 마지막 미세 조정. 눈금으로 이미 가까이 와 있을 때만 한다 —
  // 멀리서 시작하면 옆 줄에 들러붙는다.
  const snap = railed.corrected ? ringSnap(imageData, railed, geometry) : null;
  const warp = snap
    ? { ...railed, at: (mx, my) => { const p = railed.at(mx, my), d = snap(mx, my); return { x: p.x + d.dx, y: p.y + d.dy }; } }
    : railed;

  const at = (x, y) => {
    const px = Math.round(x), py = Math.round(y);
    if (px < 0 || py < 0 || px >= W || py >= H) return null;
    const i = (py * W + px) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const lum = (c) => (c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000;

  // 1단계 — 버블마다 안쪽 밝기와 색을 잰다. 인쇄된 테두리에 닿지 않게 안쪽만 본다.
  // 버블 **가운데 쪽**만 본다. 반지름의 0.36 까지다.
  // 버블을 3.2→3.4mm 로 키웠더니 0.45 로는 표본이 인쇄된 테두리에 너무 가까워져서,
  // 종이가 조금만 밀려도 테두리를 마킹으로 착각하거나 마킹을 놓쳤다.
  // 사람들이 칠하는 모양은 칸을 꽉 채우는 덩어리라 가운데가 가장 확실하다.
  const R = 0.36, D = +(0.36 * 0.67).toFixed(3);
  const OFFSETS = [[0, 0], [-R, 0], [R, 0], [0, -R], [0, R],
                   [-D, -D], [D, D], [-D, D], [D, -D]];
  const cells = new Map();
  const items = geometry.bubbles.map((b) => {
    const px = [];
    for (const [dx, dy] of OFFSETS) {
      const p = warp.at(b.cx + dx * b.rx, b.cy + dy * b.ry);
      const c = at(p.x, p.y);
      if (c) px.push(c);
    }
    const center = warp.at(b.cx, b.cy);
    if (!px.length) return { b, L: null, rgb: null, x: center.x, y: center.y };
    const rgb = px.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map((v) => v / px.length);
    const item = { b, L: lum(rgb), rgb, x: center.x, y: center.y };
    // 코드 칸(k)과 이름 칸(r)은 인쇄할 때부터 칠해져 나온다. "빈 칸" 기준을 재는
    // 무리에 끼면 기준이 어두워지므로 빼 둔다.
    if (b.id[0] !== "k" && b.id[0] !== "r") {
      const key = `${Math.floor(b.cx / CELL_MM)},${Math.floor(b.cy / CELL_MM)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(item);
    }
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
  const ratios = items.filter((it) => it.L != null && it.b.id[0] !== "k" && it.b.id[0] !== "r").map((it) => it.ratio);
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
  out.ticksPx = ticksPx;
  out.corrected = warp.corrected;
  out.tickHits = warp.hits;
  out.tickTotal = warp.total;
  // 코드 칸은 답을 이미 안다 — 몇 개나 맞혔는지가 곧 판독기의 자기 채점표다.
  out.code = [];
  for (let i = 0; i < CODE_BITS; i++) {
    const r = out.get(`k:${i}`);
    out.code.push(r ? (r.v === "blank" ? 0 : 1) : null);
  }
  // 코드 칸의 앞 세 자리는 어느 기록지든 1,0,1 로 고정이다. 그게 안 나오면 이 종이에는
  // 코드 칸 자체가 없는 것이다(옛 양식) — "코드가 틀렸다"와 "코드가 없다"는 다른 말이고,
  // 사람에게 해 줄 안내도 다르다.
  out.hasCode = out.code[0] === 1 && out.code[1] === 0 && out.code[2] === 1;
  return out;
}

/**
 * 종이에 인쇄된 명단을 읽는다 — 줄마다 "로스터 몇 번째 사람인지".
 *
 * 이게 있어야 **누가 어느 기기에서 올리든** 이름이 나온다. 예전에는 기록지를 뽑은
 * 기기의 localStorage 에 적어 둔 메모에 기대고 있어서, 팀 편성을 한 사람과 사진을
 * 올리는 사람이 다르면 이름이 통째로 빈칸이었다. 동아리에서 그 둘이 같은 사람이라는
 * 보장은 전혀 없다.
 *
 * roster: 동아리 전체 명단 [{name, number}, ...] — 여기서 번호로 꺼내 쓴다.
 * 돌려주는 값: { rows: [{no,name}|null, ...], read, bad }
 *   read = 제대로 읽은 줄, bad = 홀짝 검사에 걸린 줄(판독이 어긋났다는 뜻)
 */
// 이름 칸 일곱 개를 **그 줄 안의 명암 차이만으로** 0/1 로 가른다.
//
// 왜 따로 가르나: 이 칸들은 사람이 칠하는 게 아니라 인쇄되어 나온다. 크기가
// 2.1×1.9mm 로 작아서 손으로 칠한 칸(어둡기 0.1~0.3)만큼 진하게 안 찍히고
// 0.45~0.75 쯤에 앉는다. 그런데 문턱값은 손마킹 기준으로 정해지므로(0.62~0.63)
// 인쇄된 칸 무리 한가운데를 갈라 버린다 — 실제로 조보규 줄이 0.64/0.53/0.54/0.47
// 이었는데 0.64 하나만 문턱을 넘겨 홀짝 검사에서 걸렸다.
//
// 그래서 일곱 개를 정렬해 가장 큰 틈에서 자른다. 틈이 뚜렷하지 않거나 어두운 쪽이
// 충분히 어둡지 않으면 포기하고 원래 문턱값으로 돌아간다 — 애매하면 안 읽는 게 낫다.
// 어차피 마지막에 홀짝 검사가 한 번 더 걸러 준다.
function rowBitsByContrast(ratios) {
  if (ratios.some((v) => v == null)) return null;
  const sorted = [...ratios].sort((a, b) => a - b);
  let gap = 0, cut = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > gap) { gap = sorted[i] - sorted[i - 1]; cut = i; }
  }
  const darkMax = sorted[cut - 1], lightMin = sorted[cut];
  if (gap < 0.3) return null;        // 틈이 좁다 — 전부 같은 색이거나 애매하다
  if (darkMax > 0.85) return null;   // "어두운" 쪽이 안 어둡다 — 잡음을 가른 것이다
  return ratios.map((v) => (v <= darkMax ? 1 : 0));
}

export function readSheetRoster(readings, roster) {
  const rows = [];
  let read = 0, bad = 0;
  for (let p = 0; p < PLAYER_ROWS; p++) {
    const bits = [], ratios = [];
    for (let i = 0; i < ROW_CODE_BITS; i++) {
      const r = readings.get(`r:${p}:${i}`);
      bits.push(r ? (r.v === "blank" ? 0 : 1) : null);
      ratios.push(r && r.ratio != null ? r.ratio : null);
    }
    if (bits.some((b) => b === null)) { rows.push(null); continue; }
    // 그 줄 안의 명암으로 먼저 풀어 보고, 홀짝 검사를 통과할 때만 그 답을 쓴다.
    const own = rowBitsByContrast(ratios);
    const idx = (own && rowCodeValue(own) !== null) ? rowCodeValue(own) : rowCodeValue(bits);
    if (idx === -1) { rows.push(null); continue; } // 빈 줄 — 실패가 아니다
    const who = idx === null ? null : roster?.[idx];
    if (!who) { rows.push(null); bad++; continue; }
    rows.push({ no: typeof who.number === "number" ? who.number : null, name: who.name });
    read++;
  }
  return { rows, read, bad };
}

/**
 * 사진에서 읽은 코드가 후보들 중 어느 기록지인지 가려낸다.
 * candidates: [{key, label, ...}] — key 는 sheetCodeBits() 에 넣을 문자열.
 * 돌려주는 값: { match, score, bits, expected } — score 는 맞은 비트 수(0~16).
 */
export function matchSheetCode(readings, candidates) {
  const bits = readings.code;
  if (!readings.hasCode || !bits) return { match: null, score: 0, bits: null };
  let best = null, bestScore = -1, second = -1;
  for (const c of candidates) {
    const want = sheetCodeBits(c.key);
    let score = 0;
    for (let i = 0; i < CODE_BITS; i++) if (bits[i] === want[i]) score++;
    if (score > bestScore) { second = bestScore; bestScore = score; best = c; }
    else if (score > second) second = score;
  }
  // 다 맞아야 인정한다. 한 칸이라도 어긋나면 다른 기록지일 수 있고, 이름이
  // 통째로 밀려 붙는 사고보다는 "모르겠다"가 낫다.
  const ok = bestScore === CODE_BITS && second < CODE_BITS;
  return { match: ok ? best : null, score: bestScore, bits, expected: best ? sheetCodeBits(best.key) : null };
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
  for (const k of ["tl", "tr", "br", "bl"]) {
    const c = corners[k];
    if (!c) continue;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 눈금 표식을 찾은 자리 — 하나도 안 보이면 옛 양식으로 인쇄한 종이다.
  if (readings.ticksPx) {
    ctx.strokeStyle = "#00d0ff";
    ctx.lineWidth = Math.max(2, imageData.width / 500);
    for (const side of ["l", "r", "t", "b"]) {
      for (const p of readings.ticksPx[side] || []) {
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  // 네 귀퉁이를 이어 종이 테두리가 맞는지 보여준다
  ctx.beginPath();
  ctx.moveTo(corners.tl.x, corners.tl.y);
  for (const k of ["tr", "br", "bl"]) ctx.lineTo(corners[k].x, corners[k].y);
  ctx.closePath();
  ctx.stroke();
  return cv;
}

// ── 판독을 믿어도 되는가 ─────────────────────────────────
//
// 판독이 어긋나면 숫자가 안 나오는 게 아니라 **그럴듯한 헛것**이 나온다. 마킹이
// 엉뚱한 줄로 몰려서 빈 줄에 67점이 찍히는 식이다. 조용히 보여주면 사람이
// 그걸 진짜로 믿고 엑셀에 넣는다. 그래서 대놓고 못 믿겠다고 말하게 한다.
//
// 기준은 실제 기록지에서 나온 것이다:
//   - 한 장에 칠하는 칸은 대략 60~350개
//   - 한 사람이 한 경기에 40점을 넘기는 일은 거의 없다
//   - 마킹이 한 줄에 몰리면 세로가 어긋난 것이다
//   - 기록이 있는데 출전 표시가 없는 줄이 많으면 왼쪽 끝이 어긋난 것이다
export function judgeReading(team, filled, readings, rosterRead) {
  const problems = [];
  const live = team.players.filter((p) =>
    p.quarters.length || p.p2a || p.p3a || p.fta || p.reb || p.ast || p.stl || p.blk || p.to || p.pf);

  // 아래 짐작들보다 훨씬 확실한 근거가 두 개 있다. 종이에 답을 미리 박아 둔 것들이라
  // 판독기가 스스로 채점할 수 있다.
  if (readings) {
    if (!readings.corrected) {
      problems.push(
        `네 변의 눈금 표식을 ${readings.tickHits}/${readings.tickTotal}개만 찾았습니다 — ` +
        "종이 안쪽이 밀린 채로 읽습니다. 팀 편성에서 기록지를 다시 인쇄해주세요.");
    }
    // 이름 칸은 **답을 아는 칸**이다 — 일곱 비트 중 하나가 홀짝 검사라, 잘못 읽으면
    // 판독기가 스스로 안다. 아래의 다른 검사들은 "이러면 수상하다"는 짐작이지만
    // 이건 측정이다. 걸린 줄 수만큼은 확실히 틀리게 읽고 있는 것이다.
    if (rosterRead && rosterRead.bad) {
      const many = rosterRead.bad >= 2;
      problems.push(
        `선수 이름 칸 ${rosterRead.bad}줄이 홀짝 검사에서 걸렸습니다 — ` +
        (many
          ? "판독 위치가 줄 단위로 어긋나 있습니다. 아래 숫자를 믿지 마세요."
          : "그 줄은 이름이 비어 있고 같은 줄의 숫자도 어긋났을 수 있습니다."));
    }
    // 홀짝 검사에 안 걸리는 어긋남이 하나 더 있다: 이름 칸을 **통째로 빗나가** 읽어
    // 일곱 칸이 다 비면 "예비 줄"과 구별이 안 된다. 하지만 예비 줄에는 기록이 없다.
    // 기록은 있는데 이름 칸이 비어 있는 줄은 빗나간 것이다.
    // (다른 줄이 하나라도 읽혔을 때만 따진다 — 이름 칸이 아예 없는 옛 양식 제외.)
    if (rosterRead && rosterRead.read > 0) {
      const ghost = team.players.filter((p, i) =>
        !rosterRead.rows[i] &&
        (p.quarters.length || p.p2a || p.p3a || p.fta || p.reb || p.ast || p.stl || p.blk || p.to || p.pf)
      ).length;
      if (ghost) {
        problems.push(
          `기록은 있는데 이름 칸이 비어 나온 줄이 ${ghost}줄 있습니다 — ` +
          "그 줄은 판독 위치가 빗나갔습니다. 이름과 숫자를 종이와 맞춰 보세요.");
      }
    }
    if (readings.hasCode) {
      // 코드 칸은 답을 아는 칸이다. 여기서 틀리면 다른 칸도 같은 만큼 틀리고 있다.
      const fixed = readings.code.slice(0, 3).join(",");
      if (fixed !== "1,0,1") problems.push("기록지 코드 칸을 잘못 읽었습니다 — 판독 위치가 어긋났습니다.");
    }
  }

  if (filled < 20) {
    problems.push("칠해진 칸이 너무 적습니다 — 종이를 못 찾았거나 마킹이 흐립니다.");
  }
  if (filled > 420) {
    problems.push(`칠해진 칸이 ${filled}개로 너무 많습니다 — 빈 칸까지 칠한 걸로 읽고 있습니다.`);
  }

  const pts = (p) => p.p2m * 2 + p.p3m * 3 + p.ftm;
  const top = Math.max(0, ...team.players.map(pts));
  if (top > 40) {
    problems.push(`한 줄에 ${top}점이 몰렸습니다 — 여러 줄의 마킹이 한 줄로 쏠린 것으로 보입니다.`);
  }

  const attempts = team.players.map((p) => p.p2a + p.p3a + p.fta);
  const totalAtt = attempts.reduce((a, b) => a + b, 0);
  const maxAtt = Math.max(0, ...attempts);
  if (totalAtt > 0 && maxAtt / totalAtt > 0.55 && live.length > 2) {
    problems.push("슛 기록이 한 줄에 쏠려 있습니다 — 세로 위치가 어긋났을 수 있습니다.");
  }

  const noQuarter = live.filter((p) => !p.quarters.length).length;
  if (live.length >= 3 && noQuarter >= live.length - 1) {
    problems.push("기록은 있는데 출전 표시가 거의 없습니다 — 왼쪽 끝이 어긋났을 수 있습니다.");
  }

  return { ok: problems.length === 0, problems };
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
    if (id[0] === "k" || id[0] === "r") continue; // 코드·이름 칸은 기록이 아니다
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
