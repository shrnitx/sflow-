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

Detected classes appear in an editable review list before anything changes. Users can add entries to the current timetable (exact duplicates are skipped) or choose to replace the existing timetable after a confirmation. Screenshot layouts vary, so the parsed day/subject/time values should be checked before import. For best results, use a sharp, full screenshot with weekday headings and clear time labels.

## Cloud data storage

Tasks and timetable entries now use account-scoped Supabase tables. Before deployment, open the Supabase SQL Editor, paste and run `supabase/migrations/20261011000100_studyflow_user_data.sql`, and rebuild the frontend with the correct `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_PUBLISHABLE_KEY` values configured.

The migration creates `studyflow_tasks` and `studyflow_timetable`, enables Row Level Security, and adds policies so each signed-in user can access only rows with their own `user_id`. Keep Row Level Security enabled. Never put a Supabase service-role key in React/browser code.

The app caches data under a key specific to the signed-in user. If cloud tables are empty, cached data for that same user can be restored. Old browser-global data is only imported after a confirmation prompt; existing cloud data is not overwritten.

After running the migration, sign in, add a task and a timetable entry, refresh, and confirm they remain. Then test with a second account to confirm data is isolated. If cloud sync fails, use the in-app retry button after checking the migration, environment variables, and connection. Replacing Supabase is not needed to fix email send limits.
