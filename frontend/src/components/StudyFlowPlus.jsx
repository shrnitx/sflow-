import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, Archive, Bell,
  BookOpen, CalendarClock, CalendarDays, CheckCircle2, ChevronRight,
  CircleHelp, Command, Download, FileText, GraduationCap,
  Layers3, Library, ListChecks, Music2, Pause, Play, Plus, RotateCcw, Search,
  ShieldCheck, Sparkles, TimerReset, Trash2, Undo2, Upload, WandSparkles, X
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { makeId } from "../utils/storage";
import {
  addDays, buildAdaptivePlan, buildIcs, calculateReadiness, cardsFromNotes,
  isoDate, nextReview, parseIcs, parseQuickCapture, requiredFinalScore
} from "../utils/studyFlowPlusLogic";
import "./StudyFlowPlus.css";

const blankData = () => ({
  cards: [], materials: [], coverage: {}, grades: { currentAverage: 70, targetOverall: 85, finalWeight: 40 },
  reminderPrefs: { browserNotifications: false, quietStart: "22:00", quietEnd: "07:00" },
  history: [], lastBackupAt: null
});
const localKey = (userId) => "studyflow.plus.v1." + encodeURIComponent(userId);
const fileDbName = "studyflow-plus-files";
const materialBucket = "studyflow-materials";
const fileKey = (userId, id) => userId + ":" + id;

function safeRead(key) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : null; }
  catch { return null; }
}
function clock(value) {
  const date = new Date();
  date.setHours(Math.floor(value / 60), value % 60, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function openFileDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("This browser does not support local file storage."));
    const request = indexedDB.open(fileDbName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("files")) request.result.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local file storage."));
  });
}
async function storeLocalFile(key, file) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(file, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not save this file.")); };
  });
}
async function getLocalFile(key) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readonly");
    const request = tx.objectStore("files").get(key);
    request.onsuccess = () => { db.close(); resolve(request.result || null); };
    request.onerror = () => { db.close(); reject(request.error || new Error("Could not read this file.")); };
  });
}
async function removeLocalFile(key) {
  const db = await openFileDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not delete this file.")); };
  });
}
function downloadText(name, content, type) {
  const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
function safeParseBackup(fileText) {
  const parsed = JSON.parse(fileText);
  if (!parsed || parsed.format !== "studyflow-backup-v1" || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.timetable) || !Array.isArray(parsed.sessions) || !parsed.tasks.every((item) => item && typeof item.id === "string" && typeof item.title === "string") || !parsed.timetable.every((item) => item && typeof item.id === "string" && typeof item.subject === "string" && Number.isInteger(item.day) && item.day >= 0 && item.day <= 6 && typeof item.startTime === "string" && typeof item.endTime === "string") || !parsed.sessions.every((item) => item && typeof item.id === "string" && typeof item.startedAt === "string" && Number.isFinite(Number(item.durationMinutes)) && Number(item.durationMinutes) > 0)) {
    throw new Error("This file is not a valid StudyFlow backup.");
  }
  return parsed;
}

