// 엑셀(.xlsx) 파일을 브라우저에서 직접 읽고 고치는 작은 도구. 외부 라이브러리를 쓰지 않는다.
//
// 왜 직접 만들었나
//   흔히 쓰는 브라우저용 엑셀 라이브러리(SheetJS 등)는 파일을 "읽어서 다시 쓴다".
//   그러면 셀 서식·열 너비·틀 고정 같은 게 통째로 날아간다. 우리 팀 누적 엑셀은
//   2024년부터 쌓아온 파일이라 그걸 잃으면 안 된다.
//   그래서 이 파일은 다시 쓰지 않고 **덧댄다**: xlsx는 결국 zip이므로, 압축된 파일
//   하나하나를 원본 바이트 그대로 옮기고 시트 XML 한 개만 고쳐 넣는다.
//   건드리지 않은 부분은 바이트가 같으니 서식도 그대로 남는다.
//
// 브라우저 요구사항: DecompressionStream/CompressionStream("deflate-raw").
//   크롬 80+, 사파리 16.4+, 파이어폭스 113+. 안 되면 openWorkbook이 바로 알려준다.

// ── CRC32 ────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipSupported() {
  return typeof DecompressionStream === "function" && typeof CompressionStream === "function";
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ── zip 읽기 ─────────────────────────────────────────────
// 중앙 디렉터리만 믿는다. 로컬 헤더는 데이터 시작 위치를 찾는 데만 쓴다
// (스트리밍으로 만든 zip은 로컬 헤더의 크기 칸이 0일 수 있다).
function parseZip(buffer) {
  const dv = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  let eocd = -1;
  const floor = Math.max(0, u8.length - 22 - 0xffff);
  for (let i = u8.length - 22; i >= floor; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("엑셀 파일로 보이지 않습니다 (zip 구조를 찾지 못했어요).");

  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  if (off === 0xffffffff || count === 0xffff) {
    throw new Error("이 엑셀 파일은 zip64 형식이라 여기서 다루지 못합니다.");
  }

  const dec = new TextDecoder();
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("zip 목차가 손상됐습니다.");
    const method = dv.getUint16(off + 10, true);
    const time = dv.getUint16(off + 12, true);
    const date = dv.getUint16(off + 14, true);
    const crc = dv.getUint32(off + 16, true);
    const csize = dv.getUint32(off + 20, true);
    const usize = dv.getUint32(off + 24, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));

    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;

    entries.push({
      name, method, crc, usize, time, date,
      cdata: u8.subarray(dataStart, dataStart + csize),
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ── zip 쓰기 ─────────────────────────────────────────────
function buildZip(entries) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const local = new Uint8Array(30 + nameBytes.length);
    const ldv = new DataView(local.buffer);
    ldv.setUint32(0, 0x04034b50, true);
    ldv.setUint16(4, 20, true);   // version needed
    ldv.setUint16(6, 0, true);    // flags — 데이터 서술자 없이 쓴다
    ldv.setUint16(8, e.method, true);
    ldv.setUint16(10, e.time, true);
    ldv.setUint16(12, e.date, true);
    ldv.setUint32(14, e.crc, true);
    ldv.setUint32(18, e.cdata.length, true);
    ldv.setUint32(22, e.usize, true);
    ldv.setUint16(26, nameBytes.length, true);
    ldv.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    parts.push(local, e.cdata);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cdv = new DataView(cen.buffer);
    cdv.setUint32(0, 0x02014b50, true);
    cdv.setUint16(4, 20, true);   // version made by
    cdv.setUint16(6, 20, true);   // version needed
    cdv.setUint16(8, 0, true);
    cdv.setUint16(10, e.method, true);
    cdv.setUint16(12, e.time, true);
    cdv.setUint16(14, e.date, true);
    cdv.setUint32(16, e.crc, true);
    cdv.setUint32(20, e.cdata.length, true);
    cdv.setUint32(24, e.usize, true);
    cdv.setUint16(28, nameBytes.length, true);
    cdv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + e.cdata.length;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, offset, true);

  const all = [...parts, ...central, eocd];
  let total = 0;
  for (const p of all) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of all) { out.set(p, at); at += p.length; }
  return out;
}

// MS-DOS 시각 형식 (초는 2초 단위)
function dosTime(d = new Date()) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// ── XML 유틸 ─────────────────────────────────────────────
export function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function unescXml(s) {
  return String(s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");
}

export function colLetter(n) {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = (n - 1 - r) / 26;
  }
  return s;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? m[1] : null;
}

