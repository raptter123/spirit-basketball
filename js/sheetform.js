// 종이 기록지 한 장. 인쇄용 HTML 을 만들고, 그 위 버블들이 종이의 몇 mm 자리에
// 있는지 재어 준다.
//
// 왜 한 파일에 두 가지를 같이 두나
//   인쇄한 종이와 사진 판독기가 **같은 좌표**를 봐야 한다. 좌표를 손으로 따로 적어
//   두면 양식을 한 번 손볼 때마다 판독이 조용히 어긋난다. 그래서 인쇄도 여기서
//   만들고, 판독기가 쓸 좌표도 여기서 그 결과를 그대로 재서 낸다 — 두 숫자가
//   달라질 방법이 없다.
//
// 종이 규격: A4 가로 297 × 210mm.
// 색 규칙: 검정 = 홀수 쿼터(1·3), 빨강 = 짝수 쿼터(2·4).
// 줄 규칙: 위 두 줄 = 전반, 아래 두 줄 = 후반. 각 반기 안에서 위 = 넣음, 아래 = 놓침.

export const SHEET_MM = { w: 297, h: 210 };

// 반기당 칸 수 — 경기 최대치(2점 24 / 3점 15 / 자유투 14)를 전·후반으로 나눠 여유 있게.
export const SHOT = { p2: 12, p3: 8, ft: 10 };

// 카운트 스탯은 경기 전체. [가로, 세로]
// 리바운드 24는 한 경기 최다 관측치(18)에 여유를 둔 값이다.
export const CNT = { reb: [6, 4], ast: [3, 4], stl: [2, 4], blk: [2, 4], to: [2, 4], pf: [2, 4] };

export const PLAYER_ROWS = 9;

// 열 폭(mm). 합계 280.0 — 종이 297에서 좌우 여백 8mm씩 뺀 281 안에 들어간다.
const COLS = "22mm 9mm 9mm 9mm 53.0mm 35.7mm 44.8mm 25.1mm 13.4mm 9.5mm 9.5mm 9.5mm 9.5mm 21mm";

