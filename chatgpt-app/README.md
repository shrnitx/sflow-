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

**OAuth setup is partially implemented, but the Supabase project still needs its OAuth server enabled.** The MCP endpoint publishes OAuth protected-resource metadata and returns a `WWW-Authenticate` challenge; the consent UI is at `frontend/public/oauth/consent/index.html` and uses Supabase Auth OAuth methods. Before production use, enable OAuth 2.1 and dynamic client registration in Supabase Authentication settings, set the authorization path to `/oauth/consent`, and set the Supabase Auth Site URL to the deployed frontend origin. Confirm the project uses an asymmetric JWT signing key if the client requests `openid`. These settings cannot be changed through the currently available Supabase project tools. Do not expose the MCP endpoint to real users until OAuth discovery, consent, token refresh, and authenticated tool calls pass end-to-end tests.

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

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `MCP_PUBLIC_URL` in `.env`. For a local smoke test, send a valid Supabase access token as the bearer token on the MCP request. Do not commit `.env`.

Health check: `GET /`; MCP endpoint: `POST/GET/DELETE /mcp`.

## Connect to ChatGPT

The service can be deployed as a separate Vercel project with its root directory set to `chatgpt-app`; its public MCP endpoint is `/mcp`. The service must have `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `MCP_PUBLIC_URL` configured. Do not change the existing `sflow` frontend project's root directory for this backend. The current Vercel connector did not grant access to the target team for project creation/deployment, so no backend deployment has been made. The exact availability of custom app creation and full MCP tools depends on the ChatGPT plan/workspace and current rollout.

## Automated checks

A GitHub Actions workflow runs syntax checks and unit tests when this app changes. Tests cover calendar-date validation and normalization of task/timetable database rows. These checks do not replace an authenticated end-to-end test against a real Supabase project.

## Next implementation milestones

1. Enable Supabase OAuth 2.1 and dynamic client registration; configure `/oauth/consent` and the frontend Site URL.
2. Deploy the MCP service as a separate Vercel project with root directory `chatgpt-app` and the three environment variables.
3. Test the MCP bridge and OAuth token refresh with MCP Inspector and ChatGPT.
4. Run security tests for cross-user access, token expiry, invalid task IDs, and write confirmations.
