// 제안서 디자인 칸의 "지금" 화면을 찍어 data URI 로 내놓는다.
//
//   node .claude/skills/weekly-check/now-shot.mjs "#/"  > 지금.txt
//   node .claude/skills/weekly-check/now-shot.mjs "#/record" dark 2026-10-04T10:00
//
// 390×844(아이폰 12~15) 한 화면, 기본 다크 테마, JPEG 78% — 한 장에 30~40KB.
// 시각을 주면 브라우저 시계를 그때로 박는다(D-day · 오늘 칸이 그날 기준으로 보인다).
// 사이트는 tools/checks 의 서버로 스스로 띄운다.
import { chromium } from "playwright";
import { 서버띄우기 } from "../../../tools/checks/lib.mjs";

const [길 = "#/", 테마 = "dark", 시각] = process.argv.slice(2);
const 서버 = process.env.CHECK_URL ? null : await 서버띄우기();
const 주소 = process.env.CHECK_URL || 서버.url;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 테마 });
await ctx.addInitScript((t) => { try { localStorage.setItem("spirit-theme", t); } catch (e) { /* */ } }, 테마);
const p = await ctx.newPage();
if (시각) await p.clock.install({ time: new Date(시각) });
await p.goto(`${주소}/index.html${길}`);
await p.waitForTimeout(800);
const buf = await p.screenshot({ type: "jpeg", quality: 78 });
process.stdout.write(`data:image/jpeg;base64,${buf.toString("base64")}`);
await b.close();
if (서버) await 서버.닫기();
