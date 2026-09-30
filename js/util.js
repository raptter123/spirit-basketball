// 여러 화면이 같이 쓰는 작은 도구.
//
// 전에는 화면 파일마다 한 벌씩 들고 있었다(글자 이스케이프 6벌, 날짜 글 6곳).
// 겉은 같아 보여도 조금씩 달랐다 — 어떤 것은 null 을 "null" 로 찍고, 어떤 것은
// 작은따옴표를 그대로 뒀다. 하나만 고치면 나머지가 옛 모양으로 남는다.

/** HTML · SVG 에 넣을 글. 태그 사이에도, 따옴표로 감싼 속성값에도 쓸 수 있다.
 *  null · undefined 는 빈 글로 — "undefined" 가 화면에 찍히지 않게 한다. */
export function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** 날짜 → "2026-09-30". 기기 시간대 기준(toISOString 은 UTC 라 새벽에 하루 밀린다). */
export function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 오늘 → "2026-09-30". */
export function todayStr() {
  return dateStr(new Date());
}
