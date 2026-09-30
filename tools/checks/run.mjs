// 회귀 시험 실행기.
//
//   node tools/checks/run.mjs            전부 (기본)
//   node tools/checks/run.mjs --fast     빠른 묶음 — PR 자동 검사가 이걸 돈다
//   node tools/checks/run.mjs rec tri    이름을 준 것만
//
// 사이트를 스스로 띄운다(빈 포트). 이미 띄워 둔 서버를 쓰려면 CHECK_URL 을 준다.
// 받은 파일은 CHECK_OUT(없으면 <임시폴더>/spirit-checks) 아래에 쌓인다.
//
// 합격 판정은 두 가지를 같이 본다: 종료 코드 0, 그리고 마지막에 "전부 통과" 같은
// 끝줄이 찍혔는지. ❌ 만 찾으면 안 된다 — 시험이 예외로 죽으면 ❌ 가 한 줄도 안
// 찍혀서 "통과" 로 읽힌다. 실제로 그렇게 깨진 시험 네 벌이 통과로 보고된 적이 있다.
//
// 필요한 것: node 20+, playwright (저장소 맨 위 node_modules), python3 + openpyxl
// (엑셀을 여는 시험들) + Pillow(img), LibreOffice(soffice — xlsimg 하나만, 빠른 묶음에는 없음).
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { 서버띄우기, 저장소 } from "./lib.mjs";

const 여기 = path.dirname(fileURLToPath(import.meta.url));

// 무엇을 보는 시험인지 한 줄씩. 순서는 빨리 끝나는 것부터.
const 시험 = {
  searchq:    { 빠름: true,  말: "검색칸에 따옴표 · 꺾쇠를 쳐도 글자가 남는가" },
  util:       { 빠름: true,  말: "공용 도구 — 이스케이프 · 날짜 글이 한 벌인가 · 화면 전부 열기" },
  court:      { 빠름: true,  말: "기록 코트 — 탑 3점 · 구역 판정 · 화면 한 장" },
  fitphone:   { 빠름: true,  말: "경기 중 기록 화면이 폰 한 화면에 들어가는가(2팀 · 3파전 × 폰 6가지)" },
  heading:    { 빠름: true,  말: "제목 단계 — h1 → h3 처럼 건너뛰는 화면이 없는가 · 글씨 크기 그대로" },
  clip:       { 빠름: true,  말: "밴드 이미지 · 엑셀 샷차트의 코트가 칸 밖으로 안 넘치는가(픽셀)" },
  sub:        { 빠름: true,  말: "교체와 +/-" },
  teamcolor:  { 빠름: true,  말: "A · B · C 팀 색이 경기마다 같은가" },
  advfit:     { 빠름: true,  말: "팀 효율 카드가 폰 폭에 들어가는가" },
  chartfit:   { 빠름: true,  말: "결과 화면 샷 차트가 폰 폭에 들어가는가" },
  band:       { 빠름: true,  말: "밴드 이미지 · 밴드 글" },
  img:        { 빠름: true,  말: "밴드 이미지 모양 · 파일 이름" },
  files:      { 빠름: true,  말: "파일 이름 겹침 · 엑셀 안내 글 = 실제 시트" },
  clear:      { 빠름: true,  말: "기록 버리기 · 새 경기 · 보관함" },
  log:        { 빠름: true,  말: "최근 기록 줄 · 되돌리기" },
  rec:        { 빠름: true,  말: "기록 화면 기본 흐름" },
  chart:      { 빠름: true,  말: "결과 화면 샷 차트" },
  fix4:       { 빠름: true,  말: "리바 공수 · 선수 먼저 누르기 · 팀 색 · 엑셀 그림 한 장" },
  tri:        { 빠름: true,  말: "3파전 갈아타며 기록" },
  tridone:    { 빠름: true,  말: "3파전 결과 화면 전환 줄 · 한꺼번에 받기" },
  ex:         { 빠름: true,  말: "교류전(1팀) · 상대 최종 점수" },
  xls:        { 빠름: true,  말: "엑셀 여섯 시트의 숫자" },
  adv:        { 빠름: true,  말: "팀 효율(ORtg · DRtg · Net) 셈" },
  calholiday: { 빠름: false, 말: "달력 오늘 칸 — 공휴일 · 두 테마 명암비" },
  weekly:     { 빠름: false, 말: "달력 · 일정 화면 명암비(오늘 날짜에 따라 달라짐)" },
  xlsimg:     { 빠름: false, 말: "엑셀 샷차트 그림이 LibreOffice 에서 실제로 열리는가" },
  ten:        { 빠름: false, 말: "서로 다른 열 판을 돌려 화면 숫자를 이벤트 원본과 맞대기(5분쯤)" },
};
// 저장소에 원래 있던 종이 기록지 도구 둘. 끝줄 모양이 달라 따로 적어 둔다.
const 바깥 = {
  "real-photo-check": { 파일: path.join(저장소, "tools/real-photo-check.mjs"), 말: "실제 기록지 사진 판독 — 사람이 확인한 줄과 같은가" },
  "print-fit-check":  { 파일: path.join(저장소, "tools/print-fit-check.mjs"), 말: "기록지가 아이폰 인쇄 영역 안에 들어가는가" },
};

