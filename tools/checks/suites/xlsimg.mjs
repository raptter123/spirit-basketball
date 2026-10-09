// 엑셀 '샷차트' 시트에 들어간 차트 그림과 서식을 확인한다.
//
// openpyxl 만으로는 모자라다 — 느슨해서 엑셀이 거부할 파일도 읽어 준다. 그래서
// 리브레오피스로 실제로 열리는지까지 본다. 그게 "엑셀에서 열린다" 에 가장 가깝다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
import fs from "fs";
import { execFileSync } from "child_process";
const HERE = 폴더();
const DL = `${HERE}/dlimg`;
fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on("dialog", (d) => d.accept());

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);
const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 10)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}
await p.click("#rec-start");
await p.waitForTimeout(600);
const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));

async function 코트탭(vx, vy) {
  const box = await p.evaluate(() => {
    const s2 = document.querySelector("#rec-court-svg");
    const r = s2.getBoundingClientRect();
    const [vx, vy, vw, vh] = s2.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  await p.mouse.click(box.l + (((vx - box.vx) / box.vw) * box.w), box.t + ((vy - box.vy) / box.vh) * box.h);
  await p.waitForTimeout(150);
}
const 선수탭 = (n) => p.evaluate((v) =>
  document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(130));

// 양 팀에서 세 명씩 한 개를 쏜다 — 팀 딱지가 두 색으로 나오는지 보려는 것이다.
const 쏜사람 = 선수.slice(0, 3).concat(선수.slice(5, 8));
const 자리 = [[250, 430], [200, 300], [60, 430], [250, 250], [440, 440], [300, 350]];
for (let i = 0; i < 쏜사람.length; i++) {
  await 코트탭(자리[i][0], 자리[i][1]);
  await 선수탭(쏜사람[i]);
  await p.click(i % 2 ? "#rec-miss" : "#rec-made");
  await p.waitForTimeout(200);
}

await p.click("#rec-finish");
await p.waitForTimeout(500);
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 30000 }), p.click("#rec-xlsx")]);
const 파일 = `${DL}/${dl.suggestedFilename()}`;
await dl.saveAs(파일);
await b.close();

// ── zip 속을 들여다본다 ────────────────────────────────
// 샷차트는 네 번째 시트다: 선수기록 · 팀효율 · 자리별 · 샷차트 · 쿼터별 · 이벤트원본
const py = `
import json, zipfile, re
z = zipfile.ZipFile(${JSON.stringify(파일)})
names = z.namelist()
draw = z.read("xl/drawings/drawing1.xml").decode() if "xl/drawings/drawing1.xml" in names else ""
chart = z.read("xl/worksheets/sheet4.xml").decode()
zone  = z.read("xl/worksheets/sheet3.xml").decode()
wb    = z.read("xl/workbook.xml").decode()
print(json.dumps({
  "names": names,
  "media": [n for n in names if n.startswith("xl/media/")],
  "png매직": [z.read(n)[:8].hex() for n in names if n.startswith("xl/media/")],
  "시트이름": re.findall(r'<sheet name="([^"]+)"', wb),
  "닻종류": sorted(set(re.findall(r"<xdr:(\\w+Anchor)>", draw))),
  "닻수": draw.count("<xdr:oneCellAnchor>"),
  "from": [(int(c), int(r)) for c, r in re.findall(r"<xdr:col>(\\d+)</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>(\\d+)</xdr:row>", draw)],
  "ext": [(int(x), int(y)) for x, y in re.findall(r'<xdr:ext cx="(\\d+)" cy="(\\d+)"/>', draw)],
  "샷차트에drawing": bool(re.search(r'<drawing r:id="rId1"/>', chart)),
  "자리별에drawing": bool(re.search(r'<drawing ', zone)),
  "샷차트필터": bool(re.search(r"<autoFilter", chart)),
  "자리별꼬리": "시트에 있습니다" in zone,
}, ensure_ascii=False))
`;
const z = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));

const 쏜수 = 쏜사람.length;
say(z.시트이름.join(" / ") === "선수기록 / 팀효율 / 자리별 / 샷차트 / 쿼터별 / 이벤트원본",
  `시트 여섯 장: ${z.시트이름.join(" / ")}`);

// ── 그림은 한 장이다 ───────────────────────────────────
// 선수마다 한 장씩 세웠더니 열 명이면 시트가 150줄이 되어, 스크롤을 한참 내리지
// 않으면 한 명밖에 안 보였다. 밴드 이미지와 같은 배치로 묶어 한 장만 넣는다.
say(z.media.length === 1, `그림 ${z.media.length}장 — 전원이 한 장 안에 (쏜 사람 ${쏜수}명)`);
say(z["png매직"].every((h) => h.startsWith("89504e470d0a1a0a")), "진짜 png (매직 89 50 4E 47)");
say(z.닻종류.join(",") === "oneCellAnchor",
  `닻 종류 ${z.닻종류.join(",")} (absoluteAnchor 아님)`);
