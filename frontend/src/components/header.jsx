import React from "react";
import { BookOpen } from "lucide-react";

export const Header = () => {
  return (
    <header
      data-testid="app-header"
      className="w-full border-b border-[#d9c9a5]/60 bg-[#f6ecd4]/70 backdrop-blur-sm"
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-8 py-7 flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#7a4b1c] text-[#f6ecd4] shadow-sm shrink-0">
          <BookOpen size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1
            data-testid="app-title"
            className="font-serif text-3xl sm:text-4xl leading-tight text-[#3b2411] tracking-tight"
            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
          >
            StudyFlow
          </h1>
          <p className="text-sm sm:text-base text-[#6b4a24] mt-0.5">
            Student Task &amp; Deadline Manager — manage your academic tasks in one place.
          </p>
        </div>
      </div>
    </header>
  );
};

export default Header;