// ── 통합 문서 열기 ───────────────────────────────────────
export async function openWorkbook(arrayBuffer) {
  if (!zipSupported()) {
    throw new Error("이 브라우저는 엑셀 파일 읽기를 지원하지 않습니다. 크롬이나 최신 사파리에서 열어주세요.");
  }
  const entries = parseZip(arrayBuffer);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const dec = new TextDecoder();

  const text = async (name) => {
    const e = byName.get(name);
    if (!e) return null;
    const raw = e.method === 0 ? e.cdata : await inflateRaw(e.cdata);
    return dec.decode(raw);
  };

  const wbXml = await text("xl/workbook.xml");
  if (!wbXml) throw new Error("엑셀 파일 안에서 통합 문서를 찾지 못했습니다.");
  const relsXml = (await text("xl/_rels/workbook.xml.rels")) || "";

  const relTarget = {};
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const id = attr(m[0], "Id");
    let target = attr(m[0], "Target");
    if (!id || !target) continue;
    target = target.replace(/^\/xl\//, "").replace(/^\.\//, "");
    relTarget[id] = target.startsWith("xl/") ? target : `xl/${target}`;
  }

  const sheets = [];
  for (const m of wbXml.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = unescXml(attr(m[0], "name") || "");
    const rid = attr(m[0], "r:id") || attr(m[0], "id");
    const path = relTarget[rid];
    if (name && path) sheets.push({ name, path });
  }
  if (!sheets.length) throw new Error("엑셀 파일에 시트가 없습니다.");

  // 공유 문자열 — 셀이 t="s"일 때 실제 글자를 여기서 찾는다.
  const sstXml = await text("xl/sharedStrings.xml");
  const sst = [];
  if (sstXml) {
    for (const si of sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      let s = "";
      for (const t of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += unescXml(t[1]);
      sst.push(s);
    }
  }

  return { entries, byName, sheets, sst, text, _dirty: new Map() };
}

// ── 시트 읽기 ────────────────────────────────────────────
// 헤더 확인·마지막 줄 확인용. 값은 전부 문자열로 준다 (자릿수 비교가 아니라 눈으로 볼 용도).
export async function readSheet(wb, sheetName, maxRows = 0) {
  return (await readSheetRows(wb, sheetName, maxRows)).map((r) => r.cells);
}

// 엑셀에서 몇 번째 줄인지까지 알아야 할 때 쓴다 (이미 들어 있는 경기를 고쳐 넣을 때).
// 줄 번호는 화면에 보이는 행 번호와 같다 — 사람에게 "N행"이라고 알려줄 수 있다.
export async function readSheetRows(wb, sheetName, maxRows = 0) {
  const sheet = wb.sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`"${sheetName}" 시트를 찾지 못했습니다.`);
  const xml = wb._dirty.get(sheet.path) ?? (await wb.text(sheet.path));
  if (xml == null) throw new Error(`"${sheetName}" 시트를 읽지 못했습니다.`);

  const body = xml.slice(xml.indexOf("<sheetData"), xml.indexOf("</sheetData>") + 1);
  const rows = [];
  for (const rm of body.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(`<c${cm[1]}>`, "r") || "";
      const type = attr(`<c${cm[1]}>`, "t");
      const inner = cm[2] || "";
      let value = "";
      if (type === "inlineStr") {
        for (const t of inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) value += unescXml(t[1]);
      } else {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/);
        value = v ? unescXml(v[1]) : "";
        if (type === "s") value = wb.sst[+value] ?? "";
      }
      const col = ref.replace(/\d+/g, "");
      let idx = 0;
      for (const ch of col) idx = idx * 26 + (ch.charCodeAt(0) - 64);
      cells[Math.max(0, idx - 1)] = value;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows.push({ r: +(attr(`<row${rm[1]}>`, "r") || rows.length + 1), cells });
    if (maxRows && rows.length >= maxRows) break;
  }
  return rows;
}

// ── 셀 서식 ──────────────────────────────────────────────
// 엑셀에는 미리 정해진 서식 번호가 있다. 10번이 "0.00%" — 소수 둘째 자리 퍼센트다.
// 이걸 쓰면 styles.xml 에 새 서식을 정의할 필요 없이 번호만 가리키면 된다.
const PERCENT_NUMFMT = 10;