export const SHEET_CSS = `
.sheet{position:relative;width:297mm;height:210mm;background:#fff;padding:6mm 8mm;
       -webkit-print-color-adjust:exact;print-color-adjust:exact;
       display:flex;flex-direction:column;gap:2mm;box-sizing:border-box;
       font-family:"IBM Plex Sans KR","Malgun Gothic",sans-serif;color:#111726;
       --line:#9aa2b4;--line-2:#c9cfdb;--hdbg:#1f2a52;--ink:#111726;--ink-2:#5a6377;
       --bub:#828a9d;--blk:#111111;--red:#cf2b20;--h1:#ffffff;--h2:#edf3fa}
.sheet *{box-sizing:border-box;margin:0}

/* 네 귀퉁이 표식. 판독기가 이걸로 종이의 기울기와 원근을 바로잡는다.
   오른쪽 아래만 동그라미인 이유는 위아래가 뒤집혀 찍혀도 알아보기 위해서다. */
.sheet .fid{position:absolute;width:6mm;height:6mm;background:#000}
.sheet .fid.tl{left:2.5mm;top:2.5mm}.sheet .fid.tr{right:2.5mm;top:2.5mm}
.sheet .fid.bl{left:2.5mm;bottom:2.5mm}.sheet .fid.br{right:2.5mm;bottom:2.5mm;border-radius:50%}

/* 눈금 표식(timing mark). 네 변을 따라 촘촘히 박아 둔 작은 검은 사각형이다.
   귀퉁이 네 개만으로는 종이 **가장자리**만 잡힌다. 실제 사진에서는 종이가 살짝
   말리고, 휴대폰 렌즈가 가장자리를 휘고, 인쇄 배율도 딱 맞지 않아서 종이 **안쪽**이
   1~2mm 씩 밀린다. 버블 반지름이 1.3mm 이니 그만큼이면 옆 줄을 읽는다.
   실제로 찍어 온 사진을 재 보니 안쪽에서 세로로 최대 13px(약 1.8mm) 밀려 있었다.
   그래서 네 변 전체에 표식을 두고 가장자리 곡선을 통째로 잡는다. */
.sheet .tick{position:absolute;background:#000;width:3.4mm;height:3.4mm}
.sheet .tick.l{left:2.8mm}.sheet .tick.r{right:2.8mm}
.sheet .tick.t{top:1.3mm}.sheet .tick.b{bottom:1.3mm}

/* 기록지 식별 코드. 사람이 읽는 글자 옆에 기계가 읽는 버블로도 같이 찍는다.
   1) 이 사진이 어느 기록지인지 확인해 선수 이름을 안전하게 채우고
   2) 답을 이미 아는 칸이라 판독기가 스스로 채점할 수 있다. */
.sheet .cbits{left:158mm;display:flex;gap:0.7mm;align-items:center}
.sheet .cbits .b{width:2.9mm;height:2.5mm;border-color:#111}
.sheet .cbits .b.on{background:#111;border-color:#111}

/* 머리글과 꼬리글은 **높이를 못 박는다**. 이 둘이 내용 길이에 따라 조금이라도 커지면
   가운데 표(.grid 는 flex:1)가 그만큼 밀려서, 판독기가 재어 둔 좌표와 실제 인쇄물이
   어긋난다. 실제로 어긋났었다 — 빈 기록지로 잰 좌표와 이름이 든 기록지가 세로로
   0.21mm 달랐고, 꼬리글은 글자 길이 때문에 가로로 13.5mm 나 밀렸다. */
.sheet .head{display:flex;gap:3mm;align-items:stretch;height:20mm;flex:0 0 auto}
.sheet .title{display:flex;flex-direction:column;justify-content:center;gap:0.6mm;
       padding-right:3mm;border-right:0.4mm solid var(--line)}
.sheet .title b{font-size:5.4mm;font-weight:900;line-height:1}
.sheet .title span{font-size:2.2mm;color:var(--ink-2);letter-spacing:.08em}
.sheet .meta{display:flex;gap:2mm;align-items:center}
.sheet .mi{display:flex;flex-direction:column;gap:0.6mm}
.sheet .mi label{font-size:2.2mm;color:var(--ink-2);font-weight:600}
.sheet .mi .box{border:0.4mm solid var(--line);border-radius:1mm;padding:1mm 2mm;background:#eef1f8;
         font-size:3mm;font-weight:700;min-width:19mm;text-align:center}

.sheet .key{border:0.5mm solid var(--hdbg);border-radius:1.2mm;overflow:hidden;align-self:center}
.sheet .key table{border-collapse:collapse}
.sheet .key th,.sheet .key td{border:0.3mm solid var(--line-2);padding:1mm 2.4mm;font-size:2.5mm;text-align:center}
.sheet .key thead th{background:var(--hdbg);color:#fff;font-size:2.4mm;font-weight:600}
.sheet .key td.rl{background:#eef1f8;font-weight:700;text-align:left}
.sheet .key td b{font-size:2.9mm;font-weight:700}
.sheet .key .dot{display:inline-block;width:2.6mm;height:2.6mm;border-radius:50%;vertical-align:-0.3mm;margin-right:1mm}

.sheet .qs{margin-left:auto;border:0.4mm solid var(--line);border-radius:1mm;overflow:hidden;align-self:center}
.sheet .qs table{border-collapse:collapse}
.sheet .qs td,.sheet .qs th{border:0.3mm solid var(--line-2);padding:0.7mm 1.8mm;font-size:2.4mm;text-align:center}
.sheet .qs th{background:var(--hdbg);color:#fff;font-weight:600;font-size:2.2mm}
.sheet .qs td.tm{background:#eef1f8;font-weight:700;text-align:left;min-width:12mm}
.sheet .qs td.in{min-width:9mm;height:5mm}
.sheet .qs caption{caption-side:top;font-size:2.1mm;color:var(--ink-2);padding:0.6mm 0 0.6mm 1mm;text-align:left}

.sheet .grid{border:0.5mm solid var(--line);border-radius:1mm;overflow:hidden;display:flex;flex-direction:column;flex:1}
.sheet .gr{display:grid;align-items:stretch}
.sheet .gr>div{border-right:0.3mm solid var(--line-2)}
.sheet .gr>div:last-child{border-right:0}
.sheet .ghead{background:var(--hdbg);color:#fff}
.sheet .ghead>div{font-size:2.6mm;font-weight:600;padding:1.1mm 0;text-align:center;
           border-right-color:rgba(255,255,255,.3);display:flex;flex-direction:column;justify-content:center;gap:0.3mm}
.sheet .ghead .k{font-size:2mm;opacity:.7;font-weight:400}
.sheet .prow{border-top:0.4mm solid var(--line);flex:1}

.sheet .cname{display:flex;flex-direction:column;justify-content:center;gap:0.4mm;padding:0 2mm}
.sheet .cname .no{font-size:2.3mm;color:var(--ink-2);font-weight:700}
.sheet .cname .nm{font-size:3.4mm;font-weight:700;letter-spacing:-0.02em}
.sheet .cname.blank .nm{color:#c3c8d4}

/* 이름 아래 작은 버블 일곱 개 — 이 사람이 로스터 몇 번째인지. 사람이 칠하는 게 아니라
   인쇄할 때부터 정해져 나온다. 이름 칸이 22mm(안쪽 18mm)라 크기를 줄여 넣는다. */
.sheet .rbits{display:flex;gap:0.3mm;align-items:center;margin-top:0.5mm}
.sheet .rbits .b{width:2.1mm;height:1.9mm;border-color:#7d8496}
.sheet .rbits .b.on{background:#111;border-color:#111}

.sheet .qplay{display:flex;flex-direction:column}
.sheet .qplay>span{flex:1;display:flex;align-items:center;justify-content:center;gap:0.6mm;
            font-size:2.1mm;font-weight:700;color:#4d5870}
.sheet .qplay>span:nth-child(1),.sheet .qplay>span:nth-child(2){background:var(--h1)}
.sheet .qplay>span:nth-child(2){border-bottom:0.4mm solid var(--line)}
.sheet .qplay>span:nth-child(3),.sheet .qplay>span:nth-child(4){background:var(--h2)}
.sheet .qplay .b{width:3mm;flex:0 0 auto}

.sheet .hcol{display:flex;flex-direction:column}
.sheet .hcol span{flex:1;display:flex;align-items:center;justify-content:center;
           font-size:2.6mm;font-weight:700;color:#4d5870}
.sheet .hcol span:nth-child(1){background:var(--h1);border-bottom:0.4mm solid var(--line)}
.sheet .hcol span:nth-child(2){background:var(--h2)}

.sheet .slcol{display:flex;flex-direction:column}
.sheet .slcol span{flex:1;display:flex;align-items:center;justify-content:center;
            font-size:2.3mm;font-weight:700;color:#4d5870;white-space:nowrap}
.sheet .slcol span:nth-child(1),.sheet .slcol span:nth-child(2){background:var(--h1)}
.sheet .slcol span:nth-child(2){border-bottom:0.4mm solid var(--line)}
.sheet .slcol span:nth-child(3),.sheet .slcol span:nth-child(4){background:var(--h2)}

/* 한 시도가 세로 한 쌍(넣음/놓침). 칸막이 선 대신 옅은 캡슐 배경으로 한 세트임을 보여준다. */
.sheet .shot{display:flex;flex-direction:column}
.sheet .half{flex:1;display:flex;align-items:center;gap:0.4mm;padding:0.6mm 1.2mm}
.sheet .half:nth-child(1){background:var(--h1);border-bottom:0.4mm solid var(--line)}
.sheet .half:nth-child(2){background:var(--h2)}
.sheet .att{display:flex;flex-direction:column;gap:0.9mm;padding:0.45mm 0.25mm;
     border-radius:1.6mm;background:rgba(31,42,82,0.055)}
.sheet .att:nth-child(5n){margin-right:0.9mm}

.sheet .memo{display:flex;flex-direction:column;justify-content:space-evenly;
      padding:1.4mm 1.6mm;background:#fffdf5}
.sheet .memo i{display:block;border-bottom:0.25mm dashed #c9bfa0;height:0}
.sheet .cnt{display:flex;flex-direction:column;justify-content:center;gap:1mm;padding:1mm 1.2mm;background:#fafcfe}
.sheet .cline{display:flex;gap:0.7mm;justify-content:center}

.sheet .b{width:3.2mm;height:2.6mm;border-radius:50%;border:0.28mm solid var(--bub);flex:0 0 auto}

/* 꼬리글 — 안의 것들을 자리마다 못 박아 둔다. 예전처럼 space-between 으로 흘려 두면
   글자 수가 바뀔 때마다 코드 버블이 좌우로 옮겨 다닌다. */
.sheet .foot{position:relative;height:6.4mm;flex:0 0 auto;font-size:2.4mm;color:var(--ink-2)}
.sheet .foot>*{position:absolute;top:50%;transform:translateY(-50%)}
.sheet .foot b{color:var(--ink)}
.sheet .foot .tip{left:0;width:124mm;white-space:normal;line-height:1.3;font-size:2.1mm}
.sheet .sw{left:127mm;display:flex;gap:0.8mm;align-items:center}
.sheet .sw i{width:3.6mm;height:3.6mm;display:block;border:0.25mm solid #000}
.sheet .sw span{font-size:2.1mm;white-space:nowrap;color:var(--ink-2);margin-right:0.5mm}
.sheet .code{right:0;letter-spacing:.06em;white-space:nowrap;font-size:2.2mm}
`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── 눈금 표식 자리 ───────────────────────────────────────
// 값은 종이 폭·높이에 대한 비율. 귀퉁이 표식(2.5~8.5mm)과 겹치지 않게 안쪽으로 뺀다.
// 가로로 9개, 세로로 10개 — 재 보니 밀림은 20~30mm 폭으로 완만하게 변해서
// 이 정도 간격이면 사이를 직선으로 이어도 충분하다.
export const TICKS = {
  x: [0.12, 0.215, 0.31, 0.405, 0.5, 0.595, 0.69, 0.785, 0.88],
  y: [0.10, 0.192, 0.283, 0.375, 0.466, 0.558, 0.649, 0.741, 0.832, 0.92],
};

