const DAY_TO_ICS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const ICS_TO_DAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function unescapeIcs(value) {
  return String(value || "")
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function localDateTime(date, time) {
  const cleanTime = /^\d{2}:\d{2}$/.test(time || "") ? time : "09:00";
  return date.getFullYear().toString().padStart(4, "0") +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0") +
    "T" + cleanTime.replace(":", "") + "00";
}

function nextWeekday(day) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const delta = (Number(day) - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseIcsDate(value) {
  if (!value) return null;
  const raw = value.trim();
  const dateOnly = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    return {
      date: dateOnly[1] + "-" + dateOnly[2] + "-" + dateOnly[3],
      time: "",
      allDay: true,
      day: new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      ).getDay(),
    };
  }

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!match) return null;
  const date = match[1] + "-" + match[2] + "-" + match[3];
  const hours = match[4];
  const minutes = match[5];
  let localDay;

  if (match[7]) {
    const utc = new Date(Date.UTC(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(hours), Number(minutes)
    ));
    localDay = utc.getDay();
  } else {
    localDay = new Date(
      Number(match[1]), Number(match[2]) - 1, Number(match[3])
    ).getDay();
  }

  return {
    date,
    time: hours + ":" + minutes,
    allDay: false,
    day: localDay,
  };
}

function unfoldLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function parseEvents(text) {
  const lines = unfoldLines(text);
  const events = [];
  let current = null;

  lines.forEach((line) => {
    if (line.trim().toUpperCase() === "BEGIN:VEVENT") {
      current = {};
      return;
    }
    if (line.trim().toUpperCase() === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      return;
    }
    if (!current) return;

    const separator = line.indexOf(":");
    if (separator < 0) return;
    const left = line.slice(0, separator);
    const value = line.slice(separator + 1);
    const key = left.split(";")[0].toUpperCase();
    if (["SUMMARY", "DESCRIPTION", "LOCATION", "RRULE", "DTSTART", "DTEND"].includes(key)) {
      current[key] = {
        raw: value,
        params: left.split(";").slice(1),
        text: ["SUMMARY", "DESCRIPTION", "LOCATION"].includes(key) ? unescapeIcs(value) : value,
      };
    }
  });

  return events;
}

function eventDayList(event) {
  const rule = event.RRULE?.raw || "";
  const match = rule.match(/(?:^|;)BYDAY=([^;]+)/i);
  if (match) {
    return match[1].split(",").map((value) => ICS_TO_DAY[value.slice(-2).toUpperCase()]).filter((day) => day !== undefined);
  }
  const start = parseIcsDate(event.DTSTART?.raw);
  return start ? [start.day] : [];
}

export function exportStudyFlowCalendar({ timetable = [], tasks = [] }) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = [];

  timetable.forEach((item) => {
    if (!Number.isInteger(item.day) || !/^\d{2}:\d{2}$/.test(item.startTime || "") ||
        !/^\d{2}:\d{2}$/.test(item.endTime || "")) return;
    const date = nextWeekday(item.day);
    const lines = [
      "BEGIN:VEVENT",
      "UID:" + escapeIcs(item.id || (item.subject + "-" + item.day)) + "@studyflow",
      "DTSTAMP:" + stamp,
      "DTSTART:" + localDateTime(date, item.startTime),
      "DTEND:" + localDateTime(date, item.endTime),
      "RRULE:FREQ=WEEKLY;BYDAY=" + DAY_TO_ICS[item.day],
      "SUMMARY:" + escapeIcs(item.subject),
    ];

    const location = item.room || item.location;
    const descriptionParts = [];
    if (item.courseCode) descriptionParts.push("Course: " + item.courseCode);
    if (item.instructor) descriptionParts.push("Instructor: " + item.instructor);
    if (item.notes) descriptionParts.push(item.notes);
    if (item.meetingUrl) descriptionParts.push("Online: " + item.meetingUrl);
    if (descriptionParts.length) lines.push("DESCRIPTION:" + escapeIcs(descriptionParts.join("\n")));
    if (location) lines.push("LOCATION:" + escapeIcs(location));
    lines.push("END:VEVENT");
    events.push(lines.join("\r\n"));
  });

  tasks.forEach((task) => {
    if (!task.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(task.deadline)) return;
    const title = task.title || "StudyFlow reminder";
    events.push([
      "BEGIN:VEVENT",
      "UID:" + escapeIcs(task.id || title) + "@studyflow",
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + task.deadline.replace(/-/g, ""),
      "DTEND;VALUE=DATE:" + (() => {
        const date = new Date(task.deadline + "T00:00:00");
        date.setDate(date.getDate() + 1);
        return formatDateKey(date).replace(/-/g, "");
      })(),
      "SUMMARY:" + escapeIcs((task.type === "exam" || /exam|quiz|viva/i.test(title) ? "EXAM: " : "Task: ") + title),
      "DESCRIPTION:" + escapeIcs([task.subject, task.description].filter(Boolean).join("\n")),
      "END:VEVENT",
    ].join("\r\n"));
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow//Academic Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function parseStudyFlowCalendar(text) {
  const events = parseEvents(text);
  const timetable = [];
  const tasks = [];
  const errors = [];

  events.forEach((event, index) => {
    const title = event.SUMMARY?.text?.trim();
    const start = parseIcsDate(event.DTSTART?.raw);
    const end = parseIcsDate(event.DTEND?.raw);

    if (!title || !start) {
      errors.push("Skipped calendar event " + (index + 1) + " because its title or start date is missing.");
      return;
    }

    if (event.RRULE && /(?:^|;)FREQ=WEEKLY(?:;|$)/i.test(event.RRULE.raw) && !start.allDay && end && !end.allDay && start.time && end.time && start.time !== end.time) {
      const days = eventDayList(event);
      const description = event.DESCRIPTION?.text || "";
      const fieldValue = (label) => {
        const match = description.match(new RegExp("^" + label + ":\\s*(.*)$", "im"));
        return match ? match[1].trim() : "";
      };
      const notes = description
        .split(/\r?\n/)
        .filter((line) => !/^(?:Course|Instructor|Online):\s*/i.test(line))
        .join("\n")
        .trim();

      days.forEach((day) => timetable.push({
        id: "",
        subject: title,
        courseCode: fieldValue("Course"),
        instructor: fieldValue("Instructor"),
        meetingUrl: fieldValue("Online"),
        day,
        startTime: start.time,
        endTime: end.time,
        recurring: true,
        room: event.LOCATION?.text || "",
        notes,
      }));
      return;
    }

    const exam = /^(?:exam|quiz|viva):?\s*/i.test(title) || /\b(exam|quiz|viva|midterm|final)\b/i.test(title);
    tasks.push({
      id: "",
      type: exam ? "exam" : "task",
      title: title.replace(/^(?:task|assignment|exam|quiz|viva):\s*/i, ""),
      deadline: start.date,
      subject: "Other",
      description: event.DESCRIPTION?.text || "",
      priority: "Medium",
      completed: false,
      createdAt: new Date().toISOString(),
    });
  });

  return { timetable, tasks, errors };
}

export function downloadIcs(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}