// 확률 칸에 퍼센트 서식을 입히되, 그 칸이 원래 쓰던 글꼴·테두리·색은 그대로 둔다.
// 그러려면 기존 서식(xf)을 복사해서 숫자 서식만 바꾼 새 서식을 만들어야 한다.
// cellXfs 맨 뒤에 덧붙이므로 기존 번호는 하나도 안 밀린다 — 다른 셀은 영향이 없다.
async function percentStyleFor(wb, baseIndex) {
  if (!wb._pctStyle) wb._pctStyle = new Map();
  const key = baseIndex ?? -1;
  if (wb._pctStyle.has(key)) return wb._pctStyle.get(key);

  let xml = wb._dirty.get("xl/styles.xml") ?? (await wb.text("xl/styles.xml"));
  if (xml == null) return null;

  const block = xml.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/);
  if (!block) return null;
  const xfs = block[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) || [];

  const base = xfs[baseIndex] || xfs[0] || `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`;
  const head = base.match(/^<xf\b[^>]*?(\/?)>/);
  let attrs = head[0].replace(/^<xf/, "").replace(/\/?>$/, "");
  attrs = attrs.replace(/\snumFmtId="[^"]*"/, "");
  attrs = attrs.replace(/\sapplyNumberFormat="[^"]*"/, "");
  const newHead = `<xf numFmtId="${PERCENT_NUMFMT}" applyNumberFormat="1"${attrs}`;
  const newXf = head[1] === "/"
    ? `${newHead}/>`
    : newHead + ">" + base.slice(head[0].length);

  // 똑같은 서식이 이미 있으면 그걸 쓴다 — 부를 때마다 늘어나면 파일만 커진다.
  let index = xfs.indexOf(newXf);
  if (index < 0) {
    index = xfs.length;
    xml = xml.replace(block[0],
      `<cellXfs${block[1].replace(/\scount="[^"]*"/, "")} count="${xfs.length + 1}">${block[2]}${newXf}</cellXfs>`);
    wb._dirty.set("xl/styles.xml", xml);
  }
  wb._pctStyle.set(key, index);
  return index;
}

