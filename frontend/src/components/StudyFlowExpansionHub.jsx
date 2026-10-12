import React, { useEffect, useMemo, useState } from "react";
import { Activity, AlarmClock, ArrowDownToLine, ArrowUpFromLine, BookOpen, BrainCircuit, CalendarCheck, Check, CheckCircle2, Clock3, Copy, GraduationCap, Layers3, Plus, ShieldCheck, Sparkles, Target, Trash2, Users, Wifi, WifiOff, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./StudyFlowExpansionHub.css";

const RECORD_ID = "expansion";
const fresh = () => ({ planner: [], notes: "", cards: [], quizHistory: [], attendance: [], projects: [], focus: null, focusLog: [], room: null });
const makeId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(36).slice(2));
const keyFor = (userId) => "sflow-expansion:" + userId;
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const parseJSON = (value) => { try { return JSON.parse(value); } catch { return null; } };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtDate = (v) => { if (!v) return "No date"; const d = new Date(v + "T00:00:00"); return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
const fmtTime = (seconds) => { const s = Math.max(0, Math.floor(seconds || 0)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const features = [
  { id: "planner", label: "Smart Planner", Icon: CalendarCheck },
  { id: "notes", label: "Notes to Quiz", Icon: BookOpen },
  { id: "weakness", label: "Weaknesses", Icon: Activity },
  { id: "attendance", label: "Attendance", Icon: GraduationCap },
  { id: "exam", label: "Exam Mode", Icon: AlarmClock },
  { id: "projects", label: "Projects", Icon: Target },
  { id: "focus", label: "Focus Shield", Icon: ShieldCheck },
  { id: "rooms", label: "Study Rooms", Icon: Users },
  { id: "backup", label: "Offline & Backup", Icon: Layers3 },
  { id: "review", label: "Weekly Review", Icon: CheckCircle2 },
];

function parseTopics(raw) {
  return raw.split(/\n+/).map((x) => x.trim()).filter(Boolean).slice(0, 200).map((line) => {
    const p = line.split("|").map((x) => x.trim());
    return { title: p[0], importance: clamp(Number(p[1]) || 3, 1, 5), difficulty: clamp(Number(p[2]) || 3, 1, 5) };
  });
}
function buildPlan(raw, examDate, hours) {
  const topics = parseTopics(raw);
  if (!topics.length) return { error: "Enter at least one topic, one per line." };
  if (!examDate || examDate < today()) return { error: "Choose today or a future exam date." };
  const start = new Date(today() + "T12:00:00");
  const end = new Date(examDate + "T12:00:00");
  const days = Math.max(1, Math.floor((end - start) / 86400000) + 1);
  const daysUsed = Math.min(days, topics.length);
  const perDay = Math.ceil(topics.length / daysUsed);
  const budget = Math.max(15, Math.round(clamp(Number(hours) || 1, 0.25, 12) * 60 / perDay));
  return { plan: topics.map((t, i) => { const date = new Date(start); date.setDate(date.getDate() + Math.min(days - 1, Math.floor(i / perDay))); return { id: makeId(), title: t.title, importance: t.importance, difficulty: t.difficulty, minutes: clamp(Math.round(budget * (0.65 + t.importance * t.difficulty / 25)), 15, 180), date: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0"), done: false }; }) };
}
function cardsFromNotes(raw, topic) {
  const lines = raw.split(/\n+/).flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)).map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim()).filter((line) => line.length >= 12);
  return [...new Set(lines)].slice(0, 100).map((line, i) => {
    const explicit = line.match(/^(.{2,100}?)\s*(?:::|->|=>|:)\s*(.{4,})$/);
    const definition = line.match(/^(.{2,80}?)\s+(?:is defined as|are defined as|refers to|means|denotes|is|are)\s+(.+)$/i);
    let front, back = line;
    if (explicit) { front = explicit[1].trim(); back = explicit[2].trim(); }
    else if (definition) { front = definition[1].trim(); back = definition[2].trim().replace(/[.!?]+$/, ""); }
    else { const words = line.split(/\s+/); front = words.slice(0, Math.min(7, Math.max(3, Math.ceil(words.length / 2)))).join(" "); if (front.length < line.length) front += "…"; else front = "Recall the key idea in note " + (i + 1); }
    return { id: makeId(), front, back, topic: topic || "General" };
  });
}

export default function StudyFlowExpansionHub({ user, tasks = [] }) {
  const [active, setActive] = useState("planner");
  const [data, setData] = useState(() => { const local = typeof window === "undefined" ? null : parseJSON(localStorage.getItem(keyFor(user?.id || "guest")) || "null"); return { ...fresh(), ...(local && typeof local === "object" ? local : {}) }; });
  const [hydrated, setHydrated] = useState(false);
  const [cloud, setCloud] = useState("loading");
  const [toast, setToast] = useState("");
  const [topics, setTopics] = useState("");
  const [examDate, setExamDate] = useState("");
  const [hours, setHours] = useState("2");
  const [noteDraft, setNoteDraft] = useState("");
  const [topic, setTopic] = useState("General");
  const [testMinutes, setTestMinutes] = useState("10");
  const [quiz, setQuiz] = useState(null);
  const [attSubject, setAttSubject] = useState("");
  const [attTotal, setAttTotal] = useState("0");
  const [attAttended, setAttAttended] = useState("0");
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDue, setProjectDue] = useState("");
  const [milestoneText, setMilestoneText] = useState({});
  const [focusTitle, setFocusTitle] = useState("Deep work");
  const [focusMinutes, setFocusMinutes] = useState("25");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [roomName, setRoomName] = useState("Quiet study room");
  const [roomGoal, setRoomGoal] = useState("Finish one focused study session");
  const [roomMinutes, setRoomMinutes] = useState("25");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    let alive = true;
    setHydrated(false);
    setCloud("loading");
    const local = parseJSON(localStorage.getItem(keyFor(user.id)) || "null");
    const fallback = { ...fresh(), ...(local && typeof local === "object" ? local : {}) };
    setData(fallback);
    (async () => {
      try {
        const result = await supabase.from("studyflow_user_data").select("data").eq("user_id", user.id).eq("record_id", RECORD_ID).maybeSingle();
        if (result.error) throw result.error;
        if (!alive) return;
        if (result.data?.data && typeof result.data.data === "object" && !Array.isArray(result.data.data)) setData({ ...fresh(), ...fallback, ...result.data.data });
        setCloud("synced");
      } catch (error) {
        console.warn("Boost Lab cloud load failed:", error);
        if (alive) setCloud("local");
      } finally { if (alive) setHydrated(true); }
    })();
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    if (!user?.id || !hydrated) return undefined;
    try { localStorage.setItem(keyFor(user.id), JSON.stringify(data)); }
    catch (error) { console.warn("Boost Lab local save failed:", error); setToast("Browser storage is full. Download a backup before clearing data."); setCloud("local"); }
    if (typeof navigator !== "undefined" && !navigator.onLine) { setCloud("local"); return undefined; }
    setCloud((current) => current === "local" ? "local" : "syncing");
    const timeout = window.setTimeout(async () => {
      try {
        const result = await supabase.from("studyflow_user_data").upsert({ user_id: user.id, record_id: RECORD_ID, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,record_id" });
        if (result.error) throw result.error;
        setCloud("synced");
      } catch (error) { console.warn("Boost Lab cloud save failed:", error); setCloud("local"); }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [data, hydrated, user?.id]);

  useEffect(() => {
    const tick = () => setSecondsLeft(data.focus?.endsAt ? Math.max(0, Math.ceil((data.focus.endsAt - Date.now()) / 1000)) : 0);
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [data.focus]);

  useEffect(() => {
    if (!data.focus?.endsAt || data.focus.endsAt > Date.now() || data.focus.logged) return;
    setData((current) => {
      if (!current.focus || current.focus.logged) return current;
      const log = { id: makeId(), title: current.focus.title, startedAt: current.focus.startedAt, endedAt: new Date().toISOString(), durationMinutes: current.focus.durationMinutes, completed: true };
      return { ...current, focusLog: [log, ...(current.focusLog || [])].slice(0, 300), focus: { ...current.focus, logged: true } };
    });
    setToast("Focus session complete. Take a short break.");
  }, [secondsLeft, data.focus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("studyRoom");
    if (!raw) return;
    try {
      const room = JSON.parse(raw);
      if (room && typeof room.name === "string" && typeof room.goal === "string") {
        setData((current) => ({ ...current, room: { ...room, joinedAt: new Date().toISOString() } }));
        setToast("Room invite imported. Start your own session to join the same goal.");
        setActive("rooms");
      }
    } catch { setToast("That study-room invite is invalid."); }
    // Invite links are processed once when the hub mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notify = (message) => { setToast(message); window.setTimeout(() => setToast(""), 3500); };
  const update = (patch) => setData((current) => ({ ...current, ...patch }));
  const plan = Array.isArray(data.planner) ? data.planner : [];
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const history = Array.isArray(data.quizHistory) ? data.quizHistory : [];
  const attendance = Array.isArray(data.attendance) ? data.attendance : [];
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const focusLog = Array.isArray(data.focusLog) ? data.focusLog : [];
  const weak = useMemo(() => {
    const rows = {};
    history.forEach((item) => { const k = (item.topic || "General").trim() || "General"; rows[k] = rows[k] || { topic: k, score: 0, total: 0, attempts: 0 }; rows[k].score += Number(item.score) || 0; rows[k].total += Number(item.total) || 0; rows[k].attempts += 1; });
    return Object.values(rows).map((r) => ({ ...r, accuracy: r.total ? Math.round(r.score / r.total * 100) : 0 })).sort((a, b) => a.accuracy - b.accuracy);
  }, [history]);

  const generatePlan = () => {
    const result = buildPlan(topics, examDate, hours);
    if (result.error) return notify(result.error);
    update({ planner: result.plan });
    notify("Created a plan for " + result.plan.length + " topics.");
  };
  const generateCards = () => {
    const source = (noteDraft || data.notes || "").trim();
    if (source.length < 12) return notify("Paste more notes first.");
    const generated = cardsFromNotes(source, topic.trim() || "General");
    if (!generated.length) return notify("Could not find usable lines. Add one concept per line.");
    update({ notes: source, cards: [...generated, ...cards].slice(0, 300) });
    setNoteDraft("");
    notify("Created " + generated.length + " recall cards.");
  };
  const startQuiz = () => {
    if (!cards.length) return notify("Create cards from your notes first.");
    const items = [...cards].sort(() => Math.random() - 0.5).slice(0, Math.min(10, cards.length));
    setQuiz({ id: makeId(), topic: topic.trim() || "General", cards: items, answers: {}, index: 0, endsAt: Date.now() + clamp(Number(testMinutes) || 10, 1, 180) * 60000, finished: false, saved: false });
    setActive("exam");
  };
  useEffect(() => {
    if (!quiz || quiz.finished) return undefined;
    const timer = window.setInterval(() => {
      if (Date.now() >= quiz.endsAt) {
        setQuiz((current) => current && !current.finished ? { ...current, finished: true } : current);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [quiz?.id, quiz?.finished, quiz?.endsAt]);
  const saveQuiz = () => {
    if (!quiz || quiz.saved) return;
    const score = Object.values(quiz.answers).filter(Boolean).length;
    update({ quizHistory: [{ id: makeId(), topic: quiz.topic, score, total: quiz.cards.length, date: new Date().toISOString() }, ...history].slice(0, 300) });
    setQuiz((current) => current ? { ...current, finished: true, saved: true } : current);
    notify("Saved result: " + score + "/" + quiz.cards.length + ".");
  };
  const addAttendance = () => {
    const name = attSubject.trim();
    if (!name) return notify("Enter a subject name.");
    if (attendance.some((r) => r.subject.toLowerCase() === name.toLowerCase())) return notify("That subject already exists.");
    const total = clamp(parseInt(attTotal, 10) || 0, 0, 10000);
    const attended = clamp(parseInt(attAttended, 10) || 0, 0, total);
    update({ attendance: [...attendance, { id: makeId(), subject: name, total, attended, target: 75 }] });
    setAttSubject(""); setAttTotal("0"); setAttAttended("0");
    notify("Attendance subject added.");
  };
  const addProject = () => {
    if (!projectTitle.trim()) return notify("Enter an assignment or project name.");
    update({ projects: [{ id: makeId(), title: projectTitle.trim(), due: projectDue, status: "Not started", milestones: [] }, ...projects].slice(0, 200) });
    setProjectTitle(""); setProjectDue(""); notify("Project added.");
  };
  const startFocus = (minutes, title) => {
    const duration = clamp(Number(minutes) || 25, 1, 240);
    update({ focus: { id: makeId(), title: (title || "Deep work").trim(), startedAt: new Date().toISOString(), durationMinutes: duration, endsAt: Date.now() + duration * 60000, logged: false } });
    notify("Focus Shield started for " + duration + " minutes.");
  };
  const stopFocus = () => {
    if (data.focus && !data.focus.logged) {
      const elapsed = Math.max(0, Math.floor((Date.now() - data.focus.endsAt + data.focus.durationMinutes * 60000) / 60000));
      const duration = Math.min(data.focus.durationMinutes, elapsed);
      update({ focusLog: duration > 0 ? [{ id: makeId(), title: data.focus.title, startedAt: data.focus.startedAt, endedAt: new Date().toISOString(), durationMinutes: duration, completed: false }, ...focusLog].slice(0, 300) : focusLog, focus: null });
    } else update({ focus: null });
    notify("Focus session stopped.");
  };
  const createRoom = () => {
    const room = { name: roomName.trim() || "Study room", goal: roomGoal.trim() || "Study together", minutes: clamp(Number(roomMinutes) || 25, 1, 240), code: Math.random().toString(36).slice(2, 8).toUpperCase(), createdAt: new Date().toISOString() };
    update({ room }); notify("Shareable room invite created.");
  };
  const roomLink = () => data.room ? window.location.origin + window.location.pathname + "?studyRoom=" + encodeURIComponent(JSON.stringify({ name: data.room.name, goal: data.room.goal, minutes: data.room.minutes, code: data.room.code })) : "";
  const copyText = async (text, success) => { try { await navigator.clipboard.writeText(text); notify(success); } catch { notify("Clipboard was blocked. Select and copy the invite field manually."); } };
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "sflow-boostlab-backup-" + today() + ".json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); notify("Backup downloaded.");
  };
  const importBackup = async (event) => {
    const file = event.target.files?.[0]; if (!file) return; setRestoring(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Backup must be smaller than 10 MB.");
      const parsed = parseJSON(await file.text());
      if (!parsed || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) throw new Error("This is not a valid Boost Lab backup.");
      if (!window.confirm("Replace current Boost Lab data with this backup? This cannot be undone.")) return;
      update({ ...fresh(), ...parsed.data }); notify("Backup restored.");
    } catch (error) { notify(error.message || "Could not restore backup."); }
    finally { setRestoring(false); event.target.value = ""; }
  };

  const focusThisWeek = focusLog.filter((r) => Date.now() - new Date(r.endedAt).getTime() <= 7 * 86400000 && new Date(r.endedAt).getTime() > 0);
  const focusMinutesWeek = focusThisWeek.reduce((n, r) => n + (Number(r.durationMinutes) || 0), 0);
  const averageAccuracy = history.length ? Math.round(history.reduce((n, r) => n + (r.total ? r.score / r.total : 0), 0) / history.length * 100) : null;
  const dueSoon = tasks.filter((t) => !t.completed && t.deadline && t.deadline >= today() && t.deadline <= (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); })()).length;

  if (!hydrated) return <section className="sfh-shell"><div className="sfh-empty"><Sparkles size={18} /> Loading Boost Lab…</div></section>;

  return <section className="sfh-shell">
    <header className="sfh-header"><div><span className="sfh-kicker"><Sparkles size={14} /> STUDYFLOW BOOST LAB</span><h2>Make every study session count.</h2><p>Ten practical tools for planning, practice, focus, and academic follow-through.</p></div><span className={"sfh-sync sfh-sync-" + cloud}>{cloud === "synced" ? <CheckCircle2 size={15} /> : cloud === "local" ? <WifiOff size={15} /> : <Clock3 size={15} />}{cloud === "synced" ? "Synced" : cloud === "syncing" ? "Saving…" : cloud === "loading" ? "Loading…" : "Local mode"}</span></header>
    <nav className="sfh-tabs" aria-label="Boost Lab features">{features.map(({ id: fid, label, Icon }, i) => <button key={fid} type="button" className={"sfh-tab " + (active === fid ? "is-active" : "")} onClick={() => setActive(fid)} aria-pressed={active === fid}><Icon size={16} /><span>{i + 1}. {label}</span></button>)}</nav>

    {active === "planner" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">01 · PLAN AHEAD</span><h3>Smart syllabus planner</h3><p>Enter one topic per line. Optional format: <code>Topic | importance (1–5) | difficulty (1–5)</code>. This local planning engine prioritizes demanding topics without requiring an external AI key.</p><label>Syllabus topics<textarea value={topics} onChange={(e) => setTopics(e.target.value)} rows={6} placeholder={"Cell biology | 5 | 4\nDNA replication | 5 | 5\nStatistics | 3 | 4"} /></label><div className="sfh-form-row"><label>Exam date<input type="date" min={today()} value={examDate} onChange={(e) => setExamDate(e.target.value)} /></label><label>Study hours / day<input type="number" min="0.25" max="12" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} /></label></div><button className="sfh-primary" type="button" onClick={generatePlan}><Sparkles size={16} /> Generate revision plan</button></section><section className="sfh-panel"><span className="sfh-kicker">YOUR PLAN</span><h3>{plan.filter((p) => p.done).length}/{plan.length} topics complete</h3>{!plan.length ? <p className="sfh-empty">Your dated revision plan appears here.</p> : <div className="sfh-list">{plan.slice().sort((a,b) => a.date.localeCompare(b.date)).map((item) => <label className={"sfh-plan-row " + (item.done ? "is-done" : "")} key={item.id}><input type="checkbox" checked={Boolean(item.done)} onChange={(e) => update({ planner: plan.map((p) => p.id === item.id ? { ...p, done: e.target.checked } : p) })} /><span><strong>{item.title}</strong><small>{fmtDate(item.date)} · {item.minutes} min · priority {item.importance}/5 · difficulty {item.difficulty}/5</small></span></label>)}</div>}{plan.length > 0 && <button className="sfh-text-button" type="button" onClick={() => { if (window.confirm("Clear this revision plan?")) update({ planner: [] }); }}>Clear plan</button>}</section></div>}

    {active === "notes" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">02 · ACTIVE RECALL</span><h3>Notes-to-quiz studio</h3><p>Paste notes or write terms as <code>Term: definition</code>. Each usable line becomes a recall card. No external AI credentials required.</p><label>Study material<textarea value={noteDraft || data.notes} onChange={(e) => setNoteDraft(e.target.value)} rows={8} placeholder={"Mitosis: cell division producing two genetically identical daughter cells\nDNA replication is the process of copying DNA"} /></label><label>Subject / topic<input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} /></label><button className="sfh-primary" type="button" onClick={generateCards}><BrainCircuit size={16} /> Generate recall cards</button></section><section className="sfh-panel"><span className="sfh-kicker">RECALL DECK</span><h3>{cards.length} cards</h3>{!cards.length ? <p className="sfh-empty">Generate cards to practice.</p> : <div className="sfh-list">{cards.slice(0, 35).map((card) => <details className="sfh-card" key={card.id}><summary>{card.front}</summary><p>{card.back}</p><small>{card.topic}</small><button type="button" className="sfh-text-button" onClick={(e) => { e.preventDefault(); update({ cards: cards.filter((c) => c.id !== card.id) }); }}>Remove card</button></details>)}{cards.length > 35 && <p className="sfh-muted">Showing 35 cards. The complete deck is saved.</p>}</div>}</section></div>}

    {active === "weakness" && <section className="sfh-panel"><span className="sfh-kicker">03 · LEARN FROM RESULTS</span><h3>Weakness detection</h3><p>Topic-level performance is computed from saved exam-mode results, not guessed from your hours.</p>{!weak.length ? <div className="sfh-empty"><Activity size={22} /><strong>No results recorded</strong><span>Take a timed self-test first.</span><button className="sfh-primary" type="button" onClick={() => setActive("exam")}>Open exam mode</button></div> : <div className="sfh-list">{weak.map((r) => <div className="sfh-weakness-row" key={r.topic}><div><strong>{r.topic}</strong><small>{r.attempts} attempt(s) · {r.score}/{r.total} correct</small></div><div className="sfh-meter"><span style={{ width: r.accuracy + "%" }} /></div><strong className={r.accuracy < 60 ? "sfh-danger" : r.accuracy < 80 ? "sfh-warn" : "sfh-good"}>{r.accuracy}%</strong></div>)}<p className="sfh-tip"><Sparkles size={16} /> Start with the lowest-accuracy topic, review its cards, then retest it.</p></div>}</section>}

    {active === "attendance" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">04 · COLLEGE TRACKER</span><h3>Attendance manager</h3><div className="sfh-form-stack"><label>Subject<input value={attSubject} onChange={(e) => setAttSubject(e.target.value)} maxLength={80} placeholder="e.g. Biochemistry" /></label><div className="sfh-form-row"><label>Classes held<input type="number" min="0" max="10000" value={attTotal} onChange={(e) => setAttTotal(e.target.value)} /></label><label>Classes attended<input type="number" min="0" max={attTotal || 0} value={attAttended} onChange={(e) => setAttAttended(e.target.value)} /></label></div><button className="sfh-primary" type="button" onClick={addAttendance}><Plus size={16} /> Add subject</button></div><p className="sfh-muted">Confirm your college's threshold before relying on projections.</p></section><section className="sfh-panel"><span className="sfh-kicker">SUBJECT BREAKDOWN</span><h3>{attendance.length} subjects</h3>{!attendance.length ? <p className="sfh-empty">Add subjects and their current counts.</p> : <div className="sfh-list">{attendance.map((r) => { const pct = r.total ? Math.round(r.attended / r.total * 100) : 0; const need = pct >= r.target ? 0 : Math.ceil((r.target * r.total - r.attended) / (1 - r.target / 100)); const safe = r.total ? Math.max(0, Math.floor(r.attended / (r.target / 100) - r.total)) : 0; return <article className="sfh-project" key={r.id}><div className="sfh-panel-heading"><strong>{r.subject}</strong><button className="sfh-text-button" type="button" onClick={() => update({ attendance: attendance.filter((x) => x.id !== r.id) })}>Delete</button></div><div className="sfh-attendance-summary"><strong className={pct < r.target ? "sfh-danger" : "sfh-good"}>{pct}%</strong><span>{r.attended}/{r.total} attended</span><label>Target <select value={r.target} onChange={(e) => update({ attendance: attendance.map((x) => x.id === r.id ? { ...x, target: Number(e.target.value) } : x) })}><option value="65">65%</option><option value="70">70%</option><option value="75">75%</option><option value="80">80%</option><option value="85">85%</option><option value="90">90%</option></select></label></div><div className="sfh-meter"><span style={{ width: clamp(pct, 0, 100) + "%" }} /></div><small>{pct >= r.target ? "Up to " + safe + " absences at target" : "Attend " + need + " consecutive classes to reach target"}</small><div className="sfh-actions"><button type="button" className="sfh-secondary" onClick={() => update({ attendance: attendance.map((x) => x.id === r.id ? { ...x, attended: x.attended + 1, total: x.total + 1 } : x) })}>+ Attended</button><button type="button" className="sfh-secondary" onClick={() => update({ attendance: attendance.map((x) => x.id === r.id ? { ...x, total: x.total + 1 } : x) })}>+ Absent</button><button type="button" className="sfh-secondary" disabled={!r.total} onClick={() => update({ attendance: attendance.map((x) => x.id === r.id ? { ...x, attended: Math.max(0, x.attended - 1), total: Math.max(0, x.total - 1) } : x) })}>Undo class</button></div></article>; })}</div>}</section></div>}

    {active === "exam" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">05 · TIMED PRACTICE</span><h3>Exam simulation mode</h3><p>Take a timed self-test from your recall cards. Reveal the expected answer, mark whether you knew it, then save your result.</p><label>Test topic<input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} /></label><label>Time limit (minutes)<input type="number" min="1" max="180" value={testMinutes} onChange={(e) => setTestMinutes(e.target.value)} /></label><p className="sfh-muted">{cards.length} cards available; each test uses up to 10.</p><button className="sfh-primary" type="button" onClick={startQuiz}><AlarmClock size={16} /> Start timed test</button>{quiz && <div className="sfh-quiz-box"><div className="sfh-panel-heading"><span>{quiz.topic}</span><strong>{quiz.finished ? "Test complete" : fmtTime((quiz.endsAt - Date.now()) / 1000)}</strong></div>{quiz.finished ? <><h4>Score: {Object.values(quiz.answers).filter(Boolean).length}/{quiz.cards.length}</h4><p>{quiz.saved ? "Result saved to weakness analysis." : "Save this result to update weakness analysis."}</p><button className="sfh-primary" type="button" disabled={quiz.saved} onClick={saveQuiz}>{quiz.saved ? "Saved" : "Save result"}</button><button className="sfh-secondary" type="button" onClick={() => setQuiz(null)}>Close test</button></> : <><small>Question {quiz.index + 1} of {quiz.cards.length}</small><h4>{quiz.cards[quiz.index].front}</h4>{quiz.answers[quiz.cards[quiz.index].id] === undefined ? <><details className="sfh-card"><summary>Reveal answer</summary><p>{quiz.cards[quiz.index].back}</p></details><div className="sfh-actions"><button className="sfh-secondary" type="button" onClick={() => setQuiz((q) => ({ ...q, answers: { ...q.answers, [q.cards[q.index].id]: false } }))}>Review again</button><button className="sfh-primary" type="button" onClick={() => setQuiz((q) => ({ ...q, answers: { ...q.answers, [q.cards[q.index].id]: true } }))}><Check size={16} /> I knew it</button></div></> : <div className="sfh-actions"><span>{quiz.answers[quiz.cards[quiz.index].id] ? "Marked correct" : "Marked for review"}</span><button className="sfh-primary" type="button" onClick={() => setQuiz((q) => q.index + 1 >= q.cards.length ? { ...q, finished: true } : { ...q, index: q.index + 1 })}>{quiz.index + 1 >= quiz.cards.length ? "Finish test" : "Next question"}</button></div>}<button className="sfh-text-button" type="button" onClick={() => setQuiz((q) => ({ ...q, finished: true }))}>End test</button></>}</div>}</section><section className="sfh-panel"><span className="sfh-kicker">RESULT HISTORY</span><h3>{history.length} saved attempts</h3>{!history.length ? <p className="sfh-empty">Results appear after saving your first test.</p> : <div className="sfh-list">{history.slice(0, 12).map((r) => <div className="sfh-history-row" key={r.id}><div><strong>{r.topic}</strong><small>{fmtDate((r.date || "").slice(0, 10))}</small></div><span>{r.score}/{r.total} · {r.total ? Math.round(r.score / r.total * 100) : 0}%</span></div>)}</div>}</section></div>}

    {active === "projects" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">06 · COURSEWORK</span><h3>Assignment and project workspace</h3><div className="sfh-form-stack"><label>Project name<input value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} maxLength={160} placeholder="e.g. Literature review" /></label><label>Due date<input type="date" min={today()} value={projectDue} onChange={(e) => setProjectDue(e.target.value)} /></label><button className="sfh-primary" type="button" onClick={addProject}><Plus size={16} /> Add project</button></div></section><section className="sfh-panel"><span className="sfh-kicker">PROJECT TRACKER</span><h3>{projects.length} projects · {projects.filter((p) => p.status !== "Completed").length} open</h3>{!projects.length ? <p className="sfh-empty">Your assignments will appear here.</p> : <div className="sfh-list">{projects.map((p) => <article className="sfh-project" key={p.id}><div className="sfh-panel-heading"><div><strong>{p.title}</strong><small>{fmtDate(p.due)}</small></div><button className="sfh-text-button" type="button" onClick={() => update({ projects: projects.filter((x) => x.id !== p.id) })}>Delete</button></div><label>Status<select value={p.status} onChange={(e) => update({ projects: projects.map((x) => x.id === p.id ? { ...x, status: e.target.value } : x) })}><option>Not started</option><option>In progress</option><option>Waiting</option><option>Completed</option></select></label>{(p.milestones || []).map((m) => <label className="sfh-milestone" key={m.id}><input type="checkbox" checked={m.done} onChange={(e) => update({ projects: projects.map((x) => x.id === p.id ? { ...x, milestones: x.milestones.map((y) => y.id === m.id ? { ...y, done: e.target.checked } : y) } : x) })} />{m.title}</label>)}<div className="sfh-inline-add"><input aria-label={"New milestone for " + p.title} value={milestoneText[p.id] || ""} onChange={(e) => setMilestoneText((x) => ({ ...x, [p.id]: e.target.value }))} placeholder="Add milestone…" /><button type="button" className="sfh-secondary" onClick={() => { const title = (milestoneText[p.id] || "").trim(); if (!title) return; update({ projects: projects.map((x) => x.id === p.id ? { ...x, milestones: [...(x.milestones || []), { id: makeId(), title, done: false }] } : x) }); setMilestoneText((x) => ({ ...x, [p.id]: "" })); }}>Add</button></div></article>)}</div>}</section></div>}

    {active === "focus" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">07 · PROTECT YOUR ATTENTION</span><h3>In-app Focus Shield</h3><p>Timer persists across refreshes and the in-app shield covers this workspace. It does not block other websites or desktop apps; those require an extension/desktop companion.</p><label>Session goal<input value={focusTitle} onChange={(e) => setFocusTitle(e.target.value)} maxLength={100} /></label><label>Duration in minutes<input type="number" min="1" max="240" value={focusMinutes} onChange={(e) => setFocusMinutes(e.target.value)} /></label><div className="sfh-actions"><button className="sfh-primary" type="button" onClick={() => startFocus(focusMinutes, focusTitle)}><ShieldCheck size={16} /> Start shield</button>{data.focus && <button className="sfh-secondary" type="button" onClick={stopFocus}><X size={16} /> Stop</button>}</div></section><section className="sfh-panel sfh-focus-display"><span className="sfh-kicker">CURRENT SESSION</span><div className={"sfh-clock " + (data.focus && !data.focus.logged ? "is-running" : "")}>{data.focus && !data.focus.logged ? fmtTime(secondsLeft) : "25:00"}</div><h3>{data.focus ? data.focus.title : "Ready when you are"}</h3><p>{data.focus?.logged ? "Completed. Take a short break." : data.focus ? "Timer will keep counting when you switch tabs." : "Choose a specific goal and a realistic session length."}</p>{data.focus && !data.focus.logged && <div className="sfh-meter"><span style={{ width: clamp(secondsLeft / (data.focus.durationMinutes * 60) * 100, 0, 100) + "%" }} /></div>}<div className="sfh-stat-row"><div><strong>{focusLog.length}</strong><small>sessions logged</small></div><div><strong>{focusLog.reduce((n, r) => n + (r.durationMinutes || 0), 0)}</strong><small>minutes total</small></div></div></section>{data.focus && !data.focus.logged && secondsLeft > 0 && <div className="sfh-shield-overlay" role="status"><ShieldCheck size={34} /><span>FOCUS SHIELD ACTIVE</span><strong>{fmtTime(secondsLeft)}</strong><p>{data.focus.title}</p><button className="sfh-secondary" type="button" onClick={stopFocus}>End session</button></div>}</div>}

    {active === "rooms" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">08 · ACCOUNTABILITY</span><h3>Shareable study room</h3><p>Create an invite with a shared goal and session length. Invite links carry the room brief, but live participant presence and synchronized timers need a realtime room service.</p><div className="sfh-form-stack"><label>Room name<input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={80} /></label><label>Shared goal<input value={roomGoal} onChange={(e) => setRoomGoal(e.target.value)} maxLength={180} /></label><label>Focus minutes<input type="number" min="1" max="240" value={roomMinutes} onChange={(e) => setRoomMinutes(e.target.value)} /></label><button className="sfh-primary" type="button" onClick={() => { update({ room: { name: roomName.trim() || "Study room", goal: roomGoal.trim() || "Study together", minutes: clamp(Number(roomMinutes) || 25, 1, 240), code: Math.random().toString(36).slice(2, 8).toUpperCase(), createdAt: new Date().toISOString() } }); notify("Room invite created."); }}><Users size={16} /> Create room invite</button></div></section><section className="sfh-panel"><span className="sfh-kicker">ROOM INVITE</span><h3>{data.room?.name || "No active room"}</h3>{!data.room ? <p className="sfh-empty">Room details and invite link appear here.</p> : <><p>{data.room.goal}</p><div className="sfh-room-code">{data.room.code}</div><p className="sfh-muted">{data.room.minutes} minute session</p><label>Invite link<input readOnly value={roomLink()} onFocus={(e) => e.target.select()} /></label><div className="sfh-actions"><button className="sfh-primary" type="button" onClick={() => copyText(roomLink(), "Invite link copied.")}><Copy size={16} /> Copy invite</button><button className="sfh-secondary" type="button" onClick={() => startFocus(data.room.minutes, data.room.goal)}><Clock3 size={16} /> Start my timer</button><button className="sfh-secondary" type="button" onClick={() => update({ room: null })}>Close room</button></div></>}</section></div>}

    {active === "backup" && <div className="sfh-grid"><section className="sfh-panel"><span className="sfh-kicker">09 · OFFLINE & RECOVERY</span><h3>Keep your data recoverable</h3><p>Changes save in this browser immediately and sync to your account when online. Download a backup before clearing browser data.</p><div className="sfh-recovery-state"><span className={typeof navigator !== "undefined" && navigator.onLine ? "sfh-online-dot" : "sfh-offline-dot"} /><strong>{typeof navigator !== "undefined" && navigator.onLine ? "Internet available" : "Offline · browser copy retained"}</strong><span>{cloud === "synced" ? "Cloud save confirmed" : cloud === "syncing" ? "Cloud save pending" : "Cloud save unavailable"}</span></div><div className="sfh-actions"><button className="sfh-primary" type="button" onClick={exportBackup}><ArrowDownToLine size={16} /> Download backup</button><label className="sfh-upload-button"><ArrowUpFromLine size={16} /> {restoring ? "Restoring…" : "Restore backup"}<input type="file" accept="application/json,.json" disabled={restoring} onChange={importBackup} /></label><button className="sfh-secondary" type="button" onClick={async () => { setCloud("syncing"); try { const r = await supabase.from("studyflow_user_data").upsert({ user_id: user.id, record_id: RECORD_ID, data, updated_at: new Date().toISOString() }, { onConflict: "user_id,record_id" }); if (r.error) throw r.error; setCloud("synced"); notify("Cloud sync completed."); } catch (error) { console.warn(error); setCloud("local"); notify("Cloud sync failed; browser data was kept."); } }}><Wifi size={16} /> Retry cloud sync</button></div><p className="sfh-muted">Backup scope: Boost Lab only. Restore replaces this feature's data, not tasks or timetable.</p></section><section className="sfh-panel"><span className="sfh-kicker">BACKUP CONTENTS</span><h3>What is preserved?</h3>{[{ label: "Revision topics", count: plan.length }, { label: "Recall cards", count: cards.length }, { label: "Quiz attempts", count: history.length }, { label: "Attendance subjects", count: attendance.length }, { label: "Projects", count: projects.length }, { label: "Focus logs", count: focusLog.length }].map((r) => <div className="sfh-history-row" key={r.label}><span>{r.label}</span><strong>{r.count}</strong></div>)}</section></div>}

    {active === "review" && <section className="sfh-panel"><span className="sfh-kicker">10 · REVIEW & ADJUST</span><h3>Your weekly academic review</h3><p>Snapshot based on the tasks passed from the main workspace and records saved in Boost Lab.</p><div className="sfh-review-stats"><div><span>Focus minutes (7 days)</span><strong>{focusMinutesWeek}</strong></div><div><span>Sessions logged (7 days)</span><strong>{focusThisWeek.length}</strong></div><div><span>Average quiz accuracy</span><strong>{averageAccuracy === null ? "—" : averageAccuracy + "%"}</strong></div><div><span>Topics revised</span><strong>{plan.filter((p) => p.done).length}/{plan.length}</strong></div><div><span>Open projects</span><strong>{projects.filter((p) => p.status !== "Completed").length}</strong></div><div><span>Main tasks due in 7 days</span><strong>{dueSoon}</strong></div></div><div className="sfh-review-advice"><h4>Suggested next actions</h4><ul>{weak.length && weak[0].accuracy < 80 ? <li>Review <strong>{weak[0].topic}</strong>, currently at {weak[0].accuracy}% accuracy.</li> : <li>Take a short self-test to establish a topic-level baseline.</li>}{plan.some((p) => !p.done && p.date <= today()) ? <li>Complete a due revision topic before adding more.</li> : <li>Keep the revision plan current and mark topics done after recall practice.</li>}{projects.some((p) => p.status !== "Completed") ? <li>Move one open assignment forward by completing its next milestone.</li> : <li>Add upcoming multi-step coursework to the project tracker.</li>}{dueSoon ? <li>Review the {dueSoon} task(s) due within seven days in the main workspace.</li> : <li>Reserve time for your next major deadline.</li>}</ul></div></section>}

    {toast && <div className="sfh-toast" role="status" aria-live="polite">{toast}<button type="button" aria-label="Dismiss message" onClick={() => setToast("")}><X size={14} /></button></div>}
    <footer className="sfh-footer">Account sync: {cloud === "synced" ? "confirmed" : cloud === "syncing" ? "saving changes" : cloud === "local" ? "browser copy retained" : "checking storage"}</footer>
  </section>;
}
