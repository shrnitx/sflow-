const ISO_DATE = /^\\d{4}-\\d{2}-\\d{2}$/;

export function isIsoDate(value) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function objectData(row) {
  return row?.data && typeof row.data === "object" && !Array.isArray(row.data)
    ? row.data
    : null;
}

export function normalizeTaskRow(row) {
  const data = objectData(row);
  if (!data || typeof row.record_id !== "string" || typeof data.title !== "string") return null;
  return {
    ...data,
    id: row.record_id,
    title: data.title,
    subject: typeof data.subject === "string" ? data.subject : undefined,
    deadline: typeof data.deadline === "string" ? data.deadline : undefined,
    priority: typeof data.priority === "string" ? data.priority : undefined,
    completed: typeof data.completed === "boolean" ? data.completed : false,
    description: typeof data.description === "string" ? data.description : undefined,
  };
}

export function normalizeTimetableRow(row) {
  const data = objectData(row);
  if (!data || typeof row.record_id !== "string" || typeof data.subject !== "string") return null;
  if (!Number.isInteger(data.day) || data.day < 0 || data.day > 6) return null;
  if (typeof data.startTime !== "string" || typeof data.endTime !== "string") return null;
  return {
    ...data,
    id: row.record_id,
    subject: data.subject,
    day: data.day,
    startTime: data.startTime,
    endTime: data.endTime,
    room: typeof data.room === "string" ? data.room : undefined,
  };
}