// 이미 들어 있는 줄의 확률 칸에도 같은 서식을 입힌다.
// 값은 손대지 않는다 — 0.545 는 그대로 0.545 이고, 보이는 모양만 54.50% 가 된다.
// 이걸 안 하면 새로 붙은 줄만 퍼센트로 보여서 한 열이 두 가지 모양으로 갈린다.
export async function formatPercentColumns(wb, sheetName, colIndexes, skipRows = 1) {
  const sheet = wb.sheets.find((s) => s.name === sheetName);
  if (!sheet) return 0;
  let xml = wb._dirty.get(sheet.path) ?? (await wb.text(sheet.path));
  if (xml == null) return 0;

  const letters = new Set(colIndexes.map((i) => colLetter(i + 1)));
  let changed = 0;
  const out = [];
  let last = 0;
  const re = /<c\b([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[0];
    const ref = attr(tag, "r") || "";
    const col = ref.replace(/\d+/g, "");
    const row = +(ref.replace(/\D+/g, "") || 0);
    // 글자가 든 칸(머리글 등)에 숫자 서식을 입혀도 소용이 없으니 건너뛴다.
    const type = attr(tag, "t");
    if (!letters.has(col) || row <= skipRows || type === "s" || type === "inlineStr" || type === "str") continue;

    const baseAttr = attr(tag, "s");
    const pct = await percentStyleFor(wb, baseAttr == null ? null : +baseAttr);
    if (pct == null || String(pct) === baseAttr) continue;

    const newTag = baseAttr == null
      ? tag.replace(/^<c/, `<c s="${pct}"`)
      : tag.replace(/\ss="[^"]*"/, ` s="${pct}"`);
    out.push(xml.slice(last, m.index), newTag);
    last = m.index + tag.length;
    changed++;
  }
  if (!changed) return 0;
  out.push(xml.slice(last));
  wb._dirty.set(sheet.path, out.join(""));
  return changed;
}

// ── 이미 들어 있는 줄 고쳐 넣기 ──────────────────────────
// 사람이 옮겨 적다 틀린 걸 나중에 발견했을 때 쓴다. 다시 받으면 같은 경기가 두 번
// 들어가니, 이미 있는 줄은 붙이지 말고 그 자리에서 값만 갈아끼운다.
//
// 줄을 지우지는 않는다. 지우면 뒤 줄 번호가 다 밀리고, 그 줄을 가리키던 수식이
// 어긋난다. 지워야 할 줄은 몇 행인지 알려만 주고 사람이 엑셀에서 지우게 둔다.
//
// targets: [{ r: 엑셀 행 번호, values: [...] }]
export async function overwriteRows(wb, sheetName, targets, percentCols = []) {
  const sheet = wb.sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`"${sheetName}" 시트를 찾지 못했습니다.`);
  const xml = wb._dirty.get(sheet.path) ?? (await wb.text(sheet.path));
  if (xml == null) throw new Error(`"${sheetName}" 시트를 읽지 못했습니다.`);

  const pctSet = new Set(percentCols);
  const byRow = new Map(targets.map((t) => [t.r, t.values]));

  // 고칠 줄들을 먼저 훑어서 셀마다 원래 서식과 수식을 기억해 둔다.
  // 수식 칸은 건드리지 않는다 — 우리가 넣는 값으로 덮으면 수식이 사라진다.
  const rowInfo = new Map();
  for (const m of xml.matchAll(/<row\b([^>]*?)>([\s\S]*?)<\/row>/g)) {
    const rowNo = +(attr(`<row${m[1]}>`, "r") || 0);
    if (!byRow.has(rowNo)) continue;
    const cells = new Map();
    for (const cm of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(`<c${cm[1]}>`, "r");
      if (!ref) continue;
      cells.set(ref.replace(/\d+/g, ""), {
        style: attr(`<c${cm[1]}>`, "s"),
        formula: (cm[2] || "").includes("<f") ? cm[0] : null,
      });
    }
    rowInfo.set(rowNo, { match: m, cells });
  }

  // 확률 칸에 쓸 서식 번호를 미리 만들어 둔다 (아래 치환은 동기로 돌아야 한다).
  const pctStyle = new Map();
  for (const { cells } of rowInfo.values()) {
    for (const c of pctSet) {
      const prev = cells.get(colLetter(c + 1));
      const key = prev?.style ?? null;
      if (pctStyle.has(key)) continue;
      pctStyle.set(key, await percentStyleFor(wb, key == null ? null : +key));
    }
  }

  const chunks = [];
  const keptFormulas = [];
  let last = 0;
  for (const [rowNo, { match, cells: old }] of [...rowInfo].sort((a, b) => a[1].match.index - b[1].match.index)) {
    let cells = "";
    byRow.get(rowNo).forEach((value, c) => {
      const col = colLetter(c + 1);
      const prev = old.get(col);
      if (prev?.formula) {
        cells += prev.formula;
        keptFormulas.push(`${col}${rowNo}`);
        return;
      }
      if (value === null || value === undefined || value === "") return;
      let style = prev?.style ?? null;
      if (pctSet.has(c)) {
        const idx = pctStyle.get(style);
        if (idx != null) style = String(idx);
      }
      const sAttr = style != null ? ` s="${style}"` : "";
      if (typeof value === "number" && Number.isFinite(value)) {
        cells += `<c r="${col}${rowNo}"${sAttr}><v>${value}</v></c>`;
      } else {
        cells += `<c r="${col}${rowNo}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
      }
    });
    chunks.push(xml.slice(last, match.index), `<row${match[1]}>${cells}</row>`);
    last = match.index + match[0].length;
  }
  chunks.push(xml.slice(last));
  wb._dirty.set(sheet.path, chunks.join(""));
  return { changed: rowInfo.size, keptFormulas };
}

// ── 시트 끝에 줄 붙이기 ──────────────────────────────────
// 원본 XML을 문자열로 고쳐 넣는다. 나머지 부품(styles.xml 등)은 손대지 않으므로 서식이 남는다.
// 새 줄의 셀에는 기존 마지막 줄의 셀 서식(s 속성)을 그대로 물려준다 — 표가 이어져 보이게.
export async function appendRows(wb, sheetName, rows, percentCols = []) {
  const sheet = wb.sheets.find((s) => s.name === sheetName);
  if (!sheet) throw new Error(`"${sheetName}" 시트를 찾지 못했습니다.`);
  let xml = wb._dirty.get(sheet.path) ?? (await wb.text(sheet.path));
  if (xml == null) throw new Error(`"${sheetName}" 시트를 읽지 못했습니다.`);

  // 마지막 줄 번호와, 그 줄이 쓰던 열별 서식
  let lastRow = 0;
  let lastRowXml = "";
  for (const m of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = +(attr(`<row${m[1]}>`, "r") || 0);
    if (r >= lastRow) { lastRow = r; lastRowXml = m[2] || ""; }
  }
  const styleByCol = {};
  for (const cm of lastRowXml.matchAll(/<c\b([^>]*?)(?:\/>|>)/g)) {
    const ref = attr(`<c${cm[1]}>`, "r");
    const s = attr(`<c${cm[1]}>`, "s");
    if (ref && s != null) styleByCol[ref.replace(/\d+/g, "")] = s;
  }

  // 확률 칸은 물려받은 서식을 그대로 쓰지 않고, 숫자 서식만 퍼센트로 바꾼 판을 쓴다.
  const pctSet = new Set(percentCols);
  const pctStyleByCol = {};
  for (const c of pctSet) {
    const col = colLetter(c + 1);
    const base = styleByCol[col];
    const idx = await percentStyleFor(wb, base == null ? null : +base);
    if (idx != null) pctStyleByCol[col] = String(idx);
  }

  let added = "";
  let maxCols = 0;
  rows.forEach((row, i) => {
    const r = lastRow + 1 + i;
    maxCols = Math.max(maxCols, row.length);
    let cells = "";
    row.forEach((value, c) => {
      if (value === null || value === undefined || value === "") return;
      const col = colLetter(c + 1);
      const style = pctStyleByCol[col] ?? styleByCol[col];
      const s = style != null ? ` s="${style}"` : "";
      if (typeof value === "number" && Number.isFinite(value)) {
        cells += `<c r="${col}${r}"${s}><v>${value}</v></c>`;
      } else {
        cells += `<c r="${col}${r}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
      }
    });
    added += `<row r="${r}">${cells}</row>`;
  });

  if (xml.includes("<sheetData/>")) {
    xml = xml.replace("<sheetData/>", `<sheetData>${added}</sheetData>`);
  } else if (xml.includes("<sheetData>")) {
    xml = xml.replace("</sheetData>", `${added}</sheetData>`);
  } else {
    throw new Error(`"${sheetName}" 시트 구조를 이해하지 못했습니다.`);
  }

  // 표 범위(dimension)를 늘려둔다. 안 늘려도 엑셀이 알아서 읽지만, 맞춰두는 편이 깔끔하다.
  xml = xml.replace(/<dimension\s+ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\s*\/>/, (m0, c1, r1, c2) => {
    const endRow = lastRow + rows.length;
    const endCol = colLetter(Math.max(colIndex(c2), maxCols));
    return `<dimension ref="${c1}${r1}:${endCol}${endRow}"/>`;
  });

  wb._dirty.set(sheet.path, xml);
  return { firstRow: lastRow + 1, lastRow: lastRow + rows.length };
}

