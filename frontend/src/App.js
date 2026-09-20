import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { loadTasks, saveTasks, makeId } from "./utils/storage";
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

function App() {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = loadTasks();
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [toast, setToast] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 2500);

    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.completed).length;

    const pending = tasks.filter((task) => !task.completed).length;

    const highPriority = tasks.filter(
      (task) => !task.completed && task.priority === "High"
    ).length;

    return {
      total: tasks.length,
      pending,
      completed,
      highPriority,
    };
  }, [tasks]);

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

        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) {
          return Number(a.completed) - Number(b.completed);
        }

        const aDate = a.deadline || "9999-12-31";
        const bDate = b.deadline || "9999-12-31";

        return aDate.localeCompare(bDate);
      });
  }, [tasks, search, status, priority]);

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
      nextErrors.title = "Task title is required.";
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
      title: form.title.trim(),
      subject: form.subject,
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

  const resetFilters = () => {
    setSearch("");
    setStatus("All");
    setPriority("All");
  };

  return (
    <div className="studyflow-bg">
      <main className="app-shell">

        <header className="hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              STUDENT PRODUCTIVITY
            </div>

            <h1>StudyFlow</h1>

            <p>
              Keep assignments, deadlines and priorities in one calm workspace.
            </p>
          </div>

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
        </header>

        <section className="stats-grid">

          <div className="stat-card">
            <div className="stat-icon">
              <ListChecks size={18} />
            </div>

            <div>
              <span className="stat-label">Total Tasks</span>
              <strong>{stats.total}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon pending">
              <Clock3 size={18} />
            </div>

            <div>
              <span className="stat-label">Pending</span>
              <strong>{stats.pending}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon completed">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <span className="stat-label">Completed</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon high">
              <Flame size={18} />
            </div>

            <div>
              <span className="stat-label">High Priority</span>
              <strong>{stats.highPriority}</strong>
            </div>
          </div>

        </section>

        <section className="panel form-panel">

          <div className="panel-heading">
            <div>
              <span className="section-kicker">PLAN YOUR WORK</span>
              <h2>Add a new task</h2>
            </div>
          </div>

          <form
            onSubmit={addTask}
            className="task-form"
            noValidate
          >

            <div className="field full">
              <label htmlFor="title">Task title</label>

              <input
                id="title"
                value={form.title}
                onChange={(event) =>
                  setField("title", event.target.value)
                }
                placeholder="e.g. Physics Assignment"
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
              <label htmlFor="deadline">Deadline</label>

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
                placeholder="e.g. Complete questions 1–10"
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="primary-button"
              >
                <Plus size={18} />
                Add Task
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
                YOUR WORK
              </span>

              <h2>Tasks</h2>
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

              <h3>No tasks found</h3>

              <p>
                Try changing your filters or add a new task above.
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

        <footer className="footer">
          <span>StudyFlow</span>
          <span>Made for students</span>
          <span>Data saved locally in your browser</span>
        </footer>

      </main>

      {toast && (
        <div className="toast">
          {toast}
        </div>
      )}

    </div>
  );
}

export default App;