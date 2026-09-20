import React, { useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import {
  DAYS,
  formatTime,
  getTodayDay,
  timeToMinutes,
} from "../utils/timetable";

function TodayClasses({ timetable, onSelectClass }) {
  const todayDay = getTodayDay();

  const todayClasses = useMemo(() => {
    return timetable
      .filter((item) => item.day === todayDay)
      .sort(
        (a, b) =>
          timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
      );
  }, [timetable, todayDay]);

  const nextClass = useMemo(() => {
    const now = new Date();

    const currentMinutes =
      now.getHours() * 60 + now.getMinutes();

    return todayClasses.find(
      (item) => timeToMinutes(item.endTime) > currentMinutes
    );
  }, [todayClasses]);

  const currentTime = new Date();

  const currentMinutes =
    currentTime.getHours() * 60 + currentTime.getMinutes();

  const isClassLive = (item) => {
    const start = timeToMinutes(item.startTime);
    const end = timeToMinutes(item.endTime);

    return currentMinutes >= start && currentMinutes < end;
  };

  return (
    <section className="panel today-classes-panel">
      <div className="panel-heading today-heading">
        <div>
          <span className="section-kicker">YOUR SCHEDULE</span>
          <h2>Today's Classes</h2>
        </div>

        <div className="today-day-label">
          <CalendarDays size={16} />
          {DAYS[todayDay]}
        </div>
      </div>

      {nextClass && (
        <div className="next-class-card">
          <div>
            <span className="next-class-kicker">
              NEXT CLASS
            </span>

            <h3>{nextClass.subject}</h3>

            <p>
              {formatTime(nextClass.startTime)} –{" "}
              {formatTime(nextClass.endTime)}
            </p>
          </div>

          <Clock3 size={22} />
        </div>
      )}

      {todayClasses.length === 0 ? (
        <div className="today-empty-state">
          <CheckCircle2 size={24} />

          <div>
            <h3>No classes today</h3>
            <p>
              Your schedule is clear for today.
            </p>
          </div>
        </div>
      ) : (
        <div className="today-class-list">
          {todayClasses.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`today-class-card ${
                isClassLive(item) ? "is-live" : ""
              }`}
              onClick={() => onSelectClass(item)}
            >
              <div className="today-class-time">
                <strong>{formatTime(item.startTime)}</strong>

                <span>
                  {formatTime(item.endTime)}
                </span>
              </div>

              <div className="today-class-info">
                <h3>{item.subject}</h3>

                {isClassLive(item) && (
                  <span className="live-pill">
                    LIVE NOW
                  </span>
                )}
              </div>

              <ArrowRight size={19} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default TodayClasses;