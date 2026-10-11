import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  House,
  CalendarRange,
  GraduationCap,
  Timer,
  Settings,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  loadTasks,
  loadTimetable,
  loadUserTasks,
  loadUserTimetable,
  saveUserTasks,
  saveUserTimetable,
  loadUserFocusSessions,
  saveUserFocusSessions,
  wasLegacyMigrationReviewed,
  markLegacyMigrationReviewed,
  makeId,
} from "./utils/storage";

import {
  loadUserCollection,
  syncUserCollection,
} from "./utils/cloudStorage";

import TodayClasses from "./components/TodayClasses";
import ClassDetails from "./components/ClassDetails";
import Timetable from "./components/Timetable";
import ReminderSettings from "./components/ReminderSettings";
import QuickAdd from "./components/QuickAdd";
import ExamPrepPlanner from "./components/ExamPrepPlanner";
import FocusMode from "./components/FocusMode";

import Login from "./components/auth/login";
import Signup from "./components/auth/signup";
import { useAuth } from "./context/AuthContext";

import "./App.css";

const SUBJECTS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Programming",
  "Biology",
  "English",
  "History",
  "Economics",
  "Other",
];

const EMPTY_FORM = {
  title: "",
  subject: "",
  deadline: "",
  priority: "Medium",
  description: "",
  classId: "",
};

