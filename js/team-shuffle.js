function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function mountShuffle(container) {
  let names = [];

  function render() {
    container.innerHTML = `
      <div class="shuffle-input">
        <textarea id="shuffle-names" class="shuffle-textarea" placeholder="참석자 이름을 한 줄에 한 명씩 입력하세요" rows="8">${names
          .map(escapeHtml)
          .join("\n")}</textarea>
        <button type="button" class="btn btn-primary" id="shuffle-btn">🔀 팀 나누기</button>
      </div>
      <div class="shuffle-result" id="shuffle-result"></div>
    `;

    document.getElementById("shuffle-btn").addEventListener("click", () => {
      const textarea = document.getElementById("shuffle-names");
      names = textarea.value
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);
      doShuffle();
    });
  }

  function doShuffle() {
    const resultEl = document.getElementById("shuffle-result");
    if (names.length < 2) {
      resultEl.innerHTML = `<p class="hint">최소 2명 이상 입력해주세요.</p>`;
      return;
    }
    const shuffled = shuffle(names);
    const half = Math.ceil(shuffled.length / 2);
    const teamA = shuffled.slice(0, half);
    const teamB = shuffled.slice(half);
    resultEl.innerHTML = `
      <div class="shuffle-teams">
        <div class="shuffle-team">
          <h3>팀 A (${teamA.length}명)</h3>
          <ul>${teamA.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        </div>
        <div class="shuffle-team">
          <h3>팀 B (${teamB.length}명)</h3>
          <ul>${teamB.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        </div>
      </div>
      <button type="button" class="btn" id="reshuffle-btn">↻ 다시 섞기</button>
    `;
    document.getElementById("reshuffle-btn").addEventListener("click", doShuffle);
  }

  render();
}