say(z.닻수 === 1, `닻 ${z.닻수}개`);
say(z["샷차트에drawing"] && !z["자리별에drawing"],
  "그리기 부품은 샷차트 시트에만 붙음 (자리별에는 없음)");
say(z.names.includes("xl/worksheets/_rels/sheet4.xml.rels")
  && z.names.includes("xl/drawings/_rels/drawing1.xml.rels"),
  "시트→그리기→그림 관계 파일 두 장 다 있음");
say(!z["샷차트필터"], "샷차트 시트에는 자동 필터를 안 검 (표가 아니다)");
say(z["자리별꼬리"], "자리별 시트가 '샷차트 시트에 있습니다' 로 안내함");

const EMU = 9525;
const [폭, 높이] = z.ext[0].map((v) => v / EMU);
say(z.from[0][0] === 0 && z.from[0][1] === 3,
  `그림이 A열 ${z.from[0][1]}번 줄 (머리글 2줄 + 빈 줄 1)`);
say(폭 === 1000, `그림 너비 ${폭}px (밴드 이미지와 같은 좌표계)`);
// 팀 둘(한 줄) + 선수 여섯(두 줄) 이면 제목줄까지 700px 는 넘는다
say(높이 > 700, `그림 높이 ${높이}px — 팀 둘과 선수 ${쏜수}명이 다 들어감`);

// 박힌 png 가 실제로 2배 해상도인가
const png = JSON.parse(execFileSync("python3", ["-c", `
import json, zipfile
from struct import unpack
z = zipfile.ZipFile(${JSON.stringify(파일)})
d = z.read([n for n in z.namelist() if n.startswith("xl/media/")][0])
w, h = unpack('>II', d[16:24])
print(json.dumps({"w": w, "h": h, "bytes": len(d)}))
`], { encoding: "utf8" }));
say(png.w === 폭 * 2 && png.h === 높이 * 2,
  `박힌 png ${png.w}×${png.h}px — 보이는 크기의 2배 (${png.bytes.toLocaleString()}바이트)`);

// ── 진짜로 열리나: 리브레오피스로 변환해 본다 ──────────
const LO = `${HERE}/lo-test`;
fs.rmSync(LO, { recursive: true, force: true });
fs.mkdirSync(LO, { recursive: true });
fs.copyFileSync(파일, `${LO}/t.xlsx`);
let 변환 = "";
try {
  변환 = execFileSync("soffice",
    ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", LO, `${LO}/t.xlsx`],
    { encoding: "utf8", env: { ...process.env, HOME: LO }, timeout: 180000 });
} catch (e) { 변환 = String(e.stdout || "") + String(e.stderr || ""); }
const pdf = `${LO}/t.pdf`;
say(fs.existsSync(pdf) && 변환.includes("calc_pdf_Export"),
  `리브레오피스가 계산 문서로 열어 pdf 로 바꿈 (${fs.existsSync(pdf) ? fs.statSync(pdf).size : 0}바이트)`);
// 이 오류는 파일이 아니라 작업 환경 탓일 때가 많다 — libreoffice-core 만 있고 계산(calc)이
// 없으면 아무 엑셀이나 이 말로 실패한다(10/9 새 작업 환경에서 실제로 그랬다).
if (!fs.existsSync(pdf) && 변환.includes("source file could not be loaded")) {
  console.log("   ↳ 엑셀 파일 탓이 아닐 수 있어요: 계산 프로그램이 없으면 이렇게 실패해요 — apt-get install libreoffice-calc");
}
const 있나 = (명령) => { try { execFileSync("bash", ["-c", `command -v ${명령}`]); return true; } catch { return false; } };
if (fs.existsSync(pdf) && !있나("pdftotext")) {
  say(false, "pdftotext 가 없어 pdf 글자를 못 읽음 — apt-get install poppler-utils");
} else if (fs.existsSync(pdf)) {
  const 글 = execFileSync("pdftotext", ["-f", "1", "-l", "99", pdf, "-"], { encoding: "utf8" });
  say(글.includes("샷 차트"), "머리글 '샷 차트' 가 문서에 찍힘");
  const 이미지수 = Number(execFileSync("bash", ["-c",
    `python3 -c "import re;print(len(re.findall(rb'/Subtype\\s*/Image', open('${pdf}','rb').read())))"`],
    { encoding: "utf8" }).trim());
  say(이미지수 >= z.media.length, `pdf 안의 그림 ${이미지수}개 (넣은 ${z.media.length}개 이상)`);
}

console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(0);
