const TESSERACT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";

let tesseractPromise;

function loadTesseract() {
  if (window.Tesseract?.createWorker) {
    return Promise.resolve(window.Tesseract);
  }

  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-studyflow-tesseract="true"]');
      const script = existing || document.createElement("script");

      const onLoad = () => {
        if (window.Tesseract?.createWorker) {
          resolve(window.Tesseract);
        } else {
          tesseractPromise = null;
          reject(new Error("The image reader did not load correctly. Refresh and try again."));
        }
      };

      const onError = () => {
        tesseractPromise = null;
        reject(new Error("Could not load the image-reading engine. Check your internet connection and try again."));
      };

      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });

      if (!existing) {
        script.src = TESSERACT_SCRIPT_URL;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.dataset.studyflowTesseract = "true";
        document.head.appendChild(script);
      } else if (window.Tesseract?.createWorker) {
        resolve(window.Tesseract);
      }
    });
  }

  return tesseractPromise;
}

const DAY_MAP = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

function cleanToken(value) {
  return String(value || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
}

function dayForWord(value) {
  return DAY_MAP[cleanToken(value)];
}

function centerX(item) {
  return (item.bbox.x0 + item.bbox.x1) / 2;
}

function centerY(item) {
  return (item.bbox.y0 + item.bbox.y1) / 2;
}

function median(numbers) {
  if (!numbers.length) return 14;
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function groupWordsIntoRows(words) {
  const sorted = [...words].sort((a, b) => centerY(a) - centerY(b) || centerX(a) - centerX(b));
  const typicalHeight = median(sorted.map((word) => word.bbox.y1 - word.bbox.y0));
  const tolerance = Math.max(10, Math.min(28, typicalHeight * 0.78));
  const rows = [];

  sorted.forEach((word) => {
    const y = centerY(word);
    let row = rows[rows.length - 1];

    if (!row || Math.abs(row.y - y) > tolerance) {
      row = { y, words: [] };
      rows.push(row);
    }

    row.words.push(word);
    row.y = row.words.reduce((sum, item) => sum + centerY(item), 0) / row.words.length;
  });

  return rows;
}

function formatClock(totalMinutes) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  return String(hours).padStart(2, "0") + ":" + String(minutes % 60).padStart(2, "0");
}

function parseTimes(text) {
  const source = String(text || "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il](?=[:.]\d)/g, "1");
  const result = [];
  const pattern = /(\b(?:[01]?\d|2[0-3])\s*[:.]\s*[0-5]\d\s*(?:a\.?m\.?|p\.?m\.?)?|\b(?:1[0-2]|0?[1-9])\s*(?:a\.?m\.?|p\.?m\.?))/gi;
  let match;

  while ((match = pattern.exec(source))) {
    const token = match[0].replace(/\./g, ":").replace(/\s+/g, "").toLowerCase();
    const meridiemMatch = token.match(/(am|pm)$/);
    const meridiem = meridiemMatch ? meridiemMatch[1] : "";
    const numeric = token.replace(/(am|pm)$/, "");
    let hours;
    let minutes = 0;

    if (numeric.includes(":")) {
      const pieces = numeric.split(":");
      hours = Number(pieces[0]);
      minutes = Number(pieces[1]);
    } else {
      hours = Number(numeric);
    }

    if (!Number.isFinite(hours) || hours > 23 || minutes > 59) continue;
    if (meridiem) {
      if (hours < 1 || hours > 12) continue;
      if (meridiem === "am" && hours === 12) hours = 0;
      if (meridiem === "pm" && hours !== 12) hours += 12;
    }

    const total = hours * 60 + minutes;
    if (!result.some((time) => time.minutes === total)) {
      result.push({ minutes: total, token: match[0] });
    }
  }

  return result;
}

function removeTimesAndDays(text) {
  return String(text || "")
    .replace(/[Oo](?=[:.]\d)/g, "0")
    .replace(/\b(?:[01]?\d|2[0-3])\s*[:.]\s*[0-5]\d\s*(?:a\.?m\.?|p\.?m\.?)?/gi, " ")
    .replace(/\b(?:1[0-2]|0?[1-9])\s*(?:a\.?m\.?|p\.?m\.?)/gi, " ")
    .replace(/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sun|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat)\b/gi, " ")
    .replace(/\b(?:am|pm)\b/gi, " ")
    .replace(/[|_\u2022•]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:;,\-–—]+|[\s:;,\-–—]+$/g, "")
    .trim();
}

