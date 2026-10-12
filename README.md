# S-Flow

S-Flow is a student planner and study workspace built with React and Supabase. The application keeps tasks, exams, classes, focus sessions, and study-tool records connected to one signed-in account.

## Main features

- **Dashboard, tasks, exams, and timetable:** recurring classes, deadlines, task-to-class linking, exam revision planning, and calendar import/export.
- **Study Lab:** daily plan, task-linked focus timer, study-music player, syllabus tracking, study assistant, reminder preferences, and analytics.
- **Toolkit, in three phases:**
  - **Plan & focus:** quick capture (Ctrl/Cmd + K), deadline/priority parsing, adaptive scheduling around classes, task breakdown, focus room, and due-soon view.
  - **Learn & prepare:** course-material vault, active-recall flashcards, spaced review, study-readiness estimate, and weighted-grade calculator.
  - **Sync & recover:** ICS calendar import/export, deadline reminders, undo for recent task-list changes, JSON backup/restore, and visible sync status.
- **Cloud records:** StudyFlow Plus metadata is stored in `studyflow_user_data`. Material files use a **private** Supabase Storage bucket, `studyflow-materials`, limited to 25 MiB per file and protected by user-folder policies.
- **Recovery fallback:** if a material upload cannot reach Supabase Storage, the app can save that file in this browser's IndexedDB. Such fallback files do not travel to other devices; their metadata still syncs.

## Run locally

Use Node.js 24 and npm.

```bash
cd frontend
npm ci --legacy-peer-deps
```

Set these frontend environment variables before starting or building:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_PUBLISHABLE_KEY`

Use your Supabase **publishable** key in the browser. Do not use a service-role or secret key in frontend variables.

```bash
npm start
npm test -- --watchAll=false
npm run build
```

## Supabase schema

Database migrations are versioned in `supabase/migrations/`. They cover per-user StudyFlow records, focus sessions, planning records, the restricted RLS auto-enable event-trigger function, and the private material-storage bucket/policies.

The private material bucket uses per-user object paths:

```
<auth-user-id>/<material-id>/<sanitized-filename>
```

Its storage policies allow authenticated users to read, upload, update, or delete only objects in their own user-ID folder.

## Tests and deployment

GitHub Actions runs a production build and unit tests, plus a Chromium browser smoke test for core workflows. CI uses a dummy Supabase URL and stubs Auth/Data API calls, so passing CI validates the frontend and its mocked UI flows, not real-user credentials or external provider playback.

Calendar integration currently uses standard ICS files; automatic two-way Google/Outlook sync requires OAuth setup and server-side token handling. Browser deadline reminders run while the app is open and the browser allows it; closed-app push delivery is not configured.

## Boost Lab

Boost Lab is an additional workspace in the existing dashboard; it does not replace Study Lab, Toolkit, music, timetable, tasks, or exams. It adds:

1. Smart syllabus planner using topic importance, difficulty, daily study hours, and exam date.
2. Notes-to-recall-card generator.
3. Topic weakness analysis from saved self-test results.
4. Attendance tracker with configurable target percentages and attendance projections.
5. Timed recall-card exam simulation.
6. Assignment/project tracking with milestones.
7. Persistent in-app focus shield and session log.
8. Shareable study-room invite briefs.
9. Local-first storage, cloud sync to the account-scoped `studyflow_user_data` record `expansion`, plus JSON backup and restore.
10. Weekly study review based on saved focus logs, quiz scores, revision progress, open projects, and upcoming tasks.

The syllabus planner and notes-card generator are local deterministic utilities; no LLM provider is configured for this feature set. The focus shield overlays StudyFlow itself but does not block other websites or desktop applications. Room links share a room brief and goal; real-time participant presence and synchronized timers require a realtime room service and are not currently provided. Cloud persistence depends on a working Supabase connection and the existing per-user row policies. Offline edits remain browser-local until a later sync succeeds.

