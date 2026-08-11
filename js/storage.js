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
