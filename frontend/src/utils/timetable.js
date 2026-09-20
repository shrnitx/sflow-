export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

export const getTodayDay = () => {
  return new Date().getDay();
};

export const getTodayDate = () => {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const timeToMinutes = (time) => {
  if (typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) {
    return 0;
  }

  const [hours, minutes] = time.split(":").map(Number);

  if (hours > 23 || minutes > 59) return 0;

  return hours * 60 + minutes;
};

export const formatTime = (time) => {
  if (timeToMinutes(time) === 0 && time !== "00:00") return "";

  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

export const isTimeInRange = (
  currentMinutes,
  startTime,
  endTime
) => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  return currentMinutes >= start && currentMinutes < end;
};

export const getCurrentMinutes = () => {
  const date = new Date();
  return date.getHours() * 60 + date.getMinutes();
};

export const sortClassesByTime = (classes) => {
  if (!Array.isArray(classes)) return [];

  return [...classes].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
};

export const getDayLabel = (day) => {
  return Number.isInteger(day) && day >= 0 && day <= 6
    ? DAYS[day]
    : "";
};