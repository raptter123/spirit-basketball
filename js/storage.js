const PREFIX = "spirit-tactic-override:";

export function getOverride(id) {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOverride(id, data) {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(data));
  } catch {
    // localStorage 사용 불가 환경(프라이빗 모드 등)에서는 조용히 무시한다.
  }
}

export function clearOverride(id) {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    // no-op
  }
}

const FAVORITES_KEY = "spirit-tactic-favorites";

export function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(id) {
  const favorites = new Set(getFavorites());
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  } catch {
    // no-op
  }
  return favorites.has(id);
}

// 선수 명단은 js/roster.js 한 곳에서만 관리한다.
// (예전에는 브라우저에만 저장되는 '선수 추가' 기능이 있었지만, 그 브라우저에서만 보여서 혼란스러웠다.)

const THEME_KEY = "spirit-theme";

export function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // no-op
  }
}

const NEW_TACTIC_DRAFT_KEY = "spirit-new-tactic-draft";

export function getNewTacticDraft() {
  try {
    const raw = localStorage.getItem(NEW_TACTIC_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveNewTacticDraft(draft) {
  try {
    localStorage.setItem(NEW_TACTIC_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // no-op
  }
}

export function clearNewTacticDraft() {
  try {
    localStorage.removeItem(NEW_TACTIC_DRAFT_KEY);
  } catch {
    // no-op
  }
}

const TEAM_BUILDER_DRAFT_KEY = "spirit-team-builder-draft";

export function getTeamBuilderDraft() {
  try {
    const raw = localStorage.getItem(TEAM_BUILDER_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTeamBuilderDraft(draft) {
  try {
    localStorage.setItem(TEAM_BUILDER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // no-op
  }
}

export function clearTeamBuilderDraft() {
  try {
    localStorage.removeItem(TEAM_BUILDER_DRAFT_KEY);
  } catch {
    // no-op
  }
}

// 지난번 자체전에 나온 사람들. 위의 '짜던 것(draft)'과는 다르다 —
// draft 는 팀 편성 화면을 벗어나면 지워지지만, 이건 다음 주까지 남아 있어야 한다.
// 매주 오는 얼굴이 크게 안 바뀌는데 36명을 매번 처음부터 찍고 있었다.
const LAST_ATTENDEES_KEY = "spirit-last-attendees";

export function getLastAttendees() {
  try {
    const raw = localStorage.getItem(LAST_ATTENDEES_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && Array.isArray(v.names) && v.names.length ? v : null;
  } catch {
    return null;
  }
}

// 빈 명단은 저장하지 않는다. '전체 초기화'가 곧 기억을 지우는 일이 되면 안 된다.
export function saveLastAttendees(names, savedFor) {
  if (!Array.isArray(names) || !names.length) return;
  try {
    localStorage.setItem(LAST_ATTENDEES_KEY, JSON.stringify({ names, savedFor }));
  } catch {
    // no-op
  }
}

const TACTIC_SIM_KEY = "spirit-tactic-sim-assignment";

export function getTacticSimAssignment() {
  try {
    const raw = localStorage.getItem(TACTIC_SIM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTacticSimAssignment(assignment) {
  try {
    localStorage.setItem(TACTIC_SIM_KEY, JSON.stringify(assignment));
  } catch {
    // no-op
  }
}

export function clearTacticSimAssignment() {
  try {
    localStorage.removeItem(TACTIC_SIM_KEY);
  } catch {
    // no-op
  }
}

const BOARD_KEY = "spirit-board";

// 작전판은 새로고침이나 실수로 나갔다 와도 그리던 게 남아 있어야 한다.
// (전술 초안과 달리 화면을 떠난다고 지우지 않는다 — 지우는 건 "판 비우기" 뿐이다.)
// 저장된 값은 예전 버전이 남긴 것일 수도, 손으로 건드려 깨진 것일 수도 있다.
// 그대로 믿고 쓰면 작전판이 통째로 안 뜨는데, 사용자는 원인도 모르고 지울 방법도 없다.
// 그래서 모양이 맞는 것만 통과시키고 나머지는 버린다 — 최악이라도 처음 배치로 열린다.
const BOARD_VIEWS = ["full", "left", "right"];

function cleanBoardState(saved) {
  if (!saved || typeof saved !== "object") return null;
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  return {
    pieces: Array.isArray(saved.pieces)
      ? saved.pieces.filter((p) => p && typeof p === "object" && num(p.x) && num(p.y))
      : [],
    arrows: Array.isArray(saved.arrows)
      ? saved.arrows.filter((a) => Array.isArray(a) && a.length === 4 && a.every(num))
      : [],
    view: BOARD_VIEWS.includes(saved.view) ? saved.view : null,
    formation: typeof saved.formation === "string" ? saved.formation : null,
  };
}

export function getBoardState() {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    return raw ? cleanBoardState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveBoardState(state) {
  try {
    localStorage.setItem(BOARD_KEY, JSON.stringify(state));
  } catch {
    // no-op
  }
}

export function clearBoardState() {
  try {
    localStorage.removeItem(BOARD_KEY);
  } catch {
    // no-op
  }
}

const GAME_STATS_KEY = "spirit-game-stats";

// 기록 입력은 한 번에 끝나지 않는다 — 종이를 보며 옮겨 적다가 전화도 받고, 실수로
// 뒤로 가기도 누른다. 그래서 작전판처럼 화면을 떠나도 남겨두고, 지우는 건 "새 경기"뿐이다.
export function getGameStatsDraft() {
  try {
    const raw = localStorage.getItem(GAME_STATS_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (!saved || typeof saved !== "object") return null;
    // teams = 지금 모양(두 팀), players = 한 팀만 담던 예전 모양.
    // 예전 초안도 돌려준다 — 옮기는 건 statspage.js 의 cleanGame 이 한다.
    return Array.isArray(saved.teams) || Array.isArray(saved.players) ? saved : null;
  } catch {
    return null;
  }
}

export function saveGameStatsDraft(game) {
  try {
    localStorage.setItem(GAME_STATS_KEY, JSON.stringify(game));
  } catch {
    // no-op
  }
}

export function clearGameStatsDraft() {
  try {
    localStorage.removeItem(GAME_STATS_KEY);
  } catch {
    // no-op
  }
}

const SHEET_ROSTER_KEY = "spirit-sheet-rosters";

// 기록지를 뽑을 때 그 종이에 인쇄한 명단을 적어 둔다.
// 판독기는 "몇 번째 줄"까지만 알고 이름은 인쇄된 글자라 못 읽는다. 뽑을 때 적어 두면
// 사진을 올렸을 때 줄 번호로 이름을 되찾을 수 있다 — 사람이 여덟 번 고를 일이 없어진다.
// 열쇠는 "260823_1|혼 A" 처럼 날짜·경기·팀이다.
export function saveSheetRoster(key, roster) {
  try {
    const all = JSON.parse(localStorage.getItem(SHEET_ROSTER_KEY) || "{}");
    all[key] = roster;
    // 오래된 건 버린다 — 한 시즌 치가 쌓일 이유가 없다.
    const keys = Object.keys(all);
    if (keys.length > 60) for (const k of keys.slice(0, keys.length - 60)) delete all[k];
    localStorage.setItem(SHEET_ROSTER_KEY, JSON.stringify(all));
  } catch {
    // no-op
  }
}

export function getSheetRoster(key) {
  try {
    const all = JSON.parse(localStorage.getItem(SHEET_ROSTER_KEY) || "{}");
    const r = all[key];
    return Array.isArray(r) ? r : null;
  } catch {
    return null;
  }
}

/** 적어 둔 기록지 명단 전부. 사진 속 코드와 대조해 어느 종이인지 가려낼 때 쓴다. */
export function allSheetRosters() {
  try {
    const all = JSON.parse(localStorage.getItem(SHEET_ROSTER_KEY) || "{}");
    return Object.entries(all)
      .filter(([, r]) => Array.isArray(r))
      .map(([key, roster]) => ({ key, roster }));
  } catch {
    return [];
  }
}
