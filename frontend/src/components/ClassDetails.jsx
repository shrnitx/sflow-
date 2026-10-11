import React from "react";
import {
  Check,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  UserRound,
  X,
} from "lucide-react";
import { formatTime } from "../utils/timetable";

function displayDate(value) {
  if (!value) return "No deadline";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function ClassDetails({ classItem, tasks, onClose }) {
  if (!classItem) return null;

  const courseCode = String(classItem.courseCode || "").trim().toLowerCase();
  const subject = String(classItem.subject || "").trim().toLowerCase();
  const relatedTasks = tasks
    .filter((task) => {
      if (task.type === "exam" || task.category === "exam") return false;
      const taskSubject = String(task.subject || "").trim().toLowerCase();
      return (
        task.classId === classItem.id ||
        (taskSubject && (taskSubject === subject || (courseCode && taskSubject === courseCode)))
      );
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      return String(a.deadline || "9999-12-31").localeCompare(String(b.deadline || "9999-12-31"));
    });
  const meetingUrl = safeUrl(classItem.meetingUrl);

  return (
    <div
      className="class-details-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="class-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-details-title"
      >
        <div className="class-details-header">
          <div>
            <span className="section-kicker">CLASS DETAILS</span>
            <h2 id="class-details-title">{classItem.subject}</h2>
            {classItem.courseCode && classItem.courseCode.toLowerCase() !== String(classItem.subject || "").toLowerCase() && <span className="class-details-course-code">{classItem.courseCode}</span>}
            <div className="class-time-line">
              <Clock3 size={16} />
              {formatTime(classItem.startTime)} – {formatTime(classItem.endTime)}
            </div>
          </div>
          <button type="button" className="dialog-close-button" onClick={onClose} aria-label="Close class details">
            <X size={18} />
          </button>
        </div>

        <div className="class-details-content">
          {(classItem.instructor || classItem.room || classItem.notes || meetingUrl) && (
            <section className="class-profile-details">
              {classItem.instructor && (
                <div className="class-profile-detail"><UserRound size={17} /><div><span>Faculty</span><strong>{classItem.instructor}</strong></div></div>
              )}
              {(classItem.room || classItem.location) && (
                <div className="class-profile-detail"><MapPin size={17} /><div><span>Room / venue</span><strong>{classItem.room || classItem.location}</strong></div></div>
              )}
              {classItem.notes && <p className="class-profile-notes">{classItem.notes}</p>}
              {meetingUrl && (
                <a className="class-profile-meeting-link" href={meetingUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Join online class
                </a>
              )}
            </section>
          )}

          <div className="class-details-section">
            <div className="class-details-section-heading">
              <FileText size={17} />
              <h3>Related work</h3>
              <span className="class-details-task-count">{relatedTasks.length}</span>
            </div>

            {relatedTasks.length === 0 ? (
              <div className="class-details-empty">
                No tasks linked to this class yet. Create a task with the same subject or link it to this class.
              </div>
            ) : (
              <div className="related-task-list">
                {relatedTasks.map((task) => (
                  <div key={task.id} className={"related-task " + (task.completed ? "is-completed" : "")}>
                    <div className={"related-task-check " + (task.completed ? "checked" : "")}>
                      {task.completed && <Check size={14} />}
                    </div>
                    <div>
                      <strong>{task.title}</strong>
                      {task.description && <p>{task.description}</p>}
                      <div className="related-task-meta">
                        <span>{displayDate(task.deadline)}</span>
                        <span className={"priority-pill " + String(task.priority || "Medium").toLowerCase()}>{task.priority || "Medium"}</span>
                        {task.completed && <span className="completed-text">Completed</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClassDetails;