const 인자 = process.argv.slice(2);
const 빠른것만 = 인자.includes("--fast");
const 이름들 = 인자.filter((a) => !a.startsWith("--"));
const 고름 = 이름들.length ? 이름들
  : 빠른것만 ? Object.keys(시험).filter((k) => 시험[k].빠름)
    : [...Object.keys(시험), ...Object.keys(바깥)];
for (const n of 고름) {
  if (!시험[n] && !바깥[n]) { console.error(`모르는 시험: ${n}\n있는 것: ${[...Object.keys(시험), ...Object.keys(바깥)].join(" ")}`); process.exit(2); }
}

const 서버 = process.env.CHECK_URL ? null : await 서버띄우기();
const 주소 = process.env.CHECK_URL || 서버.url;

function 돌리기(파일) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const 자식 = spawn(process.execPath, [파일], { cwd: 저장소, env: { ...process.env, CHECK_URL: 주소 } });
    let 글 = "";
    자식.stdout.on("data", (d) => { 글 += d; });
    자식.stderr.on("data", (d) => { 글 += d; });
    자식.on("close", (code) => resolve({ code, 글, 초: ((Date.now() - t0) / 1000).toFixed(1) }));
  });
}

console.log(`사이트 ${주소} · 시험 ${고름.length}벌${빠른것만 ? " (빠른 묶음)" : ""}\n`);
let 실패 = 0;
for (const n of 고름) {
  const 파일 = 시험[n] ? path.join(여기, "suites", `${n}.mjs`) : 바깥[n].파일;
  // 바깥 도구는 옛 주소(8911)를 박아 두었을 수 있어 CHECK_URL 을 읽게 해 두었다.
  const r = await 돌리기(파일);
  const 항목 = (r.글.match(/^✅/gm) || []).length;
  const 끝줄 = /전부 통과|이상 없음|전부 일치합니다/.test(r.글);
  const 틀림 = /^❌/m.test(r.글);
  let 판정;
  if (r.code !== 0) 판정 = `죽음 (종료 ${r.code})`;
  else if (틀림) 판정 = "❌";
  else if (!끝줄) 판정 = "끝줄 없음 — 중간에 멈췄을 수 있음";
  else 판정 = `✅ ${항목}항목`;
  const 좋음 = 판정.startsWith("✅");
  if (!좋음) 실패++;
  console.log(`${n.padEnd(17)} ${판정.padEnd(12)} ${r.초.padStart(5)}초  ${(시험[n] || 바깥[n]).말}`);
  if (!좋음) {
    const 보일것 = r.글.split("\n").filter((l) => /❌|Error|오류|at .*\.mjs/.test(l)).slice(0, 6);
    (보일것.length ? 보일것 : r.글.trim().split("\n").slice(-6)).forEach((l) => console.log(`                  ${l}`));
  }
}
if (서버) await 서버.닫기();
console.log(실패 ? `\n❌ ${실패}벌 실패` : `\n✅ 전부 통과 (${고름.length}벌)`);
process.exit(실패 ? 1 : 0);
