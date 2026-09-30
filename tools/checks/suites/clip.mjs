// 내보내는 그림(밴드 이미지 · 엑셀 샷차트) 안의 코트가 제 칸 밖으로 넘치는지 잰다.
//
// 화면은 <svg viewBox> 가 코트를 잘라 주지만, 내보내는 그림은 큰 SVG 하나 안에
// <g transform> 으로 얹을 뿐이라 자르는 것이 없다. 코트선()이 진짜 반코트
// (y=10~460)를 그리는데 쓰는 자리는 y=135 부터라, 자르지 않으면 위로 125단위가
// 그대로 삐져나와 윗줄(박스스코어 · 앞 줄 차트)을 덮는다.
//
// 재는 법: getBoundingClientRect 는 clip-path 를 무시하고 원래 도형 크기를 돌려준다.
// 그래서 **칠해진 픽셀**을 본다. 코트 바닥색(#f7f9fd, 투명도 0.9)이 흰 바탕에
// 얹히면 약 (248,250,253)이 되고, 이 색은 그림 안에서 코트 바닥에만 쓰인다.
// 그 색이 있는 줄을 모으면 코트가 실제로 차지한 세로 띠가 그대로 나온다.
import { chromium } from "playwright";
import { URL, 폴더 } from "../lib.mjs";
const bad = [];
const say = (ok, m) => { console.log(`${ok ? "✅" : "❌"} ${m}`); if (!ok) bad.push(m); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("dialog", (d) => d.accept());

await p.goto(`${URL}/index.html#/record`);
await p.waitForTimeout(900);
const 이름 = await p.evaluate(() => [...document.querySelectorAll(".rec-rchip")].map((c) => c.dataset.name));
for (const n of 이름.slice(0, 10)) {
  await p.evaluate((v) => document.querySelector(`.rec-rchip[data-name="${CSS.escape(v)}"]`).click(), n);
}
await p.click("#rec-start");
await p.waitForTimeout(600);

async function 코트탭(vx, vy) {
  const box = await p.evaluate(() => {
    const s = document.querySelector("#rec-court-svg");
    const r = s.getBoundingClientRect();
    const [vx, vy, vw, vh] = s.getAttribute("viewBox").split(" ").map(Number);
    return { l: r.left, t: r.top, w: r.width, h: r.height, vx, vy, vw, vh };
  });
  await p.mouse.click(box.l + ((vx - box.vx) / box.vw) * box.w, box.t + ((vy - box.vy) / box.vh) * box.h);
  await p.waitForTimeout(140);
}
const 선수탭 = (n) => p.evaluate((v) =>
  document.querySelector(`.rec-pchip[data-player="${CSS.escape(v)}"]`).click(), n).then(() => p.waitForTimeout(130));
const 선수 = await p.evaluate(() => [...document.querySelectorAll(".rec-pchip")].map((c) => c.dataset.player));

// 양 팀에서 네 명씩 쏜다 — 선수 차트가 세 줄이 되어야 줄끼리 겹치는 것도 보인다.
const 쏜사람 = 선수.slice(0, 4).concat(선수.slice(5, 9));
const 자리 = [[250, 430], [200, 300], [60, 430], [250, 160],
  [440, 440], [300, 350], [250, 145], [150, 250]];
for (let i = 0; i < 쏜사람.length; i++) {
  await 코트탭(자리[i][0], 자리[i][1]);
  await 선수탭(쏜사람[i]);
  await p.click(i % 2 ? "#rec-miss" : "#rec-made");
  await p.waitForTimeout(180);
}

// ── 그림을 실제로 래스터로 굽고 픽셀을 센다 ───────────────
await p.evaluate(() => {
  // 코트 바닥색이 있는 줄·칸을 찾아 띠로 묶는다. 한 번 써 두고 두 그림에 같이 쓴다.
  window.__픽셀재기 = async (svg, w, h) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = url; });
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const d = g.getImageData(0, 0, w, h).data;
    // 코트 바닥 #f7f9fd 를 투명도 0.9 로 흰 바탕에 얹은 색 ≈ (248,250,253)
    const 바닥 = (i) => Math.abs(d[i] - 248) <= 2 && Math.abs(d[i + 1] - 250) <= 2 && Math.abs(d[i + 2] - 253) <= 2;
    const 줄 = [];
    for (let y = 0; y < h; y++) {
      let 처음 = -1, 끝 = -1, n = 0;
      for (let x = 0; x < w; x++) {
        if (!바닥((y * w + x) * 4)) continue;
        if (처음 < 0) 처음 = x;
        끝 = x; n++;
      }
      줄.push({ y, 처음, 끝, n });
    }
    // 바닥색이 이어지는 구간을 띠 하나로 묶는다.
    // 글씨 가장자리(안티앨리어싱)가 우연히 같은 색으로 찍히는 일이 있어 한 줄에
    // 몇 픽셀씩 흩어진다. 코트 바닥은 가장 좁은 선수 칸도 가로 300px 쯤 되므로
    // 150px 을 문턱으로 두면 글씨 부스러기는 걸러지고 코트만 남는다.
    const 띠 = [];
    let 현재 = null;
    for (const r of 줄) {
      if (r.n >= 150) {
        if (!현재) 현재 = { 위: r.y, 아래: r.y, 왼: r.처음, 오른: r.끝 };
        else { 현재.아래 = r.y; 현재.왼 = Math.min(현재.왼, r.처음); 현재.오른 = Math.max(현재.오른, r.끝); }
      } else if (현재) { 띠.push(현재); 현재 = null; }
    }
    if (현재) 띠.push(현재);
    return 띠.map((t) => ({ ...t, 높이: t.아래 - t.위 + 1 }));
  };
});

