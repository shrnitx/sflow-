import React, { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, CheckCircle2, Clock3, GraduationCap } from "lucide-react";
import { DAYS, sortClassesByTime } from "../utils/timetable";
import { loadUserSettings, saveUserSettings } from "../utils/storage";

const DEFAULT_SETTINGS = {
  remindersEnabled: false,
  classLeadMinutes: 10,
  examLeadDays: 1,
  taskLeadDays: 1,
};

function getSettings(userId) {
  return { ...DEFAULT_SETTINGS, ...loadUserSettings(userId) };
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isExam(item) {
  const type = String(item?.type || item?.category || "").toLowerCase();
  if (type === "exam" || type === "examination") return true;
  if (type === "task" || type === "assignment") return false;
  return /\b(exam|examination|midterm|finals?|quiz|viva|practical exam)\b/i.test(
    (item?.title || "") + " " + (item?.description || "")
  );
}

function daysUntil(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date - today) / 86400000);
}

function ReminderSettings({ userId, timetable, tasks, onToast }) {
  const [settings, setSettings] = useState(() => getSettings(userId));
  const [permission, setPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );
  const [lastNotice, setLastNotice] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setSettings(getSettings(userId));
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const upcomingSummary = useMemo(() => {
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const nextClass = sortClassesByTime(
      timetable.filter((item) => item.day === currentDay && Number(item.startTime?.slice(0, 2) * 60 + Number(item.startTime?.slice(3, 5))) > currentMinutes)
    )[0];
    const upcomingExam = tasks
      .filter((item) => isExam(item) && !item.completed && item.deadline)
      .map((item) => ({ ...item, daysAway: daysUntil(item.deadline) }))
      .filter((item) => item.daysAway !== null && item.daysAway >= 0)
      .sort((a, b) => a.daysAway - b.daysAway)[0];
    return { nextClass, upcomingExam };
  }, [now, timetable, tasks]);

  useEffect(() => {
    if (!settings.remindersEnabled || permission !== "granted") return undefined;

    const checkReminders = () => {
      const current = new Date();
      const dateKey = localDateKey(current);
      const currentDay = current.getDay();
      const currentMinutes = current.getHours() * 60 + current.getMinutes();
      const classes = timetable.filter((item) => item.day === currentDay);

      classes.forEach((item) => {
        const parts = String(item.startTime || "").split(":").map(Number);
        if (parts.length !== 2 || !parts.every(Number.isFinite)) return;
        const delta = parts[0] * 60 + parts[1] - currentMinutes;
        if (delta < 0 || delta > Number(settings.classLeadMinutes)) return;

        const key = "class:" + dateKey + ":" + item.id + ":" + settings.classLeadMinutes;
        if (localStorage.getItem("studyflow.notice." + userId + "." + key)) return;
        try {
          new Notification("Upcoming class: " + item.subject, {
            body: "Starts in " + delta + " minute" + (delta === 1 ? "" : "s") +
              (item.room ? " · " + item.room : ""),
            tag: key,
          });
          localStorage.setItem("studyflow.notice." + userId + "." + key, "1");
          setLastNotice("Class reminder sent for " + item.subject + ".");
        } catch (error) {
          console.warn("Could not show a class notification:", error);
        }
      });

      tasks.filter((item) => isExam(item) && !item.completed && item.deadline).forEach((item) => {
        const delta = daysUntil(item.deadline);
        if (delta === null || delta < 0 || delta > Number(settings.examLeadDays)) return;
        const key = "exam:" + dateKey + ":" + item.id + ":" + settings.examLeadDays;
        if (localStorage.getItem("studyflow.notice." + userId + "." + key)) return;
        try {
          new Notification(delta === 0 ? "Exam today: " + item.title : "Upcoming exam: " + item.title, {
            body: delta === 0 ? "Your exam is scheduled for today." : "Exam date: " + item.deadline,
            tag: key,
          });
          localStorage.setItem("studyflow.notice." + userId + "." + key, "1");
          setLastNotice("Exam reminder sent for " + item.title + ".");
        } catch (error) {
          console.warn("Could not show an exam notification:", error);
        }
      });
    };

    checkReminders();
    const timer = window.setInterval(checkReminders, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkReminders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [settings, permission, userId, timetable, tasks]);

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveUserSettings(userId, next);
  };

  const enableReminders = async () => {
    if (typeof Notification === "undefined") {
      onToast("Browser notifications are not supported here.");
      return;
    }
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission === "granted") {
        updateSettings({ remindersEnabled: true });
        onToast("Class and exam reminders enabled while StudyFlow is open.");
      } else {
        updateSettings({ remindersEnabled: false });
        onToast("Notification permission was not granted.");
      }
    } catch (error) {
      console.warn("Notification permission request failed:", error);
      onToast("Could not enable notifications in this browser.");
    }
  };

  return (
    <section className="panel reminder-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">STAY ON TRACK</span>
          <h2>Reminders</h2>
        </div>
        <div className="reminder-icon">
          {settings.remindersEnabled && permission === "granted"
            ? <Bell size={20} />
            : <BellOff size={20} />}
        </div>
      </div>

      <p className="reminder-intro">
        Choose when StudyFlow should remind you about your classes and exams.
      </p>

      <div className="reminder-settings-row">
        <div className="field">
          <label htmlFor="class-reminder-lead">Class reminder</label>
          <select
            id="class-reminder-lead"
            value={settings.classLeadMinutes}
            onChange={(event) => updateSettings({ classLeadMinutes: Number(event.target.value) })}
          >
            <option value={5}>5 minutes before</option>
            <option value={10}>10 minutes before</option>
            <option value={15}>15 minutes before</option>
            <option value={30}>30 minutes before</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="exam-reminder-lead">Exam reminder</label>
          <select
            id="exam-reminder-lead"
            value={settings.examLeadDays}
            onChange={(event) => updateSettings({ examLeadDays: Number(event.target.value) })}
          >
            <option value={0}>On exam day</option>
            <option value={1}>1 day before</option>
            <option value={3}>3 days before</option>
            <option value={7}>1 week before</option>
          </select>
        </div>
      </div>

      {permission === "granted" && settings.remindersEnabled ? (
        <div className="reminder-status" role="status">
          <CheckCircle2 size={17} />
          <span>Reminders enabled while StudyFlow is open.</span>
        </div>
      ) : (
        <button type="button" className="primary-button" onClick={enableReminders}>
          <Bell size={16} />
          Enable reminders
        </button>
      )}

      {lastNotice && <p className="reminder-last-notice">{lastNotice}</p>}

      <div className="reminder-footnote">
        <Clock3 size={14} />
        <span>For dependable reminders, keep the app open. Push notifications while fully closed need additional push-service credentials.</span>
      </div>
      {upcomingSummary.upcomingExam && (
        <div className="reminder-upcoming">
          <GraduationCap size={16} />
          <span>Next exam: <strong>{upcomingSummary.upcomingExam.title}</strong> · {upcomingSummary.upcomingExam.daysAway === 0 ? "Today" : "in " + upcomingSummary.upcomingExam.daysAway + " days"}</span>
        </div>
      )}
    </section>
  );
}

export default ReminderSettings;
