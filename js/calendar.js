import { getEventsOn, getUpcomingEvents, EVENT_TYPE_COLOR } from "./events.js";
import { getHolidayOn } from "./holidays.js";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function dotColor(type) {
  return EVENT_TYPE_COLOR[type] || "var(--accent)";
}

export function mountCalendar(container) {
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();
  let selected = toDateStr(year, month, today.getDate());

  function render() {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    let cells = "";
    for (let i = 0; i < firstWeekday; i++) {
      cells += `<div class="calendar-day empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = toDateStr(year, month, d);
      const dayEvents = getEventsOn(dateStr);
      const types = [...new Set(dayEvents.map((e) => e.type))];
      const holiday = getHolidayOn(dateStr);
      const classes = ["calendar-day"];
      if (dateStr === todayStr) classes.push("is-today");
      if (dateStr === selected) classes.push("is-selected");
      if (types.length) classes.push("has-event");
      if (holiday) classes.push("is-holiday");
      const dots = types
        .map((t) => `<span class="event-dot" style="background:${dotColor(t)}"></span>`)
        .join("");
      cells += `<button type="button" class="${classes.join(" ")}" data-date="${dateStr}" ${
        holiday ? `title="${holiday.name}"` : ""
      }>${d}${types.length ? `<span class="event-dots">${dots}</span>` : ""}</button>`;
    }

    const selectedEvents = getEventsOn(selected);
    const selectedHoliday = getHolidayOn(selected);
    const upcoming = getUpcomingEvents(todayStr);

    container.innerHTML = `
      <div class="calendar">
        <div class="calendar-header">
          <button type="button" class="btn calendar-nav" data-nav="-1">‹</button>
          <span class="calendar-title">${year}년 ${month + 1}월</span>
          <button type="button" class="btn calendar-nav" data-nav="1">›</button>
        </div>
        <div class="calendar-grid calendar-weekdays">
          ${WEEKDAYS.map((w) => `<div class="calendar-weekday">${w}</div>`).join("")}
        </div>
        <div class="calendar-grid">${cells}</div>
        <div class="calendar-legend">
          <span><span class="legend-dot" style="background:${dotColor("자체전")}"></span>자체전</span>
          <span><span class="legend-dot" style="background:${dotColor("대회")}"></span>대회</span>
          <span class="legend-holiday">공휴일</span>
        </div>
      </div>
      <div class="day-detail">
        <h3>${selected} 일정</h3>
        ${selectedHoliday ? `<p class="holiday-label">${selectedHoliday.name}</p>` : ""}
        ${
          selectedEvents.length
            ? selectedEvents.map((e) => eventCardHTML(e)).join("")
            : `<p class="hint">이 날에는 등록된 일정이 없어요.</p>`
        }
      </div>
      <div class="upcoming-list">
        <h3>다가오는 일정</h3>
        ${
          upcoming.length
            ? upcoming.map((e) => eventCardHTML(e)).join("")
            : `<p class="hint">예정된 일정이 없어요.</p>`
        }
      </div>
    `;

    container.querySelectorAll(".calendar-day[data-date]").forEach((el) => {
      el.addEventListener("click", () => {
        selected = el.dataset.date;
        render();
      });
    });
    container.querySelectorAll(".calendar-nav").forEach((el) => {
      el.addEventListener("click", () => {
        month += Number(el.dataset.nav);
        if (month < 0) {
          month = 11;
          year--;
        } else if (month > 11) {
          month = 0;
          year++;
        }
        render();
      });
    });
  }

  function eventCardHTML(e) {
    const badgeClass = e.type === "대회" ? "badge-defense" : "badge-offense";
    return `
      <div class="event-card">
        <span class="badge ${badgeClass}">${e.type}</span>
        <strong>${e.title}</strong>
        <div class="event-meta">${e.date}${e.location ? ` · ${e.location}` : ""}</div>
        ${e.note ? `<p class="event-note">${e.note}</p>` : ""}
      </div>
    `;
  }

  render();
}
