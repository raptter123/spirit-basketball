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

/* 가운데 위·아래 표식. 종이를 반으로 접었다 펴면 접힌 선을 경계로 좌우가 서로 다른
   면이 되어, 네 귀퉁이만으로 편 좌표가 가운데에서 몇 mm씩 어긋난다. 이 두 개가 있으면
   접힌 선을 경계로 왼쪽·오른쪽을 따로 펼 수 있다. 실제로 접어 온 기록지 때문에 넣었다.
   여백 안에 들어가야 해서 귀퉁이보다 작다. */
.sheet .fid.tm,.sheet .fid.bm{width:5mm;height:5mm;left:50%;margin-left:-2.5mm}
.sheet .fid.tm{top:0.6mm}.sheet .fid.bm{bottom:0.6mm}

.sheet .head{display:flex;gap:3mm;align-items:stretch}
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

.sheet .foot{display:flex;justify-content:space-between;align-items:center;font-size:2.4mm;color:var(--ink-2);gap:4mm;white-space:nowrap}
.sheet .foot b{color:var(--ink)}
.sheet .sw{display:flex;gap:0.8mm;align-items:center}
.sheet .sw i{width:4.2mm;height:4.2mm;display:block;border:0.25mm solid #000}
.sheet .sw span{font-size:2.2mm;white-space:nowrap;color:var(--ink-2);margin-right:0.5mm}
.sheet .code{letter-spacing:.06em}
`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

  const body = rows.map(([no, name], p) => `<div class="gr prow" style="grid-template-columns:${COLS}">
    <div class="cname${no === null && !name ? " blank" : ""}">
      <span class="no">${no === null ? "&nbsp;" : "#" + no}</span><span class="nm">${esc(name) || "(예비)"}</span>
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
    <div class="fid tm"></div><div class="fid bm"></div>

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
      <span><b>홀수 쿼터는 검정, 짝수 쿼터는 빨강.</b> 뛴 쿼터는 <b>출전</b>에 표시.
        <b>시도마다 칸 하나</b> — <b>넣으면 위 · 놓치면 아래</b>. 칸이 모자라면 <b>비고</b>에 적어주세요.</span>
      <span class="sw"><span>색 기준</span>
        <i style="background:#fff"></i><i style="background:#111"></i><i style="background:#cf2b20"></i></span>
      <span class="code">${esc(code)}</span>
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
  for (const key of ["tl", "tr", "bl", "br", "tm", "bm"]) {
    const el = sheetEl.querySelector(`.fid.${key}`);
    if (el) fiducials[key] = toMm(el.getBoundingClientRect());
  }

  const bubbles = [];
  sheetEl.querySelectorAll("[data-bub]").forEach((el) => {
    bubbles.push({ id: el.dataset.bub, ...toMm(el.getBoundingClientRect()) });
  });

  return { page: { ...SHEET_MM }, fiducials, bubbles };
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
