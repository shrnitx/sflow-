import React from "react";
import { Search } from "lucide-react";

const controlCls =
  "rounded-md border border-[#d9c9a5] bg-[#fdf9ec] px-3 py-2 text-sm text-[#3b2411] placeholder:text-[#a4855a] focus:outline-none focus:ring-2 focus:ring-[#b98842]/40 focus:border-[#b98842] transition-colors";

export const SearchFilter = ({
  search,
  onSearch,
  status,
  onStatus,
  priority,
  onPriority,
}) => {
  return (
    <section
      data-testid="search-filter-section"
      className="rounded-xl bg-[#fbf4e0] border border-[#d9c9a5] p-4 sm:p-5 shadow-[0_1px_0_rgba(122,75,28,0.08)]"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a4855a]"
          />
          <input
            data-testid="input-search"
            type="text"
            className={`${controlCls} w-full pl-9`}
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <select
            data-testid="filter-status"
            className={controlCls}
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
          </select>

          <select
            data-testid="filter-priority"
            className={controlCls}
            value={priority}
            onChange={(e) => onPriority(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
      </div>
    </section>
  );
};

export default SearchFilter;