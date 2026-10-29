// 홈 '다음 일정' 카드의 일요일 날씨 한 줄(js/weather.js).
//
// 날씨 서비스(Open-Meteo)는 시험 중에 부르지 않는다 — 가짜 응답을 끼워 넣고 재는 것은
// 언제 묻고 · 무엇을 보여 주고 · 못 받으면 어떻게 되는가다.
//
// 1) 경기 시작 48시간 전(일요일 12시 경기 → 금요일 12시)부터만 보인다. 그 전에는 묻지도 않는다.
// 2) 한국 기상청 모델(kma_seamless)로 묻고, "12시 −3°C · 15시 −1°C · 눈 · 12:30 받은 예보".
// 3) 1시간 안에 다시 열면 받아 둔 것을 쓰고(묻지 않음), 1시간이 지나면 새로 묻는다.
// 4) 모델 이름을 못 알아들으면(400) 기본 모델로 한 번 더 묻는다.
// 5) 신호가 끊기면 이 줄만 숨는다 — 오류 없음.
// 6) 경기가 끝나면 사라진다.
// 7) 시험 표시(__날씨시험)가 없는 자동 시험 브라우저에서는 묻지 않는다 — 다른 시험이 흔들리지 않게.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];

const 가짜 = (date) => {
  const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, "0")}:00`);
  const temperature_2m = time.map((_, h) => (h < 12 ? -4.6 : h === 12 ? -3.2 : h === 15 ? -0.6 : -2));
  const weather_code = time.map((_, h) => (h === 13 ? 73 : 3));
  return { hourly: { time, temperature_2m, weather_code } };
};

async function 열기(시각, { 모드 = "정상" } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul" });
  await ctx.addInitScript(() => { window.__날씨시험 = true; });   // 자동 시험에서도 묻게(weather.js)
  const 물음 = [];
  await ctx.route("https://api.open-meteo.com/**", async (route) => {
    const u = new globalThis.URL(route.request().url());
    물음.push(u.searchParams.get("models") || "기본");
    if (모드 === "끊김") return route.abort();
    if (모드 === "모델모름" && u.searchParams.get("models")) return route.fulfill({ status: 400, body: '{"error":true}' });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(가짜(u.searchParams.get("start_date"))) });
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date(시각) });
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(600);
  return { p, ctx, 물음 };
}
const 줄 = (p) => p.evaluate(() => {
  const el = document.getElementById("home-weather");
  return el ? { 자리: true, 보임: !el.hidden, 글: el.textContent.replace(/\s+/g, " ").trim() } : { 자리: false };
});

{
  const { p, ctx, 물음 } = await 열기("2026-12-11T11:50:00+09:00");
  const r = await 줄(p);
  확인(!r.자리 && 물음.length === 0, `금 11:50(시작 48시간 10분 전) — 날씨 자리 없음 · 물음 ${물음.length}`);
  await ctx.close();
}
{
  const { p, ctx, 물음 } = await 열기("2026-12-11T12:30:00+09:00");
  let r = await 줄(p);
  확인(r.보임 && r.글 === "❄️ 12시 −3°C · 15시 −1°C · 눈 12:30 받은 예보" && 물음.join() === "kma_seamless",
    `금 12:30 — "${r.글}" · 물음 ${물음.join()}`);
  await p.clock.fastForward("30:00");
  await p.reload(); await p.waitForTimeout(600);
  r = await 줄(p);
  확인(r.보임 && 물음.length === 1 && r.글.endsWith("12:30 받은 예보"), `30분 뒤 다시 열면 받아 둔 것(물음 ${물음.length}번 그대로)`);
  await p.clock.fastForward("31:00");
  await p.reload(); await p.waitForTimeout(600);
  r = await 줄(p);
  확인(물음.length === 2 && r.글.endsWith("13:31 받은 예보"), `1시간 넘으면 새로 물음(물음 ${물음.length}번 · "${r.글.split(" · ").pop()}")`);
  await ctx.close();
}
{
  const { p, ctx, 물음 } = await 열기("2026-12-12T20:00:00+09:00", { 모드: "모델모름" });
  const r = await 줄(p);
  확인(r.보임 && 물음.join() === "kma_seamless,기본", `기상청 모델을 못 알아들으면 기본 모델로 다시(${물음.join(" → ")}) — "${r.글}"`);
  await ctx.close();
}
{
  const { p, ctx } = await 열기("2026-12-13T09:00:00+09:00", { 모드: "끊김" });
  const r = await 줄(p);
  const 카드 = await p.evaluate(() => !!document.querySelector(".home-next .home-next-btns"));
  확인(r.자리 && !r.보임 && 카드, "신호가 끊기면 날씨 줄만 숨고 카드는 그대로");
  await ctx.close();
}
{
  const { p, ctx, 물음 } = await 열기("2026-12-13T15:30:00+09:00");
  const r = await 줄(p);
  확인(!r.자리 && 물음.length === 0, `경기 끝(일 15:30) 뒤 — 날씨 자리 없음 · 물음 ${물음.length}`);
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul" });
  let n = 0;
  await ctx.route("https://api.open-meteo.com/**", (route) => { n++; route.abort(); });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date("2026-12-12T10:00:00+09:00") });
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(600);
  확인(n === 0, `시험 표시 없는 자동 시험 브라우저 — 날씨를 묻지 않음(물음 ${n})`);
  await ctx.close();
}
{
  // 밝은 테마 글씨 명암비(받은 시각은 작은 흐린 글씨라 따로 잰다)
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "Asia/Seoul" });
  await ctx.addInitScript(() => { localStorage.setItem("spirit-theme", "light"); window.__날씨시험 = true; });
  await ctx.route("https://api.open-meteo.com/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(가짜("2026-12-13")) }));
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message));
  await p.clock.install({ time: new Date("2026-12-12T10:00:00+09:00") });
  await p.goto(`${URL}/index.html#/`); await p.waitForTimeout(600);
  const c = await p.evaluate(() => {
    const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
    const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
    const 바탕 = (e) => { for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return rgb(c); } return [255, 255, 255]; };
    const el = document.getElementById("home-weather"), s = el.querySelector("small"), bb = el.querySelector("b");
    return [cr(rgb(getComputedStyle(bb).color), 바탕(bb)), cr(rgb(getComputedStyle(s).color), 바탕(s))];
  });
  확인(c[0] >= 4.5 && c[1] >= 4.5, `밝은 테마 명암비 날씨 ${c[0]} · 받은 시각 ${c[1]}`);
  await ctx.close();
}

확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
