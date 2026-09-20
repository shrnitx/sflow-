import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  DAYS,
  formatTime,
  timeToMinutes,
} from "../utils/timetable";
import { makeId } from "../utils/storage";

const EMPTY_FORM = {
  subject: "",
  day: "1",
  startTime: "09:00",
  endTime: "10:00",
};

function Timetable({ timetable, setTimetable, setToast }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");

  const groupedDays = useMemo(() => {
    return DAYS.map((day, dayIndex) => ({
      day,
      dayIndex,
      classes: timetable
        .filter((item) => item.day === dayIndex)
        .sort(
          (a, b) =>
            timeToMinutes(a.startTime) -
            timeToMinutes(b.startTime)
        ),
    }));
  }, [timetable]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!form.startTime || !form.endTime) {
      setError("Please choose start and end time.");
      return;
    }

    if (
      timeToMinutes(form.endTime) <=
      timeToMinutes(form.startTime)
    ) {
      setError("End time must be after start time.");
      return;
    }

    if (editingId) {
      setTimetable((current) =>
        current.map((item) =>
          item.id === editingId
            ? {
                ...item,
                subject: form.subject.trim(),
                day: Number(form.day),
                startTime: form.startTime,
                endTime: form.endTime,
              }
            : item
        )
      );

      setToast("Class updated successfully.");
    } else {
      const newClass = {
        id: makeId(),
        subject: form.subject.trim(),
        day: Number(form.day),
        startTime: form.startTime,
        endTime: form.endTime,
        recurring: true,
      };

      setTimetable((current) => [
        ...current,
        newClass,
      ]);

      setToast("Class added successfully.");
    }

    resetForm();
  };

  const startEdit = (item) => {
    setEditingId(item.id);

    setForm({
      subject: item.subject || "",
      day: String(item.day),
      startTime: item.startTime || "09:00",
      endTime: item.endTime || "10:00",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const deleteClass = (id) => {
    const item = timetable.find(
      (entry) => entry.id === id
    );

    if (!item) return;

    const confirmed = window.confirm(
      `Delete "${item.subject}" from the timetable?`
    );

    if (!confirmed) return;

    setTimetable((current) =>
      current.filter((entry) => entry.id !== id)
    );

    setToast("Class removed from timetable.");

    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <section className="panel timetable-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">
            WEEKLY SCHEDULE
          </span>

          <h2>
            {editingId
              ? "Edit class"
              : "Build your timetable"}
          </h2>
        </div>
      </div>

      <form
        className="timetable-form"
        onSubmit={handleSubmit}
      >
        <div className="field">
          <label htmlFor="timetable-subject">
            Subject
          </label>

          <input
            id="timetable-subject"
            value={form.subject}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                subject: event.target.value,
              }))
            }
            placeholder="e.g. Mathematics"
          />
        </div>

        <div className="field">
          <label htmlFor="timetable-day">
            Day
          </label>

          <select
            id="timetable-day"
            value={form.day}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                day: event.target.value,
              }))
            }
          >
            {DAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="timetable-start">
            Start time
          </label>

          <input
            id="timetable-start"
            type="time"
            value={form.startTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startTime: event.target.value,
              }))
            }
          />
        </div>

        <div className="field">
          <label htmlFor="timetable-end">
            End time
          </label>

          <input
            id="timetable-end"
            type="time"
            value={form.endTime}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                endTime: event.target.value,
              }))
            }
          />
        </div>

        {error && (
          <div className="field-error timetable-error">
            {error}
          </div>
        )}

        <div className="timetable-form-actions">
          {editingId && (
            <button
              type="button"
              className="ghost-button"
              onClick={resetForm}
            >
              <X size={16} />
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="primary-button"
          >
            {editingId ? (
              <>
                <Pencil size={17} />
                Save class
              </>
            ) : (
              <>
                <Plus size={17} />
                Add class
              </>
            )}
          </button>
        </div>
      </form>

      <div className="weekly-timetable">
        {groupedDays.map(
          ({ day, dayIndex, classes }) => (
            <div
              key={day}
              className="timetable-day"
            >
              <div className="timetable-day-heading">
                <div>
                  <CalendarDays size={17} />
                  <strong>{day}</strong>
                </div>

                <span>
                  {classes.length}{" "}
                  {classes.length === 1
                    ? "class"
                    : "classes"}
                </span>
              </div>

              {classes.length === 0 ? (
                <div className="timetable-day-empty">
                  No classes
                </div>
              ) : (
                <div className="timetable-day-list">
                  {classes.map((item) => (
                    <div
                      className="timetable-entry"
                      key={item.id}
                    >
                      <div className="timetable-entry-time">
                        {formatTime(item.startTime)}
                        <span>
                          {formatTime(item.endTime)}
                        </span>
                      </div>

                      <div className="timetable-entry-subject">
                        <strong>
                          {item.subject}
                        </strong>
                        <span>
                          Every {day}
                        </span>
                      </div>

                      <div className="timetable-entry-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            startEdit(item)
                          }
                          aria-label={`Edit ${item.subject}`}
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() =>
                            deleteClass(item.id)
                          }
                          aria-label={`Delete ${item.subject}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}

export default Timetable;