function formatDeadline(value) {
  if (!value) return "No deadline";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isOverdue(task) {
  if (task.completed || !task.deadline) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(`${task.deadline}T00:00:00`);

  return deadline < today;
}

function daysOverdue(task) {
  if (!isOverdue(task)) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(`${task.deadline}T00:00:00`);

  return Math.ceil((today - deadline) / 86400000);
}

function isExamItem(item) {
  const type = String(item?.type || item?.category || "").toLowerCase();
  if (type === "exam" || type === "examination") return true;
  if (type === "task" || type === "assignment") return false;

  // Older task records had no explicit type, so infer exam records conservatively.
  return /\b(exam|examination|midterm|finals?|quiz|viva|practical exam)\b/i.test(
    `${item?.title || ""} ${item?.description || ""}`
  );
}

function getGreetingName(user) {
  const metadata = user?.user_metadata || {};
  const name = String(metadata.name || metadata.full_name || metadata.fullName || "").trim();
  if (name) return name;
  return user?.email?.split("@")[0] || "there";
}

function daysUntilDate(value) {
  if (!value) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((date - today) / 86400000);
}

function App() {
  const { user, loading, signOut } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [focusSessions, setFocusSessions] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoadedFor, setDataLoadedFor] = useState(null);
  const [cloudReadyFor, setCloudReadyFor] = useState(null);
  const [dataLoadAttempt, setDataLoadAttempt] = useState(0);
  const [dataSyncing, setDataSyncing] = useState(false);
  const [dataSyncError, setDataSyncError] = useState("");

  const [tasks, setTasks] = useState(() => {
    try {
      const saved = loadTasks();
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const [timetable, setTimetable] = useState(() => {
    try {
      const saved = loadTimetable();
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const [selectedClass, setSelectedClass] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [toast, setToast] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  useEffect(() => {
    setActiveSection("home");
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setDataLoadedFor(null);
      setDataLoading(false);
      setDataSyncError("");
      return;
    }

    let cancelled = false;

    const initializeUserData = async () => {
      setDataLoading(true);
      setCloudReadyFor(null);
      setDataSyncError("");

      try {
        const results = await Promise.all([
          loadUserCollection("tasks", user.id),
          loadUserCollection("timetable", user.id),
          loadUserCollection("focusSessions", user.id),
        ]);

        if (cancelled) return;

        let nextTasks = results[0];
        let nextTimetable = results[1];
        let nextFocusSessions = results[2];

        // A per-user cache may contain writes made while Supabase was unreachable.
        // Restore it only when the cloud collection is empty; cloud data wins otherwise.
        const cachedTasks = loadUserTasks(user.id);
        const cachedTimetable = loadUserTimetable(user.id);
        const cachedFocusSessions = loadUserFocusSessions(user.id);

        if (nextTasks.length === 0 && cachedTasks.length > 0) {
          await syncUserCollection("tasks", user.id, cachedTasks);
          nextTasks = cachedTasks;
        }

        if (nextTimetable.length === 0 && cachedTimetable.length > 0) {
          await syncUserCollection("timetable", user.id, cachedTimetable);
          nextTimetable = cachedTimetable;
        }

        if (nextFocusSessions.length === 0 && cachedFocusSessions.length > 0) {
          await syncUserCollection("focusSessions", user.id, cachedFocusSessions);
          nextFocusSessions = cachedFocusSessions;
        }

        // Older versions used shared browser keys. Never import them silently:
        // ask the signed-in user, and only import into collections that are empty.
        if (!wasLegacyMigrationReviewed()) {
          const legacyTasks = loadTasks();
          const legacyTimetable = loadTimetable();
          const canImportTasks = nextTasks.length === 0 && legacyTasks.length > 0;
          const canImportTimetable =
            nextTimetable.length === 0 && legacyTimetable.length > 0;
          const importSummary = [];

          if (canImportTasks) importSummary.push(legacyTasks.length + " task(s)");
          if (canImportTimetable) {
            importSummary.push(legacyTimetable.length + " timetable entr(y/ies)");
          }

          if (importSummary.length > 0) {
            const accountLabel = user.email ? " (" + user.email + ")" : "";
            const shouldImport = window.confirm(
              "StudyFlow found old data saved only in this browser: " +
                importSummary.join(" and ") +
                ".\n\nImport it into the signed-in account" +
                accountLabel +
                "? Existing cloud data will not be overwritten.\n\nChoose Cancel to leave the old browser data untouched."
            );

            if (shouldImport) {
              if (canImportTasks) {
                await syncUserCollection("tasks", user.id, legacyTasks);
                nextTasks = legacyTasks;
              }

              if (canImportTimetable) {
                await syncUserCollection("timetable", user.id, legacyTimetable);
                nextTimetable = legacyTimetable;
              }
            }
          }

          markLegacyMigrationReviewed();
        }

        if (cancelled) return;

        saveUserTasks(user.id, nextTasks);
        saveUserTimetable(user.id, nextTimetable);
        saveUserFocusSessions(user.id, nextFocusSessions);
        setTasks(nextTasks);
        setTimetable(nextTimetable);
        setFocusSessions(nextFocusSessions);
        setDataLoadedFor(user.id);
        setCloudReadyFor(user.id);
        setDataSyncError("");
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to load StudyFlow cloud data:", error);
        setTasks(loadUserTasks(user.id));
        setTimetable(loadUserTimetable(user.id));
        setFocusSessions(loadUserFocusSessions(user.id));
        setDataLoadedFor(user.id);
        setDataSyncError(
          "Cloud data could not be loaded. Your account-specific browser cache is shown, but changes may not sync until the Supabase tables and permissions are configured."
        );
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    initializeUserData();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email, dataLoadAttempt]);

  useEffect(() => {
    if (!user?.id || dataLoadedFor !== user.id) return;

    // Save the account-specific cache even when the network/cloud sync is down.
    saveUserTasks(user.id, tasks);
    saveUserTimetable(user.id, timetable);
    saveUserFocusSessions(user.id, focusSessions);

    if (cloudReadyFor !== user.id || dataSyncError) return;

    const timer = setTimeout(async () => {
      setDataSyncing(true);

      try {
        await Promise.all([
          syncUserCollection("tasks", user.id, tasks),
          syncUserCollection("timetable", user.id, timetable),
          syncUserCollection("focusSessions", user.id, focusSessions),
        ]);
        setDataSyncError("");
      } catch (error) {
        console.error("StudyFlow cloud sync failed:", error);
        setDataSyncError(
          "Cloud sync failed. Your latest changes remain in this account's browser cache. Reconnect and retry cloud sync."
        );
      } finally {
        setDataSyncing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tasks, timetable, focusSessions, user?.id, dataLoadedFor, cloudReadyFor, dataSyncError]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [toast]);

  const scopedItems = useMemo(
    () =>
      tasks.filter((task) =>
        activeSection === "exams" ? isExamItem(task) : !isExamItem(task)
      ),
    [tasks, activeSection]
  );

  const stats = useMemo(() => {
    const completed = scopedItems.filter((task) => task.completed).length;
    const pending = scopedItems.filter((task) => !task.completed).length;
    const highPriority = scopedItems.filter(
      (task) => !task.completed && task.priority === "High"
    ).length;

    return {
      total: scopedItems.length,
      pending,
      completed,
      highPriority,
    };
  }, [scopedItems]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...tasks]
      .filter((task) => {
        const matchesSearch =
          !query ||
          task.title?.toLowerCase().includes(query) ||
          task.subject?.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query);

        const matchesStatus =
          status === "All" ||
          (status === "Pending" && !task.completed) ||
          (status === "Completed" && task.completed) ||
          (status === "Overdue" && isOverdue(task));

        const matchesPriority =
          priority === "All" || task.priority === priority;

        const matchesSection =
          activeSection === "exams"
            ? isExamItem(task)
            : !isExamItem(task);

        return matchesSearch && matchesStatus && matchesPriority && matchesSection;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) {
          return Number(a.completed) - Number(b.completed);
        }

        const aDate = a.deadline || "9999-12-31";
        const bDate = b.deadline || "9999-12-31";

        return aDate.localeCompare(bDate);
      });
  }, [tasks, search, status, priority, activeSection]);

  const examAlerts = useMemo(
    () =>
      tasks
        .filter((task) => isExamItem(task) && !task.completed && task.deadline)
        .sort((a, b) => (daysUntilDate(a.deadline) ?? 9999) - (daysUntilDate(b.deadline) ?? 9999))
        .slice(0, 4),
    [tasks]
  );

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSearch("");
    setStatus("All");
    setPriority("All");
    setForm(EMPTY_FORM);
    setErrors({});
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const setField = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    if (errors[key]) {
      setErrors((current) => ({
        ...current,
        [key]: "",
      }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.title.trim()) {
      nextErrors.title = activeSection === "exams" ? "Exam name is required." : "Task title is required.";
    }

    if (!form.subject) {
      nextErrors.subject = "Choose a subject.";
    }

    if (!form.deadline) {
      nextErrors.deadline = "Choose a deadline.";
    }

    return nextErrors;
  };

  const addTask = (event) => {
    event.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const newTask = {
      id: makeId(),
      type: activeSection === "exams" ? "exam" : "task",
      title: form.title.trim(),
      subject: form.subject,
      classId: form.classId || "",
      deadline: form.deadline,
      priority: form.priority,
      description: form.description.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    setTasks((current) => [newTask, ...current]);

    setForm(EMPTY_FORM);
    setErrors({});
    setToast("Task added successfully.");
  };

  const toggleTask = (id) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
            }
          : task
      )
    );

    setToast("Task status updated.");
  };

  const deleteTask = (id) => {
    const task = tasks.find((item) => item.id === id);

    if (!task) return;

    const confirmed = window.confirm(`Delete "${task.title}"?`);

    if (!confirmed) return;

    setTasks((current) => current.filter((item) => item.id !== id));
    setToast("Task deleted.");
  };

  const startEdit = (task) => {
    setEditingId(task.id);

    setEditForm({
      title: task.title || "",
      subject: task.subject || "",
      deadline: task.deadline || "",
      priority: task.priority || "Medium",
      description: task.description || "",
      classId: task.classId || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const saveEdit = (event) => {
    event.preventDefault();

    if (!editForm.title.trim()) {
      setToast(isExamItem(tasks.find((task) => task.id === editingId)) ? "Exam name is required." : "Task title is required.");
      return;
    }

    if (!editForm.subject) {
      setToast("Please select a subject.");
      return;
    }

    if (!editForm.deadline) {
      setToast("Please select a deadline.");
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.id === editingId
          ? {
              ...task,
              title: editForm.title.trim(),
              subject: editForm.subject,
              deadline: editForm.deadline,
              priority: editForm.priority,
              description: editForm.description.trim(),
              classId: editForm.classId || "",
            }
          : task
      )
    );

    setEditingId(null);
    setEditForm(EMPTY_FORM);
    setToast("Task updated successfully.");
  };

  const resetFilters = () => {
    setSearch("");
    setStatus("All");
    setPriority("All");
  };

  const addQuickTask = (entry) => {
    const matchedClass = timetable.find((item) =>
      entry.subject &&
      [item.subject, item.courseCode].filter(Boolean)
        .some((value) => value.toLowerCase() === entry.subject.toLowerCase())
    );
    const newTask = {
      id: makeId(),
      type: "task",
      title: entry.title,
      subject: entry.subject || matchedClass?.subject || "Other",
      classId: matchedClass?.id || "",
      deadline: entry.deadline || "",
      priority: entry.priority || "Medium",
      description: "",
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((current) => [newTask, ...current]);
  };

  const importCalendarTasks = (items) => {
    if (!Array.isArray(items) || !items.length) return;
    setTasks((current) => [...items, ...current]);
  };

  const generateExamPlan = (items) => {
    if (!Array.isArray(items) || !items.length) return;
    setTasks((current) => [...items, ...current]);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowSignup(false);
    } catch {
      setToast("Could not sign out. Please try again.");
    }
  };

  if (loading) {
    return <div className="app-loading">Loading StudyFlow...</div>;
  }

  if (!user) {
    return showSignup ? (
      <Signup onShowLogin={() => setShowSignup(false)} />
    ) : (
      <Login onShowSignup={() => setShowSignup(true)} />
    );
  }

  if (dataLoading || dataLoadedFor !== user.id) {
    return <div className="app-loading">Loading your StudyFlow data...</div>;
  }

  return (
    <div className="studyflow-bg">
      <main className="app-shell">
        <header className="hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              STUDYFLOW DASHBOARD
            </div>

            <h1>Hello, {getGreetingName(user)}</h1>

            <p>
              Here are your class and exam alerts for today.
            </p>
          </div>

          <div className="hero-actions">
            <span className="account-email" title={user.email || "Signed in"}>
              {user.email || "Signed in"}
            </span>

            <div className="today-chip">
              <CalendarDays size={17} />

              <span>
                {new Date().toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            <button type="button" className="ghost-button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <nav className="dashboard-nav" aria-label="Main navigation">
          {[
            { id: "home", label: "Overview", Icon: House },
            { id: "timetable", label: "Timetable", Icon: CalendarRange },
            { id: "tasks", label: "Tasks", Icon: ListChecks },
            { id: "exams", label: "Exams", Icon: GraduationCap },
            { id: "focus", label: "Focus", Icon: Timer },
            { id: "settings", label: "Settings", Icon: Settings },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`dashboard-nav-item ${activeSection === id ? "is-active" : ""}`}
              onClick={() => handleSectionChange(id)}
              aria-current={activeSection === id ? "page" : undefined}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "exams" && examAlerts.length > 0 && (
                <span className="dashboard-nav-count">{examAlerts.length}</span>
              )}
            </button>
          ))}
        </nav>

        <ReminderSettings
          userId={user.id}
          timetable={timetable}
          tasks={tasks}
          onToast={setToast}
          visible={activeSection === "settings"}
        />

        {activeSection !== "home" && dataSyncError && (
          <div className="cloud-sync-warning" role="alert">
            <span>{dataSyncError}</span>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setDataLoadAttempt((attempt) => attempt + 1)}
            >
              Retry cloud sync
            </button>
          </div>
        )}

        {activeSection !== "home" && !dataSyncError && dataSyncing && (
          <div className="cloud-sync-status" role="status" aria-live="polite">
            Saving changes to your account...
          </div>
        )}

        {activeSection === "home" && (
          <section className="dashboard-home-grid">
            <TodayClasses
              timetable={timetable}
              onSelectClass={setSelectedClass}
            />

            <section className="panel exam-alerts-panel">
              <div className="panel-heading exam-alerts-heading">
                <div>
                  <span className="section-kicker">IMPORTANT DATES</span>
                  <h2>Exam alerts</h2>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => handleSectionChange("exams")}
                >
                  View exams
                </button>
              </div>

              {examAlerts.length === 0 ? (
                <div className="exam-alert-empty">
                  <div className="exam-alert-empty-icon">
                    <GraduationCap size={22} />
                  </div>
                  <h3>No exams scheduled</h3>
                  <p>Add an exam with its date to see reminders here.</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleSectionChange("exams")}
                  >
                    <Plus size={16} />
                    Add an exam
                  </button>
                </div>
              ) : (
                <div className="exam-alert-list">
                  {examAlerts.map((exam) => {
                    const daysAway = daysUntilDate(exam.deadline);
                    const urgencyLabel =
                      daysAway === null
                        ? formatDeadline(exam.deadline)
                        : daysAway < 0
                        ? `${Math.abs(daysAway)} day${Math.abs(daysAway) === 1 ? "" : "s"} overdue`
                        : daysAway === 0
                        ? "Today"
                        : daysAway === 1
                        ? "Tomorrow"
                        : `In ${daysAway} days`;

                    return (
                      <article className="exam-alert-item" key={exam.id}>
                        <div className="exam-alert-date">
                          <CalendarDays size={17} />
                          <span>{new Date(`${exam.deadline}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                        </div>
                        <div className="exam-alert-details">
                          <strong>{exam.title}</strong>
                          <span>{exam.subject || "General"} · {formatDeadline(exam.deadline)}</span>
                          {exam.description && <p>{exam.description}</p>}
                        </div>
                        <span
                          className={`exam-urgency ${daysAway !== null && daysAway < 0 ? "is-overdue" : daysAway === 0 ? "is-today" : ""}`}
                        >
                          {urgencyLabel}
                        </span>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        )}

        {activeSection === "timetable" && (
          <Timetable
            timetable={timetable}
            setTimetable={setTimetable}
            setToast={setToast}
            tasks={tasks}
            onImportTasks={importCalendarTasks}
          />
        )}

        {activeSection === "focus" && (
          <FocusMode
            userId={user.id}
            timetable={timetable}
            tasks={tasks}
            sessions={focusSessions}
            setSessions={setFocusSessions}
            onToast={setToast}
          />
        )}

        {activeSection === "settings" && (
          <section className="dashboard-settings-grid">
            <section className="panel offline-settings-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">INSTALL & SYNC</span>
                  <h2>Offline access</h2>
                </div>
              </div>
              <p>StudyFlow saves an account-specific browser cache and queues cloud changes when connectivity returns. Install the app from your browser menu for easier access.</p>
              <div className="offline-state-row">
                <span className={navigator.onLine ? "offline-state-dot is-online" : "offline-state-dot"} />
                <strong>{navigator.onLine ? "Internet connection available" : "Offline · browser cache in use"}</strong>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setDataLoadAttempt((attempt) => attempt + 1)}
              >
                <RotateCcw size={16} /> Retry cloud sync
              </button>
              <p className="offline-settings-footnote">Offline access depends on a previous successful load in this browser. Push notifications while the app is fully closed require a separate push service.</p>
            </section>
          </section>
        )}

        {(activeSection === "tasks" || activeSection === "exams") && (
          <>
        {activeSection === "tasks" && (
          <QuickAdd timetable={timetable} onAdd={addQuickTask} onToast={setToast} />
        )}

        {activeSection === "exams" && (
          <ExamPrepPlanner
            exams={tasks.filter(isExamItem)}
            onGenerate={generateExamPlan}
            onToast={setToast}
          />
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <ListChecks size={18} />
            </div>

            <div>
              <span className="stat-label">{activeSection === "exams" ? "Total Exams" : "Total Tasks"}</span>
              <strong>{stats.total}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon pending">
              <Clock3 size={18} />
            </div>

            <div>
              <span className="stat-label">{activeSection === "exams" ? "Upcoming" : "Pending"}</span>
              <strong>{stats.pending}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon completed">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <span className="stat-label">{activeSection === "exams" ? "Completed Exams" : "Completed"}</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon high">
              <Flame size={18} />
            </div>

            <div>
              <span className="stat-label">{activeSection === "exams" ? "High Priority Exams" : "High Priority"}</span>
              <strong>{stats.highPriority}</strong>
            </div>
          </div>
        </section>

        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">
                {activeSection === "exams" ? "PLAN YOUR EXAMS" : "PLAN YOUR WORK"}
              </span>
              <h2>{activeSection === "exams" ? "Add an exam" : "Add a new task"}</h2>
            </div>
          </div>

          <form
            onSubmit={addTask}
            className="task-form"
            noValidate
          >
            <div className="field full">
              <label htmlFor="title">{activeSection === "exams" ? "Exam name" : "Task title"}</label>

              <input
                id="title"
                value={form.title}
                onChange={(event) =>
                  setField("title", event.target.value)
                }
                placeholder={activeSection === "exams" ? "e.g. Biology midterm" : "e.g. Physics Assignment"}
              />

              {errors.title && (
                <span className="field-error">
                  {errors.title}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="subject">Subject</label>

              <select
                id="subject"
                value={form.subject}
                onChange={(event) =>
                  setField("subject", event.target.value)
                }
              >
                <option value="">
                  Select a subject...
                </option>

                {SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>

              {errors.subject && (
                <span className="field-error">
                  {errors.subject}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="task-class-link">Linked class <span>(optional)</span></label>
              <select
                id="task-class-link"
                value={form.classId || ""}
                onChange={(event) => setField("classId", event.target.value)}
              >
                <option value="">No linked class</option>
                {timetable.map((item) => (
                  <option key={item.id} value={item.id}>
                    {(item.courseCode ? item.courseCode + " · " : "") + item.subject + " · " + DAYS[item.day]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="deadline">{activeSection === "exams" ? "Exam date" : "Deadline"}</label>

              <input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(event) =>
                  setField("deadline", event.target.value)
                }
              />

              {errors.deadline && (
                <span className="field-error">
                  {errors.deadline}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="priority">Priority</label>

              <select
                id="priority"
                value={form.priority}
                onChange={(event) =>
                  setField("priority", event.target.value)
                }
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="description">
                Description <span>(optional)</span>
              </label>

              <input
                id="description"
                value={form.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
                placeholder={activeSection === "exams" ? "e.g. Syllabus, room, or exam instructions" : "e.g. Complete questions 1–10"}
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
              >
                <Plus size={18} />
                {activeSection === "exams" ? "Add Exam" : "Add Task"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel filters-panel">
          <div className="search-wrap">
            <Search size={18} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search tasks, subjects or descriptions..."
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            <option>All</option>
            <option>Pending</option>
            <option>Completed</option>
            <option>Overdue</option>
          </select>

          <select
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value)
            }
          >
            <option>All</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>

          {(search ||
            status !== "All" ||
            priority !== "All") && (
            <button
              type="button"
              className="ghost-button"
              onClick={resetFilters}
            >
              <RotateCcw size={16} />
              Reset
            </button>
          )}
        </section>

        <section className="tasks-section">
          <div className="tasks-heading">
            <div>
              <span className="section-kicker">
                {activeSection === "exams" ? "EXAM SCHEDULE" : "YOUR WORK"}
              </span>

              <h2>{activeSection === "exams" ? "Exams" : "Tasks"}</h2>
            </div>

            <span className="task-count">
              {visibleTasks.length} shown
            </span>
          </div>

          {visibleTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <ListChecks size={24} />
              </div>

              <h3>{activeSection === "exams" ? "No exams found" : "No tasks found"}</h3>

              <p>
                {activeSection === "exams"
                  ? "Add an exam above with its subject and date to see it in your exam list and home alerts."
                  : "Try changing your filters or add a new task above."}
              </p>
            </div>
          ) : (
            <div className="task-list">
              {visibleTasks.map((task) => {
                const overdue = isOverdue(task);
                const overdueDays = daysOverdue(task);

                return (
                  <article
                    key={task.id}
                    className={`task-card ${
                      task.completed ? "is-completed" : ""
                    }`}
                  >
                    <div className="task-main">
                      <div className="task-check">
                        <button
                          type="button"
                          className={`check-button ${
                            task.completed ? "checked" : ""
                          }`}
                          onClick={() =>
                            toggleTask(task.id)
                          }
                          aria-label={
                            task.completed
                              ? "Mark pending"
                              : "Mark complete"
                          }
                        >
                          {task.completed && (
                            <Check size={17} />
                          )}
                        </button>
                      </div>

                      <div className="task-content">
                        <div className="task-title-row">
                          <h3>{task.title}</h3>

                          <span
                            className={`priority-pill ${
                              task.priority.toLowerCase()
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <div className="task-meta">
                          <span>
                            {task.subject || "Other"}
                          </span>

                          <span className="meta-separator">
                            •
                          </span>

                          <span
                            className={
                              overdue
                                ? "overdue-text"
                                : ""
                            }
                          >
                            {formatDeadline(task.deadline)}
                          </span>

                          {task.completed && (
                            <>
                              <span className="meta-separator">
                                •
                              </span>

                              <span className="completed-text">
                                Completed
                              </span>
                            </>
                          )}
                        </div>

                        {task.description && (
                          <p className="task-description">
                            {task.description}
                          </p>
                        )}

                        {!task.completed && overdue && (
                          <div className="overdue-label">
                            {overdueDays}{" "}
                            {overdueDays === 1
                              ? "day"
                              : "days"}{" "}
                            overdue
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="task-actions">
                      <button
                        type="button"
                        className="small-button edit-button"
                        onClick={() => startEdit(task)}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className={`small-button ${
                          task.completed
                            ? "pending-button"
                            : "complete-button"
                        }`}
                        onClick={() =>
                          toggleTask(task.id)
                        }
                      >
                        {task.completed ? (
                          <>
                            <RotateCcw size={15} />
                            Mark Pending
                          </>
                        ) : (
                          <>
                            <Check size={15} />
                            Mark Complete
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="small-button delete-button"
                        onClick={() =>
                          deleteTask(task.id)
                        }
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
          </>
        )}

        <footer className="footer">
          <span>StudyFlow</span>
          <span>Made for students</span>
          <span>
            {dataSyncError
              ? "Account-specific browser cache available"
              : dataSyncing
              ? "Syncing to your account..."
              : "Cloud sync enabled"}
          </span>
        </footer>
      </main>

      {editingId && (
        <div
          className="edit-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelEdit();
            }
          }}
        >
          <form
            className="edit-dialog"
            onSubmit={saveEdit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-dialog-title"
          >
            <div className="edit-dialog-heading">
              <div>
                <span className="section-kicker">
                  {isExamItem(tasks.find((task) => task.id === editingId)) ? "UPDATE EXAM" : "UPDATE YOUR WORK"}
                </span>

                <h2 id="edit-dialog-title">
                  {isExamItem(tasks.find((task) => task.id === editingId)) ? "Edit exam" : "Edit task"}
                </h2>
              </div>

              <button
                type="button"
                className="dialog-close-button"
                onClick={cancelEdit}
                aria-label="Close edit dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="edit-dialog-form">
              <div className="field full">
                <label htmlFor="edit-title">
                  {isExamItem(tasks.find((task) => task.id === editingId)) ? "Exam name" : "Task title"}
                </label>

                <input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  autoFocus
                />
              </div>

              <div className="field">
                <label htmlFor="edit-subject">
                  Subject
                </label>

                <select
                  id="edit-subject"
                  value={editForm.subject}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                >
                  <option value="">
                    Select a subject...
                  </option>

                  {SUBJECTS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="edit-class-link">Linked class</label>
                <select
                  id="edit-class-link"
                  value={editForm.classId || ""}
                  onChange={(event) => setEditForm((current) => ({ ...current, classId: event.target.value }))}
                >
                  <option value="">No linked class</option>
                  {timetable.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(item.courseCode ? item.courseCode + " · " : "") + item.subject + " · " + DAYS[item.day]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="edit-deadline">
                  {isExamItem(tasks.find((task) => task.id === editingId)) ? "Exam date" : "Deadline"}
                </label>

                <input
                  id="edit-deadline"
                  type="date"
                  value={editForm.deadline}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      deadline: event.target.value,
                    }))
                  }
                />

                <span className="field-error">{errors.deadline}</span>
              </div>

              <div className="field">
                <label htmlFor="edit-priority">Priority</label>

                <select
                  id="edit-priority"
                  value={editForm.priority}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="field full">
                <label htmlFor="edit-description">
                  Description
                </label>

                <input
                  id="edit-description"
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="edit-dialog-actions">
              <button
                type="button"
                className="ghost-button"
                onClick={cancelEdit}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
              >
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedClass && (
        <ClassDetails
          classItem={selectedClass}
          tasks={tasks}
          onClose={() => setSelectedClass(null)}
        />
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
