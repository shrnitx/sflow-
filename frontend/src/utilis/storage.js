const STORAGE_KEY = "studyflow.tasks.v1";

export const loadTasks = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic sanity check on each item
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

export const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};
