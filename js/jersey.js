// 등번호는 민소매 유니폼 모양 안에 넣어 보여준다.
// 로스터 카드·선수 상세(HTML)와 팀 공지 이미지(캔버스)가 같은 모양을 써야 해서 여기 모아둔다.
//
// 심인보가 실제로 0번이다. 0은 거짓 값이라 `p.number ? ...`로 판단하면 번호가 사라진다.
// 반드시 `typeof p.number === "number"`로 확인할 것.

// 아래 좌표는 viewBox "0 0 40 46" 기준. 실제 그림이 차지하는 범위는 VIEW에 적어뒀다
// (캔버스에서는 여백 없이 그려야 해서 이 값으로 옮기고 키운다).
export const JERSEY_PATH =
  "M6 11 L13.5 2.5 C15.5 8 24.5 8 26.5 2.5 L34 11 C34 16.5 32.5 18.5 31 19.5 L31 40 " +
  "C31 42.5 29.5 43.5 27.5 43.5 L12.5 43.5 C10.5 43.5 9 42.5 9 40 L9 19.5 C7.5 18.5 6 16.5 6 11 Z";
export const JERSEY_COLLAR_PATH = "M13.5 2.5 C15.5 8 24.5 8 26.5 2.5";
export const JERSEY_VIEW = { x: 6, y: 2.5, w: 28, h: 41 };
// 번호의 세로 가운데. 겨드랑이(19.5) 아래 몸통 한가운데보다 살짝 위 — 가슴 쪽에 오게.
export const JERSEY_NUM_CY = 29;

export function hasNumber(p) {
  return !!p && typeof p.number === "number";
}

export function jerseyHTML(p, extraClass = "") {
  const has = hasNumber(p);
  const twoDigit = has && String(p.number).length > 1;
  return `
    <span class="jersey ${has ? "" : "is-blank"} ${extraClass}" role="img"
          aria-label="${has ? `등번호 ${p.number}번` : "등번호 미정"}">
      <svg viewBox="0 0 40 46" aria-hidden="true">
        <path class="jersey-body" d="${JERSEY_PATH}" />
        <path class="jersey-collar" d="${JERSEY_COLLAR_PATH}" />
        ${
          has
            ? `<text class="jersey-number" x="20" y="${twoDigit ? 34 : 34.5}" text-anchor="middle"
                     font-size="${twoDigit ? 13.5 : 16}">${p.number}</text>`
            : ""
        }
      </svg>
    </span>`;
}