function tickHTML() {
  const half = 1.7; // 표식 한 변의 절반(mm) — 가운데를 비율 자리에 맞춘다
  let s = "";
  TICKS.y.forEach((f, i) => {
    const top = (SHEET_MM.h * f - half).toFixed(2);
    s += `<i class="tick l ly${i}" style="top:${top}mm"></i><i class="tick r ry${i}" style="top:${top}mm"></i>`;
  });
  TICKS.x.forEach((f, i) => {
    const left = (SHEET_MM.w * f - half).toFixed(2);
    s += `<i class="tick t tx${i}" style="left:${left}mm"></i><i class="tick b bx${i}" style="left:${left}mm"></i>`;
  });
  return s;
}

// ── 종이가 자기 명단을 들고 다닌다 ───────────────────────
//
// 선수 이름은 인쇄된 글자라 판독기가 못 읽는다. 그래서 뽑을 때 명단을 적어 두고
// 나중에 줄 번호로 되살렸는데 — 그 메모는 **인쇄한 그 기기의 localStorage** 에만 있다.
// 팀 편성을 한 사람과 사진을 올리는 사람이 다르면 이름이 통째로 빈칸이 된다.
// 동아리에서 그 둘이 같은 사람이라는 보장이 전혀 없다.
//
// 그래서 이름을 **종이에 같이 찍는다**. 선수 이름 칸마다 작은 버블 일곱 개로
// 그 사람이 로스터 몇 번째인지 적어 둔다(6비트 + 홀짝 검사 1비트).
// 이러면 누가 어느 기기에서 올리든 종이만 보고 이름이 나온다.
export const ROW_CODE_BITS = 7;

