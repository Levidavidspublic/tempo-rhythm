# Tempo MCP endpoint

Tempo exposes a remote MCP server (Streamable HTTP, protocol `2025-06-18`) so an assistant such as Executor can work with your tasks, notes and calendar. Approved users only.

## What it does

`POST https://<app host>/api/mcp` is a thin proxy. It forwards to Convex `POST {CONVEX_SITE_URL}/mcp` and streams the answer back. All logic and auth live in Convex (TEMPO-MCP-01).

- Target: `CONVEX_SITE_URL`, or `NEXT_PUBLIC_CONVEX_URL` with `.convex.cloud` swapped for `.convex.site`.
- Forwarded request headers: `Authorization`, `Accept`, `Content-Type`, `Mcp-Session-Id`, `MCP-Protocol-Version`. `Origin`, `Cookie` and `Host` are dropped on purpose. Headers are never logged.
- The route is public to the cookie middleware (`PUBLIC_ROUTE_PATTERNS`). The token authenticates it.
- Status codes pass through: 401 (with `WWW-Authenticate`), 403 `ACCOUNT_PENDING_APPROVAL`, 413, 429 (with `Retry-After`). 502 means the backend is not configured or not reachable.
- The server is stateless: GET and DELETE return 405 from Convex.

## Tools (11)

`tasks_list`, `task_create`, `task_update`, `notes_list`, `note_create`, `note_update`, `calendar_list`, `calendar_create`, `calendar_update`, `today_plan_get`, `brain_dump`.

## Connect Executor

1. Sign in, open **Settings → Integrations**, and find "Connect an AI assistant (MCP)".
2. Name the token (for example `Executor`) and choose **Create token**.
3. Copy the token. It is shown once.
4. In Executor add an MCP source of type **Streamable HTTP**:
   - URL: `https://<app host>/api/mcp`
   - Header: `Authorization: Bearer <your token>`
5. List tools. You should see the 11 above.

Claude Desktop and Cursor: add a remote/HTTP MCP server with the same URL and `Authorization` header. A client that only speaks stdio can bridge with `mcp-remote`.

## Revoke

Use **Revoke** next to the token on the same page. The next call with it returns 401. A user can hold at most 10 active tokens.

## Security notes

- Tokens look like `tmcp_…`. Only a hash is stored; the plaintext is returned once at creation.
- Treat a token like a password. Never commit or paste it into a chat or ticket.
- A pending or revoked account gets 403 even with a valid token.
- Browser origins are rejected by Convex unless listed in `TEMPO_MCP_ALLOWED_ORIGINS`. Server-side clients send no `Origin` and pass.
