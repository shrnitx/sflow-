import {
  loadUserCloudBaseline,
  saveUserCloudBaseline,
} from "./storage";

describe("account-scoped cloud baseline", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("returns null until an account has a confirmed cloud baseline", () => {
    expect(loadUserCloudBaseline("user-1")).toBeNull();
  });

  test("stores and restores baseline records separately per user", () => {
    const first = {
      tasks: [{ id: "task-1", title: "Assignment", completed: false }],
      timetable: [{
        id: "class-1",
        subject: "Biology",
        day: 1,
        startTime: "09:00",
        endTime: "10:00",
      }],
      focusSessions: [{
        id: "focus-1",
        startedAt: "2026-10-11T12:00:00.000Z",
        durationMinutes: 25,
      }],
    };
    const second = { tasks: [], timetable: [], focusSessions: [] };

    saveUserCloudBaseline("user-1", first);
    saveUserCloudBaseline("user-2", second);

    expect(loadUserCloudBaseline("user-1")).toEqual(first);
    expect(loadUserCloudBaseline("user-2")).toEqual(second);
  });

  test("drops malformed records rather than trusting local JSON", () => {
    saveUserCloudBaseline("user-1", {
      tasks: [{ id: "good", title: "Valid" }, { id: "bad" }],
      timetable: [{ id: "bad-class", subject: "Invalid day", day: 9, startTime: "09:00", endTime: "10:00" }],
      focusSessions: [{ id: "invalid-focus", startedAt: "not-a-date", durationMinutes: 0 }],
    });

    expect(loadUserCloudBaseline("user-1")).toEqual({
      tasks: [{ id: "good", title: "Valid" }],
      timetable: [],
      focusSessions: [],
    });
  });
});
