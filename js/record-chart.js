// 샷 차트 — 슛이 일어난 자리를 코트 그림에 찍는다.
//
// 왜 필요한가
//   박스스코어는 "3점 2/5" 까지만 말해 준다. 그 다섯 개가 코너였는지 탑이었는지,
//   그리고 그 사람이 **어디서 많이 쏘는지**는 좌표에만 들어 있다. 기록할 때 이미
//   좌표를 받아 두었으므로 따로 받을 것 없이 그리기만 하면 된다.
//
// 한 경기로는 모자라다
//   한 사람이 한 경기에 쏘는 슛은 열댓 개다. 자리를 셋으로 나누면 칸마다 서너 개라
//   "여기서 잘 들어간다" 를 말할 수 없다. 그래서 보관함에 쌓인 경기를 통째로 걸어
//   볼 수 있게 한다 — 스무 경기면 한 사람이 이삼백 개가 되어 비로소 말이 된다.
//
// 그림 한 벌로 화면과 내보내기를 같이 한다
//   차트속() 은 색을 인자로 받는다. 화면은 var(--…) 를 그대로 써서 테마를 따르고,
//   밴드에 올릴 결과 이미지(record-image.js)는 고정 색을 박아 넣는다 — 남이 볼
//   그림이 내 테마를 따라가면 안 되기 때문이다. 기하는 여기 한 곳에서만 계산하므로
//   두 그림이 어긋날 수 없다.
import { 구역이름 } from "./record-stats.js";

// 기록 화면과 같은 잘라내기. 탭 좌표가 여기에 맞춰 잘려 들어오므로 바꾸면 안 된다.
export const CHART_VIEW = { x: 0, y: 185, w: 500, h: 285 };

/** 화면용 — 색을 CSS 변수로 두어 테마를 따라간다. */
export const 화면색 = {
  line: "var(--court-line)", paint: "var(--court-paint)", floor: "var(--court-grad-2)",
  rim: "var(--rim)", made: "var(--good)", miss: "var(--bad)", ink: "var(--text)",
};

/** 슛이 많아지면 점을 줄이고 옅게 한다. 누적으로 보면 수백 개가 겹치는데,
 *  그대로 두면 코트가 한 덩어리로 칠해져서 어디가 빽빽한지 오히려 안 보인다. */
function 점크기(n) {
  if (n <= 30) return { r: 7, w: 3, op: 0.95 };
  if (n <= 80) return { r: 5.5, w: 2.5, op: 0.8 };
  if (n <= 200) return { r: 4.5, w: 2, op: 0.62 };
  return { r: 3.5, w: 1.6, op: 0.45 };
}

function 코트선(c) {
  return `
    <rect x="10" y="185" width="480" height="275" rx="14" fill="${c.floor}" stroke="${c.line}" stroke-width="2" opacity="0.9" />
    <rect x="170" y="270" width="160" height="190" fill="${c.paint}" />
    <rect x="170" y="270" width="160" height="190" fill="none" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <circle cx="250" cy="270" r="60" fill="none" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <path d="M 210 442 A 40 40 0 0 1 290 442" fill="none" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <path d="M 30 310 L 30 460" fill="none" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <path d="M 470 310 L 470 460" fill="none" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <path d="M 30 310 A 257 257 0 0 1 470 310" fill="none" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <line x1="215" y1="428" x2="285" y2="428" stroke="${c.line}" stroke-width="2" opacity="0.5" />
    <circle cx="250" cy="442" r="9" fill="none" stroke="${c.rim}" stroke-width="3.5" />`;
}

/** 슛 점들. 들어간 것은 채운 동그라미, 빗나간 것은 ✕ — 색뿐 아니라 모양도 다르게
 *  둔다. 색만으로 가르면 색을 잘 못 가리는 사람에게는 같은 그림이 된다. */
function 점들(shots, c) {
  const { r, w, op } = 점크기(shots.length);
  // 코트 선에도 <circle> 이 있으므로(센터 서클·골대) 슛 표시에는 이름을 붙여 둔다.
  // 그래야 "슛 점만" 을 코드에서도 시험에서도 정확히 집어낼 수 있다.
  return shots.map((e) => (e.made
    ? `<circle class="shot-made" cx="${e.x}" cy="${e.y}" r="${r}" fill="${c.made}" opacity="${op}" />`
    : `<path class="shot-miss" d="M ${e.x - r} ${e.y - r} L ${e.x + r} ${e.y + r} M ${e.x + r} ${e.y - r} L ${e.x - r} ${e.y + r}"`
      + ` fill="none" stroke="${c.miss}" stroke-width="${w}" opacity="${op}" stroke-linecap="round" />`)).join("");
}

/** 화면에 넣을 <svg> 속. 바깥 <svg> 태그는 부르는 쪽이 감싼다. */
export function 차트속(shots, c = 화면색) {
  return 코트선(c) + 점들(shots, c);
}

/** SVG 문자열 → PNG Blob. 배율은 곱이다 — 1000 폭 SVG 에 2를 주면 2000px 로 나온다.
 *
 *  색을 var(--…) 로 남겨 두면 독립 SVG 안에서 안 풀려 아무것도 안 그려진다.
 *  내보내는 그림은 테마를 안 따라야 하므로 부르는 쪽에서 실제 색을 박아 넣는다. */
export function PNG만들기(svg, 배율 = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * 배율);
      cv.height = Math.round(img.height * 배율);
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("그림을 만들지 못했습니다"))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("그림을 그리지 못했습니다")); };
    img.src = url;
  });
}

/** 자리별 칸에 쓸 말. 시도가 없으면 "–" 로 둔다 — 0% 가 아니다. */
export function 구역말(z) {
  return { 몫: `${z.m}/${z.a}`, 율: z.a ? `${Math.round((z.m / z.a) * 100)}%` : "–" };
}

export { 구역이름 };
