# StudyFlow authentication setup

StudyFlow already uses Supabase Auth for email/password sign-up and login. The two-sign-up symptom is not caused by the database size: Supabase's built-in email sender is limited to **2 emails per hour** and only delivers to addresses authorized for the project team. Email confirmations can therefore block new account creation even though the frontend itself does not cap accounts.

Official references:
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase custom SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Auth general configuration](https://supabase.com/docs/guides/auth/general-configuration)

## To support repeated sign-ups

1. Open the Supabase project used by StudyFlow.
2. Configure a custom SMTP provider in the project's Auth/SMTP settings. Verify the sender address or domain with that email provider first.
3. Open **Authentication → Rate Limits** and set the email-send limit within the SMTP provider's allowed sending quota. Do not set a higher limit than the provider permits.
4. Under the email provider settings, make sure new sign-ups are enabled. Keep email confirmation enabled for a public/production app so users must verify that they own the address.
5. Under the Auth URL configuration, set the production Site URL to the deployed StudyFlow origin and allow the deployed origin as a redirect URL. For local development, allow `http://localhost:3000`.
6. Test with a new email address, open the confirmation link, then log in. Existing accounts should continue to use the Login form.

The app now translates common Supabase email-rate-limit and unauthorized-recipient errors into actionable messages. Those messages cannot raise a server-side limit by themselves; the SMTP and rate-limit settings must be changed in Supabase.

## Temporary local testing only

You can disable email confirmation in Supabase's email provider settings to allow immediate sign-in during local testing. This implicitly treats submitted email addresses as confirmed. Do **not** use that as a replacement for email verification on a public production app.

## Environment variables

The React app uses these build-time variables:

- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_PUBLISHABLE_KEY`

A publishable key is meant for frontend use. Never put a Supabase **secret** or **service_role** key in React code or any `REACT_APP_*` variable. Set production values in the hosting provider's environment settings. For local development, create `frontend/.env` using `frontend/.env.example` as a template.

## Import timetable from screenshot

The weekly timetable has a **Choose screenshot** control. It accepts PNG, JPG/JPEG, and WEBP images up to 12 MB. OCR runs in the user's browser using Tesseract.js; the image itself is not uploaded to StudyFlow's database. The browser downloads the OCR JavaScript and English language model from public CDNs on first use, so an internet connection is required.

The importer explicitly requests Tesseract.js v6 block output and extracts words and their coordinates from `data.blocks`; v6 no longer populates a top-level `data.words` array by default. It supports weekly grid layouts and the college-portal card layout where time ranges sit above course codes. For a screenshot showing just one selected weekday, choose that weekday once in the review form because the active tab cannot be reliably inferred from OCR text alone.

Detected classes appear in an editable review list before anything changes. Users can add entries to the current timetable (exact duplicates are skipped) or choose to replace the timetable after a confirmation. Screenshot layouts vary, so the parsed day/subject/time values should be checked before import. For best results, use a sharp, full screenshot with weekday headings and clear time labels.


## Dashboard features

The authenticated app opens on **Overview**, which is intentionally limited to today's class information and upcoming exam alerts. The navigation keeps Timetable, Tasks, Exams, Focus, and Settings separate.

- **Class profiles:** optionally save a course code, faculty name, room/venue, notes/material links, and online meeting URL with each weekly class. Tasks can link to a timetable class.
- **Calendar import/export:** import a standard `.ics` file into the timetable/tasks or export the current weekly classes and dated tasks/exams as an `.ics` file. Weekly recurring classes are supported; one-off calendar events are imported as dated tasks/reminders rather than becoming weekly classes.
- **Quick Add:** describe a task using text such as `Biology assignment due Friday, high priority`. The preview indicates which fields were recognized; date and subject detection are heuristic, so check the result before relying on it.
- **Exam preparation:** choose an upcoming exam, enter syllabus topics, and generate revision tasks before its date. Generated sessions appear under Tasks so they can be edited or marked complete.
- **Focus mode and analytics:** use a 25-, 40-, or 50-minute timer. Completed sessions are saved to the signed-in user's `studyflow_focus_sessions` table, protected by RLS, and summarized by subject for the current week.
- **Reminders:** in Settings, enable browser notifications and choose when to be reminded about classes, task deadlines, and exams. Notification permission is browser-specific. These reminders run while StudyFlow is open; notifications while the app is fully closed require a separate push-notification service and credentials.
- **Offline/PWA:** the web app includes an installable manifest and a service worker that caches the app shell and built JS/CSS assets. Task, timetable, and focus changes are also written to an account-specific local cache. When connectivity returns after a cloud write error, retry cloud sync; when the initial cloud load failed, the recovery flow merges the local snapshot with cloud records without treating absent remote records as deletions unless they existed in the local baseline.
- **Study analytics:** focus totals represent completed timer sessions, not passive time with the app open.

## Additional Supabase migration

The focus-session feature uses `public.studyflow_focus_sessions`. The migration `supabase/migrations/20261011000200_focus_sessions.sql` creates the table and user-only Row Level Security policies. It has been applied to the currently connected Supabase project. If deploying to a different Supabase project, run both SQL migration files in order before deploying this branch.

The app does not include a Google Calendar OAuth connection or closed-app push server because those need external OAuth/VAPID credentials. Calendar interoperability is provided through standard `.ics` import/export.

## Cloud data storage

Tasks and timetable entries now use account-scoped Supabase tables. Before deployment, open the Supabase SQL Editor, paste and run `supabase/migrations/20261011000100_studyflow_user_data.sql`, and rebuild the frontend with the correct `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` values configured.

The migration creates `studyflow_tasks` and `studyflow_timetable`, enables Row Level Security, and adds policies so each signed-in user can access only rows with their own `user_id`. Keep Row Level Security enabled. Never put a Supabase service-role key in React/browser code.

The app caches data under a key specific to the signed-in user. If cloud tables are empty, cached data for that same user can be restored. Old browser-global data is only imported after a confirmation prompt; existing cloud data is not overwritten.

After running the migration, sign in, add a task and a timetable entry, refresh, and confirm they remain. Then test with a second account to confirm data is isolated. If cloud sync fails, use the in-app retry button after checking the migration, environment variables, and connection. Replacing Supabase is not needed to fix email send limits.