function cleanSubject(words) {
  const text = words
    .sort((a, b) => centerX(a) - centerX(b))
    .map((word) => word.text)
    .join(" ");
  const cleaned = removeTimesAndDays(text);

  if (!cleaned || /^(?:break|lunch|recess|free period|holiday|no class)$/i.test(cleaned)) {
    return "";
  }

  if (cleaned.replace(/[^a-z0-9]/gi, "").length < 2) return "";
  return cleaned.replace(/\s{2,}/g, " ");
}

function columnForX(x, columns) {
  const sorted = [...columns].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length; i += 1) {
    const left = i === 0 ? -Infinity : (sorted[i - 1].x + sorted[i].x) / 2;
    const right = i === sorted.length - 1 ? Infinity : (sorted[i].x + sorted[i + 1].x) / 2;
    if (x >= left && x < right) return sorted[i];
  }
  return null;
}

function extractGridTimetable(rows) {
  const dayRows = rows.map((row) => {
    const found = row.words
      .map((word) => ({ word, day: dayForWord(word.text) }))
      .filter((item) => item.day !== undefined);
    return { row, found, distinctDays: new Set(found.map((item) => item.day)).size };
  });

  const headerCandidate = dayRows
    .filter((item) => item.distinctDays >= 2)
    .sort((a, b) => b.distinctDays - a.distinctDays || a.row.y - b.row.y)[0];

  if (!headerCandidate) return [];

  const headerY = headerCandidate.row.y;
  const columns = [];
  headerCandidate.found.forEach(({ word, day }) => {
    const existing = columns.find((column) => column.day === day);
    if (existing) {
      existing.x = (existing.x + centerX(word)) / 2;
    } else {
      columns.push({ day, x: centerX(word) });
    }
  });

  if (columns.length < 2) return [];
  columns.sort((a, b) => a.x - b.x);
  const firstColumnX = columns[0].x;
  const firstGap = columns.length > 1 ? columns[1].x - columns[0].x : 180;
  const timeColumnBoundary = firstColumnX - Math.max(18, firstGap * 0.42);

  const bodyRows = rows.filter((row) => row.y > headerY + 4);
  const slots = [];

  bodyRows.forEach((row) => {
    const dayHeadersOnly = row.words.every((word) => dayForWord(word.text) !== undefined);
    if (dayHeadersOnly) return;

    const timeWords = row.words.filter((word) => centerX(word) < timeColumnBoundary);
    const timeTokens = parseTimes(timeWords.map((word) => word.text).join(" "));
    const subjects = [];

    columns.forEach((column) => {
      const boundary = columnForX(column.x, columns);
      if (!boundary) return;
      const left = columns.findIndex((item) => item.day === boundary.day) === 0
        ? timeColumnBoundary
        : (columns[columns.findIndex((item) => item.day === boundary.day) - 1].x + boundary.x) / 2;
      const columnIndex = columns.findIndex((item) => item.day === boundary.day);
      const right = columnIndex === columns.length - 1
        ? Infinity
        : (boundary.x + columns[columnIndex + 1].x) / 2;
      const cellWords = row.words.filter((word) => centerX(word) >= left && centerX(word) < right);
      const subject = cleanSubject(cellWords);
      if (subject) subjects.push({ day: boundary.day, subject });
    });

    if (!subjects.length) return;

    let start = null;
    let end = null;
    if (timeTokens.length >= 2) {
      start = timeTokens[0].minutes;
      end = timeTokens[1].minutes;
      if (end <= start) end = null;
    } else if (timeTokens.length === 1) {
      start = timeTokens[0].minutes;
    }

    slots.push({ y: row.y, start, end, subjects });
  });

  const result = [];
  const timedSlots = slots.filter((slot) => slot.start !== null);

  slots.forEach((slot) => {
    if (slot.start === null) return;
    let end = slot.end;
    if (end === null) {
      const nextSlot = timedSlots.find((candidate) => candidate.y > slot.y && candidate.start > slot.start);
      end = nextSlot ? nextSlot.start : slot.start + 50;
    }

    if (end <= slot.start) end = slot.start + 50;
    slot.subjects.forEach(({ day, subject }) => {
      result.push({
        day,
        subject,
        startTime: formatClock(slot.start),
        endTime: formatClock(end),
        recurring: true,
      });
    });
  });

  return result;
}

