// 기록하는 동안 폰 화면이 저절로 꺼지지 않게 한다(Screen Wake Lock API).
//
// 왜
//   작전 타임 · 쉬는 시간에 폰을 안 만지면 자동 잠금(아이폰 기본 30초)으로 화면이 꺼지고,
//   잠금을 푸는 사이 다음 플레이를 놓친다. 브라우저에 "이 화면은 켜 둬" 를 부탁하면
//   운영체제의 자동 잠금 시계가 멈춘다. 전원 단추로 끄는 것은 그대로 된다.
//
// 지켜야 할 것
//   - 브라우저는 탭이 가려지면(다른 앱 · 탭 전환 · 화면 끔) 부탁을 저절로 놓는다.
//     그래서 다시 보일 때 원하는 상태면 새로 부탁한다(visibilitychange).
//   - 지원하지 않거나 거절하면 지금처럼 동작할 뿐이다. 오류를 띄우지 않는다.
//   - 경기 기록 화면에서만 켠다. 다른 화면에서 화면을 켜 둘 까닭이 없고 배터리만 쓴다.
//   - 아이폰 '홈 화면 앱' 에서는 iOS 버전에 따라 안 먹는다는 보고가 있다(WebKit 버그
//     254545). 사파리 · 안드로이드 크롬은 된다. 실제 폰으로 확인해야 하는 부분이다.

let 원함 = false;
let 잠금 = null;      // WakeLockSentinel | null
let 부탁중 = false;   // 부탁이 끝나기 전에 또 부탁하지 않게

async function 부탁() {
  if (!원함 || 잠금 || 부탁중 || document.visibilityState !== "visible") return;
  if (!("wakeLock" in navigator)) return;
  부탁중 = true;
  try {
    const s = await navigator.wakeLock.request("screen");
    // 기다리는 사이 기록 화면을 벗어났으면 바로 놓는다.
    if (!원함) { s.release().catch(() => {}); return; }
    잠금 = s;
    s.addEventListener("release", () => { if (잠금 === s) 잠금 = null; });
  } catch (e) {
    // 배터리 절약 모드 등으로 거절될 수 있다. 그러면 평소처럼 꺼진다.
  } finally {
    부탁중 = false;
  }
}

/** 켜 둘지 말지. 기록 화면(경기 중)에 들어가면 true, 벗어나면 false. */
export function 화면켜두기(on) {
  원함 = !!on;
  if (원함) {
    부탁();
  } else if (잠금) {
    const s = 잠금;
    잠금 = null;
    s.release().catch(() => {});
  }
}

/** 지금 화면을 켜 두고 있나(시험용). */
export function 화면켜둠상태() {
  return { 원함, 잠금: !!잠금 };
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") 부탁();
});
