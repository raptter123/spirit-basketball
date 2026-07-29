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

const CUSTOM_ROSTER_KEY = "spirit-custom-roster";

export function getCustomRoster() {
  try {
    const raw = localStorage.getItem(CUSTOM_ROSTER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addCustomRosterEntry(entry) {
  const list = getCustomRoster();
  list.push({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  try {
    localStorage.setItem(CUSTOM_ROSTER_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
  return list;
}

export function removeCustomRosterEntry(id) {
  const list = getCustomRoster().filter((p) => p.id !== id);
  try {
    localStorage.setItem(CUSTOM_ROSTER_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
  return list;
}

const CUSTOM_TEAM_HISTORY_KEY = "spirit-custom-team-history";

export function getCustomTeamHistory() {
  try {
    const raw = localStorage.getItem(CUSTOM_TEAM_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addCustomTeamHistoryEntry(entry) {
  const list = getCustomTeamHistory();
  list.push({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
  try {
    localStorage.setItem(CUSTOM_TEAM_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
  return list;
}

export function removeCustomTeamHistoryEntry(id) {
  const list = getCustomTeamHistory().filter((h) => h.id !== id);
  try {
    localStorage.setItem(CUSTOM_TEAM_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // no-op
  }
  return list;
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
