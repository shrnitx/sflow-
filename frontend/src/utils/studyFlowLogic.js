export function dateKey(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function dateLabel(value, options = { day: "numeric", month: "short" }) {
  if (!value) return "No date";
  const date = new Date(value.length === 10 ? value + "T00:00:00" : value);
  return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleDateString(undefined, options);
}

export function studySessionDate(session) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(session?.date || ""))) {
    return session.date;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(session?.localDate || ""))) {
    return session.localDate;
  }

  const timestamp = Date.parse(
    session?.startedAt || session?.finishedAt || session?.endedAt || session?.createdAt || ""
  );
  return Number.isFinite(timestamp) ? dateKey(new Date(timestamp)) : "";
}

function minuteOfDay(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return hours * 60 + minutes;
}

export function durationFor(task) {
  if (Number.isFinite(Number(task?.estimatedMinutes)) && Number(task.estimatedMinutes) > 0) {
    return Math.min(180, Math.max(15, Number(task.estimatedMinutes)));
  }
  return task?.priority === "High" || task?.priority === "Urgent" ? 45 : 30;
}

export function sortPending(tasks) {
  const weight = { Urgent: 0, High: 0, Medium: 1, Low: 2 };
  return (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && !task.completed)
    .slice()
    .sort((a, b) => {
      const priority = (weight[a.priority] ?? 1) - (weight[b.priority] ?? 1);
      if (priority) return priority;
      const deadlineA = a.deadline || "9999-12-31";
      const deadlineB = b.deadline || "9999-12-31";
      if (deadlineA !== deadlineB) return deadlineA.localeCompare(deadlineB);
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
}

export function buildDailyPlan(tasks, timetable, now = new Date()) {
  const pending = sortPending(tasks);
  const busy = (Array.isArray(timetable) ? timetable : [])
    .filter((entry) => entry && Number(entry.day) === now.getDay())
    .map((entry) => ({ start: minuteOfDay(entry.startTime), end: minuteOfDay(entry.endTime) }))
    .filter((entry) => entry.end > entry.start)
    .sort((a, b) => a.start - b.start);

  let cursor = Math.max(7 * 60, now.getHours() * 60 + now.getMinutes());
  const endOfDay = 22 * 60;
  const plan = [];

  for (const task of pending) {
    const duration = durationFor(task);
    let found = false;
    let tries = 0;
    while (cursor + duration <= endOfDay && tries <= busy.length + 2) {
      tries += 1;
      const conflict = busy.find((block) => cursor < block.end && cursor + duration > block.start);
      if (conflict) {
        cursor = conflict.end + 5;
        continue;
      }
      plan.push({ task, start: cursor, end: cursor + duration, duration });
      cursor += duration + 5;
      found = true;
      break;
    }
    if (!found) break;
  }
  return plan;
}

export function createAssistantReply(question, tasks, exams, syllabus, sessions, now = new Date()) {
  const key = dateKey(now);
  const q = String(question || "").toLowerCase();
  const pending = sortPending(tasks);
  const overdue = pending.filter((task) => task.deadline && task.deadline < key);
  const nextExam = (exams || [])
    .filter((exam) => exam.date && exam.date >= key)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const reviewQueue = (syllabus || []).filter((item) => !item.completed && item.nextReviewAt && item.nextReviewAt <= key);
  const todaySessions = (sessions || []).filter((session) => session.date === key);
  const todayMinutes = todaySessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  if (/progress|week|analytics|hours|study time/.test(q)) {
    return "Recorded focus time today: " + todayMinutes + " minutes across " + todaySessions.length + " session(s). " +
      (tasks || []).filter((task) => task.completed).length + " task(s) completed and " + pending.length +
      " remain. " + (reviewQueue.length ? "Revision due: " + reviewQueue.slice(0, 3).map((item) => item.title).join(", ") + "." : "No syllabus reviews are due today.");
  }
  if (/exam|revision|syllabus|chapter/.test(q)) {
    if (nextExam) return "Your next exam is " + nextExam.title + " (" + (nextExam.subject || "subject not set") + ") on " +
      dateLabel(nextExam.date, { day: "numeric", month: "long" }) + ". " +
      (reviewQueue.length ? "Start with these due reviews: " + reviewQueue.slice(0, 3).map((item) => item.title).join(", ") + "." : "Add syllabus topics to build a spaced-revision queue.");
    return reviewQueue.length ? "Start with due revisions: " + reviewQueue.slice(0, 4).map((item) => item.title).join(", ") + ". Test yourself before marking a topic reviewed." :
      "No upcoming exam is saved yet. Add your next exam date and syllabus topics so StudyFlow can track preparation.";
  }
  if (/overdue|late|behind|urgent/.test(q) && overdue.length) {
    return "Recover overdue work first: " + overdue.slice(0, 3).map((task) => task.title).join(", ") +
      ". Start with one short focus block, then reassess rather than planning an unrealistic marathon.";
  }
  if (/time|minute|hour|short session|90|60|30/.test(q)) {
    const minutes = Number((q.match(/(\d{1,3})\s*(?:min|minute)/) || [])[1]) || 60;
    const fitting = pending.filter((task) => durationFor(task) <= minutes).slice(0, 3);
    if (fitting.length) return "For about " + minutes + " minutes, try " + fitting.map((task) => task.title).join(", ") +
      ". Begin with " + fitting[0].title + " and leave five minutes to record what you finished.";
  }
  if (!pending.length) return "Your task list is clear. Use the time for a due syllabus review, or add tomorrow's first task before ending the day.";
  const suggested = pending.slice(0, 3);
  const context = overdue.length ? "You have " + overdue.length + " overdue task(s), so catch-up comes first. " :
    nextExam ? "Your next exam is " + nextExam.title + " on " + dateLabel(nextExam.date) + ". " :
    "Start with the highest-priority task with the nearest deadline. ";
  return context + "Suggested order: " + suggested.map((task, i) => (i + 1) + ". " + task.title).join(" ") +
    ". Give the first task a " + durationFor(suggested[0]) + "-minute focus block, then decide the next step based on actual progress.";
}
