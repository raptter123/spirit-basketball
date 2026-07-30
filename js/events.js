// 대회/경기 일정 데이터.
// EVENTS: 특정 날짜 하루짜리 일정 (date는 YYYY-MM-DD).
// RECURRING_EVENTS: 매주 반복되는 일정 (weekday: 0=일요일 ~ 6=토요일).
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
    rules: e.rules,
    notes: e.notes,
    recurring: true,
  }));
}

export function getEventsOn(dateStr) {
  return [...recurringEventsOn(dateStr), ...EVENTS.filter((e) => e.date === dateStr)];
}

// fromDateStr 기준 windowDays 일 안의 모든 일정(반복 + 단발성)을 날짜순으로 반환.
// 자체전처럼 매주 반복되는 일정은 매번 나열하면 목록만 길어지고 정보가 없으므로,
// 가장 가까운 한 번만 남기고 나머지는 걸러낸다. 대회처럼 반복이 아닌 일정은 전부 그대로 보여준다.
export function getUpcomingEvents(fromDateStr, windowDays = 60) {
  const from = new Date(`${fromDateStr}T00:00:00`);
  const result = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push(...getEventsOn(dateStr));
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
