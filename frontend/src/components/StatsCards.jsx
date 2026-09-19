import React from "react";
import { ListChecks, Clock, CheckCircle2, Flame } from "lucide-react";

const Card = ({ label, value, Icon, tint, testId }) => (
  <div
    data-testid={testId}
    className="rounded-xl bg-[#fbf4e0] border border-[#d9c9a5] px-5 py-4 shadow-[0_1px_0_rgba(122,75,28,0.08)]"
  >
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-[#8a6a3c]">
        {label}
      </span>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{ backgroundColor: tint.bg, color: tint.fg }}
      >
        <Icon size={16} strokeWidth={2.2} />
      </span>
    </div>
    <div
      className="mt-2 font-serif text-3xl text-[#3b2411]"
      style={{ fontFamily: "'Fraunces', Georgia, serif" }}
    >
      {value}
    </div>
  </div>
);

export const StatsCards = ({ tasks }) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const high = tasks.filter((t) => t.priority === "High").length;

  return (
    <section
      data-testid="stats-section"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    >
      <Card
        testId="stat-total"
        label="Total Tasks"
        value={total}
        Icon={ListChecks}
        tint={{ bg: "#efe2c1", fg: "#7a4b1c" }}
      />
      <Card
        testId="stat-pending"
        label="Pending"
        value={pending}
        Icon={Clock}
        tint={{ bg: "#f2e2b8", fg: "#8a5a12" }}
      />
      <Card
        testId="stat-completed"
        label="Completed"
        value={completed}
        Icon={CheckCircle2}
        tint={{ bg: "#dbe7d1", fg: "#4b6b3a" }}
      />
      <Card
        testId="stat-high"
        label="High Priority"
        value={high}
        Icon={Flame}
        tint={{ bg: "#f2d4c4", fg: "#993a1c" }}
      />
    </section>
  );
};

export default StatsCards;
