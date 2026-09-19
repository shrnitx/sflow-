import React from "react";
import { Check, RotateCcw, Trash2, Calendar, BookMarked } from "lucide-react";
import { daysUntil, formatDeadline, daysLabel } from "../utils/date";

const priorityStyle = {
  Low: { bg: "#e2ecd8", fg: "#4b6b3a", ring: "#c5d6b3" },
  Medium: { bg: "#f2e2b8", fg: "#8a5a12", ring: "#e2ca86" },
  High: { bg: "#f2d4c4", fg: "#993a1c", ring: "#e8b39a" },
};

export const TaskCard = ({ task, onToggle, onDelete }) => {
  const ps = priorityStyle[task.priority] || priorityStyle.Medium;
  const n = daysUntil(task.deadline);
  const overdue = !task.completed && n !== null && n < 0;

  return (
    <article
      data-testid={`task-card-${task.id}`}
      className={`relative rounded-xl border p-5 shadow-[0_1px_0_rgba(122,75,28,0.08)] transition-opacity ${
        task.completed
          ? "bg-[#f7efd8] border-[#d9c9a5] opacity-70"
          : overdue
          ? "bg-[#fbf4e0] border-[#e0a08a]"
          : "bg-[#fbf4e0] border-[#d9c9a5]"
      }`}
    >
      {overdue && (
        <span
          data-testid={`task-overdue-${task.id}`}
          className="absolute -top-2 left-4 rounded-full bg-[#993a1c] text-[#fdf9ec] text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 shadow"
        >
          Overdue
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            data-testid={`task-title-${task.id}`}
            className={`font-serif text-xl text-[#3b2411] leading-snug ${
              task.completed ? "line-through decoration-[#8a6a3c]/70" : ""
            }`}
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            {task.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6b4a24]">
            <span className="inline-flex items-center gap-1">
              <BookMarked size={12} />
              {task.subject}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar size={12} />
              {formatDeadline(task.deadline)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            data-testid={`task-priority-${task.id}`}
            className="rounded-full text-[11px] font-semibold px-2.5 py-1 ring-1"
            style={{ backgroundColor: ps.bg, color: ps.fg, boxShadow: `inset 0 0 0 1px ${ps.ring}` }}
          >
            {task.priority}
          </span>
          <span
            data-testid={`task-status-${task.id}`}
            className={`rounded-full text-[11px] font-semibold px-2.5 py-1 ${
              task.completed
                ? "bg-[#dbe7d1] text-[#4b6b3a]"
                : "bg-[#efe2c1] text-[#7a4b1c]"
            }`}
          >
            {task.completed ? "Completed" : "Pending"}
          </span>
        </div>
      </div>

      {task.description && (
        <p
          className={`mt-3 text-sm text-[#4a3620] whitespace-pre-wrap ${
            task.completed ? "line-through decoration-[#8a6a3c]/60" : ""
          }`}
        >
          {task.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span
          data-testid={`task-days-${task.id}`}
          className={`text-xs font-medium ${
            task.completed
              ? "text-[#8a6a3c]"
              : overdue
              ? "text-[#993a1c]"
              : n !== null && n <= 2
              ? "text-[#8a5a12]"
              : "text-[#6b4a24]"
          }`}
        >
          {task.completed ? "Done" : daysLabel(task.deadline)}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid={`btn-toggle-${task.id}`}
            onClick={() => onToggle(task.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              task.completed
                ? "bg-[#efe2c1] hover:bg-[#e2d09b] text-[#7a4b1c]"
                : "bg-[#4b6b3a] hover:bg-[#3d5a2e] text-[#f7efd8]"
            }`}
          >
            {task.completed ? (
              <>
                <RotateCcw size={14} /> Mark Pending
              </>
            ) : (
              <>
                <Check size={14} /> Mark Complete
              </>
            )}
          </button>
          <button
            type="button"
            data-testid={`btn-delete-${task.id}`}
            onClick={() => onDelete(task.id)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#f2d4c4] hover:bg-[#e8b39a] text-[#993a1c] px-3 py-1.5 text-xs font-medium transition-colors"
            aria-label={`Delete ${task.title}`}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </article>
  );
};

export default TaskCard;
