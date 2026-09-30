// 주간 점검 도구 — 합격/불합격이 아니라 "지금 어떤가" 를 재서 보고한다.
//
//   node tools/checks/audit.mjs              다섯 가지 전부
//   node tools/checks/audit.mjs dates a11y   고른 것만
//
// 각 도구가 무엇을 재는지는 아래 목록에 적었다. 회귀 시험(run.mjs)이 "예전에 고친 것이
// 다시 깨지지 않았나" 를 본다면, 이쪽은 "아직 못 찾은 것이 있나" 를 찾는다.
// 결과를 보고 고칠 것 · 넘길 것을 사람이 고른다 — 그래서 여기서는 판정하지 않는다.
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { 서버띄우기, 저장소 } from "./lib.mjs";

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 도구 = {
  "tap-contrast": "누를 곳 44px 미만 · 글씨 명암비 미달 — 11화면 × 3폭(320 · 390 · 768) × 2테마",
  a11y:           "화면 낭독기 — 이름 없는 버튼 · 라벨 없는 입력칸 · 제목 단계 건너뜀",
  monkey:         "화면마다 보이는 버튼 · 링크를 전부 한 번씩 눌러 자바스크립트 오류 모으기",
  dates:          "날짜 바뀌는 순간(월말 · 연말 · 공휴일 목록 끝) — 홈 · 달력 · 팀 편성",
  weight:         "첫 화면 무게 — 요청 수 · 크기 · 큰 파일 순",
};
const 고름 = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(도구);
for (const n of 고름) if (!도구[n]) { console.error(`모르는 도구: ${n}\n있는 것: ${Object.keys(도구).join(" ")}`); process.exit(2); }

const 서버 = process.env.CHECK_URL ? null : await 서버띄우기();
const 주소 = process.env.CHECK_URL || 서버.url;
for (const n of 고름) {
  console.log(`\n━━━ ${n} — ${도구[n]}`);
  await new Promise((resolve) => {
    const 자식 = spawn(process.execPath, [path.join(여기, "audit", `${n}.mjs`)],
      { cwd: 저장소, env: { ...process.env, CHECK_URL: 주소 }, stdio: "inherit" });
    자식.on("close", resolve);
  });
}
if (서버) await 서버.닫기();
