// 대회/경기 일정 데이터.
// EVENTS: 특정 날짜 하루짜리 일정 (date는 YYYY-MM-DD).
// RECURRING_EVENTS: 매주 반복되는 일정 (weekday: 0=일요일 ~ 6=토요일).
import { dateStr } from "./util.js";

export const EVENTS = [
  {
    date: "2026-08-08",
    title: "스타터스 리그 대회",
    type: "대회",
    location: "남양주 스포라운드",
    note: "10:00 ~ (결승 15:30)",
    format: "3팀 2개조 / 조별 1위간 결승전 진행",
    fee: "360,000원",
    gameTime: "7분 4Q 경기(2심) / 1~3쿼터 1분 데드, 4쿼터 2분 풀데드",
    ball: "몰텐 BG4500",
  },
  {
    date: "2026-08-23",
    title: "S리그 대회",
    type: "대회",
    location: "중곡문화체육센터",
    note: "09:30 ~ (승자전 11:20, 패자전 12:10)",
    format: "4팀 1개조 / 더블엘리미네이션 방식 (2승 시 토너먼트 진출, 2패 시 탈락, 1승1패 시 9/27 최종전)",
    gameTime: "7분 4Q 경기",
    ball: "윌슨 evo nxt",
  },
  {
    date: "2026-09-27",
    title: "S리그 최종전",
    type: "대회",
    location: "중곡문화체육센터",
    note: "15:20 ~",
    format: "vs ARA (반대 블록의 검은팀)",
    gameTime: "7분 4Q 경기 (타임아웃 전반 1, 후반 2)",
    ball: "윌슨 evo nxt",
  },
];

export const RECURRING_EVENTS = [
  {
    weekday: 0,
    title: "자체전",
    type: "자체전",
    location: "신당초등학교",
    address: "서울시 중구 난계로 141 (지번: 신당동 161-2)",
    startTime: "12:00",
    endTime: "15:00",
    // 홈 '다음 일정' 카드가 한 줄로 보여 주는 값. 아래 rules 첫째 · 둘째 문장과 같은
    // 내용이므로, 마감 요일이나 인원이 바뀌면 두 곳을 같이 고친다.
    //   rsvpWeekday: 참불 체크 마감 요일(0=일 ~ 6=토) · guestLimit: 이 인원 이상이면 게스트 없음
    rsvpWeekday: 3,
    guestLimit: 18,
    entrance: "후문 입장",
    rules: [
      '농구 참불 체크 가급적 "수요일"까지 체크 바랍니다',
      "수요일 기준 참불체크 18명 이상 시 게스트는 받지 않습니다 (가급적 댓글도 남겨주세요)",
      "농구 종료 후(14:55)에는 코트에 들어가지 마세요 (화장실·샤워실 이동 시에도 금지)",
      "참 누르고 노쇼 금지 / 참 안 누르고 참석 금지",
    ],
    notes: [
      "주차(유료): 성동고등학교 공영주차장(퇴계로90길 17) — 주차비 지원 예정(카카오로 안내), 영수증(카드내역)은 반드시 총무에게 공유",
      "샤워 가능 (15:20까지 체육관 퇴장)",
      "후문으로 입장",
    ],
  },
];

// 정기 일정을 쉬는 날(연말 · 설 연휴 등). date 는 그 정기 일정이 열렸을 날짜,
// title 은 위 RECURRING_EVENTS 의 title, reason 은 화면에 그대로 나가는 까닭.
// 여기에 적으면 홈 '다음 일정' · 달력 · 팀 편성 기본 날짜가 그 날을 건너뛴다.
//   예) { date: "2027-02-07", title: "자체전", reason: "설날" },
export const SKIP_DAYS = [
];

function 쉬는날(dateStr, title) {
  return SKIP_DAYS.find((s) => s.date === dateStr && s.title === title) || null;
}

export const EVENT_TYPE_COLOR = {
  자체전: "var(--offense)",
  대회: "var(--defense)",
};

function recurringEventsOn(dateStr) {
  const weekday = new Date(`${dateStr}T00:00:00`).getDay();
  return RECURRING_EVENTS.filter((e) => e.weekday === weekday).map((e) => ({
    date: dateStr,
    title: e.title,
    type: e.type,
    location: e.location,
    address: e.address,
    note: `${e.startTime} ~ ${e.endTime}`,
    startTime: e.startTime,
    endTime: e.endTime,
    rsvpWeekday: e.rsvpWeekday,
    guestLimit: e.guestLimit,
    entrance: e.entrance,
    rules: e.rules,
    notes: e.notes,
    recurring: true,
    // 쉬는 날이면 일정은 남기되(달력에 '쉼' 으로 보이게) 표시를 단다.
    ...(쉬는날(dateStr, e.title) ? { skipped: true, skipReason: 쉬는날(dateStr, e.title).reason || "" } : {}),
  }));
}

export function getEventsOn(dateStr) {
  return [...recurringEventsOn(dateStr), ...EVENTS.filter((e) => e.date === dateStr)];
}

// fromDateStr 기준 windowDays 일 안의 모든 일정(반복 + 단발성)을 날짜순으로 반환.
// 쉬는 날(SKIP_DAYS)의 정기 일정은 빼고 그다음 주를 보여 준다.
// 자체전처럼 매주 반복되는 일정은 매번 나열하면 목록만 길어지고 정보가 없으므로,
// 가장 가까운 한 번만 남기고 나머지는 걸러낸다. 대회처럼 반복이 아닌 일정은 전부 그대로 보여준다.
export function getUpcomingEvents(fromDateStr, windowDays = 60) {
  const from = new Date(`${fromDateStr}T00:00:00`);
  const result = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    result.push(...getEventsOn(dateStr(d)).filter((e) => !e.skipped));
  }
  result.sort((a, b) => a.date.localeCompare(b.date));

  const seenRecurring = new Set();
  return result.filter((e) => {
    if (!e.recurring) return true;
    if (seenRecurring.has(e.title)) return false;
    seenRecurring.add(e.title);
    return true;
  });
}

/** fromDateStr 부터 toDateStr 전날까지 쉬는 정기 일정. 홈 카드가 "11/1 은 쉬어요" 를 띄운다. */
export function getSkippedBetween(fromDateStr, toDateStr) {
  return SKIP_DAYS
    .filter((s) => s.date >= fromDateStr && s.date < toDateStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// fromDateStr 이후 가장 가까운 title 일정의 날짜. 없으면 null.
// 연말처럼 두 주를 잇달아 쉬어도 찾도록 4주를 본다.
export function getNextEventDate(title, fromDateStr, windowDays = 28) {
  const match = getUpcomingEvents(fromDateStr, windowDays).find((e) => e.title === title);
  return match ? match.date : null;
}
