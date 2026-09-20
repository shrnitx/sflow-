const STORAGE_KEY = "studyflow.tasks.v1";
const TIMETABLE_STORAGE_KEY = "studyflow.timetable.v1";

export const loadTasks = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof t.id === "string" &&
        typeof t.title === "string"
    );
  } catch (err) {
    console.warn("Failed to read tasks from localStorage:", err);
    return [];
  }
};

export const saveTasks = (tasks) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.warn("Failed to save tasks:", err);
  }
};

export const loadTimetable = () => {
  try {
    const raw = localStorage.getItem(TIMETABLE_STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.subject === "string" &&
        Number.isInteger(item.day) &&
        item.day >= 0 &&
        item.day <= 6 &&
        typeof item.startTime === "string" &&
        typeof item.endTime === "string"
    );
  } catch (err) {
    console.warn("Failed to read timetable from localStorage:", err);
    return [];
  }
};

export const saveTimetable = (timetable) => {
  try {
    localStorage.setItem(
      TIMETABLE_STORAGE_KEY,
      JSON.stringify(timetable)
    );
  } catch (err) {
    console.warn("Failed to save timetable:", err);
  }
};

export const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `t_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
};