function colIndex(letters) {
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx;
}

// ── 저장 ─────────────────────────────────────────────────
// 고친 부품만 다시 압축하고, 나머지는 원본 압축 바이트를 그대로 옮긴다.
export async function saveWorkbook(wb) {
  const enc = new TextEncoder();
  const stamp = dosTime();
  const out = [];
  for (const e of wb.entries) {
    const patched = wb._dirty.get(e.name);
    if (patched == null) { out.push(e); continue; }
    const raw = enc.encode(patched);
    out.push({
      name: e.name,
      method: 8,
      time: stamp.time,
      date: stamp.date,
      crc: crc32(raw),
      usize: raw.length,
      cdata: await deflateRaw(raw),
    });
  }
  return buildZip(out);
}

// ── 새 통합 문서 ─────────────────────────────────────────
// 업로드할 파일이 없을 때 쓰는 최소 구성.
//
// 서식을 왜 손으로 짜나
//   xlsx 의 셀 서식은 styles.xml 안의 번호를 가리키는 방식이다. 칸마다 서식을 새로
//   만들면 파일이 금세 수천 개로 불어나므로, (띠 · 정렬 · 숫자서식) 조합을 미리
//   열두 가지로 모아 두고 번호만 나눠 쓴다.
//
// 그림은 왜 넣을 수 있나
//   xlsx 는 결국 zip 이고, 그림은 그 안의 xl/media/imageN.png 한 칸이다. 시트가
//   그림을 가리키려면 그리기 부품(xl/drawings/…)이 한 겹 끼어야 한다.
//
//   닻은 oneCellAnchor 를 쓴다 — "왼쪽 위 모서리는 이 셀, 크기는 고정" 이라는 뜻이다.
//   처음에는 absoluteAnchor(시트 왼쪽 위에서 몇 EMU)로 넣었다가 되돌렸다.
//   그쪽은 규격에는 있지만 실제로 쓰는 곳이 거의 없어서, 데스크톱 엑셀 말고
//   휴대폰 엑셀 같은 데서는 그림이 아예 안 그려질 수 있다. oneCellAnchor 는
//   openpyxl 이 기본으로 내보내는 방식이라 어디서나 열린다.
//   덕분에 자리를 셀 번호로만 적으면 되고, 줄 높이 계산에 기대지 않는다.

