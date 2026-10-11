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

## Current data-storage limitation

Authentication and app data are separate concerns. Tasks and timetable entries are currently stored in browser `localStorage`, not in a user-scoped cloud table. That means they do not sync across devices and are not isolated by account in the same browser. A later database migration should move those records to tables protected by Supabase Row Level Security, keyed to the authenticated user. Replacing the database is not necessary to fix email sending limits.
