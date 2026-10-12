import {
  addDays, buildAdaptivePlan, calculateReadiness, cardsFromNotes, nextReview,
  parseIcs, parseQuickCapture, requiredFinalScore
} from "./studyFlowPlusLogic";

describe("StudyFlow Plus feature logic", () => {
  test("quick capture parses date, priority, subject and duration", () => {
    const result = parseQuickCapture("Revise genetics for Biology tomorrow high 45m", new Date("2026-10-12T09:00:00"));
    expect(result).toMatchObject({ title: "Revise genetics", deadline: "2026-10-13", priority: "High", estimatedMinutes: 45, subject: "Biology", type: "task" });
  });

  test("quick capture rejects empty input and bounds duration", () => {
    expect(parseQuickCapture("   ")).toBeNull();
    expect(parseQuickCapture("Read notes 999m").estimatedMinutes).toBe(240);
  });

  test("adaptive planner schedules tasks around classes and marks overflow", () => {
    const now = new Date("2026-10-12T09:00:00");
    const tasks = [
      { id: "a", title: "Lab report", priority: "High", estimatedMinutes: 60 },
      { id: "b", title: "Read chapter", priority: "Low", estimatedMinutes: 30 }
    ];
    const timetable = [{ id: "c", day: now.getDay(), subject: "Class", startTime: "09:00", endTime: "11:00" }];
    const result = buildAdaptivePlan(tasks, timetable, now);
    expect(result.blocks.length).toBe(2);
    expect(result.blocks[0].start).toBeGreaterThanOrEqual(11 * 60);
    expect(result.unscheduled).toHaveLength(0);
  });

  test("adaptive planner avoids scheduling a parent alongside its subtasks", () => {
    const result = buildAdaptivePlan([
      { id: "p", title: "Assignment", estimatedMinutes: 60 },
      { id: "c", title: "Assignment step", parentTaskId: "p", estimatedMinutes: 20 }
    ], [], new Date("2026-10-12T09:00:00"));
    expect(result.blocks.map((block) => block.task.id)).toEqual(["c"]);
  });

  test("parent task returns to the plan after all its subtasks are complete", () => {
    const result = buildAdaptivePlan([
      { id: "p", title: "Assignment", estimatedMinutes: 60, completed: false },
      { id: "c", title: "Assignment step", parentTaskId: "p", estimatedMinutes: 20, completed: true }
    ], [], new Date("2026-10-12T09:00:00"));
    expect(result.blocks.map((block) => block.task.id)).toEqual(["p"]);
  });

  test("calendar importer parses all-day event titles", () => {
    expect(parseIcs("BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:Biology exam\nDTSTART;VALUE=DATE:20261020\nEND:VEVENT\nEND:VCALENDAR")).toMatchObject([
      { title: "Biology exam", deadline: "2026-10-20", type: "exam" }
    ]);
  });

  test("notes make cards only from explicit question-answer pairs", () => {
    const cards = cardsFromNotes("Mitosis :: Cell division\nnot a card\nOsmosis -> Water movement", () => "id");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ question: "Mitosis", answer: "Cell division" });
  });

  test("review intervals adapt to rating", () => {
    const card = { id: "1", reps: 0, nextReviewAt: "2026-10-12" };
    expect(nextReview(card, "again", new Date("2026-10-12T10:00:00")).nextReviewAt).toBe("2026-10-12");
    expect(nextReview(card, "good", new Date("2026-10-12T10:00:00")).nextReviewAt).toBe(addDays("2026-10-12", 3));
  });

  test("readiness and weighted grade calculation return transparent numbers", () => {
    expect(calculateReadiness(100, 80, 5, 10)).toBe(82);
    expect(requiredFinalScore(70, 85, 40)).toBe(107.5);
    expect(requiredFinalScore(70, 85, 0)).toBeNull();
  });
});
