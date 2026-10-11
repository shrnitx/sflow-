import React, { useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  Eye,
  FileUp,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  DAYS,
  WEEKDAYS,
  formatTime,
  sortClassesByTime,
  timeToMinutes,
} from "../utils/timetable";
import { makeId } from "../utils/storage";
import { downloadIcs, exportStudyFlowCalendar, parseStudyFlowCalendar } from "../utils/calendar";
import TimetableScreenshotImport from "./TimetableScreenshotImport";

const EMPTY_FORM = {
  subject: "",
  day: "1",
  startTime: "09:00",
  endTime: "10:00",
  courseCode: "",
  instructor: "",
  room: "",
  notes: "",
  meetingUrl: "",
};

function Timetable({ timetable, setTimetable, setToast, tasks = [], onImportTasks = () => {}, onSelectClass = () => {} }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const calendarInputRef = useRef(null);

  const groupedDays = useMemo(() => {
    return WEEKDAYS.map((dayIndex) => ({
      day: DAYS[dayIndex],
      dayIndex,
      classes: sortClassesByTime(
        timetable.filter((item) => item.day === dayIndex)
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

    const day = Number(form.day);

    if (!Number.isInteger(day) || day < 0 || day > 6) {
      setError("Please choose a valid day.");
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
                day,
                startTime: form.startTime,
                endTime: form.endTime,
                courseCode: form.courseCode.trim(),
                instructor: form.instructor.trim(),
                room: form.room.trim(),
                notes: form.notes.trim(),
                meetingUrl: form.meetingUrl.trim(),
              }
            : item
        )
      );

      setToast("Class updated successfully.");
    } else {
      const newClass = {
        id: makeId(),
        subject: form.subject.trim(),
        day,
        startTime: form.startTime,
        endTime: form.endTime,
        courseCode: form.courseCode.trim(),
        instructor: form.instructor.trim(),
        room: form.room.trim(),
        notes: form.notes.trim(),
        meetingUrl: form.meetingUrl.trim(),
        recurring: true,
        createdAt: new Date().toISOString(),
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
      courseCode: item.courseCode || "",
      instructor: item.instructor || "",
      room: item.room || item.location || "",
      notes: item.notes || "",
      meetingUrl: item.meetingUrl || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const importScreenshotEntries = (entries, replaceExisting) => {
    const imported = entries.map((entry) => ({
      ...entry,
      id: makeId(),
      recurring: true,
      createdAt: new Date().toISOString(),
    }));

    if (replaceExisting) {
      setTimetable(imported);
      setToast(`Imported ${imported.length} classes and replaced the current timetable.`);
      return;
    }

    const currentKeys = new Set(
      timetable.map((item) =>
        [
          item.day,
          item.startTime,
          item.endTime,
          item.subject.trim().toLowerCase(),
        ].join("|")
      )
    );
    const freshEntries = imported.filter((item) => {
      const key = [
        item.day,
        item.startTime,
        item.endTime,
        item.subject.trim().toLowerCase(),
      ].join("|");
      if (currentKeys.has(key)) return false;
      currentKeys.add(key);
      return true;
    });

    setTimetable((current) => [...current, ...freshEntries]);
    setToast(
      freshEntries.length
        ? `Imported ${freshEntries.length} classes. Exact duplicates were skipped.`
        : "All detected classes already exist in your timetable."
    );
  };

  const importCalendarFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setToast("Calendar file is too large. Choose a file smaller than 4 MB.");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseStudyFlowCalendar(text);
      const importedClasses = parsed.timetable
        .filter((item) => item.subject && item.startTime && item.endTime)
        .map((item) => ({ ...item, id: makeId(), recurring: true, createdAt: new Date().toISOString() }));
      const existingKeys = new Set(timetable.map((item) => [
        item.day, item.startTime, item.endTime, String(item.subject || "").toLowerCase()
      ].join("|")));
      const freshClasses = importedClasses.filter((item) => {
        const key = [item.day, item.startTime, item.endTime, item.subject.toLowerCase()].join("|");
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      });

      if (freshClasses.length) {
        setTimetable((current) => [...current, ...freshClasses]);
      }

      const existingTaskKeys = new Set(
        tasks.map((item) => [
          String(item.type || "task").toLowerCase(),
          String(item.title || "").trim().toLowerCase(),
          String(item.deadline || ""),
        ].join("|"))
      );
      const importedTasks = parsed.tasks
        .filter((item) => {
          const key = [
            String(item.type || "task").toLowerCase(),
            String(item.title || "").trim().toLowerCase(),
            String(item.deadline || ""),
          ].join("|");
          if (existingTaskKeys.has(key)) return false;
          existingTaskKeys.add(key);
          return true;
        })
        .map((item) => ({ ...item, id: makeId() }));
      if (importedTasks.length) onImportTasks(importedTasks);

      const summary = [];
      if (freshClasses.length) summary.push(freshClasses.length + " class(es)");
      if (importedTasks.length) summary.push(importedTasks.length + " new task/exam reminder(s)");
      const errorCount = parsed.errors.length;
      setToast(
        summary.length
          ? "Imported " + summary.join(" and ") + (errorCount ? ". " + errorCount + " event(s) were skipped." : ".")
          : "No supported calendar entries were found. Use a standard .ics file."
      );
    } catch (caughtError) {
      console.error("StudyFlow calendar import failed:", caughtError);
      setToast("Could not read that calendar file. Try exporting a standard .ics calendar.");
    }
  };

  const exportCalendar = () => {
    try {
      const content = exportStudyFlowCalendar({ timetable, tasks });
      downloadIcs("studyflow-calendar.ics", content);
      setToast("Calendar export downloaded.");
    } catch (caughtError) {
      console.error("StudyFlow calendar export failed:", caughtError);
      setToast("Could not export the calendar. Please try again.");
    }
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
      <div className="panel-heading timetable-panel-heading">
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
        <div className="timetable-calendar-actions">
          <input
            ref={calendarInputRef}
            className="timetable-file-input"
            type="file"
            accept=".ics,text/calendar"
            onChange={importCalendarFile}
            aria-label="Import calendar file"
          />
          <button type="button" className="ghost-button" onClick={() => calendarInputRef.current?.click()}>
            <FileUp size={16} /> Import .ics
          </button>
          <button type="button" className="ghost-button" onClick={exportCalendar}>
            <Download size={16} /> Export calendar
          </button>
        </div>
      </div>

      <TimetableScreenshotImport
        existingCount={timetable.length}
        onImport={importScreenshotEntries}
      />

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
            {WEEKDAYS.map((dayIndex) => (
              <option key={dayIndex} value={dayIndex}>
                {DAYS[dayIndex]}
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

        <div className="field">
          <label htmlFor="timetable-course-code">Course code <span>(optional)</span></label>
          <input id="timetable-course-code" value={form.courseCode} maxLength={40}
            onChange={(event) => setForm((current) => ({ ...current, courseCode: event.target.value }))}
            placeholder="e.g. BTF123" />
        </div>

        <div className="field">
          <label htmlFor="timetable-instructor">Faculty <span>(optional)</span></label>
          <input id="timetable-instructor" value={form.instructor} maxLength={100}
            onChange={(event) => setForm((current) => ({ ...current, instructor: event.target.value }))}
            placeholder="Instructor name" />
        </div>

        <div className="field">
          <label htmlFor="timetable-room">Room / venue <span>(optional)</span></label>
          <input id="timetable-room" value={form.room} maxLength={80}
            onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))}
            placeholder="e.g. LT-23" />
        </div>

        <div className="field">
          <label htmlFor="timetable-meeting-url">Online meeting link <span>(optional)</span></label>
          <input id="timetable-meeting-url" type="url" value={form.meetingUrl} maxLength={500}
            onChange={(event) => setForm((current) => ({ ...current, meetingUrl: event.target.value }))}
            placeholder="https://..." />
        </div>

        <div className="field full">
          <label htmlFor="timetable-notes">Notes / materials <span>(optional)</span></label>
          <textarea id="timetable-notes" rows={2} value={form.notes} maxLength={1000}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Room details, class notes, or material links" />
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
                          {item.courseCode && item.courseCode.toLowerCase() !== item.subject.toLowerCase() ? item.courseCode + " · " : ""}{item.subject}
                        </strong>
                        <span>
                          {item.instructor || item.room
                            ? [item.instructor, item.room || item.location].filter(Boolean).join(" · ")
                            : "Every " + day}
                        </span>
                        {item.meetingUrl && (
                          <a className="timetable-meeting-link" href={item.meetingUrl} target="_blank" rel="noreferrer">
                            Join online class
                          </a>
                        )}
                        {item.notes && <small className="timetable-entry-notes">{item.notes}</small>}
                      </div>

                      <div className="timetable-entry-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onSelectClass(item)}
                          aria-label={`View details for ${item.subject}`}
                          title="View class details"
                        >
                          <Eye size={15} />
                        </button>
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