const PCT_NUMFMT = 164;                       // "0.0%" — 아래 styles.xml 에서 정의한다
export const ROW_PT = 18;                     // 모든 줄 높이(pt). 보기 좋으라고 맞춘 값이다
const EMU_PER_PX = 9525;                      // 1px = 9525 EMU (96dpi 기준)

// styles.xml 의 cellXfs 번호. 아래 STYLES 문자열에 적은 순서와 같아야 한다.
const XF = {
  plain: { left: 0, center: 1, pct: 2 },
  zebra: { left: 3, center: 4, pct: 5 },
  total: { left: 6, center: 7, pct: 8 },
  head: { left: 9, center: 10, pct: 10 },
};
const XF_NOTE = 11;
// 팀 이름 칸에만 쓰는 색. 줄이 많아지면 어느 팀 줄인지 눈으로 못 따라가서 넣었다.
const XF_TEAM = [
  { plain: 12, zebra: 13, total: 14, head: 12 },
  { plain: 15, zebra: 16, total: 17, head: 15 },
];

const STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="${PCT_NUMFMT}" formatCode="0.0%"/></numFmts>` +
  // 4·5번은 팀 색이다. js/record-image.js 의 C.team(#C2410C · #15803D) 을 조금
  // 어둡게 한 값이다 — 원래 색 그대로는 합계 줄 바탕(#EAEEF7) 위에서 명암비가
  // 4.46 · 4.32 로 기준(4.5)에 못 미쳤다. 지금은 가장 나쁜 자리에서도 4.81 · 4.85 고,
  // 원래 색과의 색차는 ΔE 3.4 · 4.5 라 같은 팀 색으로 읽힌다.
  // (css/style.css 가 --accent 와 --accent-text 를 나눠 쓰는 것과 같은 이유다.)
  `<fonts count="6">` +
  `<font><sz val="11"/><color rgb="FF161B28"/><name val="맑은 고딕"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF161B28"/><name val="맑은 고딕"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFDFE4F5"/><name val="맑은 고딕"/></font>` +
  `<font><b/><sz val="12"/><color rgb="FF2C3557"/><name val="맑은 고딕"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFB93E0B"/><name val="맑은 고딕"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF147739"/><name val="맑은 고딕"/></font>` +
  `</fonts>` +
  `<fills count="5">` +
  `<fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF2C3557"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF5F7FB"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEAEEF7"/><bgColor indexed="64"/></patternFill></fill>` +
  `</fills>` +
  `<borders count="2">` +
  `<border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left/><right/><top/><bottom style="thin"><color rgb="FFD7DBE6"/></bottom><diagonal/></border>` +
  `</borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="18">` +
  // 0~2 보통 줄
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  `<xf numFmtId="${PCT_NUMFMT}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  // 3~5 얼룩 줄
  `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  `<xf numFmtId="${PCT_NUMFMT}" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  // 6~8 합계 줄
  `<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  `<xf numFmtId="${PCT_NUMFMT}" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>` +
  // 9~10 머리글
  `<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>` +
  // 11 표 아래 안내 줄
  `<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  // 12~17 팀 이름 칸 (앞 팀 · 뒤 팀 × 보통 · 얼룩 · 합계)
  `<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="5" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="표준" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** 숫자만 든 열은 가운데로 맞춘다. 이름·날짜 같은 글자 열은 왼쪽이 읽기 좋다. */
