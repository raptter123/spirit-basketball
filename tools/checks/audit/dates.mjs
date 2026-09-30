// 날짜가 바뀌는 자리(월말 · 연말 · 공휴일 목록이 끝나는 해)에서 화면이 멀쩡한지 본다.
// 브라우저 시계를 박아 두고 홈 · 일정 · 팀 편성 · 기록을 연다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const 날짜들 = [
  "2026-09-30T10:00:00", "2026-10-01T10:00:00", "2026-10-04T10:00:00",
  "2026-12-31T23:30:00", "2027-01-01T00:30:00", "2027-12-31T10:00:00", "2028-01-02T10:00:00",
];
const b = await chromium.launch();
for (const d of 날짜들) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 100)); });
  p.on("dialog", (x) => x.accept());
  await p.clock.install({ time: new Date(d) });
  await p.goto(`${URL}/index.html?d=${d}#/`); await p.waitForTimeout(700);
  const 홈 = await p.evaluate(() => ({
    다가옴: document.querySelector(".home-next")?.innerText.replace(/\s+/g, " ").trim().slice(0, 90) || "(없음)",
  }));
  await p.goto(`${URL}/index.html?d=${d}x#/schedule`); await p.waitForTimeout(700);
  const 일정 = await p.evaluate(() => ({
    제목: document.querySelector(".calendar-title, .cal-title, .calendar h2, .calendar-head")?.textContent.trim()
      || [...document.querySelectorAll("h2,h3,b,strong")].map((e) => e.textContent.trim()).find((t) => /\d{4}.*\d+월|년/.test(t)),
    오늘: document.querySelector(".calendar-day.is-today")?.textContent.trim().replace(/\s+/g, " ") || "(없음)",
    공휴일칸: document.querySelectorAll(".calendar-day.is-holiday, .calendar-day [class*=holiday]").length,
    다가오는: [...document.querySelectorAll(".upcoming-list li, .upcoming-list .upcoming-item, .upcoming-list > *")].slice(1, 4)
      .map((e) => e.innerText.replace(/\s+/g, " ").trim().slice(0, 40)),
  }));
  await p.goto(`${URL}/index.html?d=${d}y#/team-shuffle`); await p.waitForTimeout(700);
  const 편성 = await p.evaluate(() => ({
    날짜: document.querySelector('input[type="date"]')?.value || "(없음)",
  }));
  console.log(`\n■ ${d}`);
  console.log(`  홈 다가오는 일정: ${홈.다가옴}`);
  console.log(`  달력: ${일정.제목} · 오늘 칸 "${일정.오늘}" · 공휴일 칸 ${일정.공휴일칸}개`);
  console.log(`  다가오는 목록: ${일정.다가오는.join(" | ")}`);
  console.log(`  팀 편성 기본 날짜: ${편성.날짜}`);
  console.log(`  오류: ${errs.length ? errs.join(" / ") : "없음"}`);
  await ctx.close();
}
await b.close(); process.exit(0);
