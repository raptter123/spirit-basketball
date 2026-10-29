// 연말 결산 "혼 어워즈" — 시즌 합치기(js/season.js)에 올린 경기들로 부문별 1위를 한 장에.
//
// 밴드 송년 글에 붙일 그림이다. 숫자는 시즌 합치기 표(시즌합계)와 같은 것을 쓴다 —
// 표와 그림이 다른 말을 하면 안 된다.
//
// 부문과 자격
//   평균으로 뽑는 부문(득점 · 리바 · 어시 · 스틸)은 한두 경기만 나온 사람이 1위가 되지
//   않게, 올린 경기 수의 절반(올림) 이상 나온 사람만 본다. 3점왕은 합계, 개근상은 나온
//   경기 수라 자격이 없다. 1위가 여럿이면 셋까지 같이 적는다. 그 부문 기록이 아무에게도
//   없으면(스틸을 안 적은 시즌 등) 그 칸은 뺀다 — 0개로 1위를 주면 안 된다.

const 부문들 = [
  { ic: "🏀", 이름: "득점왕", 값: (a) => a.pts / a.경기수, 평균: true, 말: (v) => `경기당 ${v.toFixed(1)}점` },
  { ic: "💪", 이름: "리바운드왕", 값: (a) => a.reb / a.경기수, 평균: true, 말: (v) => `경기당 ${v.toFixed(1)}개` },
  { ic: "🎯", 이름: "어시스트왕", 값: (a) => a.ast / a.경기수, 평균: true, 말: (v) => `경기당 ${v.toFixed(1)}개` },
  { ic: "🧤", 이름: "스틸왕", 값: (a) => a.stl / a.경기수, 평균: true, 말: (v) => `경기당 ${v.toFixed(1)}개` },
  { ic: "🔥", 이름: "3점왕", 값: (a) => a.p3m, 평균: false, 말: (v) => `3점 ${v}개` },
  { ic: "🏃", 이름: "개근상", 값: (a) => a.경기수, 평균: false, 말: (v, n) => (v === n ? `${n}경기 전부` : `${v}경기`) },
];

/** 평균 부문에 들 자격 — 올린 경기 수의 절반(올림), 적어도 1경기. */
export function 자격경기(경기수) {
  return Math.max(1, Math.ceil(경기수 / 2));
}

/**
 * rows: 시즌합계(경기들) 결과, 경기수: 올린 경기 수.
 * 돌아오는 값: [{ ic, 이름, 사람들: [이름…], 값말 }] — 기록이 있는 부문만.
 */
export function 어워즈(rows, 경기수) {
  const 기준 = 자격경기(경기수);
  const 결과 = [];
  for (const 부 of 부문들) {
    const 후보 = rows.filter((a) => a.경기수 > 0 && (!부.평균 || a.경기수 >= 기준));
    // 평균은 소수 첫째 자리로 견준다 — 그림에 적히는 값이 같으면 같은 1위다.
    const 값 = (a) => (부.평균 ? Math.round(부.값(a) * 10) / 10 : 부.값(a));
    const 최고 = Math.max(0, ...후보.map(값));
    if (!(최고 > 0)) continue;
    const 사람들 = 후보.filter((a) => 값(a) === 최고).map((a) => a.name).sort((x, y) => x.localeCompare(y, "ko"));
    결과.push({ ic: 부.ic, 이름: 부.이름, 사람들: 사람들.slice(0, 3), 더: Math.max(0, 사람들.length - 3), 값말: 부.말(최고, 경기수) });
  }
  return 결과;
}

const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const 색 = { 종이: "#121a30", 칸: "#1c2644", 금: "#e8c26a", 글: "#e8eefc", 흐림: "#a9c7ff", 눈: "rgba(255,255,255,0.28)" };

