import React from "react";
import {
  Check,
  Clock3,
  FileText,
  X,
} from "lucide-react";
import {
  formatTime,
  getTodayDate,
} from "../utils/timetable";

function ClassDetails({ classItem, tasks, onClose }) {
  if (!classItem) return null;

  const today = getTodayDate();

  const relatedTasks = tasks
    .filter(
      (task) =>
        task.subject?.toLowerCase() ===
          classItem.subject?.toLowerCase() &&
        task.deadline === today
    )
    .sort(
      (a, b) => Number(a.completed) - Number(b.completed)
    );

  return (
    <div
      className="class-details-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
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
            <span className="section-kicker">
              TODAY'S CLASS
            </span>

            <h2 id="class-details-title">
              {classItem.subject}
            </h2>

            <div className="class-time-line">
              <Clock3 size={16} />

              {formatTime(classItem.startTime)} –{" "}
              {formatTime(classItem.endTime)}
            </div>
          </div>

          <button
            type="button"
            className="dialog-close-button"
            onClick={onClose}
            aria-label="Close class details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="class-details-content">
          <div className="class-details-section">
            <div className="class-details-section-heading">
              <FileText size={17} />

              <h3>Today's Work</h3>
            </div>

            {relatedTasks.length === 0 ? (
              <div className="class-details-empty">
                No tasks added for this class today.
              </div>
            ) : (
              <div className="related-task-list">
                {relatedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`related-task ${
                      task.completed
                        ? "is-completed"
                        : ""
                    }`}
                  >
                    <div
                      className={`related-task-check ${
                        task.completed
                          ? "checked"
                          : ""
                      }`}
                    >
                      {task.completed && (
                        <Check size={14} />
                      )}
                    </div>

                    <div>
                      <strong>{task.title}</strong>

                      {task.description && (
                        <p>{task.description}</p>
                      )}

                      <span
                        className={`priority-pill ${
                          task.priority?.toLowerCase()
                        }`}
                      >
                        {task.priority}
                      </span>
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