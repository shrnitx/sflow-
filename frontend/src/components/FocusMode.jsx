import React, { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CheckCircle2, CirclePause, CirclePlay, RotateCcw, Timer } from "lucide-react";
import { makeId } from "../utils/storage";
import { WEEKDAYS, DAYS } from "../utils/timetable";

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function FocusMode({ userId, timetable, tasks, sessions, setSessions, onToast }) {
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [subject, setSubject] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const startedRef = useRef(false);
  const loggedRef = useRef(false);
  const startTimestampRef = useRef(null);

  const subjects = useMemo(() => {
    return [...new Set([
      ...timetable.map((item) => item.subject),
      ...tasks.filter((item) => item.type !== "exam").map((item) => item.subject),
    ].filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [timetable, tasks]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (remainingSeconds !== 0 || !startedRef.current || loggedRef.current) return;
    loggedRef.current = true;
    startedRef.current = false;
    const actualSeconds = Math.max(1, Number(durationMinutes) * 60);
    const now = new Date();
    const session = {
      id: makeId(),
      startedAt: startTimestampRef.current || now.toISOString(),
      finishedAt: now.toISOString(),
      durationMinutes: Math.max(1, Math.round(actualSeconds / 60)),
      durationSeconds: actualSeconds,
      subject: subject || "General study",
      localDate: dateKey(now),
    };
    setSessions((current) => [session, ...current].slice(0, 1000));
    onToast("Focus session complete. Your study time was saved.");
  }, [remainingSeconds, durationMinutes, subject, setSessions, onToast]);

  useEffect(() => {
    if (!running && !startedRef.current && remainingSeconds === 0) return;
    if (!running && remainingSeconds > 0 && !startedRef.current) {
      setRemainingSeconds(Number(durationMinutes) * 60);
    }
  }, [durationMinutes]); // changing the duration resets an idle timer

  const start = () => {
    if (remainingSeconds <= 0) {
      setRemainingSeconds(Number(durationMinutes) * 60);
      loggedRef.current = false;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      loggedRef.current = false;
      startTimestampRef.current = new Date().toISOString();
    }
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const reset = () => {
    setRunning(false);
    startedRef.current = false;
    loggedRef.current = false;
    startTimestampRef.current = null;
    setRemainingSeconds(Number(durationMinutes) * 60);
  };

  const totalSeconds = Number(durationMinutes) * 60;
  const elapsed = Math.max(0, totalSeconds - remainingSeconds);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const circumference = 2 * Math.PI * 78;
  const progress = totalSeconds ? elapsed / totalSeconds : 0;

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekSessions = sessions.filter((session) => {
    const started = new Date(session.startedAt);
    return !Number.isNaN(started.getTime()) && started >= weekStart;
  });
  const totalWeekMinutes = weekSessions.reduce(
    (sum, session) => sum + Number(session.durationMinutes || 0),
    0
  );
  const minutesBySubject = weekSessions.reduce((result, session) => {
    const label = session.subject || "General study";
    result[label] = (result[label] || 0) + Number(session.durationMinutes || 0);
    return result;
  }, {});
  const maxSubjectMinutes = Math.max(1, ...Object.values(minutesBySubject));

  return (
    <div className="focus-page">
      <section className="panel focus-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">DEEP WORK</span>
            <h2>Focus mode</h2>
          </div>
          <div className="focus-heading-icon"><Timer size={22} /></div>
        </div>
        <p className="focus-description">
          Choose a subject, start a session, and keep your attention in one place.
        </p>
        <div className="focus-controls">
          <div className="field">
            <label htmlFor="focus-subject">Study subject</label>
            <select id="focus-subject" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={running}>
              <option value="">General study</option>
              {subjects.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="focus-duration">Session length</label>
            <select
              id="focus-duration"
              value={durationMinutes}
              disabled={running || startedRef.current}
              onChange={(event) => {
                const nextDuration = Number(event.target.value);
                setDurationMinutes(nextDuration);
                setRemainingSeconds(nextDuration * 60);
              }}
            >
              <option value={25}>25 minutes</option>
              <option value={40}>40 minutes</option>
              <option value={50}>50 minutes</option>
            </select>
          </div>
        </div>

        <div className="focus-timer-layout">
          <div className="focus-clock" aria-live="off">
            <svg viewBox="0 0 180 180" role="img" aria-label={minutes + " minutes " + seconds + " seconds remaining"}>
              <circle cx="90" cy="90" r="78" className="focus-clock-track" />
              <circle
                cx="90"
                cy="90"
                r="78"
                className="focus-clock-progress"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <div className="focus-clock-time">
              <strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>
              <span>{running ? "Stay focused" : remainingSeconds === 0 ? "Session complete" : startedRef.current ? "Paused" : "Ready when you are"}</span>
            </div>
          </div>
          <div className="focus-actions">
            {running ? (
              <button type="button" className="primary-button" onClick={pause}>
                <CirclePause size={18} /> Pause session
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={start}>
                <CirclePlay size={18} /> {startedRef.current ? "Resume session" : remainingSeconds === 0 ? "Start again" : "Start focus"}
              </button>
            )}
            <button type="button" className="ghost-button" onClick={reset} disabled={!startedRef.current && !running && remainingSeconds === totalSeconds}>
              <RotateCcw size={16} /> Reset timer
            </button>
            {remainingSeconds === 0 && (
              <div className="focus-complete-note"><CheckCircle2 size={17} /> Session saved to your study history.</div>
            )}
          </div>
        </div>
      </section>

      <section className="panel focus-analytics-panel">
        <div className="panel-heading">
          <div>
            <span className="section-kicker">THIS WEEK</span>
            <h2>Study analytics</h2>
          </div>
          <BarChart3 size={22} />
        </div>
        <div className="focus-week-summary">
          <div>
            <strong>{Math.floor(totalWeekMinutes / 60)}h {totalWeekMinutes % 60}m</strong>
            <span>Focused study time</span>
          </div>
          <div>
            <strong>{weekSessions.length}</strong>
            <span>Completed sessions</span>
          </div>
        </div>
        {Object.keys(minutesBySubject).length === 0 ? (
          <div className="focus-empty-analytics">Your subject breakdown will appear after your first completed focus session.</div>
        ) : (
          <div className="focus-subject-bars">
            {Object.entries(minutesBySubject).sort((a, b) => b[1] - a[1]).map(([label, value]) => (
              <div key={label} className="focus-subject-row">
                <div className="focus-subject-label"><span>{label}</span><strong>{value} min</strong></div>
                <div className="focus-subject-track"><div style={{ width: (value / maxSubjectMinutes * 100) + "%" }} /></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel focus-history-panel">
        <div className="panel-heading">
          <div><span className="section-kicker">RECENT WORK</span><h2>Session history</h2></div>
        </div>
        {sessions.length === 0 ? (
          <div className="focus-empty-analytics">No completed sessions yet.</div>
        ) : (
          <div className="focus-session-history">
            {sessions.slice(0, 10).map((session) => (
              <div key={session.id} className="focus-session-item">
                <div><strong>{session.subject || "General study"}</strong><span>{new Date(session.startedAt).toLocaleString()}</span></div>
                <strong>{session.durationMinutes} min</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default FocusMode;
