// 기록지 한 장이 아이폰에서 **한 면에 들어가는지** 재는 시험.
//
// 왜 필요한가: 종이가 A4(210×297)여도 iOS 사파리가 실제로 찍는 영역은 그보다 작다.
// 위아래에 주소·날짜·쪽번호를 넣기 때문이고, 끌 수도 없다. 딱 맞추면 매 장 자투리가
// 다음 면으로 넘어가 2장이 4페이지가 된다 — 실제로 두 번 그랬다.
//
// 아래 IOS_USABLE 값은 추측이 아니라 **아이폰에서 뽑은 PDF 를 재서** 얻은 것이다.
// 다시 재려면 PDF 를 pymupdf 로 열어 쪽마다 그려진 내용의 시작 y 를 보면 된다:
//   d=pymupdf.open(f); [min(x["rect"].y0 for x in pg.get_drawings())*25.4/72 for pg in d]
// 그 차이가 곧 한 면에 찍히는 세로다.
//
// 쓰는 법:  npx http-server -p 8911 -s .   그리고   node tools/print-fit-check.mjs
import { chromium } from "playwright";
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:844}});
p.on("pageerror",e=>console.log("PAGEERROR:",e.message));
await p.goto("http://127.0.0.1:8911/index.html#/team-shuffle");
await p.waitForTimeout(1500);
await p.evaluate(()=>{ for(const c of [...document.querySelectorAll("input[data-name]")].slice(0,10)){
  c.checked=true; c.dispatchEvent(new Event("change",{bubbles:true})); } });
await p.waitForTimeout(500);
await p.evaluate(()=>document.getElementById("ts-auto-assign")?.click());
await p.waitForTimeout(500);
await p.evaluate(()=>document.getElementById("ts-sheet-btn").click());
await p.waitForTimeout(1800);
await p.emulateMedia({media:"print"});
await p.waitForTimeout(400);
const r = await p.evaluate(()=>{
  const PX_PER_MM = 96/25.4;
  const pages=[...document.querySelectorAll(".sheet-page")];
  const mm=v=>+(v/PX_PER_MM).toFixed(1);
  return pages.map(pg=>{
    const R=pg.getBoundingClientRect();
    const S=pg.querySelector(".sheet").getBoundingClientRect();
    return {면_가로:mm(R.width), 면_세로:mm(R.height),
            기록지_가로:mm(S.width), 기록지_세로:mm(S.height),
            넘침_가로:mm(S.right-R.right), 넘침_아래:mm(S.bottom-R.bottom)};
  });
});
console.log(JSON.stringify(r,null,1));
// 아이폰에서 뽑은 실제 PDF 로 잰 값. 쪽마다 내용이 248.7 / 248.6 / 248.6mm 씩
// 밀려났으므로 iOS 사파리가 실제로 찍는 세로는 248.6mm 다. 추측이 아니다.
const IOS_USABLE_H = 248.6, IOS_USABLE_W = 181.8;
const [pg]=r;
const okH = pg.면_세로 <= IOS_USABLE_H, okW = pg.면_가로 <= IOS_USABLE_W;
console.log(`\n아이폰 실측 인쇄 영역: ${IOS_USABLE_W} x ${IOS_USABLE_H}mm`);
console.log(`  상자 ${pg.면_가로} x ${pg.면_세로}mm`);
console.log(`  세로 여유 ${(IOS_USABLE_H-pg.면_세로).toFixed(1)}mm ${okH?"✅":"❌ 넘침 — 한 장이 두 면으로 쪼개진다"}`);
console.log(`  가로 여유 ${(IOS_USABLE_W-pg.면_가로).toFixed(1)}mm ${okW?"✅":"❌"}`);
if(!okH||!okW) process.exitCode=1;
await b.close();
