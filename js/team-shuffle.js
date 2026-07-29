import { getAllHistory } from "./team-history.js";
import { getCustomTeamHistory, addCustomTeamHistoryEntry, removeCustomTeamHistoryEntry } from "./storage.js";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function teamLabel(i) {
  return `${String.fromCharCode(65 + i)}팀`;
}

function splitIntoTeams(list, teamCount) {
  const shuffled = shuffle(list);
  const teams = Array.from({ length: teamCount }, () => []);
  shuffled.forEach((name, i) => teams[i % teamCount].push(name));
  return teams;
}

function teamCountChipsHTML(current) {
  return [2, 3]
    .map((n) => `<button type="button" class="chip ${current === n ? "chip-active" : ""}" data-count="${n}">${n}팀</button>`)
    .join("");
}

export function mountShuffle(container) {
  let namesText = "";
  let names = [];
  let teamCount = 2;

  function render() {
    container.innerHTML = `
      <div class="shuffle-input">
        <textarea id="shuffle-names" class="shuffle-textarea" placeholder="참석자 이름을 한 줄에 한 명씩 입력하세요" rows="8">${escapeHtml(
          namesText
        )}</textarea>
        <div class="team-count-select">
          <span>팀 수:</span>
          ${teamCountChipsHTML(teamCount)}
        </div>
        <button type="button" class="btn btn-primary" id="shuffle-btn">🔀 팀 나누기</button>
      </div>
      <div class="shuffle-result" id="shuffle-result"></div>
    `;

    document.getElementById("shuffle-names").addEventListener("input", (e) => {
      namesText = e.target.value;
    });

    container.querySelectorAll(".team-count-select .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        teamCount = Number(btn.dataset.count);
        render();
      });
    });

    document.getElementById("shuffle-btn").addEventListener("click", () => {
      names = namesText
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);
      doShuffle();
    });
  }

  function doShuffle() {
    const resultEl = document.getElementById("shuffle-result");
    if (names.length < teamCount) {
      resultEl.innerHTML = `<p class="hint">최소 ${teamCount}명 이상 입력해주세요.</p>`;
      return;
    }
    const teams = splitIntoTeams(names, teamCount);
    resultEl.innerHTML = `
      <div class="shuffle-teams">
        ${teams
          .map(
            (team, i) => `
          <div class="shuffle-team">
            <h3>${teamLabel(i)} (${team.length}명)</h3>
            <ul>${team.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
          </div>`
          )
          .join("")}
      </div>
      <button type="button" class="btn" id="reshuffle-btn">↻ 다시 섞기</button>
    `;
    document.getElementById("reshuffle-btn").addEventListener("click", doShuffle);
  }

  render();
}

function historyCardHTML(rec) {
  const isCustom = Boolean(rec.id);
  return `
    <div class="history-card">
      <div class="history-card-header">
        <strong>${rec.date}</strong>
        ${isCustom ? `<span class="history-local-tag">이 브라우저에만 저장됨</span>` : ""}
        ${
          isCustom
            ? `<button type="button" class="btn-icon history-remove-btn" data-id="${rec.id}" aria-label="삭제">×</button>`
            : ""
        }
      </div>
      <div class="history-teams">
        ${rec.teams
          .map(
            (team, i) => `
          <div class="history-team">
            <span class="history-team-label">${teamLabel(i)} (${team.length}명)</span>
            <div class="history-team-names">${team.map((n) => escapeHtml(n)).join(", ")}</div>
          </div>`
          )
          .join("")}
      </div>
    </div>
  `;
}

