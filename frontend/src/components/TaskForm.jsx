import React, { useState } from "react";
import { Plus } from "lucide-react";

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

const initial = {
  title: "",
  subject: "",
  deadline: "",
  priority: "Medium",
  description: "",
};

const inputCls =
  "w-full rounded-md border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brown)]/40 focus:border-[var(--brown)] transition-colors";

export const TaskForm = ({ onAdd }) => {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validate = () => {
    const e = {};
    if (!values.title.trim()) e.title = "Please enter a task title.";
    if (!values.subject.trim()) e.subject = "Please select a subject.";
    if (!values.deadline) e.deadline = "Please select a deadline.";
    if (!["Low", "Medium", "High"].includes(values.priority))
      e.priority = "Please select a priority.";
    return e;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onAdd({
      title: values.title.trim(),
      subject: values.subject.trim(),
      deadline: values.deadline,
      priority: values.priority,
      description: values.description.trim(),
    });
    setValues(initial);
    setErrors({});
  };

  return (
    <section
      data-testid="task-form-section"
      className="rounded-xl bg-[var(--card-strong)] border border-[var(--line)] p-5 sm:p-6 shadow-[0_1px_0_rgba(122,75,28,0.08)]"
    >
      <h2
        className="font-serif text-2xl text-[var(--ink)] mb-4"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        Add a new task
      </h2>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-[var(--muted)] mb-1" htmlFor="title">
            Task Title
          </label>
          <input
            id="title"
            data-testid="input-title"
            type="text"
            className={inputCls}
            placeholder="e.g. Physics Assignment"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
          />
          {errors.title && (
            <p data-testid="error-title" className="mt-1 text-xs text-[var(--danger)]">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1" htmlFor="subject">
            Subject
          </label>
          <select
            id="subject"
            data-testid="input-subject"
            className={inputCls}
            value={values.subject}
            onChange={(e) => set("subject", e.target.value)}
          >
            <option value="">Select a subject…</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errors.subject && (
            <p data-testid="error-subject" className="mt-1 text-xs text-[var(--danger)]">
              {errors.subject}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1" htmlFor="deadline">
            Deadline
          </label>
          <input
            id="deadline"
            data-testid="input-deadline"
            type="date"
            className={inputCls}
            value={values.deadline}
            onChange={(e) => set("deadline", e.target.value)}
          />
          {errors.deadline && (
            <p data-testid="error-deadline" className="mt-1 text-xs text-[var(--danger)]">
              {errors.deadline}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            data-testid="input-priority"
            className={inputCls}
            value={values.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
          {errors.priority && (
            <p data-testid="error-priority" className="mt-1 text-xs text-[var(--danger)]">
              {errors.priority}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1" htmlFor="description">
            Description <span className="text-[var(--muted)] font-normal">(optional)</span>
          </label>
          <input
            id="description"
            data-testid="input-description"
            type="text"
            className={inputCls}
            placeholder="e.g. Complete questions 1–10"
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div className="md:col-span-2 flex justify-end pt-1">
          <button
            type="submit"
            data-testid="btn-add-task"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brown)] hover:bg-[var(--brown-dark)] active:bg-[var(--brown-dark)] text-[var(--card)] px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Task
          </button>
        </div>
      </form>
    </section>
  );
};

export default TaskForm;