function 가운데열(rows) {
  const set = new Set();
  const cols = rows.reduce((a, r) => Math.max(a, r.length), 0);
  for (let c = 0; c < cols; c++) {
    let 숫자 = 0;
    let 글자 = 0;
    for (let r = 1; r < rows.length; r++) {
      const v = rows[r][c];
      if (v === "" || v == null) continue;
      if (typeof v === "number") 숫자++;
      else 글자++;
    }
    if (숫자 && !글자) set.add(c);
  }
  return set;
}

/** 한글은 대략 두 칸을 먹는다. 열 너비를 글자 수로 잡을 때 쓴다. */
function 글자폭(v) {
  return String(v ?? "").split("").reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0);
}

function 셀(ref, value, style) {
  const s = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`;
}

/** 시트 하나를 XML 로 만든다. sheet 는 createWorkbookSheets 가 받는 것과 같은 모양.
 *  drawingRel 이 있으면 시트 끝에 그리기 부품을 매단다. */
function sheetXml(sheet, drawingRel) {
  const rows = sheet.rows;
  const pctSet = new Set(sheet.percentCols || []);
  const 강조 = new Set(sheet.강조행 || []);
  const 꼬리말 = sheet.꼬리말 || [];
  const 센터 = 가운데열(rows);

  // 열 너비는 표에서만 잰다. 꼬리말까지 같이 재면 긴 문장 하나가 첫 열을 통째로 늘린다.
  const widths = [];
  rows.forEach((row) => row.forEach((v, i) => {
    widths[i] = Math.max(widths[i] || 0, 글자폭(v));
  }));
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(28, Math.max(6, w + 3))}" customWidth="1"/>`)
    .join("");

  const 팀열 = sheet.팀열 || null;
  const 띠 = (r) => (r === 0 ? "head" : 강조.has(r) ? "total" : r % 2 === 0 ? "zebra" : "plain");
  const body = rows.map((row, r) => {
    const 결 = 띠(r);
    const 칸 = XF[결];
    const cells = row.map((value, c) => {
      if (value === null || value === undefined || value === "") return "";
      // 팀 이름 칸만 팀 색으로 쓴다. 이름이 안 맞으면(게스트 팀 등) 보통 서식으로 둔다.
      const ti = 팀열 && c === 팀열.col && r > 0 ? 팀열.이름.indexOf(value) : -1;
      const style = ti >= 0 ? XF_TEAM[ti][결]
        : pctSet.has(c) && r > 0 ? 칸.pct
          : 센터.has(c) ? 칸.center : 칸.left;
      return 셀(`${colLetter(c + 1)}${r + 1}`, value, style);
    }).join("");
    return `<row r="${r + 1}" ht="${ROW_PT}" customHeight="1">${cells}</row>`;
  });
  // 꼬리말은 표와 한 칸 떼어 놓는다 — 붙이면 자동 필터가 같이 집어간다.
  꼬리말.forEach((말, i) => {
    const r = rows.length + 2 + i;
    body.push(`<row r="${r}" ht="${ROW_PT}" customHeight="1">${셀(`A${r}`, 말, XF_NOTE)}</row>`);
  });

  const lastCol = colLetter(Math.max(1, widths.length));
  const lastRow = Math.max(1, rows.length + (꼬리말.length ? 꼬리말.length + 1 : 0));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="A1:${lastCol}${lastRow}"/>` +
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0">` +
    `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="${ROW_PT}"/>` +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${body.join("")}</sheetData>` +
    (sheet.필터 !== false && rows.length > 1 ? `<autoFilter ref="A1:${lastCol}${rows.length}"/>` : "") +
    (drawingRel ? `<drawing r:id="${drawingRel}"/>` : "") +
    `</worksheet>`;
}

/** 그림 한 장의 닻. 왼쪽 위 모서리를 (col, row) 셀에 붙이고, 크기는 px 로 고정한다.
 *  크기가 고정이라 열 너비가 달라져도 그림이 찌그러지지 않는다. */
function 그림닻(i, relId, { col = 0, row = 0, w, h }) {
  const emu = (px) => Math.round(px * EMU_PER_PX);
  return `<xdr:oneCellAnchor>` +
    `<xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff>` +
    `<xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${emu(w)}" cy="${emu(h)}"/>` +
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/>` +
    `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
    `<xdr:clientData/></xdr:oneCellAnchor>`;
}

