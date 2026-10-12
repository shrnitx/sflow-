import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Clock3, ListChecks, Star, Target } from "lucide-react";

import "./StudyFlowHeroAnimation.css";

const POP_EASE = [0.175, 0.885, 0.32, 1.275];
const SOFT_EASE = [0.22, 1, 0.36, 1];

function getActivityTime(task) {
  const candidate = task.updatedAt || task.completedAt || task.createdAt;
  if (!candidate) return 0;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function StudyFlowHeroAnimation({ tasks = [] }) {
  const reduceMotion = useReducedMotion() === true;
  const sourceTasks = Array.isArray(tasks)
    ? tasks.filter((task) => task && typeof task.title === "string")
    : [];
  const recentTasks = sourceTasks
    .slice()
    .sort((a, b) => getActivityTime(b) - getActivityTime(a))
    .slice(0, 3);
  const completedCount = sourceTasks.filter((task) => Boolean(task.completed)).length;
  const totalCount = sourceTasks.length;
  const progressPercent = totalCount
    ? Math.round((completedCount / totalCount) * 100)
    : 0;
  const progressAngle = progressPercent * 3.6;
  const hasTasks = totalCount > 0;
  const taskSummary = recentTasks.map((task) => task.title).join(", ");
  const illustrationLabel = hasTasks
    ? "StudyFlow recent work. " + completedCount + " of " + totalCount +
      " tasks completed. Recent tasks: " + taskSummary
    : "StudyFlow planner illustration. No tasks yet. Add a task to begin tracking progress.";

  const floatInitial = (x, y) =>
    reduceMotion
      ? { opacity: 1, x: 0, y: 0, scale: 1 }
      : { opacity: 0, x, y, scale: 0.86 };

  const floatTransition = (delay) => ({
    duration: reduceMotion ? 0 : 0.48,
    delay: reduceMotion ? 0 : delay,
    ease: SOFT_EASE,
  });

  return (
    <div className="studyflow-hero-animation" role="img" aria-label={illustrationLabel}>
      <div className="sf-hero-scene">
        <div className="sf-hero-aura" />

        <motion.div
          className="sf-planner"
          initial={reduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0.12 : 0.8,
            ease: reduceMotion ? "easeOut" : POP_EASE,
          }}
        >
          <div className="sf-planner-pages">
            <div className="sf-agenda-heading">
              <div className="sf-agenda-title-group">
                <span className="sf-agenda-eyebrow">STUDYFLOW</span>
                <strong>{hasTasks ? "Your recent work" : "Today's agenda"}</strong>
              </div>
              <span className="sf-agenda-label">
                {hasTasks ? "RECENT ACTIVITY" : "READY WHEN YOU ARE"}
              </span>
            </div>

            <div className="sf-agenda-rule" />

            {recentTasks.length > 0 ? recentTasks.map((task, index) => {
              const isCompleted = Boolean(task.completed);
              const completedTime = task.completedAt ? Date.parse(task.completedAt) : NaN;
              const recentlyCompleted =
                isCompleted &&
                Number.isFinite(completedTime) &&
                Date.now() - completedTime < 5000;
              const checkDelay = reduceMotion
                ? 0
                : recentlyCompleted
                  ? 0.08
                  : 1.88 + index * 0.12;
              const taskMeta = isCompleted
                ? "Completed"
                : (task.subject || (task.priority ? task.priority + " priority" : "In progress"));

              return (
                <div className="sf-agenda-task" key={task.id || task.title + index}>
                  <motion.span
                    className={"sf-task-check" + (isCompleted ? " sf-task-check-completed" : "")}
                  >
                    {isCompleted && (
                      <svg className="sf-check-mark" viewBox="0 0 20 20" fill="none">
                        <motion.path
                          d="M4.5 10.2 8.2 13.8 15.7 6.3"
                          stroke="#FFFFFF"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{
                            pathLength: reduceMotion ? 1 : 0,
                            opacity: reduceMotion ? 1 : 0.4,
                          }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.46,
                            delay: checkDelay,
                            ease: "easeOut",
                          }}
                        />
                      </svg>
                    )}
                    {isCompleted && !reduceMotion && (
                      <>
                        <motion.span
                          className="sf-sparkle sf-sparkle-one"
                          initial={{ opacity: 0, scale: 0.3, y: 3 }}
                          animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.2], y: [3, -1, -7] }}
                          transition={{ duration: 0.72, delay: recentlyCompleted ? 0.16 : 2.05 + index * 0.12, ease: "easeOut" }}
                        />
                        <motion.span
                          className="sf-sparkle sf-sparkle-two"
                          initial={{ opacity: 0, scale: 0.3, y: 3 }}
                          animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.2], y: [3, -1, -7] }}
                          transition={{ duration: 0.72, delay: recentlyCompleted ? 0.22 : 2.11 + index * 0.12, ease: "easeOut" }}
                        />
                        <motion.span
                          className="sf-sparkle sf-sparkle-three"
                          initial={{ opacity: 0, scale: 0.3, y: 3 }}
                          animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.2], y: [3, -1, -7] }}
                          transition={{ duration: 0.72, delay: recentlyCompleted ? 0.28 : 2.17 + index * 0.12, ease: "easeOut" }}
                        />
                      </>
                    )}
                  </motion.span>

                  <span className="sf-agenda-task-copy">
                    <span className="sf-agenda-task-title">{task.title}</span>
                    <span className="sf-agenda-task-meta">
                      <Clock3 size={10} /> {taskMeta}
                    </span>
                  </span>
                  <span className={
                    "sf-task-priority " +
                    (isCompleted ? "sf-task-priority-mint" :
                      task.priority === "High" ? "sf-task-priority-amber" :
                      "sf-task-priority-indigo")
                  } />
                </div>
              );
            }) : (
              <>
                <div className="sf-agenda-task">
                  <span className="sf-task-check sf-task-check-pending" />
                  <span className="sf-agenda-task-copy">
                    <span className="sf-agenda-task-title">Add your first task</span>
                    <span className="sf-agenda-task-meta">One small step to begin</span>
                  </span>
                  <span className="sf-task-priority sf-task-priority-amber" />
                </div>
                <div className="sf-agenda-skeleton">
                  <span className="sf-skeleton-check" />
                  <span className="sf-skeleton-lines"><i /><i /></span>
                </div>
                <div className="sf-agenda-skeleton">
                  <span className="sf-skeleton-check" />
                  <span className="sf-skeleton-lines"><i /><i /></span>
                </div>
              </>
            )}

            {hasTasks && recentTasks.length < 3 && Array.from({ length: 3 - recentTasks.length }).map((_, index) => (
              <div className="sf-agenda-skeleton" key={"empty-row-" + index}>
                <span className="sf-skeleton-check" />
                <span className="sf-skeleton-lines"><i /><i /></span>
              </div>
            ))}
          </div>

          <motion.div
            className="sf-planner-cover"
            style={{ transformOrigin: "top center" }}
            initial={reduceMotion ? { rotateX: -104, opacity: 0.02 } : { rotateX: 0, opacity: 1 }}
            animate={{ rotateX: -104, opacity: 0.02 }}
            transition={{
              duration: reduceMotion ? 0 : 0.52,
              delay: reduceMotion ? 0 : 0.78,
              ease: SOFT_EASE,
            }}
          >
            <span className="sf-cover-emblem"><BookOpen size={23} strokeWidth={1.8} /></span>
            <span className="sf-cover-title">STUDYFLOW</span>
            <span className="sf-cover-subtitle">A little progress, every day.</span>
            <span className="sf-cover-bottom-line" />
          </motion.div>
        </motion.div>

        <motion.div
          className="sf-floating-card sf-floating-checklist"
          initial={floatInitial(-8, 14)}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={floatTransition(0.82)}
        >
          <div className="sf-floating-inner sf-checklist-inner">
            <span className="sf-floating-icon sf-icon-indigo"><ListChecks size={17} /></span>
            <span className="sf-floating-label"><strong>{totalCount}</strong> tasks</span>
          </div>
        </motion.div>

        <motion.div
          className="sf-floating-card sf-floating-target"
          initial={floatInitial(8, 14)}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={floatTransition(0.97)}
        >
          <div className="sf-floating-inner sf-target-inner">
            <span className="sf-target-icon"><Target size={21} strokeWidth={2} /></span>
            <span className="sf-target-star"><Star size={10} fill="currentColor" /></span>
          </div>
        </motion.div>

        <motion.div
          className="sf-floating-card sf-floating-progress"
          initial={floatInitial(8, 14)}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          transition={floatTransition(1.12)}
        >
          <div className="sf-floating-inner sf-progress-inner">
            <span
              className="sf-progress-ring"
              style={{
                background: "conic-gradient(var(--green) 0deg " + progressAngle +
                  "deg, var(--line) " + progressAngle + "deg 360deg)",
              }}
            >
              <span>{progressPercent}%</span>
            </span>
            <span className="sf-progress-copy">
              <strong>{completedCount} done</strong>
              <small>{hasTasks ? "of " + totalCount + " tasks" : "Start with one"}</small>
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default StudyFlowHeroAnimation;
