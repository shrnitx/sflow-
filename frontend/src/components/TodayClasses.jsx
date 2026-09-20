import React, { useEffect, useMemo, useState } from "react";
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
  isTimeInRange,
  sortClassesByTime,
  timeToMinutes,
} from "../utils/timetable";

function TodayClasses({ timetable, onSelectClass }) {
  const todayDay = getTodayDay();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayClasses = useMemo(() => {
    return sortClassesByTime(
      timetable.filter((item) => item.day === todayDay)
    );
  }, [timetable, todayDay]);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const nextClass = useMemo(() => {
    return todayClasses.find(
      (item) => timeToMinutes(item.endTime) > currentMinutes
    );
  }, [todayClasses, currentMinutes]);

  const getClassState = (item) => {
    if (isTimeInRange(currentMinutes, item.startTime, item.endTime)) {
      return "live";
    }

    return currentMinutes >= timeToMinutes(item.endTime)
      ? "completed"
      : "upcoming";
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

      {nextClass ? (
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

            <span className="next-class-status">
              {getClassState(nextClass) === "live"
                ? "Live now"
                : `Starts in ${Math.max(
                    0,
                    timeToMinutes(nextClass.startTime) - currentMinutes
                  )} min`}
            </span>
          </div>

          <Clock3 size={22} />
        </div>
      ) : todayClasses.length > 0 ? (
        <div className="today-no-more">No more classes today</div>
      ) : null}

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
            (() => {
              const classState = getClassState(item);

              return (
            <button
              key={item.id}
              type="button"
              className={`today-class-card is-${classState}`}
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

                {classState === "live" && (
                  <span className="live-pill">
                    LIVE NOW
                  </span>
                )}

                {classState === "completed" && (
                  <span className="class-state-label">COMPLETED</span>
                )}
              </div>

              <ArrowRight size={19} />
            </button>
              );
            })()
          ))}
        </div>
      )}
    </section>
  );
}

export default TodayClasses;