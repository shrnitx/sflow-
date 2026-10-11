import React, { useMemo, useState } from "react";
import { CalendarClock, ListTodo, WandSparkles } from "lucide-react";
import { makeId } from "../utils/storage";

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function ExamPrepPlanner({ exams, existingTasks = [], onGenerate, onToast }) {
  const todayKey = localDateKey(new Date());
  const availableExams = useMemo(
    () => [...exams]
      .filter((exam) => exam.deadline && !exam.completed)
      .sort((a, b) => {
        const aPast = a.deadline <= todayKey;
        const bPast = b.deadline <= todayKey;
        if (aPast !== bPast) return Number(aPast) - Number(bPast);
        return a.deadline.localeCompare(b.deadline);
      }),
    [exams, todayKey]
  );
  const [examId, setExamId] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5);
  const [error, setError] = useState("");

  const selectedExam = availableExams.find((exam) => exam.id === examId) || availableExams[0] || null;

  const generate = () => {
    setError("");
    if (!selectedExam) {
      setError("Add an exam with a date first.");
      return;
    }
    const topics = [...new Set(
      topicsText.split(/[\n,;]+/).map((topic) => topic.trim()).filter(Boolean)
    )];
    if (!topics.length) {
      setError("Enter at least one syllabus topic, chapter, or revision task.");
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(selectedExam.deadline + "T00:00:00");
    if (Number.isNaN(examDate.getTime()) || examDate <= today) {
      setError("The exam date is today or in the past. Set a future exam date to generate a revision plan.");
      return;
    }

    const availableDays = [];
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() + 1);
    while (cursor < examDate) {
      // Spread sessions across the week. Weekends remain available, but the
      // selected weekly load keeps the plan from creating work every day.
      const weekday = cursor.getDay();
      if (sessionsPerWeek === 7 || (sessionsPerWeek === 5 && weekday >= 1 && weekday <= 5) ||
          (sessionsPerWeek === 6 && weekday !== 0)) {
        availableDays.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (!availableDays.length) {
      setError("There isn't enough time before this exam. Add a manual revision task for today.");
      return;
    }

    const buckets = availableDays.map(() => []);
    topics.forEach((topic, index) => {
      buckets[Math.floor(index * buckets.length / topics.length)].push(topic);
    });

    const plan = buckets
      .filter((bucket) => bucket.length > 0)
      .map((bucket, index, nonEmptyBuckets) => {
        const bucketIndex = buckets.findIndex((items) => items === bucket);
        const dueDate = availableDays[bucketIndex];
        return {
          id: makeId(),
          type: "task",
          title: "Revise for " + selectedExam.title + ": " + bucket.join(", "),
          subject: selectedExam.subject || "Other",
          deadline: localDateKey(dueDate),
          priority: index === nonEmptyBuckets.length - 1 ? "High" : "Medium",
          description: "Auto-generated revision session. Review the topic, practise questions, and mark this task complete when done.",
          completed: false,
          examId: selectedExam.id,
          createdAt: new Date().toISOString(),
        };
      });

    const existingKeys = new Set(
      existingTasks
        .filter((task) => task.examId === selectedExam.id)
        .map((task) => [
          String(task.title || "").trim().toLowerCase(),
          String(task.deadline || ""),
        ].join("|"))
    );
    const freshPlan = plan.filter((task) => {
      const key = [
        String(task.title || "").trim().toLowerCase(),
        String(task.deadline || ""),
      ].join("|");
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (!freshPlan.length) {
      setError("This revision plan already exists. Change the topic list or edit the existing tasks instead of creating duplicates.");
      return;
    }

    onGenerate(freshPlan);
    const skipped = plan.length - freshPlan.length;
    onToast(
      "Created " + freshPlan.length + " revision session(s) for " + selectedExam.title +
      (skipped ? ". Skipped " + skipped + " duplicate(s)." : ".")
    );
    setTopicsText("");
  };

  return (
    <section className="panel exam-planner-panel">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">PREPARE AHEAD</span>
          <h2>Exam preparation planner</h2>
        </div>
        <div className="exam-planner-icon"><CalendarClock size={21} /></div>
      </div>
      <p className="exam-planner-intro">Turn a syllabus into dated revision tasks before the exam. Review the generated plan in Tasks and adjust it as needed.</p>

      <div className="exam-planner-form">
        <div className="field">
          <label htmlFor="planner-exam">Exam</label>
          <select id="planner-exam" value={selectedExam?.id || ""} onChange={(event) => setExamId(event.target.value)}>
            {availableExams.length === 0 ? (
              <option value="">Add an exam first...</option>
            ) : availableExams.map((exam) => (
              <option key={exam.id} value={exam.id}>{exam.title} · {exam.deadline}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="planner-frequency">Revision days</label>
          <select id="planner-frequency" value={sessionsPerWeek} onChange={(event) => setSessionsPerWeek(Number(event.target.value))}>
            <option value={5}>Weekdays (5 days/week)</option>
            <option value={6}>6 days/week</option>
            <option value={7}>Every day</option>
          </select>
        </div>
        <div className="field full">
          <label htmlFor="planner-topics">Syllabus topics <span>(one per line or comma-separated)</span></label>
          <textarea
            id="planner-topics"
            rows={4}
            value={topicsText}
            onChange={(event) => setTopicsText(event.target.value)}
            placeholder={"Cell biology\nGenetics\nEnzymes\nPractise past papers"}
          />
        </div>
        {error && <div className="field-error exam-planner-error" role="alert">{error}</div>}
        <div className="exam-planner-actions">
          <button type="button" className="primary-button" onClick={generate} disabled={availableExams.length === 0}>
            <WandSparkles size={17} /> Generate revision plan
          </button>
        </div>
      </div>
      <div className="exam-planner-note"><ListTodo size={15} />Generated items are saved as tasks, not exams, and will appear in your Tasks section.</div>
    </section>
  );
}

export default ExamPrepPlanner;