export default function StudyFlowPlus({ user, tasks, setTasks, timetable, setTimetable, sessions, setSessions, onToast, active = true }) {
  const userId = user && user.id;
  const [phase, setPhase] = useState("daily");
  const [toolkit, setToolkit] = useState(() => safeRead(localKey(userId)) || blankData());
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudState, setCloudState] = useState("loading");
  const [quickInput, setQuickInput] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");
  const [paletteSearch, setPaletteSearch] = useState("");
  const [taskForBreakdown, setTaskForBreakdown] = useState("");
  const [plan, setPlan] = useState(null);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialSubject, setMaterialSubject] = useState("");
  const [materialTags, setMaterialTags] = useState("");
  const [materialFile, setMaterialFile] = useState(null);
  const [notesText, setNotesText] = useState("");
  const [cardDraft, setCardDraft] = useState({ question: "", answer: "", subject: "" });
  const [reviewCardId, setReviewCardId] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState("");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [focusStartedAt, setFocusStartedAt] = useState(null);
  const [backupFile, setBackupFile] = useState(null);
  const previousTasks = useRef(null);
  const hydratedUser = useRef(null);
  const skipHistoryRef = useRef(false);

  const notify = useCallback((message) => {
    if (typeof onToast === "function") onToast(message);
  }, [onToast]);

  useEffect(() => {
    let active = true;
    setCloudReady(false);
    setCloudState("loading");
    setToolkit(safeRead(localKey(userId)) || blankData());
    previousTasks.current = Array.isArray(tasks) ? tasks : [];
    const load = async () => {
      try {
        const { data, error } = await supabase.from("studyflow_user_data").select("data").eq("user_id", userId).eq("record_id", "toolkit").maybeSingle();
        if (error) throw error;
        if (!active) return;
        if (data && data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
          const local = safeRead(localKey(userId)) || blankData();
          const remote = data.data;
          setToolkit({ ...blankData(), ...local, ...remote, grades: { ...blankData().grades, ...(local.grades || {}), ...(remote.grades || {}) }, reminderPrefs: { ...blankData().reminderPrefs, ...(local.reminderPrefs || {}), ...(remote.reminderPrefs || {}) }, cards: Array.isArray(remote.cards) ? remote.cards : local.cards, materials: Array.isArray(remote.materials) ? remote.materials : local.materials, history: Array.isArray(remote.history) ? remote.history : local.history });
        }
        setCloudState("synced");
      } catch (error) {
        console.warn("StudyFlow Plus cloud load failed:", error);
        if (active) setCloudState("local");
      } finally {
        if (active) {
          hydratedUser.current = userId;
          setCloudReady(true);
        }
      }
    };
    if (userId) load();
    return () => { active = false; };
  }, [userId]); // a user switch must not leak another account's data

  useEffect(() => {
    if (!userId || !cloudReady || hydratedUser.current !== userId) return undefined;
    try { localStorage.setItem(localKey(userId), JSON.stringify(toolkit)); }
    catch (error) { console.warn("StudyFlow Plus local save failed:", error); setCloudState("local"); }
    setCloudState((state) => state === "local" ? state : "syncing");
    const timeout = window.setTimeout(async () => {
      try {
        const { error } = await supabase.from("studyflow_user_data").upsert({
          user_id: userId, record_id: "toolkit", data: toolkit, updated_at: new Date().toISOString()
        }, { onConflict: "user_id,record_id" });
        if (error) throw error;
        setCloudState("synced");
      } catch (error) {
        console.warn("StudyFlow Plus cloud save failed:", error);
        setCloudState("local");
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [userId, toolkit, cloudReady]);

  // Keep a bounded, per-user undo history for task edits without duplicating the live task store.
  useEffect(() => {
    if (!cloudReady || !Array.isArray(tasks)) return;
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      previousTasks.current = tasks;
      return;
    }
    if (previousTasks.current === null) { previousTasks.current = tasks; return; }
    if (previousTasks.current === tasks) return;
    const before = previousTasks.current;
    if (JSON.stringify(before) === JSON.stringify(tasks)) return;
    previousTasks.current = tasks;
    setToolkit((current) => ({
      ...current,
      history: [{ at: new Date().toISOString(), tasks: before }, ...(current.history || [])].slice(0, 10)
    }));
  }, [tasks, cloudReady]);

  useEffect(() => {
    if (!active) return undefined;
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);

  const pendingTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []).filter((task) => task && !task.completed), [tasks]);
  const selectedFocusTask = pendingTasks.find((task) => task.id === focusTaskId) || pendingTasks[0] || null;
  const dueCards = useMemo(() => (toolkit.cards || []).filter((card) => !card.nextReviewAt || card.nextReviewAt <= isoDate()), [toolkit.cards]);
  const readiness = calculateReadiness(
    toolkit.coverage && toolkit.coverage.subject ? toolkit.coverage.subject : 0,
    toolkit.coverage && toolkit.coverage.quizScore ? toolkit.coverage.quizScore : 0,
    (toolkit.cards || []).filter((card) => card.lastScore && card.lastScore !== "again").length,
    (toolkit.cards || []).length
  );
  const grade = toolkit.grades || blankData().grades;
  const neededScore = requiredFinalScore(grade.currentAverage, grade.targetOverall, grade.finalWeight);

  const createQuickTask = (event) => {
    if (event) event.preventDefault();
    const parsed = parseQuickCapture(quickInput);
    if (!parsed || !parsed.title.trim()) return notify("Type a task first.");
    const task = { id: makeId(), ...parsed, completed: false, description: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setTasks((current) => [task, ...(Array.isArray(current) ? current : [])]);
    setQuickInput("");
    setPaletteOpen(false);
    notify("Added: " + task.title);
  };

  const breakdown = () => {
    const parent = pendingTasks.find((task) => task.id === taskForBreakdown);
    if (!parent) return notify("Choose a pending task to break down.");
    const existingChildren = (tasks || []).filter((task) => task.parentTaskId === parent.id);
    if (existingChildren.length) return notify("This task already has subtasks. Edit those instead of duplicating them.");
    const steps = [
      ["Clarify requirements and gather resources", 10],
      ["Work through the core task", 50],
      ["Check the result against the requirements", 25],
      ["Polish and submit", 15]
    ];
    const total = Math.max(20, Number(parent.estimatedMinutes) || 60);
    const created = steps.map((step, index) => ({
      id: makeId(), title: parent.title + " · " + step[0],
      subject: parent.subject || "", type: "task", priority: parent.priority || "Medium",
      deadline: parent.deadline || "", estimatedMinutes: Math.max(5, Math.round(total * step[1] / 100)),
      parentTaskId: parent.id, completed: false, createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), description: index === 0 ? "Start with the task brief and any linked material." : ""
    }));
    setTasks((current) => [ ...created, ...(current || []) ]);
    notify("Created four subtasks for " + parent.title + ".");
  };

  const createPlan = () => {
    const next = buildAdaptivePlan(tasks, timetable, new Date());
    setPlan(next);
    notify(next.blocks.length ? "Your plan is ready. Unscheduled tasks are listed below." : "No remaining task fits before 10 PM. Try tomorrow or reduce estimates.");
  };

  const focusOnTask = (taskId) => {
    const selected = pendingTasks.find((task) => task.id === taskId);
    if (!selected) return notify("That task is already complete or unavailable.");
    setFocusTaskId(taskId);
    setPhase("daily");
    setSecondsLeft(focusMinutes * 60);
    setTimerRunning(false);
    setFocusStartedAt(null);
    notify("Focus room set for: " + selected.title);
  };

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timeout = window.setTimeout(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [timerRunning, secondsLeft]);

  useEffect(() => {
    if (!timerRunning || secondsLeft > 0) return;
    setTimerRunning(false);
    const seconds = Math.max(0, focusMinutes * 60);
    const endedAt = new Date();
    if (selectedFocusTask && seconds >= 60) {
      setSessions((current) => [{
        id: makeId(), taskId: selectedFocusTask.id, taskTitle: selectedFocusTask.title,
        subject: selectedFocusTask.subject || "General", startedAt: focusStartedAt || new Date(endedAt.getTime() - seconds * 1000).toISOString(),
        finishedAt: endedAt.toISOString(), localDate: isoDate(endedAt), durationMinutes: Math.round(seconds / 60)
      }, ...(Array.isArray(current) ? current : [])].slice(0, 500));
    }
    setFocusStartedAt(null);
    notify("Focus block complete. Take a short break.");
  }, [timerRunning, secondsLeft, focusMinutes, selectedFocusTask, focusStartedAt, setSessions, notify]);

  const startFocus = () => {
    if (!selectedFocusTask) return notify("Add a pending task before starting a focus block.");
    if (secondsLeft <= 0) setSecondsLeft(focusMinutes * 60);
    if (!focusStartedAt) setFocusStartedAt(new Date().toISOString());
    setTimerRunning(true);
  };
  const pauseFocus = () => setTimerRunning(false);
  const resetFocus = () => { setTimerRunning(false); setSecondsLeft(focusMinutes * 60); setFocusStartedAt(null); };

  const addMaterial = async (event) => {
    event.preventDefault();
    if (!materialTitle.trim() && !materialFile) return notify("Add a title or choose a file.");
    const material = {
      id: makeId(), title: materialTitle.trim() || materialFile.name, subject: materialSubject.trim(),
      tags: materialTags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 10),
      filename: materialFile ? materialFile.name : "", mimeType: materialFile ? materialFile.type : "",
      size: materialFile ? materialFile.size : 0, addedAt: new Date().toISOString(),
      fileLocalOnly: false, storagePath: ""
    };
    if (materialFile) {
      if (materialFile.size > 25 * 1024 * 1024) return notify("Choose a file under 25 MB.");
      const safeFilename = materialFile.name.replace(/[^\w.-]+/g, "_").slice(-140) || "material";
      const storagePath = userId + "/" + material.id + "/" + safeFilename;
      try {
        const { error } = await supabase.storage.from(materialBucket).upload(storagePath, materialFile, {
          cacheControl: "3600",
          contentType: materialFile.type || "application/octet-stream",
          upsert: false
        });
        if (error) throw error;
        material.storagePath = storagePath;
      } catch (cloudError) {
        console.warn("StudyFlow material cloud upload failed; trying device storage:", cloudError);
        try {
          await storeLocalFile(fileKey(userId, material.id), materialFile);
          material.fileLocalOnly = true;
        } catch (localError) {
          console.error("StudyFlow material local fallback failed:", localError);
          return notify("The file could not be saved to your account or this device. Check your connection and try again.");
        }
      }
    }
    setToolkit((current) => ({ ...current, materials: [material, ...(current.materials || [])] }));
    setMaterialTitle(""); setMaterialSubject(""); setMaterialTags(""); setMaterialFile(null);
    const picker = document.getElementById("sfplus-material-file");
    if (picker) picker.value = "";
    if (!materialFile) notify("Material details saved to your account.");
    else if (material.storagePath) notify("File uploaded to your private account storage. It will be available on your other devices.");
    else notify("Cloud upload failed. File saved on this device only; its details still sync.");
  };

  const downloadMaterial = async (material) => {
    if (!material.filename) return notify("No file is attached to this material.");
    const saveBlob = (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = material.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (material.storagePath) {
      try {
        const { data, error } = await supabase.storage.from(materialBucket).download(material.storagePath);
        if (error) throw error;
        if (!data) throw new Error("The stored file was not returned.");
        saveBlob(data);
        return;
      } catch (error) {
        console.warn("StudyFlow cloud material download failed:", error);
        try {
          const local = await getLocalFile(fileKey(userId, material.id));
          if (local) {
            saveBlob(local);
            return;
          }
        } catch (localError) {
          console.warn("StudyFlow local file fallback failed:", localError);
        }
        return notify("Could not download this file. Check your connection and sign-in, then retry.");
      }
    }
    try {
      const blob = await getLocalFile(fileKey(userId, material.id));
      if (!blob) return notify("This file is stored only on the device where it was added. Re-upload it here to restore it.");
      saveBlob(blob);
    } catch (error) { notify(error.message || "Could not download this material."); }
  };

  const deleteMaterial = async (material) => {
    if (!window.confirm("Remove " + material.title + "? The stored file will also be deleted.")) return;
    if (material.storagePath) {
      try {
        const { error } = await supabase.storage.from(materialBucket).remove([material.storagePath]);
        if (error) throw error;
      } catch (error) {
        console.error("StudyFlow cloud material delete failed:", error);
        return notify("The file could not be deleted from cloud storage. Try again before removing its record.");
      }
    }
    if (material.filename && !material.storagePath) {
      try { await removeLocalFile(fileKey(userId, material.id)); }
      catch (error) { console.warn("StudyFlow local file delete failed:", error); }
    }
    setToolkit((current) => ({ ...current, materials: (current.materials || []).filter((item) => item.id !== material.id) }));
    notify("Material removed.");
  };

  const addCard = (event) => {
    event.preventDefault();
    if (!cardDraft.question.trim() || !cardDraft.answer.trim()) return notify("Both question and answer are required.");
    const card = { id: makeId(), question: cardDraft.question.trim(), answer: cardDraft.answer.trim(), subject: cardDraft.subject.trim(), createdAt: new Date().toISOString(), reps: 0, ease: 2.5, nextReviewAt: isoDate(), lastScore: null };
    setToolkit((current) => ({ ...current, cards: [card, ...(current.cards || [])] }));
    setCardDraft({ question: "", answer: "", subject: "" });
    setReviewCardId(card.id); setShowAnswer(false);
    notify("Flashcard added to today's review queue.");
  };

  const importNotesAsCards = () => {
    const generated = cardsFromNotes(notesText, makeId);
    if (!generated.length) return notify("No Q::A or Question -> Answer pairs found. Format one card per line, for example: Mitosis :: Cell division.");
    setToolkit((current) => ({ ...current, cards: [...generated, ...(current.cards || [])] }));
    setNotesText("");
    setReviewCardId(generated[0].id); setShowAnswer(false);
    notify("Created " + generated.length + " flashcards from your notes.");
  };

  const review = (rating) => {
    const card = (toolkit.cards || []).find((item) => item.id === reviewCardId) || dueCards[0];
    if (!card) return;
    const updated = nextReview(card, rating);
    setToolkit((current) => ({ ...current, cards: (current.cards || []).map((item) => item.id === card.id ? updated : item) }));
    setReviewCardId("");
    setShowAnswer(false);
    notify("Review recorded. Next review: " + updated.nextReviewAt + ".");
  };

  const exportCalendar = () => {
    downloadText("studyflow-calendar.ics", buildIcs(tasks, timetable), "text/calendar;charset=utf-8");
    notify("Calendar file exported. Import it into Google Calendar, Outlook or Apple Calendar.");
  };
  const importCalendar = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify("Choose an ICS file under 2 MB."); event.target.value = ""; return; }
    try {
      const parsed = parseIcs(await file.text());
      if (!parsed.length) throw new Error("No supported calendar events were found.");
      setTasks((current) => {
        const existing = new Set((current || []).map((task) => [String(task.title).toLowerCase(), task.deadline || ""].join("|")));
        const fresh = [];
        parsed.forEach((item) => {
          const key = [item.title.toLowerCase(), item.deadline].join("|");
          if (existing.has(key)) return;
          existing.add(key);
          fresh.push({ ...item, id: makeId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), description: "Imported from " + file.name });
        });
        if (!fresh.length) notify("All imported events already exist.");
        else notify("Imported " + fresh.length + " new calendar events as tasks or exams.");
        return [...fresh, ...(current || [])];
      });
    } catch (error) { notify(error.message || "Could not import that calendar file."); }
    event.target.value = "";
  };

  const exportBackup = () => {
    const payload = {
      format: "studyflow-backup-v1", exportedAt: new Date().toISOString(), tasks, timetable,
      sessions, toolkit: { ...toolkit, history: (toolkit.history || []).slice(0, 10) }
    };
    downloadText("studyflow-backup-" + isoDate() + ".json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    setToolkit((current) => ({ ...current, lastBackupAt: new Date().toISOString() }));
    notify("Backup downloaded. Keep it somewhere safe.");
  };
  const importBackup = async () => {
    if (!backupFile) return notify("Choose a backup JSON file first.");
    if (!window.confirm("Restore this backup and replace the current tasks, timetable and focus history? Download a current backup first if you may need to undo this.")) return;
    try {
      const backup = safeParseBackup(await backupFile.text());
      setTasks(backup.tasks);
      setTimetable(backup.timetable);
      setSessions(backup.sessions);
      if (backup.toolkit && typeof backup.toolkit === "object") setToolkit({ ...blankData(), ...backup.toolkit });
      setBackupFile(null);
      const picker = document.getElementById("sfplus-backup-file");
      if (picker) picker.value = "";
      notify("Backup restored. Cloud sync will update after validation.");
    } catch (error) { notify(error.message || "Backup could not be restored."); }
  };

  const undoTaskChange = () => {
    const previous = (toolkit.history || [])[0];
    if (!previous || !Array.isArray(previous.tasks)) return notify("No task change to undo yet.");
    if (!window.confirm("Undo the latest task-list change? This restores the previous task list.")) return;
    skipHistoryRef.current = true;
    setTasks(previous.tasks);
    setToolkit((current) => ({ ...current, history: (current.history || []).slice(1) }));
    notify("Previous task list restored.");
  };

  const quietActive = (prefs, now = new Date()) => {
    const toMinutes = (v) => {
      const m = String(v || "").match(/^(\d{2}):(\d{2})$/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    const start = toMinutes(prefs.quietStart); const end = toMinutes(prefs.quietEnd);
    if (start === null || end === null || start === end) return false;
    const current = now.getHours() * 60 + now.getMinutes();
    return start < end ? current >= start && current < end : current >= start || current < end;
  };
  useEffect(() => {
    const prefs = toolkit.reminderPrefs || blankData().reminderPrefs;
    if (!prefs.browserNotifications || !("Notification" in window) || Notification.permission !== "granted") return undefined;
    const check = () => {
      if (quietActive(prefs)) return;
      const today = isoDate();
      const noticeList = (tasks || []).filter((task) => !task.completed && task.deadline && task.deadline <= addDays(today, 1) && task.deadline >= today);
      noticeList.slice(0, 3).forEach((task) => {
        const key = "studyflow.notice." + encodeURIComponent(userId) + "." + task.id + "." + today;
        try {
          if (localStorage.getItem(key)) return;
          new Notification(task.deadline === today ? "Due today: " + task.title : "Due tomorrow: " + task.title, { body: "Open StudyFlow to plan a focus block.", tag: key });
          localStorage.setItem(key, "1");
        } catch (error) { console.warn("StudyFlow reminder failed:", error); }
      });
    };
    check();
    const timer = window.setInterval(check, 60000);
    return () => window.clearInterval(timer);
  }, [toolkit.reminderPrefs, tasks, userId]);

  const requestNotifications = async () => {
    if (!("Notification" in window)) return notify("This browser does not support system notifications. In-app reminders remain available.");
    const permission = await Notification.requestPermission();
    setToolkit((current) => ({ ...current, reminderPrefs: { ...current.reminderPrefs, browserNotifications: permission === "granted" } }));
    notify(permission === "granted" ? "Browser reminders are enabled while StudyFlow is open." : "Notifications were not enabled. You can still use the in-app deadline list.");
  };

  const dueTasks = pendingTasks.filter((task) => task.deadline && task.deadline <= addDays(isoDate(), 1)).slice(0, 6);
  const materialQuery = materialSearch.trim().toLowerCase();
  const visibleMaterials = (toolkit.materials || []).filter((item) => !materialQuery || [item.title, item.subject, ...(item.tags || [])].join(" ").toLowerCase().includes(materialQuery));
  const activeReviewCard = (toolkit.cards || []).find((card) => card.id === reviewCardId) || dueCards[0] || null;

  return <section className="sfplus">
    <header className="sfplus-header">
      <div><span className="sfplus-kicker"><Sparkles size={14} /> STUDYFLOW PLUS</span><h2>Your academic command center</h2><p>Capture work, plan a realistic day, study actively and protect your progress.</p></div>
      <div className={"sfplus-sync sfplus-sync-" + cloudState}><span />{cloudState === "synced" ? "Cloud synced" : cloudState === "syncing" ? "Syncing…" : cloudState === "loading" ? "Loading…" : "Saved locally"}</div>
    </header>
    <div className="sfplus-toolbar">
      <button className="sfplus-command" type="button" onClick={() => setPaletteOpen(true)}><Command size={16} /><span>Quick capture or search</span><kbd>Ctrl K</kbd></button>
      <button type="button" className="ghost-button" onClick={exportBackup}><Download size={15} />Backup</button>
    </div>
    <nav className="sfplus-phases" aria-label="StudyFlow feature phases">
      <button type="button" className={phase === "daily" ? "is-active" : ""} onClick={() => setPhase("daily")}><span>01</span><b>Plan & focus</b><small>Daily workflow</small></button>
      <button type="button" className={phase === "learn" ? "is-active" : ""} onClick={() => setPhase("learn")}><span>02</span><b>Learn & prepare</b><small>Knowledge tools</small></button>
      <button type="button" className={phase === "reliability" ? "is-active" : ""} onClick={() => setPhase("reliability")}><span>03</span><b>Sync & recover</b><small>Reliability</small></button>
    </nav>

    {phase === "daily" && <div className="sfplus-phase-body">
      <div className="sfplus-grid">
        <article className="sfplus-card sfplus-wide">
          <div className="sfplus-card-title"><span className="sfplus-icon"><WandSparkles size={18} /></span><div><h3>Universal quick capture</h3><p>Type the task naturally. Dates, priority and time estimates are recognized.</p></div></div>
          <form className="sfplus-inline-form" onSubmit={createQuickTask}><input value={quickInput} onChange={(e) => setQuickInput(e.target.value)} maxLength={240} placeholder="e.g. Revise genetics for Biology tomorrow high 45m" aria-label="Quick capture a task" /><button className="primary-button" type="submit"><Plus size={15} />Add</button></form>
          <p className="sfplus-hint">Tip: include “today”, “tomorrow”, a YYYY-MM-DD date, “high”, and a duration such as “45m”.</p>
          <div className="sfplus-row-pills"><span><ListChecks size={13} />{pendingTasks.length} pending tasks</span><span><CalendarClock size={13} />{dueTasks.length} due soon</span><span><ShieldCheck size={13} />Saves to your existing task list</span></div>
        </article>

        <article className="sfplus-card">
          <div className="sfplus-card-title"><span className="sfplus-icon"><CalendarDays size={18} /></span><div><h3>Adaptive day planner</h3><p>Fits tasks around today's classes and protects higher-priority deadlines.</p></div></div>
          <button className="primary-button" type="button" onClick={createPlan}><Sparkles size={15} />Build / refresh plan</button>
          {plan && <div className="sfplus-plan-list">
            {plan.blocks.map((block) => <div className="sfplus-plan-item" key={block.task.id}><div><b>{clock(block.start)}–{clock(block.end)}</b><strong>{block.task.title}</strong><small>{block.duration} min · {block.task.priority || "Medium"} priority</small></div><button type="button" className="sfplus-small-button" onClick={() => focusOnTask(block.task.id)}><Play size={13} />Focus</button></div>)}
            {plan.unscheduled.length > 0 && <div className="sfplus-warning"><AlertTriangle size={15} /><span>{plan.unscheduled.length} task(s) don't fit today: {plan.unscheduled.slice(0, 3).map((task) => task.title).join(", ")}.</span></div>}
            {!plan.blocks.length && <p className="sfplus-hint">No tasks fit in the remaining time today. Keep them for tomorrow or adjust estimates.</p>}
          </div>}
        </article>

        <article className="sfplus-card">
          <div className="sfplus-card-title"><span className="sfplus-icon"><Layers3 size={18} /></span><div><h3>Assignment breakdown</h3><p>Turn a large task into four trackable steps without duplicating existing subtasks.</p></div></div>
          <label className="sfplus-label">Choose a pending task<select value={taskForBreakdown} onChange={(e) => setTaskForBreakdown(e.target.value)}><option value="">Select task…</option>{pendingTasks.filter((task) => !pendingTasks.some((child) => child.parentTaskId === task.id)).map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label>
          <button type="button" className="primary-button" onClick={breakdown} disabled={!taskForBreakdown}><ListChecks size={15} />Create subtasks</button>
          <p className="sfplus-hint">Subtasks are saved as normal tasks linked to their parent and included in the planner.</p>
        </article>

        <article className="sfplus-card sfplus-wide">
          <div className="sfplus-card-title"><span className="sfplus-icon"><TimerReset size={18} /></span><div><h3>One-click focus room</h3><p>Pick a task, focus for a set duration and log the session against your existing analytics.</p></div></div>
          <div className="sfplus-focus-controls">
            <label className="sfplus-label sfplus-grow">Focus task<select value={selectedFocusTask ? selectedFocusTask.id : ""} onChange={(e) => setFocusTaskId(e.target.value)} disabled={timerRunning}><option value="">No pending task</option>{pendingTasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label>
            <label className="sfplus-label">Duration<select value={focusMinutes} onChange={(e) => { const m = Number(e.target.value); setFocusMinutes(m); if (!timerRunning) setSecondsLeft(m * 60); }} disabled={timerRunning}><option value={15}>15 min</option><option value={25}>25 min</option><option value={50}>50 min</option></select></label>
            <div className="sfplus-timer" role="timer" aria-label={Math.floor(secondsLeft / 60) + " minutes " + (secondsLeft % 60) + " seconds"}>{String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}</div>
            {timerRunning ? <button type="button" className="primary-button" onClick={pauseFocus}><Pause size={15} />Pause</button> : <button type="button" className="primary-button" onClick={startFocus} disabled={!selectedFocusTask}><Play size={15} />{secondsLeft === focusMinutes * 60 ? "Start focus" : secondsLeft > 0 ? "Resume" : "Start again"}</button>}
            <button type="button" className="ghost-button" onClick={resetFocus}><RotateCcw size={14} />Reset</button>
          </div>
          <div className="sfplus-music"><div><Music2 size={16} /><span>Study music</span><small>Shared player above the Toolkit, also used in Study Lab</small></div><p className="sfplus-hint">The same music player stays active while you move between Study Lab and Toolkit, so audio and controls do not duplicate.</p></div>
          {selectedFocusTask && <p className="sfplus-hint">Session will be logged against <b>{selectedFocusTask.title}</b>. A completed block records one focus session.</p>}
        </article>

        <article className="sfplus-card sfplus-wide">
          <div className="sfplus-card-title"><span className="sfplus-icon"><Bell size={18} /></span><div><h3>Deadlines at a glance</h3><p>Keep the next two days visible while you plan.</p></div></div>
          {dueTasks.length ? dueTasks.map((task) => <div className="sfplus-deadline" key={task.id}><span>{task.deadline === isoDate() ? "Today" : "Tomorrow"}</span><strong>{task.title}</strong><small>{task.subject || "General"} · {task.priority || "Medium"}</small></div>) : <p className="sfplus-hint">Nothing due today or tomorrow. The app will show items here when you add deadlines.</p>}
        </article>
      </div>
    </div>}

    {phase === "learn" && <div className="sfplus-phase-body">
      <div className="sfplus-grid">
        <article className="sfplus-card sfplus-wide">
          <div className="sfplus-card-title"><span className="sfplus-icon"><Library size={18} /></span><div><h3>Course materials vault</h3><p>Store course-resource metadata in your account and upload files to your private account storage, with a device-local fallback.</p></div></div>
          <form className="sfplus-form-grid" onSubmit={addMaterial}>
            <label className="sfplus-label">Material title<input value={materialTitle} maxLength={120} onChange={(e) => setMaterialTitle(e.target.value)} placeholder="e.g. Genetics lecture notes" /></label>
            <label className="sfplus-label">Subject<input value={materialSubject} maxLength={80} onChange={(e) => setMaterialSubject(e.target.value)} placeholder="e.g. Biology" /></label>
            <label className="sfplus-label">Tags, separated by commas<input value={materialTags} maxLength={180} onChange={(e) => setMaterialTags(e.target.value)} placeholder="exam, lecture 4, revision" /></label>
            <label className="sfplus-label">Attach a file (max 25 MB)<input id="sfplus-material-file" type="file" onChange={(e) => setMaterialFile(e.target.files && e.target.files[0] || null)} /></label>
            <button className="primary-button" type="submit"><Plus size={15} />Save material</button>
          </form>
          <div className="sfplus-search"><Search size={15} /><input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="Search materials, subjects or tags…" aria-label="Search materials" /></div>
          <div className="sfplus-material-list">{visibleMaterials.length ? visibleMaterials.map((item) => <div className="sfplus-material" key={item.id}><span className="sfplus-material-icon"><FileText size={17} /></span><div><strong>{item.title}</strong><small>{item.subject || "Uncategorized"}{item.tags && item.tags.length ? " · " + item.tags.join(", ") : ""}</small><small>{item.filename ? item.filename + " · " + Math.max(1, Math.round(item.size / 1024)) + " KB" + (item.storagePath ? " · private cloud file" : " · device-local file") : "Link / note only"}</small></div>{item.filename && <button className="sfplus-icon-button" type="button" title="Download file" onClick={() => downloadMaterial(item)}><Download size={15} /></button>}<button className="sfplus-icon-button" type="button" title="Remove material" onClick={() => deleteMaterial(item)}><Trash2 size={15} /></button></div>) : <p className="sfplus-hint">Your materials will appear here. Uploaded file bytes are stored privately in your account; only local-fallback files remain on this device.</p>}</div>
        </article>

        <article className="sfplus-card">
          <div className="sfplus-card-title"><span className="sfplus-icon"><BookOpen size={18} /></span><div><h3>Active-recall flashcards</h3><p>Create cards manually or paste Q::A pairs from notes.</p></div></div>
          <form className="sfplus-form-grid" onSubmit={addCard}>
            <label className="sfplus-label">Question<input value={cardDraft.question} maxLength={500} required onChange={(e) => setCardDraft((v) => ({ ...v, question: e.target.value }))} placeholder="What is mitosis?" /></label>
            <label className="sfplus-label">Answer<textarea value={cardDraft.answer} maxLength={2000} rows={3} required onChange={(e) => setCardDraft((v) => ({ ...v, answer: e.target.value }))} placeholder="The process of cell division…" /></label>
            <label className="sfplus-label">Subject<input value={cardDraft.subject} maxLength={80} onChange={(e) => setCardDraft((v) => ({ ...v, subject: e.target.value }))} placeholder="Biology" /></label>
            <button className="primary-button" type="submit"><Plus size={15} />Add flashcard</button>
          </form>
          <label className="sfplus-label sfplus-note-import">Generate from formatted notes<textarea rows={4} value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder={"One pair per line:\nMitosis :: Cell division\nOsmosis -> Water movement through a selectively permeable membrane"} /></label>
          <button type="button" className="ghost-button" onClick={importNotesAsCards}><Sparkles size={14} />Create from Q::A lines</button>
          <div className="sfplus-row-pills"><span>{(toolkit.cards || []).length} cards total</span><span>{dueCards.length} due today</span></div>
          {activeReviewCard && <div className="sfplus-review">
            <small>{activeReviewCard.subject || "General"} · review due {activeReviewCard.nextReviewAt || "today"}</small>
            <h4>{activeReviewCard.question}</h4>
            {showAnswer ? <p>{activeReviewCard.answer}</p> : <button type="button" className="primary-button" onClick={() => setShowAnswer(true)}>Reveal answer</button>}
            {showAnswer && <div className="sfplus-rating">{[["again","Again"],["hard","Hard"],["good","Good"],["easy","Easy"]].map(([rating,label]) => <button type="button" key={rating} onClick={() => review(rating)}>{label}</button>)}</div>}
          </div>}
          {!activeReviewCard && <p className="sfplus-hint">No cards are due. Add a card or wait for the next scheduled review.</p>}
          {(toolkit.cards || []).length > 0 && <div className="sfplus-card-list">{toolkit.cards.slice(0, 5).map((card) => <div key={card.id}><span>{card.question}</span><small>{card.nextReviewAt || "today"}</small><button type="button" className="sfplus-icon-button" aria-label={"Delete flashcard " + card.question} onClick={() => setToolkit((current) => ({ ...current, cards: current.cards.filter((item) => item.id !== card.id) }))}><Trash2 size={13} /></button></div>)}</div>}
        </article>

        <article className="sfplus-card">
          <div className="sfplus-card-title"><span className="sfplus-icon"><GraduationCap size={18} /></span><div><h3>Exam readiness & grade simulator</h3><p>Readiness is a transparent estimate, not a guarantee of marks.</p></div></div>
          <div className="sfplus-readiness"><div><strong>{readiness}%</strong><small>Readiness estimate</small></div><div className="sfplus-readiness-track"><span style={{ width: readiness + "%" }} /></div></div>
          <label className="sfplus-label">Syllabus coverage: {Number((toolkit.coverage || {}).subject) || 0}%<input type="range" min="0" max="100" value={Number((toolkit.coverage || {}).subject) || 0} onChange={(e) => setToolkit((current) => ({ ...current, coverage: { ...current.coverage, subject: Number(e.target.value) } }))} /></label>
          <label className="sfplus-label">Latest practice test score: {Number((toolkit.coverage || {}).quizScore) || 0}%<input type="range" min="0" max="100" value={Number((toolkit.coverage || {}).quizScore) || 0} onChange={(e) => setToolkit((current) => ({ ...current, coverage: { ...current.coverage, quizScore: Number(e.target.value) } }))} /></label>
          <div className="sfplus-grade-fields">
            <label className="sfplus-label">Current average %<input type="number" min="0" max="100" value={grade.currentAverage} onChange={(e) => setToolkit((current) => ({ ...current, grades: { ...current.grades, currentAverage: e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value))) } }))} /></label>
            <label className="sfplus-label">Target overall %<input type="number" min="0" max="100" value={grade.targetOverall} onChange={(e) => setToolkit((current) => ({ ...current, grades: { ...current.grades, targetOverall: e.target.value === "" ? "" : Math.max(0, Math.min(100, Number(e.target.value))) } }))} /></label>
            <label className="sfplus-label">Final exam weight %<input type="number" min="1" max="100" value={grade.finalWeight} onChange={(e) => setToolkit((current) => ({ ...current, grades: { ...current.grades, finalWeight: Math.max(1, Math.min(100, Number(e.target.value) || 1)) } }))} /></label>
          </div>
          <div className="sfplus-grade-result"><strong>{neededScore === null ? "Enter a valid exam weight" : neededScore > 100 ? "Target requires over 100%" : neededScore < 0 ? "Target already achieved on current average" : "Required final score: " + neededScore + "%"}</strong><small>Assumes the current average contributes the remaining {100 - Number(grade.finalWeight || 0)}% of the final grade.</small></div>
          <p className="sfplus-hint">Readiness = 40% syllabus coverage + 40% practice score + 20% flashcards reviewed successfully. It is a planning aid, not a prediction engine.</p>
        </article>
      </div>
    </div>}

    {phase === "reliability" && <div className="sfplus-phase-body">
      <div className="sfplus-grid">
        <article className="sfplus-card">
          <div className="sfplus-card-title"><span className="sfplus-icon"><CalendarDays size={18} /></span><div><h3>Calendar import & export</h3><p>Export class events, tasks and exams; import dated events as tasks or exams using a standard ICS file.</p></div></div>
          <button type="button" className="primary-button" onClick={exportCalendar}><Download size={15} />Export calendar (.ics)</button>
          <label className="sfplus-label sfplus-file-label">Import an .ics file<input type="file" accept=".ics,text/calendar" onChange={importCalendar} /></label>
          <div className="sfplus-warning"><CircleHelp size={15} /><span>This is file-based sync, not automatic two-way account sync. Automatic Google/Outlook sync needs OAuth credentials and a server-side token store; none are configured in this repository.</span></div>
        </article>

        <article className="sfplus-card">
          <div className="sfplus-card-title"><span className="sfplus-icon"><Bell size={18} /></span><div><h3>Reminder center</h3><p>Optional browser reminders for tasks due today or tomorrow, with quiet hours.</p></div></div>
          <button type="button" className="primary-button" onClick={requestNotifications}><Bell size={15} />Enable browser notifications</button>
          <div className="sfplus-form-grid">
            <label className="sfplus-label">Quiet hours start<input type="time" value={(toolkit.reminderPrefs || {}).quietStart || "22:00"} onChange={(e) => setToolkit((current) => ({ ...current, reminderPrefs: { ...current.reminderPrefs, quietStart: e.target.value } }))} /></label>
            <label className="sfplus-label">Quiet hours end<input type="time" value={(toolkit.reminderPrefs || {}).quietEnd || "07:00"} onChange={(e) => setToolkit((current) => ({ ...current, reminderPrefs: { ...current.reminderPrefs, quietEnd: e.target.value } }))} /></label>
          </div>
          <p className="sfplus-hint">Browser reminders run while StudyFlow is open and this tab is allowed to run. True closed-app push delivery needs a push subscription service and server/VAPID secrets.</p>
        </article>

        <article className="sfplus-card sfplus-wide">
          <div className="sfplus-card-title"><span className="sfplus-icon"><ShieldCheck size={18} /></span><div><h3>Undo, backup & recovery</h3><p>Restore the last task list change or download a complete JSON backup. Backups can be restored after a warning.</p></div></div>
          <div className="sfplus-recovery-actions">
            <button type="button" className="ghost-button" onClick={undoTaskChange} disabled={!(toolkit.history || []).length}><Undo2 size={15} />Undo last task change ({(toolkit.history || []).length})</button>
            <button type="button" className="primary-button" onClick={exportBackup}><Download size={15} />Download full backup</button>
          </div>
          <label className="sfplus-label sfplus-file-label">Choose a StudyFlow backup (.json)<input id="sfplus-backup-file" type="file" accept=".json,application/json" onChange={(e) => setBackupFile(e.target.files && e.target.files[0] || null)} /></label>
          <button type="button" className="ghost-button" onClick={importBackup} disabled={!backupFile}><Upload size={15} />Restore selected backup</button>
          {toolkit.lastBackupAt && <p className="sfplus-hint">Last exported backup: {new Date(toolkit.lastBackupAt).toLocaleString()}</p>}
          <div className="sfplus-warning"><Archive size={15} /><span>File bytes in the materials vault are stored only on this browser. Downloaded JSON backups include tasks, timetable, focus history and study-tool metadata, not uploaded file bytes.</span></div>
        </article>
      </div>
    </div>}

    <footer className="sfplus-footer"><span><ShieldCheck size={14} />Per-account metadata</span><span><CloudIcon state={cloudState} />{cloudState === "synced" ? "Cloud save complete" : cloudState === "local" ? "Local save active; cloud retry needed" : "Cloud sync status visible"}</span><span><Activity size={14} />{pendingTasks.length} pending · {(sessions || []).length} focus sessions</span></footer>

    {paletteOpen && <div className="sfplus-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
      <section className="sfplus-palette" role="dialog" aria-modal="true" aria-label="Quick capture and search">
        <div className="sfplus-palette-title"><Command size={18} /><strong>Quick capture</strong><button type="button" aria-label="Close" onClick={() => setPaletteOpen(false)}><X size={16} /></button></div>
        <form className="sfplus-inline-form" onSubmit={createQuickTask}><input autoFocus value={quickInput} onChange={(e) => setQuickInput(e.target.value)} maxLength={240} placeholder="Add task, deadline, priority, duration…" /><button className="primary-button" type="submit"><Plus size={15} />Add task</button></form>
        <label className="sfplus-label">Find existing tasks<input value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)} placeholder="Search titles…" /></label>
        <div className="sfplus-palette-results">{pendingTasks.filter((task) => !paletteSearch || task.title.toLowerCase().includes(paletteSearch.toLowerCase())).slice(0, 8).map((task) => <button key={task.id} type="button" onClick={() => { setPaletteOpen(false); focusOnTask(task.id); }}><Search size={14} /><span>{task.title}</span><small>{task.deadline || "No deadline"}</small><ChevronRight size={14} /></button>)}</div>
        <p className="sfplus-hint">Keyboard shortcut: Ctrl+K or Cmd+K. Search result selects the task for a focus session.</p>
      </section>
    </div>}
  </section>;
}

function CloudIcon({ state }) {
  return state === "synced" ? <CheckCircle2 size={14} /> : state === "local" ? <AlertTriangle size={14} /> : <Activity size={14} />;
}
