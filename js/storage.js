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
