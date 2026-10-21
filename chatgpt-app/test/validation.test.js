import test from "node:test";
import assert from "node:assert/strict";
import { isIsoDate, normalizeTaskRow, normalizeTimetableRow } from "../validation.js";

test("accepts real ISO calendar dates", () => {
  assert.equal(isIsoDate("2026-10-21"), true);
  assert.equal(isIsoDate("2024-02-29"), true);
});

test("rejects malformed and impossible dates", () => {
  for (const value of ["21-10-2026", "2026-2-01", "2026-02-29", "2026-13-01", "", 20261021]) {
    assert.equal(isIsoDate(value), false, String(value));
  }
});

test("normalizes task rows using database record_id as identity", () => {
  const task = normalizeTaskRow({
    record_id: "task-1",
    data: { id: "spoofed-id", title: "Revise physics", completed: true, subject: "Physics" },
  });
  assert.equal(task.id, "task-1");
  assert.equal(task.title, "Revise physics");
  assert.equal(task.completed, true);
  assert.equal(normalizeTaskRow({ record_id: "task-2", data: { title: 3 } }), null);
  assert.equal(normalizeTaskRow({ record_id: "task-3", data: [] }), null);
});

test("rejects invalid timetable rows", () => {
  assert.equal(normalizeTimetableRow({
    record_id: "class-1",
    data: { subject: "Maths", day: 1, startTime: "09:00", endTime: "10:00" },
  }).id, "class-1");
  assert.equal(normalizeTimetableRow({
    record_id: "class-2",
    data: { subject: "Maths", day: 8, startTime: "09:00", endTime: "10:00" },
  }), null);
});
