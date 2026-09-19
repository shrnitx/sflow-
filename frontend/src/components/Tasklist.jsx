import React from "react";
import { TaskCard } from "./TaskCard";
import { NotebookPen, SearchX } from "lucide-react";

const EmptyState = ({ icon: Icon, title, subtitle, testId }) => (
  <div
    data-testid={testId}
    className="rounded-xl border border-dashed border-[#d9c9a5] bg-[#fbf4e0]/60 py-14 px-6 text-center"
  >
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#efe2c1] text-[#7a4b1c] mb-3">
      <Icon size={22} />
    </div>
    <h3
      className="font-serif text-xl text-[#3b2411]"
      style={{ fontFamily: "'Fraunces', Georgia, serif" }}
    >
      {title}
    </h3>
    <p className="mt-1 text-sm text-[#6b4a24]">{subtitle}</p>
  </div>
);

export const TaskList = ({ tasks, allTasksCount, onToggle, onDelete }) => {
  if (allTasksCount === 0) {
    return (
      <EmptyState
        testId="empty-state-no-tasks"
        icon={NotebookPen}
        title="No tasks yet."
        subtitle="Add your first academic task to get started."
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        testId="empty-state-no-results"
        icon={SearchX}
        title="No matching tasks found."
        subtitle="Try adjusting your search or filters."
      />
    );
  }

  return (
    <div data-testid="task-list" className="grid grid-cols-1 gap-4">
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default TaskList;