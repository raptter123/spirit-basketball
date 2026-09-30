import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const 받음 = [];
p.on("response", async (r) => { try { const buf = await r.body(); 받음.push({ u: r.url().replace(URL, ""), n: buf.length, t: r.request().resourceType() }); } catch (e) {} });
const t0 = Date.now();
await p.goto(`${URL}/index.html#/`, { waitUntil: "networkidle" });
const 시간 = await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
const 합 = 받음.reduce((a, x) => a + x.n, 0);
console.log(`첫 화면: 요청 ${받음.length}개 · ${(합 / 1024).toFixed(1)}KB (압축 전) · DOMContentLoaded ${시간.dcl}ms`);
for (const x of 받음.sort((a, c) => c.n - a.n).slice(0, 14)) console.log(`  ${(x.n / 1024).toFixed(1).padStart(7)}KB  ${x.t.padEnd(10)} ${x.u.split("?")[0]}`);
// 이미지 원본 크기 대비 보이는 크기
const 그림 = await p.evaluate(() => [...document.querySelectorAll("img")].map((i) => ({ src: i.src.split("/").pop(), 원본: `${i.naturalWidth}×${i.naturalHeight}`, 보임: `${Math.round(i.getBoundingClientRect().width)}×${Math.round(i.getBoundingClientRect().height)}` })));
console.log("\n이미지:", JSON.stringify(그림));
await b.close(); process.exit(0);
