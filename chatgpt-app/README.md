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

This implementation has no service-role key and rejects tool calls without an authenticated Supabase access token. It validates the token with Supabase Auth and scopes every query to the authenticated user ID. Never disable that check or pass a service-role key to the browser.

**OAuth setup is still incomplete.** The MCP endpoint publishes OAuth protected-resource metadata and returns a `WWW-Authenticate` challenge; the consent UI is at `frontend/public/oauth/consent/index.html` and uses Supabase Auth OAuth methods. Before production use, enable OAuth 2.1 and dynamic client registration in Supabase Authentication settings, set the authorization path to `/oauth/consent`, and set the Supabase Auth Site URL to the deployed frontend origin. Confirm the project uses an asymmetric JWT signing key if the client requests `openid`. These settings cannot be changed through the currently available Supabase project tools. Do not connect real accounts until OAuth discovery, consent, token refresh, and authenticated tool calls pass end-to-end tests.

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

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and optionally `MCP_PUBLIC_URL` in `.env`. If `MCP_PUBLIC_URL` is omitted, the server derives the public origin from the incoming request. For a local smoke test, send a valid Supabase access token as the bearer token on the MCP request. Do not commit `.env`.

Health check: `GET /`; MCP endpoint: `POST/GET/DELETE /mcp`; OAuth protected-resource metadata: `GET /.well-known/oauth-protected-resource`.

## Deployment and ChatGPT connection

A separate Vercel project has been created and its deployment is **READY**:

- Base URL: https://studyflow-chatgpt-mcp.vercel.app
- MCP endpoint: https://studyflow-chatgpt-mcp.vercel.app/mcp
- OAuth protected-resource metadata: https://studyflow-chatgpt-mcp.vercel.app/.well-known/oauth-protected-resource

The deployment uses the `chatgpt-app` directory from branch `feat/chatgpt-mcp-app`, with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` configured as encrypted Vercel environment variables. The separate backend does not change the existing `sflow` frontend project. The Vercel project has deployment SSO protection disabled so an MCP client can reach the endpoint; actual tool calls still require a valid Supabase access token.

**The service is deployed but not yet connected to ChatGPT.** Supabase OAuth 2.1 and dynamic client registration still need to be enabled and configured, and the consent page must be available at the frontend's deployed `/oauth/consent` path. End-to-end OAuth and authenticated MCP tests have not been completed. Do not treat the deployment as production-ready until those checks pass. The availability of custom app creation and full MCP tools also depends on the ChatGPT plan/workspace and current rollout.

## Automated checks

GitHub Actions currently passes all three workflows: MCP syntax/unit checks, the frontend production build, and the main StudyFlow CI including browser smoke tests. These checks do not replace authenticated end-to-end testing against Supabase or ChatGPT.

## Remaining implementation milestones

1. Enable Supabase OAuth 2.1 and dynamic client registration; configure `/oauth/consent` and the frontend Site URL.
2. Test OAuth discovery, consent, token refresh, and authenticated tool calls with MCP Inspector.
3. Connect the MCP endpoint to ChatGPT where the account/workspace supports custom MCP apps.
4. Run security tests for cross-user access, token expiry, invalid task IDs, and write confirmations.
