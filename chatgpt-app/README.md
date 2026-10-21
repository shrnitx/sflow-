# StudyFlow ChatGPT app (MCP)

This folder adds a separate Model Context Protocol (MCP) server and interactive MCP Apps widget to the existing React/Supabase StudyFlow project. It does not replace or modify the existing web app. It supports local Node hosting and Vercel serverless routing (`/mcp` rewrites to `/api/mcp`).

## Included tools

- `get_studyflow_dashboard` — read tasks and timetable for the signed-in account.
- `create_study_task` — create a task.
- `update_study_task` — edit a task or mark it complete.
- `delete_study_task` — delete a task (only after an explicit user request).
- `get_study_timetable` — read timetable entries.
- Interactive widget: dashboard summary, task list, add-task form, mark-complete controls, and timetable view.

The server uses the same Supabase tables as the web app: `studyflow_tasks`, `studyflow_timetable`, and the row shape `user_id, record_id, data, updated_at`.

## Security status

This scaffold intentionally has no service-role key and rejects tool calls without an authenticated Supabase access token. It validates the token with Supabase Auth and scopes every query to the authenticated user ID. Never disable that check or pass a service-role key to the browser.

**OAuth is not wired up yet.** Before real users can connect their StudyFlow accounts from ChatGPT, implement the OAuth authorization/token flow described in the OpenAI Apps SDK authentication guide and map the authenticated identity to a Supabase user. Until then, this is an implementation scaffold, not a production-ready connected app. Do not expose it publicly with real user data until that flow and end-to-end tests are complete.

## Local setup

Requires Node.js 20+.

```bash
cd chatgpt-app
cp .env.example .env
npm install
npm run check
npm test
npm start
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env`. For a local smoke test, send a valid Supabase access token as the bearer token on the MCP request. Do not commit `.env`.

Health check: `GET /`; MCP endpoint: `POST/GET/DELETE /mcp`.

## Connect to ChatGPT

The service can be deployed as a separate Vercel project with its root directory set to `chatgpt-app`; its public MCP endpoint is `/mcp`. The service must have `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` configured. Do not use the existing `sflow` frontend project's root directory for this backend. The exact availability of custom app creation, write tools, and authentication depends on the ChatGPT plan/workspace and current rollout. Configure OAuth before attempting normal account sign-in.

## Automated checks

A GitHub Actions workflow runs syntax checks and unit tests when this app changes. Tests cover calendar-date validation and normalization of task/timetable database rows. These checks do not replace an authenticated end-to-end test against a real Supabase project.

## Next implementation milestones

1. Add OAuth authorization, callback, token exchange, refresh, and revocation endpoints.
2. Test the MCP bridge and tool calls with MCP Inspector and ChatGPT.
3. Deploy the MCP service and widget over HTTPS.
4. Run security tests for cross-user access, token expiry, invalid task IDs, and write confirmations.
