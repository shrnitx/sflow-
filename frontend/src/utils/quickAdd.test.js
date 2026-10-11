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

  test("rejects empty input instead of creating an empty task", () => {
    expect(parseQuickEntry("   ").error).toBeTruthy();
  });
});
