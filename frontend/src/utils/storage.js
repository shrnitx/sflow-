const STORAGE_KEY = "studyflow.tasks.v1";
const TIMETABLE_STORAGE_KEY = "studyflow.timetable.v1";
const LEGACY_REVIEWED_KEY = "studyflow.legacy-migration-reviewed.v1";

const isTask = (item) =>
  item &&
  typeof item === "object" &&
  typeof item.id === "string" &&
  typeof item.title === "string";

const isTimetableEntry = (item) =>
  item &&
  typeof item === "object" &&
  typeof item.id === "string" &&
  typeof item.subject === "string" &&
  Number.isInteger(item.day) &&
  item.day >= 0 &&
  item.day <= 6 &&
  typeof item.startTime === "string" &&
  typeof item.endTime === "string";

const readArray = (key, validator) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validator);
  } catch (err) {
    console.warn(`Failed to read ${key} from localStorage:`, err);
    return [];
  }
};

const writeArray = (key, records) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(records) ? records : []));
  } catch (err) {
    console.warn(`Failed to save ${key}:`, err);
  }
};

// Legacy, browser-global keys are kept only as a one-time migration source.
export const loadTasks = () => readArray(STORAGE_KEY, isTask);
export const saveTasks = (tasks) => writeArray(STORAGE_KEY, tasks);
export const loadTimetable = () => readArray(TIMETABLE_STORAGE_KEY, isTimetableEntry);
export const saveTimetable = (timetable) => writeArray(TIMETABLE_STORAGE_KEY, timetable);

const userKey = (key, userId) => `${key}.user.${encodeURIComponent(userId)}`;

export const loadUserTasks = (userId) =>
  readArray(userKey(STORAGE_KEY, userId), isTask);

export const saveUserTasks = (userId, tasks) =>
  writeArray(userKey(STORAGE_KEY, userId), tasks);

export const loadUserTimetable = (userId) =>
  readArray(userKey(TIMETABLE_STORAGE_KEY, userId), isTimetableEntry);

export const saveUserTimetable = (userId, timetable) =>
  writeArray(userKey(TIMETABLE_STORAGE_KEY, userId), timetable);

const FOCUS_STORAGE_KEY = "studyflow.focus-sessions.v1";

const isFocusSession = (item) =>
  item &&
  typeof item === "object" &&
  typeof item.id === "string" &&
  typeof item.startedAt === "string" &&
  Number.isFinite(Number(item.durationMinutes)) &&
  Number(item.durationMinutes) > 0;

export const loadUserFocusSessions = (userId) =>
  readArray(userKey(FOCUS_STORAGE_KEY, userId), isFocusSession);

export const saveUserFocusSessions = (userId, sessions) =>
  writeArray(userKey(FOCUS_STORAGE_KEY, userId), sessions);

const settingsKey = (userId) => `studyflow.settings.user.${encodeURIComponent(userId)}`;

export const loadUserSettings = (userId) => {
  try {
    const value = localStorage.getItem(settingsKey(userId));
    const parsed = value ? JSON.parse(value) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.warn("Failed to read StudyFlow settings:", error);
    return {};
  }
};

export const saveUserSettings = (userId, settings) => {
  try {
    localStorage.setItem(settingsKey(userId), JSON.stringify(settings || {}));
  } catch (error) {
    console.warn("Failed to save StudyFlow settings:", error);
  }
};

export const wasLegacyMigrationReviewed = () => {
  try {
    return localStorage.getItem(LEGACY_REVIEWED_KEY) === "true";
  } catch {
    return false;
  }
};

export const markLegacyMigrationReviewed = () => {
  try {
    localStorage.setItem(LEGACY_REVIEWED_KEY, "true");
  } catch (err) {
    console.warn("Could not save the legacy migration decision:", err);
  }
};

export const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};
