export function isoDate(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function addDays(value, days) {
  const date = new Date(String(value || isoDate()) + "T12:00:00");
  date.setDate(date.getDate() + Number(days || 0));
  return isoDate(date);
}

export function parseQuickCapture(input, now = new Date()) {
  let title = String(input || "").trim();
  if (!title) return null;
  let deadline = "";
  const today = isoDate(now);
  const lower = title.toLowerCase();
  if (/\btoday\b/i.test(title)) {
    deadline = today;
    title = title.replace(/\btoday\b/ig, "");
  } else if (/\btomorrow\b/i.test(title)) {
    deadline = addDays(today, 1);
    title = title.replace(/\btomorrow\b/ig, "");
  } else {
    const match = title.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (match) {
      const parsed = new Date(match[1] + "T12:00:00");
      if (!Number.isNaN(parsed.getTime()) && isoDate(parsed) === match[1]) deadline = match[1];
      title = title.replace(match[0], "");
    }
  }
  let priority = "Medium";
  const priorityMatch = lower.match(/\b(urgent|high|medium|low)\b/);
  if (priorityMatch) {
    priority = priorityMatch[1].charAt(0).toUpperCase() + priorityMatch[1].slice(1);
    if (priority === "Urgent") priority = "High";
    title = title.replace(new RegExp("\\b" + priorityMatch[1] + "\\b", "ig"), "");
  }
  let estimatedMinutes = 30;
  const duration = title.match(/\b(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i);
  if (duration) {
    estimatedMinutes = Math.max(5, Math.min(240, Number(duration[1])));
    title = title.replace(duration[0], "");
  }
  let subject = "";
  const subjectMatch = title.match(/\bfor\s+(physics|chemistry|biology|mathematics|maths?|programming|computer science|english|history|economics|other)\b/i);
  if (subjectMatch) {
    subject = subjectMatch[1];
    title = title.replace(subjectMatch[0], "");
  }
  title = title.replace(/[\s,;:-]+$/g, "").replace(/^[\s,;:-]+/g, "").trim();
  return {
    title: title || String(input).trim(),
    deadline,
    priority,
    estimatedMinutes,
    subject: subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : "",
    type: /\b(exam|quiz|midterm|final|viva|test)\b/i.test(title) ? "exam" : "task"
  };
}

export function buildAdaptivePlan(tasks, timetable, now = new Date()) {
  const day = now.getDay();
  const minute = now.getHours() * 60 + now.getMinutes();
  const endOfDay = 22 * 60;
  // Hide a parent task only while it has unfinished subtasks. Once every
  // subtask is complete, surface the parent again as the final review/submit step.
  const parentsWithIncompleteChildren = new Set(
    (Array.isArray(tasks) ? tasks : [])
      .filter((task) => task && task.parentTaskId && !task.completed)
      .map((task) => task.parentTaskId)
  );
  const pending = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && !task.completed && !parentsWithIncompleteChildren.has(task.id))
    .slice()
    .sort((a, b) => {
      const rank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
      const p = (rank[a.priority] ?? 2) - (rank[b.priority] ?? 2);
      if (p) return p;
      const da = a.deadline || "9999-12-31";
      const db = b.deadline || "9999-12-31";
      if (da !== db) return da.localeCompare(db);
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  const busy = (Array.isArray(timetable) ? timetable : [])
    .filter((entry) => entry && Number(entry.day) === day)
    .map((entry) => {
      const toMinutes = (value) => {
        const parts = String(value || "00:00").split(":").map(Number);
        return (parts[0] || 0) * 60 + (parts[1] || 0);
      };
      return { start: toMinutes(entry.startTime), end: toMinutes(entry.endTime), title: entry.subject || "Class" };
    })
    .filter((item) => item.end > item.start)
    .sort((a, b) => a.start - b.start);
  let cursor = Math.max(7 * 60, minute);
  const plan = [];
  const unscheduled = [];
  for (const task of pending) {
    const durationRaw = Number(task.estimatedMinutes);
    const duration = Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.max(10, Math.min(180, durationRaw))
      : task.priority === "High" || task.priority === "Urgent" ? 45 : 30;
    let placed = false;
    for (let attempts = 0; attempts < busy.length + 8 && cursor + duration <= endOfDay; attempts += 1) {
      const conflict = busy.find((block) => cursor < block.end && cursor + duration > block.start);
      if (!conflict) {
        plan.push({ task, start: cursor, end: cursor + duration, duration });
        cursor += duration + 5;
        placed = true;
        break;
      }
      cursor = conflict.end + 5;
    }
    if (!placed) unscheduled.push(task);
  }
  return { blocks: plan, unscheduled };
}

export function buildIcs(tasks, timetable, now = new Date()) {
  const escape = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StudyFlow//Academic Planner//EN", "CALSCALE:GREGORIAN"];
  const events = (Array.isArray(tasks) ? tasks : []).filter((task) => task && task.deadline && !task.completed);
  events.forEach((task) => {
    const next = addDays(task.deadline, 1).replace(/-/g, "");
    const start = String(task.deadline).replace(/-/g, "");
    lines.push("BEGIN:VEVENT", "UID:" + escape(task.id) + "@studyflow", "DTSTAMP:" + stamp(now), "DTSTART;VALUE=DATE:" + start, "DTEND;VALUE=DATE:" + next, "SUMMARY:" + escape(task.title), "DESCRIPTION:" + escape((task.subject || "Study task") + " | Priority: " + (task.priority || "Medium")), "END:VEVENT");
  });
  const weekdays = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  (Array.isArray(timetable) ? timetable : []).forEach((item) => {
    if (!item || !Number.isInteger(Number(item.day)) || !item.startTime || !item.endTime) return;
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    const distance = (Number(item.day) - date.getDay() + 7) % 7;
    date.setDate(date.getDate() + distance);
    const startParts = String(item.startTime).split(":").map(Number);
    date.setHours(startParts[0] || 0, startParts[1] || 0, 0, 0);
    if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 7);
    const day = isoDate(date).replace(/-/g, "");
    const start = String(item.startTime).replace(":", "") + "00";
    const end = String(item.endTime).replace(":", "") + "00";
    lines.push("BEGIN:VEVENT", "UID:" + escape(item.id || item.subject) + "@studyflow-class", "DTSTAMP:" + stamp(now), "DTSTART:" + day + "T" + start, "DTEND:" + day + "T" + end, "RRULE:FREQ=WEEKLY;BYDAY=" + weekdays[Number(item.day)], "SUMMARY:" + escape(item.subject || "Class"), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function parseIcs(text) {
  const unfolded = String(text || "").replace(/\r?\n[ \t]/g, "");
  const blocks = unfolded.split(/BEGIN:VEVENT/i).slice(1);
  const events = [];
  for (const block of blocks.slice(0, 200)) {
    const summary = block.match(/^SUMMARY(?:;[^:]*)?:(.*)$/im);
    const start = block.match(/^DTSTART(?:;VALUE=DATE|;[^:]*)?:(\d{8}|\d{8}T\d{6}Z?)/im);
    if (!summary || !start) continue;
    const rawDate = start[1];
    const deadline = rawDate.slice(0, 4) + "-" + rawDate.slice(4, 6) + "-" + rawDate.slice(6, 8);
    const title = summary[1].replace(/\\n/g, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
    if (!title) continue;
    events.push({ title, deadline, subject: "", priority: "Medium", estimatedMinutes: 30, type: /\b(exam|quiz|midterm|final|viva|test)\b/i.test(title) ? "exam" : "task", completed: false });
  }
  return events;
}

export function cardsFromNotes(notes, makeId = () => String(Date.now() + Math.random())) {
  const lines = String(notes || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const cards = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let match = line.match(/^(?:Q\s*:\s*)?(.+?)\s*(?:::|=>|->|\t| \| )\s*(?:A\s*:\s*)?(.+)$/i);
    if (!match && /^Q\s*:/i.test(line) && lines[i + 1] && /^A\s*:/i.test(lines[i + 1])) {
      match = [line, line.replace(/^Q\s*:\s*/i, ""), lines[i + 1].replace(/^A\s*:\s*/i, "")];
      i += 1;
    }
    if (!match) continue;
    const question = match[1].replace(/^Q\s*:\s*/i, "").trim();
    const answer = match[2].replace(/^A\s*:\s*/i, "").trim();
    if (question && answer) cards.push({ id: makeId(), question, answer, subject: "", createdAt: new Date().toISOString(), reps: 0, ease: 2.5, nextReviewAt: isoDate(), lastScore: null });
  }
  return cards;
}

export function nextReview(card, rating, now = new Date()) {
  const map = { again: 0, hard: 1, good: 3, easy: 7 };
  const prior = Math.max(0, Number(card && card.reps) || 0);
  const base = map[rating] ?? 3;
  const days = rating === "again" ? 0 : rating === "hard" ? Math.max(1, Math.round(Math.max(1, prior) * 1.5)) : rating === "easy" ? Math.min(60, Math.max(7, (prior + 1) * 7)) : Math.min(45, base * Math.max(1, prior + 1));
  return { ...card, reps: rating === "again" ? 0 : prior + 1, lastScore: rating, nextReviewAt: addDays(isoDate(now), days) };
}

export function calculateReadiness(syllabusCoverage, quizScore, reviewedCards, totalCards) {
  const coverage = Math.max(0, Math.min(100, Number(syllabusCoverage) || 0));
  const quiz = Math.max(0, Math.min(100, Number(quizScore) || 0));
  const recall = totalCards > 0 ? Math.max(0, Math.min(100, (reviewedCards / totalCards) * 100)) : 0;
  return Math.round(coverage * 0.4 + quiz * 0.4 + recall * 0.2);
}

export function requiredFinalScore(currentAverage, targetOverall, finalWeight) {
  const weight = Number(finalWeight) / 100;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1) return null;
  const required = (Number(targetOverall) - Number(currentAverage) * (1 - weight)) / weight;
  return Number.isFinite(required) ? Math.round(required * 10) / 10 : null;
}