export async function recognizeTimetableScreenshot(file, onProgress = () => {}) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Choose a timetable screenshot in PNG, JPG, or WEBP format.");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("That image is larger than 12 MB. Please choose a smaller screenshot.");
  }

  const Tesseract = await loadTesseract();
  let worker;

  try {
    worker = await Tesseract.createWorker("eng", 1, {
      logger: (event) => {
        if (event.status === "recognizing text") {
          onProgress(Math.round((event.progress || 0) * 100), "Reading timetable text");
        } else if (event.status) {
          onProgress(Math.round((event.progress || 0) * 100), event.status);
        }
      },
    });

    onProgress(2, "Preparing image reader");
    const { data } = await worker.recognize(file);
    const words = (data.words || [])
      .filter((word) => word.text?.trim() && word.bbox)
      .map((word) => ({ text: word.text.trim(), bbox: word.bbox, confidence: word.confidence || 0 }));

    if (!words.length) {
      throw new Error("No readable text was found. Try a clearer screenshot with larger text.");
    }

    const rows = groupWordsIntoRows(words);
    const gridEntries = extractGridTimetable(rows);

    if (gridEntries.length) {
      const unique = new Map();
      gridEntries.forEach((entry) => {
        const key = [entry.day, entry.startTime, entry.endTime, entry.subject.toLowerCase()].join("|");
        if (!unique.has(key)) unique.set(key, entry);
      });
      onProgress(100, "Timetable extracted");
      return [...unique.values()].sort((a, b) =>
        a.day - b.day || a.startTime.localeCompare(b.startTime)
      );
    }

    // Fallback for simple one-class-per-line screenshots that name the day explicitly.
    const lines = (data.lines || []).map((line) => ({
      text: line.text || "",
      bbox: line.bbox,
    }));
    const fallback = [];

    lines.forEach((line) => {
      const parts = line.text.split(/\s+/);
      const dayTokens = parts.map((part) => ({ part, day: dayForWord(part) })).filter((item) => item.day !== undefined);
      const timeTokens = parseTimes(line.text);

      if (!dayTokens.length || !timeTokens.length) return;
      const subject = removeTimesAndDays(line.text);
      if (!subject || /^(?:break|lunch|recess|free period|holiday|no class)$/i.test(subject)) return;

      const start = timeTokens[0].minutes;
      const end = timeTokens[1]?.minutes && timeTokens[1].minutes > start
        ? timeTokens[1].minutes
        : start + 50;

      dayTokens.forEach(({ day }) => fallback.push({
        day,
        subject,
        startTime: formatClock(start),
        endTime: formatClock(end),
        recurring: true,
      }));
    });

    const unique = new Map();
    fallback.forEach((entry) => {
      const key = [entry.day, entry.startTime, entry.endTime, entry.subject.toLowerCase()].join("|");
      if (!unique.has(key)) unique.set(key, entry);
    });

    if (!unique.size) {
      throw new Error(
        "I couldn't confidently map the screenshot to days and time slots. Try a clear, full timetable screenshot with visible weekday and time headings."
      );
    }

    onProgress(100, "Timetable extracted");
    return [...unique.values()].sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}