/** 시트 하나짜리 통합 문서. 시트를 여럿 넣으려면 createWorkbookSheets 를 쓴다. */
export async function createWorkbook(sheetName, rows, percentCols = []) {
  return createWorkbookSheets([{ name: sheetName, rows, percentCols }]);
}

/** 시트 여러 장짜리 통합 문서.
 *  합계와 원본을 한 파일에 담으려고 나눠 두었다 — 파일이 여러 개면 짝이 흩어진다.
 *
 *  sheets 는 [{ name, rows, percentCols, 강조행, 팀열, 꼬리말, 필터, pics }, …]
 *    percentCols  0.0% 서식을 입힐 열 번호. 값은 분수로 넣어야 한다
 *    강조행       굵게·바탕색으로 띄울 줄 번호(0 = 머리글이므로 1부터)
 *    팀열         { col, 이름: [앞팀, 뒤팀] } — 그 칸을 팀 색으로 쓴다
 *    꼬리말       표 아래 한 칸 띄고 붙일 안내 문구들
 *    필터         false 면 자동 필터를 안 건다(표가 아닌 시트)
 *    pics         [{ bytes, col, row, w, h }] — png 바이트, 왼쪽 위 셀, 보일 크기(px) */
export async function createWorkbookSheets(sheets) {
  if (!zipSupported()) {
    throw new Error("이 브라우저는 엑셀 파일 만들기를 지원하지 않습니다. 크롬이나 최신 사파리에서 열어주세요.");
  }
  if (!sheets.length) throw new Error("시트가 없습니다.");

  // 그림이 든 시트마다 그리기 부품을 하나씩 만든다. 그림 파일은 통합 문서 전체에서
  // 이어진 번호를 쓴다 — 시트별로 1부터 매기면 이름이 부딪친다.
  const media = [];
  const drawings = [];
  const sheetDrawing = new Map();
  sheets.forEach((s, si) => {
    const pics = s.pics || [];
    if (!pics.length) return;
    const dn = drawings.length + 1;
    const rels = [];
    const anchors = [];
    pics.forEach((p, i) => {
      const mn = media.length + 1;
      media.push({ name: `xl/media/image${mn}.png`, bytes: p.bytes });
      const rid = `rId${i + 1}`;
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${mn}.png"/>`);
      anchors.push(그림닻(i, rid, p));
    });
    drawings.push({
      n: dn,
      xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
        `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        anchors.join("") + `</xdr:wsDr>`,
      rels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        rels.join("") + `</Relationships>`,
      sheet: si + 1,
    });
    sheetDrawing.set(si, dn);
  });

  // 스타일은 마지막 관계 번호로 둔다. 시트가 rId1..rIdN 을 차례로 쓴다.
  const styleRel = sheets.length + 1;
  const files = {
    "[Content_Types].xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      (media.length ? `<Default Extension="png" ContentType="image/png"/>` : "") +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      sheets.map((_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
      drawings.map((d) =>
        `<Override PartName="/xl/drawings/drawing${d.n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join("") +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`,
    "_rels/.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
    "xl/workbook.xml":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${sheets.map((s, i) =>
        `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets.map((_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
      `<Relationship Id="rId${styleRel}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
    "xl/styles.xml": STYLES,
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s, sheetDrawing.has(i) ? "rId1" : null);
  });
  for (const d of drawings) {
    files[`xl/drawings/drawing${d.n}.xml`] = d.xml;
    files[`xl/worksheets/_rels/sheet${d.sheet}.xml.rels`] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d.n}.xml"/>` +
      `</Relationships>`;
    files[`xl/drawings/_rels/drawing${d.n}.xml.rels`] = d.rels;
  }

  const enc = new TextEncoder();
  const stamp = dosTime();
  const entries = [];
  for (const [name, xml] of Object.entries(files)) {
    const raw = enc.encode(xml);
    entries.push({
      name, method: 8, time: stamp.time, date: stamp.date,
      crc: crc32(raw), usize: raw.length, cdata: await deflateRaw(raw),
    });
  }
  // png 는 이미 압축된 형식이라 그대로 담는다(method 0). 다시 압축해도 안 줄고 시간만 든다.
  for (const m of media) {
    entries.push({
      name: m.name, method: 0, time: stamp.time, date: stamp.date,
      crc: crc32(m.bytes), usize: m.bytes.length, cdata: m.bytes,
    });
  }
  return buildZip(entries);
}
