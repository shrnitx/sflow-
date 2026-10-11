import React, { useRef, useState } from "react";
import { Check, FileImage, LoaderCircle, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { DAYS } from "../utils/timetable";
import { recognizeTimetableScreenshot } from "../utils/timetableImageParser";

export default function TimetableScreenshotImport({
  existingCount,
  onImport,
}) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [entries, setEntries] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [mode, setMode] = useState("merge");

  const updateEntry = (id, field, value) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.draftId === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const processFile = async (file) => {
    if (!file) return;

    setFileName(file.name);
    setEntries([]);
    setError("");
    setProgress(0);
    setStatus("Preparing image reader");
    setReading(true);

    try {
      const extracted = await recognizeTimetableScreenshot(file, (nextProgress, nextStatus) => {
        setProgress(nextProgress);
        setStatus(nextStatus);
      });

      setEntries(
        extracted.map((entry, index) => ({
          ...entry,
          draftId: index,
        }))
      );
      setStatus("Review the detected classes before importing.");
    } catch (caughtError) {
      setError(caughtError?.message || "Could not read this timetable screenshot.");
      setStatus("");
    } finally {
      setReading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    // Permit selecting the same file again after correcting the screenshot.
    event.target.value = "";
    if (file) processFile(file);
  };

  const removeEntry = (draftId) => {
    setEntries((current) => current.filter((entry) => entry.draftId !== draftId));
  };

  const importEntries = () => {
    const validEntries = entries.filter((entry) =>
      entry.subject.trim() &&
      Number.isInteger(Number(entry.day)) &&
      Number(entry.day) >= 0 &&
      Number(entry.day) <= 6 &&
      /^\d{2}:\d{2}$/.test(entry.startTime) &&
      /^\d{2}:\d{2}$/.test(entry.endTime) &&
      entry.endTime > entry.startTime
    );

    if (!validEntries.length) {
      setError("There are no valid classes to import. Check the subject names and times.");
      return;
    }

    if (mode === "replace" && existingCount > 0) {
      const confirmed = window.confirm(
        "Replace all " + existingCount + " current timetable entr(y/ies) with " +
        validEntries.length + " detected class(es)? This cannot be undone."
      );
      if (!confirmed) return;
    }

    onImport(
      validEntries.map(({ draftId, ...entry }) => ({
        ...entry,
        day: Number(entry.day),
        subject: entry.subject.trim(),
      })),
      mode === "replace"
    );

    setEntries([]);
    setFileName("");
    setStatus("");
    setProgress(0);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="timetable-import">
      <div className="timetable-import-heading">
        <div className="timetable-import-icon">
          <FileImage size={19} />
        </div>
        <div>
          <h3>Import from screenshot</h3>
          <p>Upload your class timetable. StudyFlow reads it in your browser and prepares editable entries.</p>
        </div>
      </div>

      <div className="timetable-import-controls">
        <input
          ref={inputRef}
          id="timetable-screenshot"
          className="timetable-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          disabled={reading}
        />
        <label className="ghost-button timetable-upload-button" htmlFor="timetable-screenshot">
          <Upload size={16} />
          {reading ? "Reading screenshot..." : "Choose screenshot"}
        </label>
        {fileName && <span className="timetable-file-name">{fileName}</span>}
      </div>

      {reading && (
        <div className="timetable-ocr-progress" role="status" aria-live="polite">
          <div className="timetable-ocr-progress-label">
            <LoaderCircle size={16} className="timetable-spinner" />
            <span>{status || "Reading timetable..."}</span>
            <strong>{progress}%</strong>
          </div>
          <div className="timetable-ocr-progress-track">
            <div style={{ width: progress + "%" }} />
          </div>
        </div>
      )}

      {error && <div className="timetable-import-error" role="alert">{error}</div>}

      {entries.length > 0 && !reading && (
        <div className="timetable-import-review">
          <div className="timetable-import-review-heading">
            <div>
              <strong>{entries.length} classes detected</strong>
              <p>Correct any OCR mistakes below, then import.</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                setEntries([]);
                setFileName("");
                setStatus("");
              }}
              aria-label="Clear detected classes"
              title="Clear"
            >
              <X size={16} />
            </button>
          </div>

          <div className="timetable-import-mode">
            <label>
              <input
                type="radio"
                name="timetable-import-mode"
                value="merge"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              Add to current timetable
            </label>
            <label>
              <input
                type="radio"
                name="timetable-import-mode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              Replace current timetable
            </label>
          </div>

          <div className="timetable-import-rows">
            {entries.map((entry) => (
              <div className="timetable-import-row" key={entry.draftId}>
                <div className="field timetable-import-subject">
                  <label htmlFor={"import-subject-" + entry.draftId}>Subject</label>
                  <input
                    id={"import-subject-" + entry.draftId}
                    value={entry.subject}
                    onChange={(event) => updateEntry(entry.draftId, "subject", event.target.value)}
                    maxLength={100}
                  />
                </div>
                <div className="field">
                  <label htmlFor={"import-day-" + entry.draftId}>Day</label>
                  <select
                    id={"import-day-" + entry.draftId}
                    value={entry.day}
                    onChange={(event) => updateEntry(entry.draftId, "day", Number(event.target.value))}
                  >
                    {DAYS.map((day, index) => (
                      <option key={day} value={index}>{day}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={"import-start-" + entry.draftId}>Start</label>
                  <input
                    id={"import-start-" + entry.draftId}
                    type="time"
                    value={entry.startTime}
                    onChange={(event) => updateEntry(entry.draftId, "startTime", event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={"import-end-" + entry.draftId}>End</label>
                  <input
                    id={"import-end-" + entry.draftId}
                    type="time"
                    value={entry.endTime}
                    onChange={(event) => updateEntry(entry.draftId, "endTime", event.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="icon-button danger timetable-import-remove"
                  onClick={() => removeEntry(entry.draftId)}
                  aria-label={"Remove " + entry.subject}
                  title="Remove this detected class"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <div className="timetable-import-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setEntries([]);
                setFileName("");
                setStatus("");
                setError("");
              }}
            >
              <RotateCcw size={15} />
              Start over
            </button>
            <button type="button" className="primary-button" onClick={importEntries}>
              <Check size={16} />
              Import {entries.length} classes
            </button>
          </div>
        </div>
      )}

      <p className="timetable-import-privacy">
        Screenshot text is processed locally in your browser. Use a clear, full timetable image with weekday and time headings.
      </p>
    </div>
  );
}
