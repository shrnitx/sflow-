import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Bell, BookOpen, BrainCircuit, CalendarDays, Check, CheckCircle2,
  Clock3, Cloud, CloudOff, Coffee, Flame, ListChecks, Pause, Play, Plus,
  RotateCcw, ShieldCheck, Sparkles, Target, TimerReset, Trash2
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { makeId } from "../utils/storage";
import { buildDailyPlan, createAssistantReply, dateKey, dateLabel, durationFor, sortPending } from "../utils/studyFlowLogic";
import "./StudyFlowWorkspace.css";

const USER_DATA_KEYS = ["exams", "syllabus", "reminders"];
const WORKSPACE_PREFIX = "studyflow.workspace.v1";

function safeRead(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function clockLabel(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

function Metric({ icon: Icon, label, value }) {
  return <div className="sfw-metric"><span><Icon size={16} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

export default function StudyFlowWorkspace({ user, tasks, setTasks, timetable, setToast, sessions, setSessions }) {
  const userId = user.id;
  const dataKey = WORKSPACE_PREFIX + ":" + userId;
  const [tab, setTab] = useState("focus");
  const [exams, setExams] = useState(() => safeRead(dataKey + ":exams", []));
  const [syllabus, setSyllabus] = useState(() => safeRead(dataKey + ":syllabus", []));
  const [reminderPrefs, setReminderPrefs] = useState(() => safeRead(dataKey + ":reminders", { notificationsEnabled: false, dailyReminderTime: "09:00" }));
  const [messages, setMessages] = useState(() => safeRead(dataKey + ":assistant", []));
  const [dataReadyUser, setDataReadyUser] = useState(null);
  const [cloudStatus, setCloudStatus] = useState("syncing");
  const [examDraft, setExamDraft] = useState({ title: "", subject: "", date: "" });
  const [topicDraft, setTopicDraft] = useState({ title: "", subject: "" });
  const [focusTaskId, setFocusTaskId] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [timerMode, setTimerMode] = useState("focus");
  const [secondsLeft, setSecondsLeft] = useState(1500);
  const [timerState, setTimerState] = useState("idle");
  const [dailyPlan, setDailyPlan] = useState([]);
  const [question, setQuestion] = useState("");
  const [permission, setPermission] = useState(typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported");
  const guard = useRef(false);
  const lastTick = useRef(0);

  const pendingTasks = useMemo(() => sortPending(tasks), [tasks]);
  const selectedTask = useMemo(() => pendingTasks.find((task) => task.id === focusTaskId) || pendingTasks[0] || null, [pendingTasks, focusTaskId]);

  useEffect(() => {
    if (!focusTaskId && pendingTasks.length) setFocusTaskId(pendingTasks[0].id);
    if (focusTaskId && !pendingTasks.some((task) => task.id === focusTaskId)) setFocusTaskId(pendingTasks[0]?.id || "");
  }, [pendingTasks, focusTaskId]);

  useEffect(() => {
    let active = true;
    setDataReadyUser(null);
    setCloudStatus("syncing");
    const load = async () => {
      const fallback = {
        exams: safeRead(dataKey + ":exams", []),
        syllabus: safeRead(dataKey + ":syllabus", []),
        reminders: safeRead(dataKey + ":reminders", { notificationsEnabled: false, dailyReminderTime: "09:00" }),
      };
      try {
        const { data, error } = await supabase.from("studyflow_user_data").select("record_id,data").eq("user_id", userId).in("record_id", USER_DATA_KEYS);
        if (error) throw error;
        if (!active) return;
        const remote = Object.fromEntries((data || []).map((row) => [row.record_id, row.data || {}]));
        setExams(Array.isArray(remote.exams?.items) ? remote.exams.items : fallback.exams);
        setSyllabus(Array.isArray(remote.syllabus?.items) ? remote.syllabus.items : fallback.syllabus);
        setReminderPrefs(remote.reminders?.prefs && typeof remote.reminders.prefs === "object" ? remote.reminders.prefs : fallback.reminders);
        setCloudStatus("synced");
      } catch (error) {
        console.error("StudyFlow workspace cloud read failed:", error);
        if (!active) return;
        setExams(fallback.exams);
        setSyllabus(fallback.syllabus);
        setReminderPrefs(fallback.reminders);
        setCloudStatus("error");
      } finally {
        if (active) setDataReadyUser(userId);
      }
    };
    load();
    return () => { active = false; };
  }, [userId, dataKey]);

  useEffect(() => {
    if (dataReadyUser !== userId) return undefined;
    try {
      window.localStorage.setItem(dataKey + ":exams", JSON.stringify(exams));
      window.localStorage.setItem(dataKey + ":syllabus", JSON.stringify(syllabus));
      window.localStorage.setItem(dataKey + ":reminders", JSON.stringify(reminderPrefs));
      window.localStorage.setItem(dataKey + ":assistant", JSON.stringify(messages));
    } catch (error) {
      console.error("StudyFlow local workspace backup failed:", error);
    }
    const timeout = window.setTimeout(async () => {
      try {
        const updatedAt = new Date().toISOString();
        const rows = [
          { user_id: userId, record_id: "exams", data: { items: exams }, updated_at: updatedAt },
          { user_id: userId, record_id: "syllabus", data: { items: syllabus }, updated_at: updatedAt },
          { user_id: userId, record_id: "reminders", data: { prefs: reminderPrefs }, updated_at: updatedAt },
        ];
        const { error } = await supabase.from("studyflow_user_data").upsert(rows, { onConflict: "user_id,record_id" });
        if (error) throw error;
        setCloudStatus("synced");
      } catch (error) {
        console.error("StudyFlow workspace cloud save failed:", error);
        setCloudStatus("error");
      }
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [userId, dataKey, dataReadyUser, exams, syllabus, reminderPrefs, messages]);

  const recordSession = useCallback((seconds) => {
    if (!selectedTask || seconds < 60) {
      setToast("Complete at least one minute of focus on a selected task to log a session.");
      return;
    }
    const ended = new Date();
    const session = {
      id: makeId(),
      taskId: selectedTask.id,
      taskTitle: selectedTask.title,
      subject: selectedTask.subject || "Uncategorized",
      startedAt: new Date(ended.getTime() - seconds * 1000).toISOString(),
      endedAt: ended.toISOString(),
      finishedAt: ended.toISOString(),
      date: dateKey(ended),
      localDate: dateKey(ended),
      durationSeconds: seconds,
      durationMinutes: Math.max(1, Math.round(seconds / 60)),
    };
    setSessions((current) => [session, ...current].slice(0, 500));
    setToast("Focus session saved to your study history.");
  }, [selectedTask, setToast, setSessions]);

  const finishTimer = useCallback(() => {
    if (guard.current) return;
    guard.current = true;
    if (timerMode === "focus") recordSession(Math.max(0, focusMinutes * 60 - secondsLeft));
    else setToast("Break complete. Start a new focus block when you're ready.");
    setTimerState("complete");
  }, [timerMode, focusMinutes, secondsLeft, recordSession, setToast]);

  useEffect(() => {
    if (timerState !== "running") return undefined;
    const tick = () => {
      const now = Date.now();
      if (!lastTick.current) lastTick.current = now;
      const elapsed = Math.floor((now - lastTick.current) / 1000);
      if (elapsed < 1) return;
      lastTick.current += elapsed * 1000;
      setSecondsLeft((current) => {
        const next = Math.max(0, current - elapsed);
        if (next === 0) window.setTimeout(finishTimer, 0);
        return next;
      });
    };
    lastTick.current = Date.now();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [timerState, finishTimer]);

  const startTimer = () => {
    if (timerMode === "focus" && !selectedTask) {
      setToast("Add a pending task before starting a focus session.");
      return;
    }
    if (timerState === "complete") setSecondsLeft((timerMode === "focus" ? focusMinutes : 5) * 60);
    guard.current = false;
    lastTick.current = Date.now();
    setTimerState("running");
  };

  const pauseTimer = () => { lastTick.current = 0; setTimerState("paused"); };
  const resetTimer = () => {
    guard.current = true;
    lastTick.current = 0;
    setTimerState("idle");
    setSecondsLeft((timerMode === "focus" ? focusMinutes : 5) * 60);
  };
  const chooseDuration = (minutes) => {
    if (timerState === "running" || timerState === "paused") return;
    if (![15, 25, 50].includes(minutes)) return;
    guard.current = true;
    setFocusMinutes(minutes);
    setTimerMode("focus");
    setTimerState("idle");
    setSecondsLeft(minutes * 60);
  };
  const startBreak = () => {
    guard.current = true;
    lastTick.current = 0;
    setTimerMode("break");
    setSecondsLeft(5 * 60);
    setTimerState("idle");
  };

  const addExam = (event) => {
    event.preventDefault();
    if (!examDraft.title.trim() || !examDraft.date) {
      setToast("Add an exam name and date.");
      return;
    }
    setExams((current) => [...current, {
      id: makeId(), title: examDraft.title.trim(), subject: examDraft.subject.trim() || "General",
      date: examDraft.date, createdAt: new Date().toISOString(),
    }].sort((a, b) => a.date.localeCompare(b.date)));
    setExamDraft({ title: "", subject: "", date: "" });
    setToast("Exam saved.");
  };
  const removeExam = (id) => setExams((current) => current.filter((exam) => exam.id !== id));

  const addTopic = (event) => {
    event.preventDefault();
    if (!topicDraft.title.trim() || !topicDraft.subject.trim()) {
      setToast("Add both a subject and a topic.");
      return;
    }
    setSyllabus((current) => [{
      id: makeId(), title: topicDraft.title.trim(), subject: topicDraft.subject.trim(),
      completed: false, reviewCount: 0, nextReviewAt: dateKey(), lastReviewedAt: null,
      createdAt: new Date().toISOString(),
    }, ...current]);
    setTopicDraft({ title: "", subject: "" });
    setToast("Syllabus topic saved.");
  };
  const reviewTopic = (id) => {
    const intervals = [1, 3, 7, 14, 30];
    const now = new Date();
    setSyllabus((current) => current.map((item) => {
      if (item.id !== id) return item;
      const count = (item.reviewCount || 0) + 1;
      const next = new Date(now);
      next.setDate(next.getDate() + intervals[Math.min(count - 1, intervals.length - 1)]);
      return { ...item, reviewCount: count, lastReviewedAt: now.toISOString(), nextReviewAt: dateKey(next) };
    }));
    setToast("Review recorded and next review scheduled.");
  };
  const toggleTopic = (id) => setSyllabus((current) => current.map((item) => item.id === id ? { ...item, completed: !item.completed } : item));

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      setToast("This browser does not support system notifications. In-app reminders still work.");
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setPermission(result);
      setReminderPrefs((current) => ({ ...current, notificationsEnabled: result === "granted" }));
      setToast(result === "granted" ? "Browser reminders enabled." : "Notification permission was not granted.");
    } catch {
      setToast("Could not enable browser notifications.");
    }
  };

  const reminders = useMemo(() => {
    const today = dateKey();
    const horizon = dateKey(new Date(Date.now() + 7 * 86400000));
    const taskReminders = sortPending(tasks).filter((task) => task.deadline && task.deadline <= horizon).map((task) => ({
      id: "task-" + task.id, kind: task.deadline < today ? "Overdue task" : "Task deadline", title: task.title, date: task.deadline,
    }));
    const examReminders = exams.filter((exam) => exam.date && exam.date >= today && exam.date <= dateKey(new Date(Date.now() + 14 * 86400000))).map((exam) => ({
      id: "exam-" + exam.id, kind: "Upcoming exam", title: exam.title, date: exam.date,
    }));
    return [...taskReminders, ...examReminders].sort((a, b) => a.date.localeCompare(b.date));
  }, [tasks, exams]);

  useEffect(() => {
    if (!reminderPrefs.notificationsEnabled || permission !== "granted" || !("Notification" in window)) return undefined;
    const check = () => {
      const today = dateKey();
      const tomorrow = dateKey(new Date(Date.now() + 86400000));
      const dueTasks = sortPending(tasks).filter((task) => task.deadline === today || task.deadline === tomorrow);
      const soonExams = exams.filter((exam) => exam.date && exam.date >= today && exam.date <= dateKey(new Date(Date.now() + 3 * 86400000)));
      const key = "studyflow.notified.v1:" + userId;
      const sent = new Set(safeRead(key, []));
      const items = [
        ...dueTasks.map((task) => ({ key: "task-" + task.id + "-" + today, title: task.deadline === today ? "Task due today" : "Task due tomorrow", body: task.title })),
        ...soonExams.map((exam) => ({ key: "exam-" + exam.id + "-" + today, title: "Upcoming exam", body: exam.title + " · " + dateLabel(exam.date) })),
      ];
      const [hh, mm] = String(reminderPrefs.dailyReminderTime || "09:00").split(":").map(Number);
      const now = new Date();
      if (now.getHours() * 60 + now.getMinutes() >= hh * 60 + mm) {
        items.push({ key: "daily-plan-" + today, title: "Plan your day", body: pendingTasks.length ? "You have " + pendingTasks.length + " pending task(s). Choose the first one in StudyFlow." : "Review your syllabus or add tomorrow's first task." });
      }
      items.forEach((item) => {
        if (sent.has(item.key)) return;
        new window.Notification(item.title, { body: item.body, tag: item.key });
        sent.add(item.key);
      });
      window.localStorage.setItem(key, JSON.stringify(Array.from(sent).slice(-150)));
    };
    check();
    const interval = window.setInterval(check, 60000);
    return () => window.clearInterval(interval);
  }, [reminderPrefs.notificationsEnabled, reminderPrefs.dailyReminderTime, permission, tasks, exams, pendingTasks.length, userId]);

  const askAssistant = (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    const answer = createAssistantReply(text, tasks, exams, syllabus, sessions);
    setMessages((current) => [...current, { id: makeId(), role: "user", text }, { id: makeId(), role: "assistant", text: answer }].slice(-20));
    setQuestion("");
  };

  const todayMinutes = sessions.filter((session) => session.date === dateKey()).reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  const dueReviews = syllabus.filter((item) => !item.completed && item.nextReviewAt && item.nextReviewAt <= dateKey());
  const examProgress = (exam) => {
    const related = syllabus.filter((topic) => topic.subject.toLowerCase() === String(exam.subject || "").toLowerCase());
    return related.length ? Math.round(100 * related.filter((topic) => topic.completed).length / related.length) : null;
  };

  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = dateKey(date);
      return { key, label: date.toLocaleDateString(undefined, { weekday: "short" }), minutes: sessions.filter((session) => session.date === key).reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0) };
    });
    const max = Math.max(60, ...days.map((day) => day.minutes));
    const subjects = {};
    sessions.filter((session) => session.date >= days[0].key && session.date <= days[6].key).forEach((session) => {
      const subject = session.subject || "Uncategorized";
      subjects[subject] = (subjects[subject] || 0) + Number(session.durationMinutes || 0);
    });
    const activeDays = new Set(sessions.map((session) => session.date));
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (activeDays.has(dateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      days: days.map((day) => ({ ...day, height: Math.max(3, Math.round(day.minutes / max * 100)) })),
      total: days.reduce((sum, day) => sum + day.minutes, 0),
      completed: tasks.filter((task) => task.completed && task.completedAt && task.completedAt.slice(0, 10) >= days[0].key).length,
      subjects: Object.entries(subjects).sort((a, b) => b[1] - a[1]).slice(0, 5),
      streak,
    };
  }, [sessions, tasks]);

  return (
    <section className="sfw panel">
      <header className="sfw-header">
        <div><span className="section-kicker">YOUR STUDY SYSTEM</span><h2>Turn plans into progress.</h2><p>Focus, plan, revise and learn from your actual study activity.</p></div>
        <div className={"sfw-cloud-status " + (cloudStatus === "error" ? "is-error" : cloudStatus === "syncing" ? "is-syncing" : "is-synced")}>
          {cloudStatus === "error" ? <CloudOff size={15} /> : cloudStatus === "syncing" ? <Cloud size={15} /> : <ShieldCheck size={15} />}
          {cloudStatus === "error" ? "Saved locally" : cloudStatus === "syncing" ? "Syncing" : "Cloud synced"}
        </div>
      </header>

      <nav className="sfw-tabs" aria-label="Study tools">
        {[["focus", TimerReset, "Focus"], ["plan", CalendarDays, "Daily plan"], ["exams", BookOpen, "Exams & syllabus"], ["analytics", Activity, "Analytics"], ["reminders", Bell, "Reminders"], ["assistant", BrainCircuit, "Assistant"]].map(([id, Icon, label]) =>
          <button key={id} type="button" className={"sfw-tab" + (tab === id ? " is-active" : "")} onClick={() => setTab(id)} aria-pressed={tab === id}><Icon size={16} />{label}</button>
        )}
      </nav>

      {tab === "focus" && <div className="sfw-body">
        <div className="sfw-intro"><div><span className="sfw-overline">DEEP WORK</span><h3>One thing at a time.</h3><p>Log real focus time against a task. Pauses don't inflate your study hours.</p></div><div className="sfw-focus-today"><Flame size={17} /><strong>{todayMinutes} min</strong><small>focused today</small></div></div>
        <div className="sfw-focus-layout">
          <div className="sfw-timer-card">
            <span className="sfw-timer-mode">{timerMode === "focus" ? "FOCUS SESSION" : "SHORT BREAK"}</span>
            <div className="sfw-timer-dial" role="timer" aria-label={formatClock(secondsLeft)}><strong>{formatClock(secondsLeft)}</strong><small>{timerMode === "focus" ? "Stay with one task" : "Take a breath"}</small></div>
            <div className="sfw-duration">{[15, 25, 50].map((minutes) => <button key={minutes} type="button" disabled={timerState === "running" || timerState === "paused"} className={timerMode === "focus" && focusMinutes === minutes ? "is-selected" : ""} onClick={() => chooseDuration(minutes)}>{minutes} min</button>)}</div>
            <div className="sfw-button-row">{timerState === "running" ? <button className="primary-button" type="button" onClick={pauseTimer}><Pause size={16} />Pause</button> : <button className="primary-button" type="button" onClick={startTimer}><Play size={16} />{timerState === "paused" ? "Resume" : timerState === "complete" ? "Start again" : "Start focus"}</button>}<button className="ghost-button" type="button" onClick={resetTimer}><RotateCcw size={15} />Reset</button></div>
            {timerState === "complete" && <div className="sfw-complete"><CheckCircle2 size={15} />{timerMode === "focus" ? "Session saved to analytics." : "Break complete."}<button type="button" onClick={startBreak}><Coffee size={14} />5-min break</button></div>}
          </div>
          <aside className="sfw-focus-side">
            <label htmlFor="sfw-focus-task">Focus task</label>
            <select id="sfw-focus-task" value={selectedTask?.id || ""} disabled={timerState === "running" || timerState === "paused"} onChange={(event) => setFocusTaskId(event.target.value)}>
              {pendingTasks.length ? pendingTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>) : <option value="">No pending tasks</option>}
            </select>
            {selectedTask ? <div className="sfw-selected-task"><small>{selectedTask.subject || "General"} · {selectedTask.priority || "Medium"} priority</small><strong>{selectedTask.title}</strong><span>{selectedTask.deadline ? "Due " + dateLabel(selectedTask.deadline) : "No deadline set"}</span><button type="button" className="sfw-text-action" onClick={() => setTasks((current) => current.map((task) => task.id === selectedTask.id ? { ...task, completed: true, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : task))}><Check size={14} />Mark complete</button></div> : <div className="sfw-empty"><ListChecks size={22} /><strong>No pending tasks</strong><span>Add a task before starting a focus session.</span></div>}
            <div className="sfw-recent"><div className="sfw-list-head"><strong>Recent sessions</strong><button type="button" onClick={() => setTab("analytics")}>Analytics →</button></div>
              {sessions.slice(0, 3).length ? sessions.slice(0, 3).map((session) => <div className="sfw-session-row" key={session.id}><span><strong>{session.taskTitle || "Study session"}</strong><small>{session.subject || "General"}</small></span><b>{session.durationMinutes || 0}m</b></div>) : <p className="sfw-muted">Completed sessions will appear here.</p>}
            </div>
          </aside>
        </div>
      </div>}

      {tab === "plan" && <div className="sfw-body">
        <div className="sfw-intro"><div><span className="sfw-overline">TIME BLOCKING</span><h3>A realistic plan for today.</h3><p>Schedules pending tasks around today's classes. This is a suggestion, not a timetable change.</p></div><button type="button" className="primary-button" onClick={() => setDailyPlan(buildDailyPlan(tasks, timetable))}><Sparkles size={16} />Build my day</button></div>
        {dailyPlan.length ? <div className="sfw-plan-list">{dailyPlan.map((block) => <div className="sfw-plan-row" key={block.task.id}><div className="sfw-plan-time"><strong>{clockLabel(String(Math.floor(block.start / 60)).padStart(2, "0") + ":" + String(block.start % 60).padStart(2, "0"))}</strong><small>{block.duration} min</small></div><span className="sfw-plan-dot" /><div className="sfw-plan-task"><small>{block.task.subject || "Study task"} · {block.task.priority || "Medium"}</small><strong>{block.task.title}</strong><span>Until {clockLabel(String(Math.floor(block.end / 60)).padStart(2, "0") + ":" + String(block.end % 60).padStart(2, "0"))}</span></div><button type="button" className="sfw-text-action" onClick={() => { setFocusTaskId(block.task.id); setTab("focus"); }}><Play size={14} />Focus</button></div>)}</div> : <div className="sfw-empty sfw-empty-large"><CalendarDays size={26} /><strong>Your plan starts here</strong><span>Generate time blocks from pending tasks and your real class timetable.</span><button type="button" className="ghost-button" onClick={() => setDailyPlan(buildDailyPlan(tasks, timetable))}>Generate today's plan</button></div>}
      </div>}

      {tab === "exams" && <div className="sfw-body">
        <div className="sfw-intro"><div><span className="sfw-overline">EXAM READINESS</span><h3>Track the syllabus, not just the date.</h3><p>Topic reviews follow a 1, 3, 7, 14, then 30-day spacing pattern.</p></div><div className="sfw-count-badge">{dueReviews.length} reviews due</div></div>
        <div className="sfw-forms-grid">
          <form className="sfw-feature-form" onSubmit={addExam}><h4><CalendarDays size={16} />Add an exam</h4><label>Exam name<input value={examDraft.title} maxLength={100} required placeholder="e.g. Physics mid-sem" onChange={(e) => setExamDraft((v) => ({ ...v, title: e.target.value }))} /></label><label>Subject<input value={examDraft.subject} maxLength={80} placeholder="e.g. Physics" onChange={(e) => setExamDraft((v) => ({ ...v, subject: e.target.value }))} /></label><label>Exam date<input type="date" value={examDraft.date} min={dateKey()} required onChange={(e) => setExamDraft((v) => ({ ...v, date: e.target.value }))} /></label><button type="submit" className="primary-button"><Plus size={15} />Save exam</button></form>
          <form className="sfw-feature-form" onSubmit={addTopic}><h4><BookOpen size={16} />Add a syllabus topic</h4><label>Subject<input value={topicDraft.subject} maxLength={80} required placeholder="e.g. Chemistry" onChange={(e) => setTopicDraft((v) => ({ ...v, subject: e.target.value }))} /></label><label>Chapter / topic<input value={topicDraft.title} maxLength={120} required placeholder="e.g. Chemical kinetics" onChange={(e) => setTopicDraft((v) => ({ ...v, title: e.target.value }))} /></label><p className="sfw-help">New topics enter today's review queue. Mark them reviewed after testing yourself.</p><button type="submit" className="primary-button"><Plus size={15} />Add topic</button></form>
        </div>
        <div className="sfw-list-box"><div className="sfw-list-head"><h4>Your exams</h4><small>{exams.length} saved</small></div>{exams.length ? exams.slice().sort((a,b) => a.date.localeCompare(b.date)).map((exam) => {
          const progress = examProgress(exam);
          const days = Math.ceil((new Date(exam.date + "T00:00:00").getTime() - new Date(dateKey() + "T00:00:00").getTime()) / 86400000);
          return <article className="sfw-exam-row" key={exam.id}><div className="sfw-exam-date"><strong>{new Date(exam.date + "T00:00:00").getDate()}</strong><small>{new Date(exam.date + "T00:00:00").toLocaleDateString(undefined,{month:"short"})}</small></div><div className="sfw-exam-info"><strong>{exam.title}</strong><span>{exam.subject} · {days === 0 ? "Today" : days > 0 ? days + " days left" : Math.abs(days) + " days ago"}</span>{progress !== null && <div className="sfw-progress"><span style={{ width: progress + "%" }} /></div>}</div><button type="button" className="sfw-icon-button" aria-label={"Delete " + exam.title} onClick={() => removeExam(exam.id)}><Trash2 size={15} /></button></article>;
        }) : <p className="sfw-muted">Add an exam to give your revision a target.</p>}</div>
        <div className="sfw-list-box"><div className="sfw-list-head"><h4>Syllabus & spaced revision</h4><small>{syllabus.filter((item) => item.completed).length}/{syllabus.length} complete</small></div>{syllabus.length ? syllabus.slice().sort((a,b) => Number(a.completed)-Number(b.completed) || String(a.nextReviewAt).localeCompare(String(b.nextReviewAt))).map((topic) => <article className={"sfw-topic-row" + (topic.completed ? " is-complete" : "")} key={topic.id}><button type="button" className={"sfw-topic-check" + (topic.completed ? " is-checked" : "")} aria-label={(topic.completed ? "Reopen " : "Complete ") + topic.title} onClick={() => toggleTopic(topic.id)}>{topic.completed && <Check size={13} />}</button><div className="sfw-topic-info"><strong>{topic.title}</strong><span>{topic.subject} · {topic.completed ? "Completed" : topic.nextReviewAt <= dateKey() ? "Review due" : "Next " + dateLabel(topic.nextReviewAt)} · {topic.reviewCount || 0} reviews</span></div>{!topic.completed && <button type="button" className="sfw-small-action" onClick={() => reviewTopic(topic.id)}>Reviewed today</button>}<button type="button" className="sfw-icon-button" aria-label={"Delete " + topic.title} onClick={() => setSyllabus((current) => current.filter((item) => item.id !== topic.id))}><Trash2 size={14} /></button></article>) : <p className="sfw-muted">Add the first topic to begin spaced revision.</p>}</div>
      </div>}

      {tab === "analytics" && <div className="sfw-body">
        <div className="sfw-intro"><div><span className="sfw-overline">MEASURE WHAT MATTERS</span><h3>Your study week, in facts.</h3><p>Only recorded focus sessions count as study time. No invented productivity scores.</p></div><div className="sfw-count-badge">Last 7 days</div></div>
        <div className="sfw-metrics">{[[Clock3,"Focus time",Math.floor(weekly.total/60)+"h "+weekly.total%60+"m"],[CheckCircle2,"Tasks completed",weekly.completed],[Flame,"Active-day streak",weekly.streak+" days"],[Target,"Pending tasks",pendingTasks.length]].map(([Icon,label,value]) => <Metric key={label} icon={Icon} label={label} value={value} />)}</div>
        <div className="sfw-chart-box"><div className="sfw-list-head"><h4>Daily focus time</h4><small>Minutes per day</small></div><div className="sfw-bars" role="img" aria-label={weekly.days.map((day) => day.label+": "+day.minutes+" minutes").join(", ")}>{weekly.days.map((day) => <div className="sfw-bar-col" key={day.key}><b>{day.minutes ? day.minutes+"m" : ""}</b><div className="sfw-bar-track"><span style={{ height: day.height+"%" }} /></div><small>{day.label}</small></div>)}</div></div>
        <div className="sfw-chart-box"><div className="sfw-list-head"><h4>Focus time by subject</h4><small>Last 7 days</small></div>{weekly.subjects.length ? <div className="sfw-subjects">{weekly.subjects.map(([subject,minutes]) => <div className="sfw-subject-line" key={subject}><span>{subject}</span><div><i style={{ width: Math.min(100, minutes/Math.max(1,weekly.total)*100)+"%" }} /></div><b>{minutes}m</b></div>)}</div> : <p className="sfw-muted">Complete a focus session to start building analytics.</p>}</div>
      </div>}

      {tab === "reminders" && <div className="sfw-body">
        <div className="sfw-intro"><div><span className="sfw-overline">NO SURPRISE DEADLINES</span><h3>Keep important things visible.</h3><p>Browser reminders run while StudyFlow is open. The in-app list remains available if notifications are blocked.</p></div><button type="button" className={reminderPrefs.notificationsEnabled && permission === "granted" ? "ghost-button" : "primary-button"} onClick={enableNotifications}><Bell size={15} />{reminderPrefs.notificationsEnabled && permission === "granted" ? "Notifications enabled" : "Enable notifications"}</button></div>
        <div className="sfw-reminder-settings"><label htmlFor="sfw-reminder-time">Daily planning reminder time<input id="sfw-reminder-time" type="time" value={reminderPrefs.dailyReminderTime || "09:00"} onChange={(event) => setReminderPrefs((current) => ({ ...current, dailyReminderTime: event.target.value }))} /></label><p>When enabled, StudyFlow sends one planning reminder per day at or after this time while the app is open, plus alerts for tasks due today/tomorrow and exams within three days.</p></div>
        <div className="sfw-reminder-metrics"><div><strong>{reminders.length}</strong><span>upcoming / overdue</span></div><div><strong>{reminderPrefs.notificationsEnabled && permission === "granted" ? "On" : "Off"}</strong><span>browser notifications</span></div><div><strong>{permission === "denied" ? "Blocked" : permission === "unsupported" ? "Unsupported" : "Available"}</strong><span>permission</span></div></div>
        {permission === "denied" && <p className="sfw-warning">Notifications are blocked by browser settings. Allow them in the address bar/site settings to enable system reminders.</p>}
        <div className="sfw-reminder-list">{reminders.length ? reminders.map((item) => <article key={item.id} className="sfw-reminder-row"><span className={item.kind === "Overdue task" ? "is-overdue" : ""}><Bell size={15} /></span><div><small>{item.kind}</small><strong>{item.title}</strong></div><time>{item.date < dateKey() ? "Overdue" : dateLabel(item.date)}</time></article>) : <div className="sfw-empty sfw-empty-large"><CheckCircle2 size={25} /><strong>Nothing urgent soon</strong><span>New tasks and exams will appear as their dates approach.</span></div>}</div>
      </div>}

      {tab === "assistant" && <div className="sfw-body">
        <div className="sfw-intro"><div><span className="sfw-overline">PERSONAL STUDY COACH</span><h3>Make the next step obvious.</h3><p>Ask about pending work, deadlines, exam revision or recorded focus time.</p></div><div className="sfw-count-badge"><BrainCircuit size={15} /> Study assistant</div></div>
        <div className="sfw-assistant-note"><ShieldCheck size={17} /><span>This version uses your saved data and local planning rules. No external AI model or API key is connected, so chat stays in this app.</span></div>
        <div className="sfw-suggestions">{["What should I study first today?","Help me prepare for my next exam.","I have 60 minutes. What fits?","How is my progress this week?"].map((prompt) => <button type="button" key={prompt} onClick={() => setQuestion(prompt)}><Sparkles size={13} />{prompt}</button>)}</div>
        <div className="sfw-chat" aria-live="polite">{messages.length ? messages.map((message) => <div className={"sfw-chat-msg is-"+message.role} key={message.id}><small>{message.role === "assistant" ? "StudyFlow" : "You"}</small><p>{message.text}</p></div>) : <div className="sfw-empty sfw-empty-large"><BrainCircuit size={25} /><strong>Your study context is ready</strong><span>Suggestions use real tasks, exams, revisions and logged focus sessions.</span></div>}</div>
        <form className="sfw-chat-form" onSubmit={(event) => { event.preventDefault(); const text = question.trim(); if (!text) return; const answer = createAssistantReply(text,tasks,exams,syllabus,sessions); setMessages((current) => [...current,{id:makeId(),role:"user",text},{id:makeId(),role:"assistant",text:answer}].slice(-20)); setQuestion(""); }}><label className="sr-only" htmlFor="sfw-question">Ask StudyFlow</label><input id="sfw-question" value={question} maxLength={400} placeholder="e.g. I have 45 minutes before class..." onChange={(event) => setQuestion(event.target.value)} /><button className="primary-button" type="submit" disabled={!question.trim()}><Sparkles size={15} />Ask</button></form>
        {messages.length > 0 && <button className="sfw-clear-chat" type="button" onClick={() => setMessages([])}>Clear conversation</button>}
      </div>}

      <footer className="sfw-footer"><span><Cloud size={14} />Per-account sync when connected</span><span><ShieldCheck size={14} />Private per-user records</span></footer>
    </section>
  );
}