// 로스터 번호에 1을 더해 담는다. 그래야 **0 = 빈 줄**이 되어, 안 쓰는 줄에는 아무것도
// 안 찍힌다(잉크도 덜 들고 종이도 덜 지저분하다). 6비트라 62번 선수까지 들어간다.
const ROW_MAX = 62;

/** 로스터 번호 → 버블 일곱 개. 앞 6개가 번호(작은 자리부터), 마지막이 홀짝 검사. */
export function rowCodeBits(index) {
  const v = Number.isInteger(index) && index >= 0 && index <= ROW_MAX ? index + 1 : 0;
  const bits = [];
  for (let i = 0; i < 6; i++) bits.push((v >> i) & 1);
  bits.push(bits.reduce((a, b) => a ^ b, 0)); // 짝수 홀짝 — 한 칸 잘못 읽으면 걸린다
  return bits;
}

/**
 * 버블 일곱 개 → 로스터 번호.
 *   null  홀짝이 안 맞는다 = 잘못 읽었다
 *   -1    빈 줄 (또는 이름 칸이 없는 옛 양식)
 *   0 이상 로스터 번호
 * "잘못 읽었다"와 "빈 줄"은 전혀 다른 말이라 섞으면 안 된다 — 빈 줄을 판독 실패로
 * 세면 멀쩡한 기록지가 실패로 보인다.
 */