const 샷 = await p.evaluate(async () => {
  const mod = await import("./js/record-image.js");
  const st = await import("./js/storage.js");
  const game = st.getRecordSession().games[0];
  const { svg, width, height } = mod.샷차트한장SVG(game, [game], 1000);
  const 띠 = await window.__픽셀재기(svg, width, height);
  const 자름 = (svg.match(/<clipPath/g) || []).length;
  return { width, height, 띠, 자름 };
});

console.log(`샷차트 그림 ${샷.width} × ${샷.height}px · clipPath ${샷.자름}개`);
console.log("코트 띠: " + 샷.띠.map((t) => `y ${t.위}~${t.아래}(${t.높이}px)`).join(" · "));

// 칸 너비: 안쪽 폭 1000-32 = 968... 실제로는 pad 16 씩이라 w = 968
// 팀 칸 (968-20)/2 = 474 → 코트 474 × 325/500 = 308.1
// 선수 칸 (968-32)/3 = 312 → 312 × 0.65 = 202.8
const 안쪽 = 1000 - 32;
const 팀높이 = ((안쪽 - 20) / 2) * (325 / 500);
const 선수높이 = ((안쪽 - 32) / 3) * (325 / 500);

// ── 1. 코트 띠가 넷으로 갈라지는가 ────────────────────────
// 팀 두 칸(한 줄) + 선수 여덟(3 + 3 + 2 = 세 줄) = 네 줄.
// 위로 삐져나오면 줄끼리 맞닿아 띠가 하나로 뭉친다.
say(샷.띠.length === 4, `코트 띠 ${샷.띠.length}개 — 팀 한 줄 + 선수 세 줄 (삐져나오면 뭉쳐서 줄어든다)`);

// ── 2. 띠 높이가 잘라낸 325 만큼인가 ──────────────────────
// 안 자르면 450 만큼(팀 426.6 · 선수 280.8) 나온다.
const 높이들 = 샷.띠.map((t) => t.높이);
const 기대 = [팀높이, 선수높이, 선수높이, 선수높이];
const 어긋 = 높이들.map((v, i) => Math.abs(v - 기대[i])).filter((d) => d > 2);
say(!어긋.length,
  `띠 높이 ${높이들.join(" / ")}px (기대 ${기대.map((v) => v.toFixed(1)).join(" / ")}px — 450 이 아니라 325 만큼)`);

// ── 3. 줄 사이가 벌어져 있는가 ────────────────────────────
const 사이 = 샷.띠.slice(1).map((t, i) => t.위 - 샷.띠[i].아래 - 1);
say(사이.every((g) => g >= 20), `줄 사이 여백 ${사이.join(" / ")}px (제목·요약 글씨가 들어갈 자리)`);

// ── 4. 코트가 그림 가로 안쪽인가 ──────────────────────────
const 왼 = Math.min(...샷.띠.map((t) => t.왼));
const 오른 = Math.max(...샷.띠.map((t) => t.오른));
say(왼 >= 14 && 오른 <= 샷.width - 14, `코트 가로 ${왼}~${오른}px (그림 폭 ${샷.width})`);

// ── 5. 첫 띠가 제목 아래에서 시작하는가 ───────────────────
// pad 16 + 제목줄 34 + 칸제목 26 = 76
say(샷.띠[0].위 >= 70, `첫 코트가 y=${샷.띠[0].위} 에서 시작 (제목줄 아래, 기대 76)`);

say(샷.자름 === 10, `clipPath ${샷.자름}개 — 코트 칸(팀 2 + 선수 8)마다 하나씩`);

// ── 6. 밴드 이미지도 같은가 ───────────────────────────────
const 밴드 = await p.evaluate(async () => {
  const mod = await import("./js/record-image.js");
  const st = await import("./js/storage.js");
  const game = st.getRecordSession().games[0];
  const { svg, width, height } = mod.결과이미지SVG(game, [game]);
  const 띠 = await window.__픽셀재기(svg, width, height);
  // '샷 차트' 제목의 자리 — 여기를 코트가 덮으면 안 된다
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;width:1000px;opacity:0;pointer-events:none";
  host.innerHTML = svg;
  document.body.appendChild(host);
  const root = host.querySelector("svg");
  const base = root.getBoundingClientRect();
  const t = [...root.querySelectorAll("text")].find((x) => x.textContent === "샷 차트");
  const r = t.getBoundingClientRect();
  const 제목 = { 위: r.top - base.top, 아래: r.bottom - base.top };
  host.remove();
  return { width, height, 띠, 제목 };
});
console.log(`밴드 이미지 ${밴드.width} × ${밴드.height}px`);
console.log("코트 띠: " + 밴드.띠.map((t) => `y ${t.위}~${t.아래}(${t.높이}px)`).join(" · "));
say(밴드.띠.length === 4, `밴드 이미지도 코트 띠 ${밴드.띠.length}개`);
say(밴드.띠[0].위 > 밴드.제목.아래,
  `'샷 차트' 제목(y ${Math.round(밴드.제목.위)}~${Math.round(밴드.제목.아래)}) 아래에서 코트가 시작 (y=${밴드.띠[0].위})`);

say(!errs.length, errs.length ? `자바스크립트 오류: ${errs[0]}` : "자바스크립트 오류 없음");
await b.close();
console.log(bad.length ? `\n❌ ${bad.length}건 실패` : "\n✅ 전부 통과");
process.exit(bad.length ? 1 : 0);
