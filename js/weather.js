// 홈 '다음 일정' 카드의 날씨 한 줄 — "☁️ 12시 3°C · 15시 5°C · 흐림 · 10:24 받은 예보".
//
// 어디서
//   Open-Meteo(https://open-meteo.com) — 열쇠(API key)가 없어도 되는 무료 날씨 서비스.
//   이 사이트는 열쇠를 숨길 곳이 없어서 열쇠 없는 곳만 쓸 수 있다. 한국 기상청 모델
//   (kma_seamless: 한반도 1.5km 격자, 6시간마다 새로 계산)을 먼저 묻고, 그 모델 이름을
//   못 알아들으면 기본 모델로 한 번 더 묻는다.
//
// 언제
//   경기 시작 48시간 전부터 경기 끝까지만 보여 준다(일요일 12시 경기면 금요일 12시부터).
//   촘촘한 한국 모델이 내다보는 거리가 이틀이라, 그보다 이른 예보는 자주 바뀐다.
//   열 때마다 묻지 않고 1시간 안에는 받아 둔 것을 쓴다(storage.js 의 spirit-weather).
//
// 못 받으면
//   신호가 끊겼거나 서비스가 멈추면 이 줄만 빠진다. 나머지 화면은 그대로다.
import { getWeatherCache, saveWeatherCache } from "./storage.js";

// 신당초등학교(서울 중구 난계로 141) 어림 좌표. 1.5km 격자라 동네 단위면 충분하다.
const 좌표 = { lat: 37.5665, lon: 127.0175 };
const 보관 = 60 * 60 * 1000;
const 미리 = 48 * 60 * 60 * 1000;

const 시각 = (date, hhmm) => new Date(`${date}T${hhmm}:00+09:00`).getTime();

/** 이 일정에 날씨 줄을 띄울 때인가(경기 시작 48시간 전 ~ 경기 끝). */
export function 날씨보일때(e, now = Date.now()) {
  if (!e?.startTime || !e?.endTime) return false;
  const 시작 = 시각(e.date, e.startTime), 끝 = 시각(e.date, e.endTime);
  return now >= 시작 - 미리 && now <= 끝;
}

// WMO 날씨 코드 → 가장 궂은 것 하나. 눈 > 비 > 뇌우 > 흐림 > 구름 조금 > 맑음.
function 날씨말(codes) {
  const 있나 = (f) => codes.some(f);
  if (있나((c) => (c >= 71 && c <= 77) || c === 85 || c === 86)) return ["❄️", "눈"];
  if (있나((c) => c >= 95)) return ["⛈️", "뇌우"];
  if (있나((c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82))) return ["🌧️", "비"];
  if (있나((c) => c === 3 || c === 45 || c === 48)) return ["☁️", "흐림"];
  if (있나((c) => c === 1 || c === 2)) return ["⛅", "구름 조금"];
  return ["☀️", "맑음"];
}

/** Open-Meteo 응답에서 경기 시간대를 뽑아 한 줄로. 모자라면 null. */
export function 날씨줄(data, e, 받은시각) {
  const h = data?.hourly;
  if (!h?.time?.length) return null;
  const 시작시 = Number(e.startTime.slice(0, 2)), 끝시 = Number(e.endTime.slice(0, 2));
  const 칸 = (시) => h.time.indexOf(`${e.date}T${String(시).padStart(2, "0")}:00`);
  const a = 칸(시작시), z = 칸(끝시);
  if (a < 0 || z < 0) return null;
  const 기온 = (i) => `${Math.round(h.temperature_2m[i])}°C`.replace("-", "−");
  const codes = (h.weather_code || []).slice(a, z + 1).filter((c) => c != null);
  const [ic, 말] = 날씨말(codes);
  const 받음 = new Date(받은시각);
  const hh = String(받음.getHours()).padStart(2, "0"), mm = String(받음.getMinutes()).padStart(2, "0");
  return { ic, 글: `${시작시}시 ${기온(a)} · ${끝시}시 ${기온(z)} · ${말}`, 받음: `${hh}:${mm} 받은 예보` };
}

async function 받기(e) {
  const 묻기 = async (모델) => {
    const q = new URLSearchParams({
      latitude: 좌표.lat, longitude: 좌표.lon, hourly: "temperature_2m,weather_code",
      timezone: "Asia/Seoul", start_date: e.date, end_date: e.date,
    });
    if (모델) q.set("models", 모델);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: ctl.signal });
      return r.ok ? await r.json() : null;
    } finally {
      clearTimeout(t);
    }
  };
  return (await 묻기("kma_seamless")) || (await 묻기(null));
}

/** 홈 카드의 날씨 자리(el)를 채운다. 못 받으면 숨긴 채로 둔다. */
export async function 날씨채우기(el, e) {
  if (!el || !날씨보일때(e)) return;
  // 자동 시험(Playwright 등)에서는 묻지 않는다 — 다른 시험이 주말 날짜로 홈을 열 때마다 진짜
  // 날씨 서비스를 부르면 결과가 그날 날씨와 신호에 따라 흔들린다. 날씨 시험만 켜고 잰다.
  if (navigator.webdriver && !window.__날씨시험) return;
  const 열쇠 = `${e.date} ${e.startTime}-${e.endTime}`;
  let 줄 = null;
  const 둔것 = getWeatherCache();
  if (둔것 && 둔것.열쇠 === 열쇠 && Date.now() - 둔것.at < 보관) {
    줄 = 둔것.줄;
  } else {
    try {
      const data = await 받기(e);
      const at = Date.now();
      줄 = data ? 날씨줄(data, e, at) : null;
      if (줄) saveWeatherCache({ 열쇠, at, 줄 });
    } catch {
      줄 = null;
    }
  }
  if (!줄 || !el.isConnected) return;
  el.innerHTML = `<span aria-hidden="true">${줄.ic}</span> <b>${줄.글}</b> <small>${줄.받음}</small>`;
  el.hidden = false;
}
