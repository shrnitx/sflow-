import React, { useEffect, useMemo, useState } from "react";
import "@/App.css";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import TaskForm from "./components/TaskForm";
import SearchFilter from "./components/SearchFilter";
import TaskList from "./components/TaskList";
import ConfirmDialog from "./components/ConfirmDialog";
import Toast from "./components/Toast";
import { loadTasks, saveTasks, makeId } from "./utils/storage";
import { daysUntil } from "./utils/date";

function App() {
  const [tasks, setTasks] = useState(() => loadTasks());
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = (data) => {
    const task = {
      id: makeId(),
      ...data,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [task, ...prev]);
    setToast("Task added successfully.");
  };

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const askDelete = (id) => setPendingDeleteId(id);

  const cancelDelete = () => setPendingDeleteId(null);

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    setTasks((prev) => prev.filter((t) => t.id !== pendingDeleteId));
    setPendingDeleteId(null);
    setToast("Task deleted.");
  };

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tasks.filter((t) => {
      if (status === "Pending" && t.completed) return false;
      if (status === "Completed" && !t.completed) return false;
      if (priority !== "All" && t.priority !== priority) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
      );
    });
    // Sort: pending first, then by soonest deadline, then by creation
    list = [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const da = daysUntil(a.deadline);
      const db = daysUntil(b.deadline);
      if (da !== db) return (da ?? Infinity) - (db ?? Infinity);
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
    return list;
  }, [tasks, search, status, priority]);

  const pendingDeleteTask = tasks.find((t) => t.id === pendingDeleteId) || null;

  return (
    <div className="min-h-screen bg-[#f5ead0] text-[#3b2411] studyflow-bg">
      <Header />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <StatsCards tasks={tasks} />
        <TaskForm onAdd={addTask} />
        <SearchFilter
          search={search}
          onSearch={setSearch}
          status={status}
          onStatus={setStatus}
          priority={priority}
          onPriority={setPriority}
        />
        <TaskList
          tasks={filteredTasks}
          allTasksCount={tasks.length}
          onToggle={toggleTask}
          onDelete={askDelete}
        />
      </main>

      <footer className="max-w-5xl mx-auto px-5 sm:px-8 pb-8 pt-4 text-center text-xs text-[#8a6a3c]">
        StudyFlow · Made for students · Data saved locally in your browser.
      </footer>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="Delete this task?"
        message={
          pendingDeleteTask
            ? `Are you sure you want to delete "${pendingDeleteTask.title}"? This cannot be undone.`
            : "Are you sure you want to delete this task?"
        }
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />

      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

export default App;