export function rowCodeValue(bits) {
  if (!bits || bits.length !== ROW_CODE_BITS || bits.some((b) => b !== 0 && b !== 1)) return null;
  if (bits.slice(0, 6).reduce((a, b) => a ^ b, 0) !== bits[6]) return null;
  let v = 0;
  for (let i = 0; i < 6; i++) v |= bits[i] << i;
  return v === 0 ? -1 : v - 1;
}

// ── 기계가 읽는 기록지 코드 ──────────────────────────────
export const CODE_BITS = 16;

/** 기록지를 가리키는 16비트. 날짜·경기·팀 이름이 같으면 같은 값이 나온다. */
export function sheetCodeBits(key) {
  // FNV-1a — 짧고 치우침이 적다. 암호용이 아니라 서로 구분만 되면 된다.
  let hz = 0x811c9dc5;
  for (const ch of String(key)) {
    hz ^= ch.codePointAt(0);
    hz = Math.imul(hz, 0x01000193) >>> 0;
  }
  // 앞 세 자리는 늘 1,0,1 로 고정한다 — 판독기가 검정/빈칸 기준을 잡는 데 쓴다.
  const bits = [1, 0, 1];
  for (let i = 0; i < CODE_BITS - 3; i++) bits.push((hz >>> i) & 1);
  return bits;
}

/** 사람이 읽는 코드 문자열. 종이 오른쪽 아래에 같이 찍는다. */
export function sheetCodeText(key) {
  return "SPIRIT · " + String(key ?? "").replace("|", " · ");
}

// 버블 하나. id 는 판독 결과를 어느 기록에 넣을지 정하는 열쇠라 반드시 붙인다.
const bub = (id, extra = "") => `<span class="b${extra}" data-bub="${id}"></span>`;

// 슛 칸: 전반/후반 두 줄, 각 줄에 시도 n개. 시도 하나 = 캡슐 하나(위 넣음 / 아래 놓침).
function shotCell(p, key, n) {
  let s = `<div class="shot">`;
  for (const half of [1, 2]) {
    s += `<div class="half">`;
    for (let i = 0; i < n; i++) {
      s += `<span class="att">${bub(`s:${p}:${key}:${half}:${i}:m`)}${bub(`s:${p}:${key}:${half}:${i}:x`)}</span>`;
    }
    s += `</div>`;
  }
  return s + `</div>`;
}

// 카운트 칸: 경기 전체 한 덩어리. 색으로 쿼터를 남긴다.
function cntCell(p, key) {
  const [w, h] = CNT[key];
  let s = `<div class="cnt">`, k = 0;
  for (let r = 0; r < h; r++) {
    s += `<div class="cline">`;
    for (let c = 0; c < w; c++, k++) s += bub(`c:${p}:${key}:${k}`);
    s += `</div>`;
  }
  return s + `</div>`;
}

