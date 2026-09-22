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

// 그날만 뛰는 게스트. 로스터에는 절대 넣지 않는다 — roster.js 맨 위 경고대로,
// 이미 인쇄해 둔 기록지의 이름 칸 버블이 그 배열의 *순서*를 가리키고 있어서
// 중간에 끼우면 종이가 엉뚱한 사람을 가리킨다.
//
// 경기 날짜를 열쇠로 쓴다. 그래서 규칙 세 가지가 저절로 맞는다:
//   - 같은 날이면 화면을 나갔다 와도 남아 있다 (초안처럼 날아가지 않는다)
//   - 날짜를 다음 주로 바꾸면 빈 목록이다 — 지우는 걸 기억할 필요가 없다
//   - '지난번 그대로'가 게스트를 데려올 일이 없다 (저장 자체가 분리돼 있다)
const GUESTS_KEY = "spirit-guests-by-date";
const GUEST_DAYS_KEPT = 8;

export function getGuests(dateStr) {
  if (!dateStr) return [];
  try {
    const all = JSON.parse(localStorage.getItem(GUESTS_KEY) || "{}");
    const v = all[dateStr];
    return Array.isArray(v) ? v.filter((n) => typeof n === "string") : [];
  } catch {
    return [];
  }
}

export function saveGuests(dateStr, names) {
  if (!dateStr) return;
  try {
    const all = JSON.parse(localStorage.getItem(GUESTS_KEY) || "{}");
    if (names && names.length) all[dateStr] = names;
    else delete all[dateStr];
    // 날짜별로 쌓이니 오래된 건 버린다. 지난 경기 것을 며칠은 남겨 둬야
    // "어제 그 게스트 누구였지"를 다시 볼 수 있다.
    const keys = Object.keys(all).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - GUEST_DAYS_KEPT))) delete all[k];
    localStorage.setItem(GUESTS_KEY, JSON.stringify(all));
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

const RECORD_GAME_KEY = "spirit-record-game";

// 기록 중인 경기. 이벤트 원본을 통째로 담는다.
//
// 화면을 나가도, 폰이 잠겨도 남아 있어야 한다 — 경기 도중에 전화가 오거나 사파리가
// 탭을 재우는 일이 실제로 생긴다. 지우는 건 사람이 '기록 버리기'나 '새 경기'를
// 눌렀을 때뿐이다.
export function getRecordGame() {
  try {
    const raw = localStorage.getItem(RECORD_GAME_KEY);
    const g = raw ? JSON.parse(raw) : null;
    // 모양이 깨진 것은 없는 셈 친다 — 반쯤 읽힌 경기로 화면이 죽는 것보다 낫다.
    return g && Array.isArray(g.events) && Array.isArray(g.teams) ? g : null;
  } catch {
    return null;
  }
}

export function saveRecordGame(game) {
  try {
    localStorage.setItem(RECORD_GAME_KEY, JSON.stringify(game));
  } catch {
    // no-op
  }
}

export function clearRecordGame() {
  try {
    localStorage.removeItem(RECORD_GAME_KEY);
  } catch {
    // no-op
  }
}

const RECORD_ARCHIVE_KEY = "spirit-record-games";
// 경기 하나에 이벤트 200개면 대략 16KB 다. 20경기면 320KB 로, 브라우저가 주는
// 5MB 안에 넉넉히 들어간다. 그래도 넘치면 오래된 것부터 버리고 다시 시도한다.
const ARCHIVE_MAX = 20;

/** 끝낸 경기 보관함. 최근 것이 앞에 온다.
 *
 *  '새 경기'를 누르면 기록 중이던 경기가 통째로 사라지던 것을 막으려고 둔다.
 *  결과 화면에 들어가는 순간 여기에 들어오므로, 엑셀을 못 받고 화면을 닫아도
 *  나중에 다시 받을 수 있다. */
export function getRecordArchive() {
  try {
    const raw = localStorage.getItem(RECORD_ARCHIVE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter((g) => g && Array.isArray(g.events) && Array.isArray(g.teams));
  } catch {
    return [];
  }
}

/** 보관함에 넣는다. 같은 경기(startedAt)면 덮어쓴다 —
 *  결과 화면을 여러 번 드나들어도 같은 경기가 여러 개 쌓이면 안 된다. */
export function archiveRecordGame(game) {
  if (!game || !Array.isArray(game.events)) return;
  let list = getRecordArchive().filter((g) => g.startedAt !== game.startedAt);
  list.unshift(game);
  list = list.slice(0, ARCHIVE_MAX);
  while (list.length) {
    try {
      localStorage.setItem(RECORD_ARCHIVE_KEY, JSON.stringify(list));
      return;
    } catch {
      // 자리가 모자라면 가장 오래된 경기를 버리고 다시 시도한다.
      // 방금 끝낸 경기를 못 넣는 것이 제일 나쁘다.
      if (list.length === 1) return;
      list.pop();
    }
  }
}

export function removeArchivedGame(startedAt) {
  try {
    const list = getRecordArchive().filter((g) => g.startedAt !== startedAt);
    localStorage.setItem(RECORD_ARCHIVE_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
}

/** 보관함을 통째로 비운다. 시험 삼아 찍어 본 경기를 실전 전에 치울 때 쓴다.
 *  기록 중인 경기는 다른 칸에 있으므로 여기서 건드리지 않는다. */
export function clearRecordArchive() {
  try {
    localStorage.removeItem(RECORD_ARCHIVE_KEY);
  } catch {
    // no-op
  }
}
