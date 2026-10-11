import React, { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { parseQuickEntry, quickAddHelp } from "../utils/quickAdd";

function QuickAdd({ timetable, onAdd, onToast }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const knownSubjects = useMemo(
    () => timetable.map((item) => item.subject).filter(Boolean),
    [timetable]
  );

  const parse = () => {
    const result = parseQuickEntry(input, knownSubjects);
    if (result.error) {
      setError(result.error);
      setPreview(null);
      return;
    }
    setError("");
    setPreview(result);
  };

  const add = (event) => {
    event.preventDefault();
    const parsed = parseQuickEntry(input, knownSubjects);
    if (parsed.error) {
      setError(parsed.error);
      setPreview(null);
      return;
    }
    onAdd(parsed);
    setInput("");
    setPreview(null);
    setError("");
    onToast("Task added from Quick Add.");
  };

  return (
    <section className="panel quick-add-panel">
      <div className="quick-add-heading">
        <div className="quick-add-icon"><Sparkles size={19} /></div>
        <div>
          <span className="section-kicker">CAPTURE IN SECONDS</span>
          <h2>Quick Add</h2>
          <p>Describe your task naturally. StudyFlow will fill in the fields it can recognize.</p>
        </div>
      </div>
      <form className="quick-add-form" onSubmit={add}>
        <input
          aria-label="Describe a task"
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setError("");
            setPreview(null);
          }}
          placeholder="Biology assignment due Friday, high priority"
          maxLength={300}
        />
        <button type="button" className="ghost-button" onClick={parse} disabled={!input.trim()}>
          Preview
        </button>
        <button type="submit" className="primary-button" disabled={!input.trim()}>
          <ArrowRight size={16} /> Add task
        </button>
      </form>
      <p className="quick-add-help">{quickAddHelp()}</p>
      {error && <div className="timetable-import-error" role="alert">{error}</div>}
      {preview && (
        <div className="quick-add-preview">
          <div>
            <span>Task</span><strong>{preview.title}</strong>
          </div>
          <div>
            <span>Subject</span><strong>{preview.subject || "Not detected"}</strong>
          </div>
          <div>
            <span>Due date</span><strong>{preview.deadline || "Not detected"}</strong>
          </div>
          <div>
            <span>Priority</span><strong>{preview.priority}</strong>
          </div>
        </div>
      )}
      {preview && !preview.deadline && (
        <p className="quick-add-caution">No due date was detected. The task will be added without a deadline.</p>
      )}
    </section>
  );
}

export default QuickAdd;
