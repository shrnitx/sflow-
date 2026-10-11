const SUBJECTS = [
  "Physics", "Chemistry", "Mathematics", "Programming", "Biology",
  "English", "History", "Economics", "Other",
];

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDatePhrase(text, now = new Date()) {
  const source = text.toLowerCase();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (/\bday after tomorrow\b/.test(source)) {
    today.setDate(today.getDate() + 2);
    return localDateKey(today);
  }
  if (/\btomorrow\b/.test(source)) {
    today.setDate(today.getDate() + 1);
    return localDateKey(today);
  }
  if (/\btoday\b/.test(source)) return localDateKey(today);

  const inDays = source.match(/\bin\s+(\d{1,3})\s+days?\b/);
  if (inDays) {
    const result = new Date(today);
    result.setDate(result.getDate() + Number(inDays[1]));
    return localDateKey(result);
  }

  const iso = source.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const date = new Date(iso[1] + "-" + iso[2] + "-" + iso[3] + "T00:00:00");
    if (!Number.isNaN(date.getTime())) return localDateKey(date);
  }

  const numeric = source.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = numeric[3] ? Number(numeric[3]) : today.getFullYear();
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      if (!numeric[3] && date < today) date.setFullYear(year + 1);
      return localDateKey(date);
    }
  }

  const weekdayNames = [
    ["sunday", 0], ["monday", 1], ["tuesday", 2], ["wednesday", 3],
    ["thursday", 4], ["friday", 5], ["saturday", 6],
  ];
  const weekday = weekdayNames.find(([name]) =>
    new RegExp("\\b(?:this\\s+)?" + name + "\\b", "i").test(source)
  );
  if (weekday) {
    const targetDay = weekday[1];
    let delta = (targetDay - today.getDay() + 7) % 7;
    if (/\bnext\s+/.test(source)) {
      delta = delta === 0 ? 7 : delta + 7;
    }
    const result = new Date(today);
    result.setDate(result.getDate() + delta);
    return localDateKey(result);
  }

  return "";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^$()|[\]\\]/g, "\\$&");
}

function cleanTitle(source) {
  return source
    .replace(/\b(?:due|deadline|by)\s+(?:day after tomorrow|tomorrow|today|next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b(?:due|deadline|by)\s+(?:day after tomorrow|tomorrow|today)\b/gi, " ")
    .replace(/\bin\s+\d{1,3}\s+days?\b/gi, " ")
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]20\d{2})?\b/g, " ")
    .replace(/\b(?:priority\s*[:=]?\s*)?(?:high|medium|low)\s+priority\b/gi, " ")
    .replace(/\bpriority\s*[:=]\s*(?:high|medium|low)\b/gi, " ")
    .replace(/\b(?:high|medium|low)\s+priority\b/gi, " ")
    .replace(/[;,]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "")
    .trim();
}

export function parseQuickEntry(input, knownSubjects = []) {
  const raw = String(input || "").trim();
  if (!raw) {
    return { error: "Type what you need to do first." };
  }

  const source = raw.toLowerCase();
  const deadline = parseDatePhrase(source);
  const priorityMatch = source.match(/\b(high|medium|low)(?:\s+priority)?\b|\bpriority\s*[:=]\s*(high|medium|low)\b/i);
  const priority = priorityMatch?.[1] || priorityMatch?.[2] || "Medium";
  const normalizedSubjects = [...new Set([...knownSubjects, ...SUBJECTS])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const subject = normalizedSubjects.find((item) =>
    new RegExp("\\b" + escapeRegExp(item) + "\\b", "i").test(raw)
  ) || "";

  let title = cleanTitle(raw)
    .replace(/\b(high|medium|low)(?:\s+priority)?\b/gi, " ")
    .replace(/\bpriority\s*[:=]\s*(high|medium|low)\b/gi, " ");
  if (subject) title = title.replace(new RegExp("\\b" + escapeRegExp(subject) + "\\b", "i"), " ");
  title = title
    .replace(/^(?:please\s+)?(?:add|create|remind me to|remember to)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!title) {
    return { error: "I couldn't find a task name. Add a short description, such as \"Biology assignment due Friday, high priority\"." };
  }

  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    subject,
    deadline,
    priority: priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase(),
    type: "task",
    parsed: {
      dueDateFound: Boolean(deadline),
      subjectFound: Boolean(subject),
      priorityFound: Boolean(priorityMatch),
    },
  };
}

export function quickAddHelp() {
  return 'Examples: "Biology assignment due Friday, high priority", "Finish lab report tomorrow", or "Math revision in 3 days".';
}