/**
 * 기록지 한 장의 HTML.
 * roster: [[등번호|null, 이름], ...] — 모자라면 빈 줄로 채운다.
 */
export function sheetHTML({ date = "", gameNo = 1, us = "", them = "", roster = [], code = "" } = {}) {
  const bits = sheetCodeBits(code);
  const rows = [...roster];
  while (rows.length < PLAYER_ROWS) rows.push([null, ""]);
  rows.length = PLAYER_ROWS;

  const head = `<div class="gr ghead" style="grid-template-columns:${COLS}">
    <div>선수</div><div>출전<span class="k">쿼터</span></div><div>전반<span class="k">후반</span></div><div>넣음<span class="k">놓침</span></div>
    <div>2점</div><div>3점</div><div>자유투</div>
    <div>리바운드<span class="k">경기 전체</span></div>
    <div>어시스트<span class="k">경기 전체</span></div>
    <div>스틸<span class="k">전체</span></div><div>블락<span class="k">전체</span></div>
    <div>턴오버<span class="k">전체</span></div><div>파울<span class="k">전체</span></div>
    <div>비고<span class="k">칸 모자랄 때</span></div>
  </div>`;

  const body = rows.map(([no, name, idx], p) => `<div class="gr prow" style="grid-template-columns:${COLS}">
    <div class="cname${no === null && !name ? " blank" : ""}">
      <span class="no">${no === null ? "&nbsp;" : "#" + no}</span><span class="nm">${esc(name) || "(예비)"}</span>
      <span class="rbits">${rowCodeBits(name ? idx : null).map((v, i) =>
        `<span class="b${v ? " on" : ""}" data-bub="r:${p}:${i}"></span>`).join("")}</span>
    </div>
    <div class="qplay">${[1, 2, 3, 4].map((q) => `<span>${q}${bub(`q:${p}:${q}`)}</span>`).join("")}</div>
    <div class="hcol"><span>전반</span><span>후반</span></div>
    <div class="slcol"><span>넣음</span><span>놓침</span><span>넣음</span><span>놓침</span></div>
    ${shotCell(p, "p2", SHOT.p2)}${shotCell(p, "p3", SHOT.p3)}${shotCell(p, "ft", SHOT.ft)}
    ${cntCell(p, "reb")}${cntCell(p, "ast")}${cntCell(p, "stl")}
    ${cntCell(p, "blk")}${cntCell(p, "to")}${cntCell(p, "pf")}
    <div class="memo"><i></i><i></i><i></i></div>
  </div>`).join("");

  return `<div class="sheet">
    <div class="fid tl"></div><div class="fid tr"></div><div class="fid bl"></div><div class="fid br"></div>
    ${tickHTML()}

    <div class="head">
      <div class="title"><b>혼 SPIRIT</b><span>STAT SHEET</span></div>
      <div class="meta">
        <div class="mi"><label>날짜</label><div class="box">${esc(date)}</div></div>
        <div class="mi"><label>경기</label><div class="box">${esc(gameNo)}경기</div></div>
        <div class="mi"><label>우리 팀</label><div class="box">${esc(us)}</div></div>
        <div class="mi"><label>상대</label><div class="box">${esc(them)}</div></div>
      </div>
      <div class="key"><table>
        <thead><tr><th></th>
          <th><span class="dot" style="background:#111111"></span>검정</th>
          <th><span class="dot" style="background:#cf2b20"></span>빨강</th></tr></thead>
        <tr><td class="rl">위 칸 · 전반</td><td><b>1쿼터</b></td><td><b>2쿼터</b></td></tr>
        <tr><td class="rl">아래 칸 · 후반</td><td><b>3쿼터</b></td><td><b>4쿼터</b></td></tr>
      </table></div>
      <div class="qs"><table>
        <caption>쿼터 점수 — 그때까지의 <b>누적</b> 점수</caption>
        <tr><th>팀</th><th>1Q</th><th>2Q</th><th>3Q</th><th>4Q</th></tr>
        <tr><td class="tm">${esc(us)}</td><td class="in"></td><td class="in"></td><td class="in"></td><td class="in"></td></tr>
        <tr><td class="tm">${esc(them)}</td><td class="in"></td><td class="in"></td><td class="in"></td><td class="in"></td></tr>
      </table></div>
    </div>

    <div class="grid">${head}${body}</div>

    <div class="foot">
      <span class="tip"><b>홀수 쿼터는 검정, 짝수 쿼터는 빨강.</b> 뛴 쿼터는 <b>출전</b>에 표시.
        <b>시도마다 칸 하나</b> — <b>넣으면 위 · 놓치면 아래</b>.</span>
      <span class="sw"><span>색 기준</span>
        <i style="background:#fff"></i><i style="background:#111"></i><i style="background:#cf2b20"></i></span>
      <span class="cbits">${bits.map((v, i) =>
        `<span class="b${v ? " on" : ""}" data-bub="k:${i}"></span>`).join("")}</span>
      <span class="code">${esc(sheetCodeText(code))}</span>
    </div>
  </div>`;
}

