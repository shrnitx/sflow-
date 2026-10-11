import { parseQuickEntry } from "./quickAdd";

describe("parseQuickEntry", () => {
  test("detects a subject, weekday deadline, and priority", () => {
    const result = parseQuickEntry("Biology assignment due Friday, high priority");

    expect(result.error).toBeUndefined();
    expect(result.title).toMatch(/assignment/i);
    expect(result.subject).toBe("Biology");
    expect(result.priority).toBe("High");
    expect(result.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("keeps a simple task without a date usable", () => {
    const result = parseQuickEntry("Finish lab report");

    expect(result.error).toBeUndefined();
    expect(result.title).toMatch(/finish lab report/i);
    expect(result.deadline).toBe("");
  });

  test("moves a standalone relative date into the deadline field", () => {
    const result = parseQuickEntry("Finish lab report tomorrow");
    const expectedDate = new Date();
    expectedDate.setHours(0, 0, 0, 0);
    expectedDate.setDate(expectedDate.getDate() + 1);
    const expectedDeadline = [
      expectedDate.getFullYear(),
      String(expectedDate.getMonth() + 1).padStart(2, "0"),
      String(expectedDate.getDate()).padStart(2, "0"),
    ].join("-");

    expect(result.error).toBeUndefined();
    expect(result.title).toBe("Finish lab report");
    expect(result.deadline).toBe(expectedDeadline);
  });

  test("rejects empty input instead of creating an empty task", () => {
    expect(parseQuickEntry("   ").error).toBeTruthy();
  });
});