function 둥근네모(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 어워즈 한 장(캔버스). 폭 540 × 2배 = 1080px — 밴드에 올리기 알맞은 폭. */
export function 어워즈그림(rows, 날짜들) {
  const 상 = 어워즈(rows, 날짜들.length);
  const W = 540, pad = 24, 머리 = 118, 칸높이 = 132, 틈 = 12, 꼬리 = 40;
  const 줄 = Math.ceil(상.length / 2) || 1;
  const H = pad + 머리 + 줄 * 칸높이 + (줄 - 1) * 틈 + 꼬리 + pad;
  const canvas = document.createElement("canvas");
  canvas.width = W * 2; canvas.height = H * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  ctx.fillStyle = 색.종이; ctx.fillRect(0, 0, W, H);
  // 제목 띠의 눈송이(씨앗 고정 — 다시 만들어도 같은 그림)
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  ctx.fillStyle = 색.눈;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W, y = 8 + rnd() * (머리 - 10);
    if (x > pad - 6 && x < W - pad && y > 30 && y < 96) continue;   // 제목 · 기간 글자 자리는 피한다
    ctx.beginPath(); ctx.arc(x, y, 1.4 + rnd() * 2, 0, Math.PI * 2); ctx.fill();
  }

  const 연도 = String(날짜들[날짜들.length - 1] || "").slice(0, 4);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.fillStyle = 색.금; ctx.font = `900 34px ${FONT}`;
  ctx.fillText(`🏆 ${연도} 혼 어워즈`, pad, pad + 40);
  ctx.fillStyle = 색.흐림; ctx.font = `600 15px ${FONT}`;
  const 짧게 = (d) => (d ? `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}` : "?");
  ctx.fillText(`${짧게(날짜들[0])} ~ ${짧게(날짜들[날짜들.length - 1])} · ${날짜들.length}경기`, pad, pad + 70);

  const 칸폭 = (W - pad * 2 - 틈) / 2;
  상.forEach((s, i) => {
    const x = pad + (i % 2) * (칸폭 + 틈), y = pad + 머리 + Math.floor(i / 2) * (칸높이 + 틈);
    둥근네모(ctx, x, y, 칸폭, 칸높이, 14); ctx.fillStyle = 색.칸; ctx.fill();
    ctx.strokeStyle = "rgba(232,194,106,0.35)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = `22px ${FONT}`; ctx.fillStyle = 색.글; ctx.fillText(s.ic, x + 16, y + 34);
    ctx.font = `800 16px ${FONT}`; ctx.fillStyle = 색.금; ctx.fillText(s.이름, x + 48, y + 33);
    // 이름이 여럿이면 글씨를 줄여 한 칸에 넣는다.
    const 이름글 = s.사람들.join(" · ") + (s.더 ? ` 외 ${s.더}` : "");
    let 크기 = 28;
    ctx.font = `900 ${크기}px ${FONT}`;
    while (ctx.measureText(이름글).width > 칸폭 - 32 && 크기 > 15) { 크기 -= 1; ctx.font = `900 ${크기}px ${FONT}`; }
    ctx.fillStyle = 색.글; ctx.fillText(이름글, x + 16, y + 80);
    ctx.font = `600 15px ${FONT}`; ctx.fillStyle = 색.흐림; ctx.fillText(s.값말, x + 16, y + 110);
  });
  if (!상.length) {
    ctx.font = `600 16px ${FONT}`; ctx.fillStyle = 색.흐림;
    ctx.fillText("올린 경기에 기록이 없어요", pad, pad + 머리 + 40);
  }

  ctx.font = `500 12px ${FONT}`; ctx.fillStyle = 색.흐림;
  ctx.fillText(`평균 부문은 ${자격경기(날짜들.length)}경기 이상 나온 사람 중에서 · 기록 탭으로 적은 경기만`, pad, H - pad - 10);
  return canvas;
}

/** 어워즈 그림 창 — 미리 보기 · 다운로드 · 클립보드 복사. 팀 공지 이미지 창과 같은 모양. */
export function 어워즈창(rows, 날짜들, 내려주기) {
  const canvas = 어워즈그림(rows, 날짜들);
  const 연도 = String(날짜들[날짜들.length - 1] || "").slice(0, 4) || "season";
  const bg = document.createElement("div");
  bg.className = "modal-backdrop";
  bg.innerHTML = `
    <div class="modal ts-image-modal" role="dialog" aria-modal="true" aria-labelledby="awards-title">
      <h3 id="awards-title">${연도} 혼 어워즈</h3>
      <div class="ts-image-preview"><img id="awards-img" src="${canvas.toDataURL("image/png")}" alt="${연도} 혼 어워즈 — 부문별 1위" /></div>
      <p class="hint">이미지를 길게 눌러 저장하거나, 아래 단추로 받아서 밴드에 올려 주세요.</p>
      <p class="hint" id="awards-say" role="status"></p>
      <div class="modal-actions">
        <button type="button" class="btn" id="awards-close">닫기</button>
        <button type="button" class="btn" id="awards-download">다운로드</button>
        <button type="button" class="btn btn-primary" id="awards-copy">클립보드에 복사</button>
      </div>
    </div>`;
  document.body.appendChild(bg);
  const 닫기 = () => bg.remove();
  bg.querySelector("#awards-close").addEventListener("click", 닫기);
  bg.addEventListener("click", (e) => { if (e.target === bg) 닫기(); });
  bg.querySelector("#awards-download").addEventListener("click", () => {
    canvas.toBlob((blob) => { if (blob) 내려주기(blob, `spirit-awards-${연도}.png`); }, "image/png");
  });
  bg.querySelector("#awards-copy").addEventListener("click", () => {
    const 말 = bg.querySelector("#awards-say");
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        말.textContent = "복사했어요. 밴드 글에 붙여 넣으세요.";
      } catch {
        말.textContent = "이 브라우저는 그림 복사를 막아 두었어요. 다운로드를 써 주세요.";
      }
    }, "image/png");
  });
  return bg;
}