/**
 * 그려진 기록지에서 좌표를 재어 낸다. 단위는 mm, 원점은 종이 왼쪽 위.
 * 브라우저가 배치한 결과를 그대로 재기 때문에, 인쇄물과 어긋날 수가 없다.
 *
 * sheetEl: sheetHTML() 로 만든 .sheet 요소 (화면에 붙어 있어야 잰다)
 */
export function measureSheet(sheetEl) {
  const box = sheetEl.getBoundingClientRect();
  // 1mm 가 화면에서 몇 px 인지 — 종이 폭이 297mm 인 걸 알고 있으니 거기서 낸다.
  const perMm = box.width / SHEET_MM.w;
  const toMm = (r) => ({
    cx: (r.left + r.width / 2 - box.left) / perMm,
    cy: (r.top + r.height / 2 - box.top) / perMm,
    rx: r.width / 2 / perMm,
    ry: r.height / 2 / perMm,
  });

  const fiducials = {};
  for (const key of ["tl", "tr", "bl", "br"]) {
    const el = sheetEl.querySelector(`.fid.${key}`);
    if (el) fiducials[key] = toMm(el.getBoundingClientRect());
  }

  // 눈금 표식도 같은 방식으로 잰다. 판독기는 이 자리를 사진에서 찾아
  // 종이 네 변의 실제 곡선을 잡는다.
  const ticks = { l: [], r: [], t: [], b: [] };
  for (const side of ["l", "r", "t", "b"]) {
    const n = side === "l" || side === "r" ? TICKS.y.length : TICKS.x.length;
    const prefix = side === "l" ? "ly" : side === "r" ? "ry" : side === "t" ? "tx" : "bx";
    for (let i = 0; i < n; i++) {
      const el = sheetEl.querySelector(`.tick.${prefix}${i}`);
      ticks[side].push(el ? toMm(el.getBoundingClientRect()) : null);
    }
  }

  const bubbles = [];
  sheetEl.querySelectorAll("[data-bub]").forEach((el) => {
    bubbles.push({ id: el.dataset.bub, ...toMm(el.getBoundingClientRect()) });
  });

  return { page: { ...SHEET_MM }, fiducials, ticks, bubbles };
}

// 버블 id 를 다시 뜯어 읽는다. 판독 결과를 기록으로 옮길 때 쓴다.
//   q:<선수>:<쿼터>                    출전
//   s:<선수>:<p2|p3|ft>:<반기>:<번째>:<m|x>  슛 (m=넣음, x=놓침)
//   c:<선수>:<reb|ast|…>:<번째>          카운트
export function parseBubbleId(id) {
  const t = id.split(":");
  if (t[0] === "q") return { kind: "quarter", player: +t[1], quarter: +t[2] };
  if (t[0] === "s") return { kind: "shot", player: +t[1], stat: t[2], half: +t[3], attempt: +t[4], made: t[5] === "m" };
  if (t[0] === "c") return { kind: "count", player: +t[1], stat: t[2], index: +t[3] };
  return null;
}
