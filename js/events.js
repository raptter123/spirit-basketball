// 대회/경기 일정 데이터.
// EVENTS: 특정 날짜 하루짜리 일정 (date는 YYYY-MM-DD).
// RECURRING_EVENTS: 매주 반복되는 일정 (weekday: 0=일요일 ~ 6=토요일).
export const EVENTS = [
  {
    date: "2026-08-08",
    title: "스타터스 리그 대회",
    type: "대회",
    location: "",
    note: "",
  },
  {
    date: "2026-08-22",
    title: "S리그 대회",
    type: "대회",
    location: "",
    note: "",
  },
];

export const RECURRING_EVENTS = [
  {
    weekday: 0,
    title: "자체전",
    type: "자체전",
    location: "신당초",
    startTime: "12:00",
    endTime: "15:00",
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
    note: `${e.startTime} ~ ${e.endTime}`,
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
