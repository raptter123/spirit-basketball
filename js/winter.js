// 겨울 철 장식. 날짜만 보고 켜고 끈다 — 해마다 손댈 것이 없다.
import { todayStr } from "./util.js";

/** 12월 1일 ~ 2월 말이면 true. dateStr 은 "YYYY-MM-DD"(없으면 오늘, 서울 시각). */
export function 겨울인가(dateStr = todayStr()) {
  const m = Number(String(dateStr).slice(5, 7));
  return m === 12 || m === 1 || m === 2;
}

// 홈 화면에 내리는 눈. 옅은 점 18개가 위에서 아래로 천천히 떨어진다.
//
// - 홈에서만 그린다(#app 안에 두어서 다른 화면으로 가면 같이 사라진다). 기록 화면처럼
//   손이 바쁜 곳에서 눈이 움직이면 방해만 된다.
// - 눌리지 않는다(pointer-events: none) — 아래 단추를 그대로 누른다.
// - 폰에서 '동작 줄이기' 를 켠 사람에게는 안 보인다(CSS 의 prefers-reduced-motion).
// - 자리 · 크기 · 속도는 씨앗을 고정한 의사 난수라 열 때마다 같다(시험이 잴 수 있게).
const 눈개수 = 18;

export function 눈HTML(dateStr) {
  if (!겨울인가(dateStr)) return "";
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const 점 = Array.from({ length: 눈개수 }, () => {
    const 왼 = (rnd() * 100).toFixed(1);
    const 크기 = (3 + rnd() * 4).toFixed(1);
    const 걸림 = (9 + rnd() * 8).toFixed(1);
    const 늦게 = (-rnd() * 16).toFixed(1);       // 음수 지연 — 처음부터 화면 곳곳에 흩어져 있게
    const 흔들 = ((rnd() - 0.5) * 40).toFixed(0);
    return `<i style="left:${왼}%;width:${크기}px;height:${크기}px;animation-duration:${걸림}s;animation-delay:${늦게}s;--drift:${흔들}px"></i>`;
  }).join("");
  return `<div class="home-snow" aria-hidden="true">${점}</div>`;
}
