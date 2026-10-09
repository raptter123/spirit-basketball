// 헤더 로고 링크(홈으로 가기)가 폰에서도 누를 곳 44px 인가.
//
// #160 에서 폰 헤더를 얇게 하며 로고를 54 → 40px 로 줄였더니, 로고 링크(a.brand)도
// 40px 높이가 되어 누를 곳 기준(44px)에 4px 모자랐다. 생김새는 그대로 두고 누르는
// 범위만 위아래로 넓힌다. 헤더 높이 56px 이 그대로인지도 같이 본다.
//
// 넓힌 범위는 계산된 값이 아니라 실제로 그 자리를 누르면 로고 링크가 잡히는지
// (elementFromPoint)로 잰다 — ::after 가 다른 요소 밑에 깔리면 숫자만 맞고 눌리지 않는다.
import { chromium } from "playwright";
import { URL } from "../lib.mjs";

let ok = true;
const 확인 = (맞음, 말) => { if (!맞음) ok = false; console.log(`${맞음 ? "✅" : "❌"} ${말}`); };
const b = await chromium.launch();
const errs = [];
for (const [w, h] of [[320, 568], [390, 844], [430, 932], [768, 1024]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${URL}/index.html#/tactics`); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const a = document.querySelector("a.brand");
    const box = a.getBoundingClientRect();
    const x = box.left + box.width / 2;
    // 위에서 아래로 1px 씩 눌러 보며 로고 링크가 잡히는 세로 범위를 잰다.
    let 위 = null, 아래 = null;
    for (let y = 0; y < 120; y++) {
      const el = document.elementFromPoint(x, y);
      if (el && el.closest("a.brand")) { if (위 === null) 위 = y; 아래 = y; }
    }
    return { 높이: 위 === null ? 0 : 아래 - 위 + 1, 위, 아래, 그림: Math.round(box.height),
      헤더: Math.round(document.querySelector(".site-header").getBoundingClientRect().height),
      테마단추: document.elementFromPoint(document.querySelector("#theme-toggle").getBoundingClientRect().left + 19, 28)?.closest("#theme-toggle") != null };
  });
  확인(r.높이 >= 44 && r.테마단추, `${w}px — 로고 링크가 눌리는 높이 ${r.높이}px (y ${r.위}~${r.아래}) · 그림 높이 ${r.그림}px · 헤더 ${r.헤더}px · 테마 단추는 그대로 눌림`);
  if (w < 720) 확인(r.헤더 === 56, `${w}px — 헤더 높이 ${r.헤더}px (얇은 헤더 그대로)`);
}
확인(errs.length === 0, `자바스크립트 오류 ${errs.length}건${errs.length ? " — " + errs[0] : ""}`);
console.log(ok ? "\n✅ 전부 통과" : "\n❌ 실패");
await b.close(); process.exit(ok ? 0 : 1);