function showHistoryExportModal(entries) {
  const payload = entries.map(({ id, ...rest }) => rest);
  const text = JSON.stringify(payload, null, 2);

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal">
      <h3>팀 편성 기록 내보내기</h3>
      <p class="hint">아래 내용을 복사해서 <strong>황규철</strong>에게 보내주세요. 확인 후 실제 사이트에 반영할게요.</p>
      <textarea class="export-textarea" readonly>${text}</textarea>
      <div class="modal-actions">
        <button type="button" class="btn" id="history-modal-close">닫기</button>
        <button type="button" class="btn btn-primary" id="history-modal-copy">복사하기</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
  document.getElementById("history-modal-close").addEventListener("click", () => backdrop.remove());
  document.getElementById("history-modal-copy").addEventListener("click", async () => {
    const btn = document.getElementById("history-modal-copy");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "복사됨!";
    } catch {
      btn.textContent = "복사 실패, 직접 선택해주세요";
    }
    setTimeout(() => {
      btn.textContent = "복사하기";
    }, 1500);
  });
}

export function mountTeamHistory(container) {
  let formTeamCount = 2;
  let dateValue = "";
  let teamTexts = ["", ""];

  function render() {
    const history = getAllHistory();
    const customCount = getCustomTeamHistory().length;

    container.innerHTML = `
      <div class="history-form">
        <p class="hint editor-local-notice">✎ 여기서 저장하는 기록은 <strong>이 브라우저에만</strong> 저장돼요. 팀 전체에 반영하려면 "내보내기"로 나온 내용을 전달해주세요.</p>
        <div class="history-form-row">
          <input type="date" id="history-date" value="${dateValue}" />
          <div class="team-count-select">
            <span>팀 수:</span>
            ${teamCountChipsHTML(formTeamCount)}
          </div>
        </div>
        <div class="history-team-inputs">
          ${Array.from(
            { length: formTeamCount },
            (_, i) => `
            <div class="history-team-input">
              <label>${teamLabel(i)}</label>
              <textarea class="history-team-textarea" data-team="${i}" rows="4" placeholder="이름을 한 줄에 한 명씩">${escapeHtml(
              teamTexts[i] || ""
            )}</textarea>
            </div>`
          ).join("")}
        </div>
        <p class="hint" id="history-form-error"></p>
        <button type="button" class="btn btn-primary" id="save-history-btn">기록 저장</button>
      </div>
      <div class="history-list">
        <div class="history-list-header">
          <h3>편성 기록</h3>
          ${customCount ? `<button type="button" class="btn btn-sm" id="export-history-btn">내보내기</button>` : ""}
        </div>
        ${
          history.length
            ? history.map((rec) => historyCardHTML(rec)).join("")
            : `<p class="hint">아직 기록된 팀 편성이 없어요.</p>`
        }
      </div>
    `;

    document.getElementById("history-date").addEventListener("input", (e) => {
      dateValue = e.target.value;
    });

    container.querySelectorAll(".history-team-textarea").forEach((ta) => {
      ta.addEventListener("input", (e) => {
        teamTexts[Number(e.target.dataset.team)] = e.target.value;
      });
    });

    container.querySelectorAll(".history-form .team-count-select .chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        formTeamCount = Number(btn.dataset.count);
        while (teamTexts.length < formTeamCount) teamTexts.push("");
        render();
      });
    });

    document.getElementById("save-history-btn").addEventListener("click", () => {
      const teams = teamTexts
        .slice(0, formTeamCount)
        .map((t) =>
          t
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean)
        );
      const errorEl = document.getElementById("history-form-error");
      if (!dateValue) {
        errorEl.textContent = "날짜를 선택해주세요.";
        return;
      }
      if (teams.every((t) => t.length === 0)) {
        errorEl.textContent = "최소 한 팀 이상 이름을 입력해주세요.";
        return;
      }
      addCustomTeamHistoryEntry({ date: dateValue, teams });
      dateValue = "";
      teamTexts = Array(formTeamCount).fill("");
      render();
    });

    const exportBtn = document.getElementById("export-history-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => showHistoryExportModal(getCustomTeamHistory()));
    }

    container.querySelectorAll(".history-remove-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeCustomTeamHistoryEntry(btn.dataset.id);
        render();
      });
    });
  }

  render();
}
