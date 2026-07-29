import { getCustomTeamHistory } from "./storage.js";

// 실제 자체전 날 어떻게 팀이 짜였는지 기록. date는 YYYY-MM-DD, teams는 팀별 이름 배열의 배열
// (2팀 또는 3팀 모두 가능). 여기 있는 항목은 모두에게 보이는 확정 기록이고,
// 브라우저에 로컬로만 저장된 항목은 getCustomTeamHistory()에서 합쳐진다.
export const TEAM_HISTORY = [];

export function getAllHistory() {
  return [...TEAM_HISTORY, ...getCustomTeamHistory()].sort((a, b) => b.date.localeCompare(a.date));
}

export function getHistoryOn(dateStr) {
  return getAllHistory().filter((h) => h.date === dateStr);
}
