import { mergeCloudState, sameCloudState } from "./cloudStateMerge";

describe("cross-device cloud-state merge", () => {
  test("merges independent setting edits", () => {
    const base = { coverage: { biology: 20, chemistry: 30 }, grades: { average: 70 } };
    const local = { coverage: { biology: 45, chemistry: 30 }, grades: { average: 70 } };
    const remote = { coverage: { biology: 20, chemistry: 55 }, grades: { average: 78 } };
    expect(mergeCloudState(base, local, remote)).toEqual({
      coverage: { biology: 45, chemistry: 55 }, grades: { average: 78 }
    });
  });

  test("merges id-based arrays and non-conflicting edits", () => {
    const base = { cards: [{ id: "a", question: "Old", answer: "Old" }] };
    const local = { cards: [
      { id: "a", question: "Old", answer: "Local" },
      { id: "b", question: "Local-only", answer: "B" }
    ] };
    const remote = { cards: [
      { id: "a", question: "Remote", answer: "Old" },
      { id: "c", question: "Remote-only", answer: "C" }
    ] };
    expect(mergeCloudState(base, local, remote)).toEqual({ cards: [
      { id: "a", question: "Remote", answer: "Local" },
      { id: "b", question: "Local-only", answer: "B" },
      { id: "c", question: "Remote-only", answer: "C" }
    ] });
  });

  test("accepts untouched remote deletes but preserves unsynced local edits", () => {
    const base = { cards: [
      { id: "keep", answer: "A" }, { id: "delete", answer: "B" }, { id: "edit", answer: "Old" }
    ] };
    const local = { cards: [
      { id: "keep", answer: "A" }, { id: "delete", answer: "B" }, { id: "edit", answer: "Local" }
    ] };
    const remote = { cards: [{ id: "keep", answer: "A" }, { id: "edit", answer: "Old" }] };
    expect(mergeCloudState(base, local, remote).cards).toEqual([
      { id: "keep", answer: "A" }, { id: "edit", answer: "Local" }
    ]);
  });

  test("preserves remote edits that conflict with a local delete", () => {
    const base = { cards: [{ id: "a", answer: "Old" }] };
    const local = { cards: [] };
    const remote = { cards: [{ id: "a", answer: "Edited remotely" }] };
    expect(mergeCloudState(base, local, remote).cards).toEqual([{ id: "a", answer: "Edited remotely" }]);
  });

  test("compares equivalent object data regardless of key order", () => {
    expect(sameCloudState(
      { cards: [{ id: "a", nested: { x: 1, y: 2 } }] },
      { cards: [{ nested: { y: 2, x: 1 }, id: "a" }] }
    )).toBe(true);
  });
});
