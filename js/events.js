// 대회/경기 일정 데이터. date는 YYYY-MM-DD, type은 대회/경기/훈련 등 자유롭게 사용.
export const EVENTS = [
  {
    date: "2026-08-02",
    title: "정기 리그 3라운드",
    type: "경기",
    location: "잠실체육관",
    note: "오후 7시 집합, 유니폼 지참",
  },
  {
    date: "2026-08-16",
    title: "팀 내 3x3 미니게임",
    type: "훈련",
    location: "혼 홈코트",
    note: "팀 내 친선전, 참가 신청은 밴드에서",
  },
  {
    date: "2026-09-05",
    title: "추계 동호인 대회 예선",
    type: "대회",
    location: "송파구민체육관",
    note: "",
  },
  {
    date: "2026-09-20",
    title: "추계 동호인 대회 본선",
    type: "대회",
    location: "송파구민체육관",
    note: "예선 통과 시 진행",
  },
  {
    date: "2026-10-10",
    title: "정기 리그 플레이오프",
    type: "경기",
    location: "잠실체육관",
    note: "",
  },
];

export function getEventsOn(dateStr) {
  return EVENTS.filter((e) => e.date === dateStr);
}
