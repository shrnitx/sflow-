import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Clock3, ListChecks, Star, Target } from "lucide-react";

import "./StudyFlowHeroAnimation.css";

const POP_EASE = [0.175, 0.885, 0.32, 1.275];
const SOFT_EASE = [0.22, 1, 0.36, 1];

function StudyFlowHeroAnimation() {
  const reduceMotion = useReducedMotion() === true;

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
    <div className="studyflow-hero-animation" aria-hidden="true">
      <div className="sf-hero-scene">
        <div className="sf-hero-aura" />

        <motion.div
          className="sf-planner"
          initial={reduceMotion ? { opacity: 0, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0.16 : 0.8,
            ease: reduceMotion ? "easeOut" : POP_EASE,
          }}
        >
          <div className="sf-planner-pages">
            <div className="sf-agenda-heading">
              <div className="sf-agenda-title-group">
                <span className="sf-agenda-eyebrow">STUDYFLOW</span>
                <strong>Today's agenda</strong>
              </div>
              <span className="sf-agenda-label">DAILY PLAN</span>
            </div>

            <div className="sf-agenda-rule" />

            <div className="sf-agenda-task sf-agenda-task-first">
              <motion.span
                className="sf-task-check"
                initial={reduceMotion ? { backgroundColor: "#10B981", borderColor: "#10B981" } : { backgroundColor: "#FFFFFF", borderColor: "#D7DCE7" }}
                animate={{ backgroundColor: "#10B981", borderColor: "#10B981" }}
                transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : 1.91, ease: "easeOut" }}
              >
                <svg className="sf-check-mark" viewBox="0 0 20 20" fill="none">
                  <motion.path
                    d="M4.5 10.2 8.2 13.8 15.7 6.3"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: reduceMotion ? 1 : 0, opacity: reduceMotion ? 1 : 0.4 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : 1.98, ease: "easeOut" }}
                  />
                </svg>
                <span className="sf-sparkle sf-sparkle-one" />
                <span className="sf-sparkle sf-sparkle-two" />
                <span className="sf-sparkle sf-sparkle-three" />
                <span className="sf-sparkle sf-sparkle-four" />
              </motion.span>

              <span className="sf-agenda-task-copy">
                <span className="sf-agenda-task-title">Review lecture notes</span>
                <span className="sf-agenda-task-meta"><Clock3 size={10} /> 25 min focus</span>
              </span>
              <span className="sf-task-priority sf-task-priority-mint" />
            </div>

            <div className="sf-agenda-task">
              <span className="sf-task-check sf-task-check-pending" />
              <span className="sf-agenda-task-copy">
                <span className="sf-agenda-task-title">Practice 10 questions</span>
                <span className="sf-agenda-task-meta"><Clock3 size={10} /> 30 min focus</span>
              </span>
              <span className="sf-task-priority sf-task-priority-indigo" />
            </div>

            <div className="sf-agenda-task">
              <span className="sf-task-check sf-task-check-pending" />
              <span className="sf-agenda-task-copy">
                <span className="sf-agenda-task-title">Read next chapter</span>
                <span className="sf-agenda-task-meta"><Clock3 size={10} /> 20 min focus</span>
              </span>
              <span className="sf-task-priority sf-task-priority-amber" />
            </div>
          </div>

          <motion.div
            className="sf-planner-cover"
            style={{ transformOrigin: "top center" }}
            initial={reduceMotion ? { rotateX: -104, opacity: 0.02 } : { rotateX: 0, opacity: 1 }}
            animate={{ rotateX: -104, opacity: 0.02 }}
            transition={{ duration: reduceMotion ? 0 : 0.52, delay: reduceMotion ? 0 : 0.78, ease: SOFT_EASE }}
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
            <span className="sf-floating-label"><strong>3</strong> tasks</span>
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
            <span className="sf-progress-ring"><span>66%</span></span>
            <span className="sf-progress-copy"><strong>On track</strong><small>Keep going</small></span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default StudyFlowHeroAnimation;
