// Utilities for working with task deadlines.
// All comparisons use calendar-day (local time), so "today" is not overdue.

const startOfDay = (d) => {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
};

export const daysUntil = (isoDate) => {
  if (!isoDate) return null;
  const target = startOfDay(isoDate);
  const today = startOfDay(new Date());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

export const formatDeadline = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const daysLabel = (isoDate) => {
  const n = daysUntil(isoDate);
  if (n === null) return "";
  if (n < 0) return `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"} overdue`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `${n} days left`;
};