import { buildDailyPlan, createAssistantReply, dateKey, durationFor, sortPending, studySessionDate } from "./studyFlowLogic";

function task(id, overrides = {}) {
  return { id, title: id, completed: false, priority: "Medium", deadline: "", ...overrides };
}

describe("StudyFlow planning logic", () => {
  test("sorts incomplete high-priority tasks before medium priority tasks and omits completed tasks", () => {
    const tasks = [
      task("medium sooner", { deadline: "2026-10-12" }),
      task("completed high", { priority: "High", completed: true }),
      task("high", { priority: "High", deadline: "2026-10-30" }),
      task("low", { priority: "Low" }),
    ];
    expect(sortPending(tasks).map((item) => item.id)).toEqual(["high", "medium sooner", "low"]);
  });

  test("uses reasonable default durations and clamps user estimates", () => {
    expect(durationFor(task("normal"))).toBe(30);
    expect(durationFor(task("high", { priority: "High" }))).toBe(45);
    expect(durationFor(task("custom", { estimatedMinutes: 240 }))).toBe(180);
    expect(durationFor(task("too short", { estimatedMinutes: 3 }))).toBe(15);
  });

  test("places study blocks around classes without overlapping them", () => {
    const now = new Date(2026, 9, 12, 8, 45, 0);
    const tasks = [task("read notes"), task("practice", { priority: "High" })];
    const timetable = [{ day: now.getDay(), subject: "Lecture", startTime: "09:00", endTime: "10:00" }];
    const plan = buildDailyPlan(tasks, timetable, now);
    expect(plan.length).toBe(2);
    expect(plan[0].start).toBeGreaterThanOrEqual(10 * 60);
    expect(plan.every((block) => !(block.start < 10 * 60 && block.end > 9 * 60))).toBe(true);
    expect(plan[1].start).toBeGreaterThan(plan[0].end);
  });

  test("does not invent tasks or schedule past the end of the day", () => {
    expect(buildDailyPlan([], [], new Date(2026, 9, 12, 9, 0, 0))).toEqual([]);
    expect(buildDailyPlan([task("too late")], [], new Date(2026, 9, 12, 21, 50, 0))).toEqual([]);
  });

  test("assistant uses saved exam and due revision data", () => {
    const now = new Date(2026, 9, 11, 12, 0, 0);
    const examDate = dateKey(new Date(2026, 9, 13, 12, 0, 0));
    const reply = createAssistantReply(
      "Help me with exam revision",
      [task("assignment")],
      [{ id: "exam1", title: "Physics mid-sem", subject: "Physics", date: examDate }],
      [{ id: "topic1", title: "Interference", subject: "Physics", completed: false, nextReviewAt: dateKey(now) }],
      [{ id: "session1", date: dateKey(now), durationMinutes: 25 }],
      now
    );
    expect(reply).toContain("Physics mid-sem");
    expect(reply).toContain("Interference");
  });

  test("assistant reports recorded focus time rather than fabricating study hours", () => {
    const now = new Date(2026, 9, 11, 12, 0, 0);
    const reply = createAssistantReply(
      "How is my study time today?",
      [task("finished", { completed: true })],
      [],
      [],
      [{ id: "s1", date: dateKey(now), durationMinutes: 25 }, { id: "s2", date: dateKey(now), durationMinutes: 15 }],
      now
    );
    expect(reply).toContain("40 minutes");
    expect(reply).toContain("2 session(s)");
  });
  test("normalizes focus sessions written by both timer versions", () => {
    expect(studySessionDate({ date: "2026-10-11" })).toBe("2026-10-11");
    expect(studySessionDate({ localDate: "2026-10-10" })).toBe("2026-10-10");
    const startedAt = new Date(2026, 9, 9, 12, 0, 0).toISOString();
    expect(studySessionDate({ startedAt })).toBe(dateKey(new Date(startedAt)));
    expect(studySessionDate({ id: "unknown-session" })).toBe("");
  });

});
