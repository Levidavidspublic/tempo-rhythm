# Executor in Tempo: connecting a person's own Executor account

Ticket: TEMPO-B07-02 (#977). Written 16 Oct 2026. Research only: no code, no calls to Executor.
Feeds: B07-07 (Convex data ticket) and B07-08 (Settings → Connections UI + one coach flow).

**How to read the labels**

| Label | Meaning |
|---|---|
| `[S<n>]` | Sourced. The number points to section 9 (Sources). |
| **UNKNOWN** | Could not be read or checked. Do not build on it without checking first. |
| **EXTRAPOLATED** | A reasoned guess from sources, not stated by them. |

**What could not be read.** `executor.sh`, `mcp.executor.sh` and `modelcontextprotocol.io` were not reachable from this
sandbox (proxy 403 on CONNECT; WebFetch `getaddrinfo ENOTFOUND`). The live docs pages "The MCP endpoint" and "Add an
MCP client" were **not** read. What this doc says about Executor comes from its public source repo, its published npm
package, search-result snippets, and the MCP spec source on GitHub. See section 9.

---

## 0. The short version

1. Executor is an open-source layer between AI agents and the apps people use. You add apps once in Executor, with
   their logins and per-tool rules, and any MCP client can use them. [S1][S2]
2. Tempo becomes an **MCP client** of the person's own Executor account. (Today Tempo is an MCP **server** that
   Executor can call. That is a different direction. [S20])
3. Connect: Settings → Connections → **Connect Executor** → Executor sign-in and consent → back to Tempo. OAuth 2.1
   with PKCE, discovery from the MCP URL, and client self-registration (Dynamic Client Registration). [S10–S13]
4. The OAuth callback lands on a **Convex HTTP route**. Tokens are exchanged, encrypted and stored there. They never
   reach the browser.
5. Tokens are encrypted at rest (AES-256-GCM) with a key from a Convex env var, `TEMPO_CONNECTIONS_KEY`
   (EXTRAPOLATED name).
6. The coach may run, without asking, only MCP tools that mark themselves read-only (`readOnlyHint: true`). On the
   Executor build read here those are `search`, `describe` and `skills`. [S8]
7. Everything else (`call`, `execute`, `resume`, unknown tools, missing hints) needs a Tempo approval card first, or is
   blocked. Executor's `call` runs any app tool, so Tempo cannot tell a read from a write and must ask. [S8][S15]
8. First coach flow (B07-08): "Look in my apps". The coach runs Executor `search` and tells the person which apps and
   tools Tempo can reach. No app data is read and nothing is written.
9. Disconnect scrubs the tokens in Tempo and asks Executor to revoke them, if Executor offers revocation (UNKNOWN for
   hosted).
10. The biggest UNKNOWN: whether `https://mcp.executor.sh/mcp` is the live endpoint. The code read here uses
    `https://executor.sh/mcp`. So the MCP URL must be a config value, and everything else is discovered from it.

---

## 1. What Executor is

### 1.1 The product

- "Executor is an open-source integration layer for AI agents. Configure every integration once (MCP servers, OpenAPI
  specs, GraphQL APIs) with authentication and per-tool policies, then use that one catalog from any MCP-compatible
  agent." [S1]
- Each tool is "allowed, gated behind approval, or blocked". Defaults come from the spec. Example: `GET` operations
  on an OpenAPI spec are allowed by default. [S1][S2]
- Credentials stay inside Executor. "The agent runs in a sandbox and never sees them." [S2]
- Ways to run it: Executor Cloud (hosted, free tier), CLI, desktop app, self-host on Docker or Cloudflare. [S1]
- Repo: `UsefulSoftwareCo/executor` (`RhysSullivan/executor` points to the same repo; same HEAD `906bee5`,
  12 Oct 2026). MIT license. [S1]

### 1.2 Two generations

There are two Executor generations today. Which one serves the hosted endpoint matters.

| | Executor 1 | Executor 2 (beta) |
|---|---|---|
| Source | Public repo, `apps/cloud` [S3] | Not public (the repo that builds it is not on GitHub's public list) [S1][S5]. Published as npm `executor@2.0.0-beta.23`, 15 Oct 2026 [S8] |
| Hosted app | `https://executor.sh` [S3] | `https://app.executor.sh` (sign-up URL in v1 config) [S5] |
| Hosted MCP URL | `https://executor.sh/mcp`, or `https://executor.sh/<org>/mcp` [S3]. The Cursor plugin uses `https://executor.sh/mcp` [S7] | **UNKNOWN.** Amit's reading of the docs: `https://mcp.executor.sh/mcp`. The v2 code keeps separate lists of "MCP origins" and "API origins", so a separate `mcp.` host fits (EXTRAPOLATED) [S8] |
| Model | Integrations → connections → policies [S2] | "Apps" whose queries and mutations become tools; each declares its own approval; "nothing is inferred from an operation looking read-only" [S9] |
| Docs | `apps/docs` in the repo [S2] | `executor.sh/docs/*` is now forwarded to v2 by the v1 edge [S5]. Its sidebar has "Agents and MCP": "The MCP endpoint", "Add an MCP client", "API keys" [S9] |

**Recommendation.** Build for Executor 2 (the docs Amit read), but keep the MCP URL in config and discover everything
else from it. If the live endpoint is v1, only the config value changes (plus `?mode=passthrough`, see 1.3).

### 1.3 What the MCP endpoint offers (tools)

**Executor 2, read from the published v2 build** (strings in the npm package; hosted may differ, EXTRAPOLATED that it
matches) [S8]:

| Tool | What it does (from its description) | Annotations |
|---|---|---|
| `search` | "Find Executor app tools by words in their paths, descriptions and labels." Returns paths, one-line descriptions, input types, apps and linked accounts. 10 items per page by default. | `readOnlyHint: true`, `destructiveHint: false` |
| `describe` | Full description and TypeScript signature of tools at exact paths (up to 20 paths). | `readOnlyHint: true`, `destructiveHint: false` |
| `skills` | "Read instructions that apps ship." | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: true` |
| `call` | "Call Executor app tools directly by exact path from search." One call or a batch. | Never marked read-only. Model and browser modes set no hints (MCP defaults apply: not read-only). Native mode: `readOnlyHint: false`, `destructiveHint: true`, `openWorldHint: true` |
| `execute` | "Run a JavaScript program over Executor apps." Limits: 5 minutes, 100 tool calls, 100,000 output bytes. "External effects are not rolled back." | No hints set (not read-only) |
| `resume` | Continues a paused `call` / `execute` after approval or input. | No hints set (not read-only) |

Search results carry `path`, `description` and `input` only. They do **not** say whether an app tool reads or
writes. [S8] (Executor's own dashboard does classify tools as read / change / delete / unknown from
`readOnly` or `readOnlyHint`, but that is not in the MCP results. [S8])

**Executor 1** [S2][S4]:

| Mode | Tools | Annotations |
|---|---|---|
| Default | `execute`, `resume`, `skills` | `skills` read-only; `execute` and `resume` none |
| `?mode=passthrough` ("Search and invoke") | `integrations`, `search`, `invoke`, `skills` | `integrations`, `search`, `skills`: `readOnlyHint: true`, `destructiveHint: false`. `invoke`: `readOnlyHint: false`, `destructiveHint: true` |

### 1.4 Approvals inside Executor (`elicitation_mode`)

Both generations take an `elicitation_mode` URL parameter. [S4][S8]

| Mode | Executor's own words [S8] | Fit for Tempo |
|---|---|---|
| `model` (default) | "Your agent collects responses and resumes calls that need approval." | **Use this.** Executor hands the approval back to Tempo, and Tempo shows its own card. |
| `native` | "Your connected client handles approval prompts." Needs MCP form elicitation in the client. | Not now: Tempo's client would need elicitation support. |
| `browser` | "Calls that need approval wait for you to review them in your browser." | No: the person would approve on Executor's site, not in Tempo. |

- An approval request expires after 15 minutes. Executor resumes "only the exact call that was reviewed". [S8]
- Tempo must never answer an Executor approval request on its own. Executor's `resume` tool says "Ask the user before
  approving." [S8]

### 1.5 Scoped connections

- In v2, a person can make a **scoped connection**: "Turn on the apps this agent needs. Everything else stays off.
  Approval rules come from each app's code." It can be revoked ("Revoke connection"). [S8]
- The consent screen says either "This connection can use all apps available to you" or "This connection can use only
  the apps and tools you chose for it in Executor. Changes you make there apply immediately." [S8]
- A scoped connection is chosen by the MCP URL: `…/mcp?connection=<id>` (id: 1–64 letters, digits, `_`, `-`). [S8]
- "An MCP credential is bound to one MCP URL, including its connection and elicitation_mode parameters." A token got
  at the plain URL does not work at a scoped URL, and the reverse. [S8]
- v1 has a similar idea: `…/mcp/toolkits/<slug>`. [S3] (What a toolkit holds: UNKNOWN.)

### 1.6 OAuth on Executor's side

| | Executor 1 [S3] | Executor 2 (local v2 build) [S8] |
|---|---|---|
| Protected resource metadata | `https://executor.sh/.well-known/oauth-protected-resource/mcp` (RFC 9728) | `<origin>/.well-known/oauth-protected-resource/mcp?…` |
| Authorization server | `https://signin.executor.sh` (WorkOS AuthKit; env default) | Executor's own OAuth server. The v1 edge forwards `/.well-known/oauth-authorization-server/api/auth` to v2 [S5], so the hosted issuer may be `https://executor.sh/api/auth` (EXTRAPOLATED) |
| `scopes_supported` | `openid profile email offline_access` | **UNKNOWN** |
| Client registration | **UNKNOWN** (metadata is fetched live from AuthKit) | Dynamic Client Registration on, unauthenticated registration allowed, PKCE required |
| Token lifetimes | **UNKNOWN** | Access 1 hour, refresh 30 days (local build defaults) |
| Endpoint rate limits | **UNKNOWN** | Register 60/min, token 20/min (local build) |
| Revocation endpoint | **UNKNOWN** | The auth library advertises `…/oauth2/revoke` (EXTRAPOLATED that hosted keeps it) |
| Consent screen | **UNKNOWN** | The Connect page tells people: "Sign in to Executor, choose your team and approve access." The consent summary names the access (all apps, or one scoped connection) and the approval mode. [S8] |

Hosted values for v2: all **UNKNOWN** until someone reads the live metadata. Tempo must read them at connect time, not
hard-code them.

---

## 2. Connect flow for a Tempo user

### 2.1 Step by step

| # | Who | What happens |
|---|---|---|
| 1 | Person | Opens Settings → Connections (`/settings/integrations`). Taps **Connect Executor**. |
| 2 | Web | Calls action `connections.startExecutorConnect`. Shows "Opening Executor…". |
| 3 | Convex action | Checks the account is approved (`requireApprovedUser`, as `mcp.createToken` does [S20]). Checks the feature switch. |
| 4 | Convex action | Sends one unauthenticated MCP request to `EXECUTOR_MCP_URL`. Expects `401` with `WWW-Authenticate: Bearer resource_metadata="…"`. If there is no header, tries the well-known URIs in spec order. [S12] |
| 5 | Convex action | Fetches the protected resource metadata. Checks `resource` equals the MCP URL. Takes `authorization_servers[0]`. [S12] |
| 6 | Convex action | Fetches authorization server metadata: RFC 8414 first, then OpenID discovery, in spec order. Checks `issuer` matches exactly; else stops. [S12] |
| 7 | Convex action | Stops if `code_challenge_methods_supported` is missing or lacks `S256`. [S13] |
| 8 | Convex action | Gets a client id. Uses a stored one for this issuer and redirect URI if present. Else registers with Dynamic Client Registration (`registration_endpoint`). See 2.3. [S11] |
| 9 | Convex action | Makes `state` (32 random bytes), a PKCE `code_verifier` and its S256 challenge. Saves a pending row: hash of `state`, encrypted verifier, issuer, resource, redirect URI, client id, user id, expiry (10 minutes, EXTRAPOLATED). |
| 10 | Convex action | Builds the authorization URL: `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, `state`, `scope` (see 2.3), and `resource=<MCP URL>` (RFC 8707: **MUST**, in both the authorization and the token request). [S10] Returns only this URL. |
| 11 | Web | `window.location.assign(url)`. |
| 12 | Person | Signs in to Executor, picks the team, approves. |
| 13 | Executor | Redirects to `GET {CONVEX_SITE_URL}/connections/executor/callback?code=…&state=…&iss=…`. |
| 14 | Convex HTTP route | Checks and exchanges the code (2.4). Encrypts and stores tokens. Marks the connection `connected`. |
| 15 | Convex HTTP route | Optional check: one MCP `tools/list` with the new token. |
| 16 | Convex HTTP route | `302` to `{SITE_URL}/settings/integrations?executor=connected`. Never puts a token or code in this URL. |
| 17 | Web | Reads `?executor=…`, shows a short toast, then removes the parameter from the address bar. |

Errors at step 14 redirect with `?executor=denied`, `?executor=expired` or `?executor=error`. Tempo never shows
Executor's `error_description` text. (The spec forbids acting on it when `iss` does not match. [S10] Showing it at all
adds nothing for the person.)

### 2.2 Where the redirect URI lives

| | A. Convex HTTP route (recommended) | B. Next.js route on the web app |
|---|---|---|
| URL | `{CONVEX_SITE_URL}/connections/executor/callback`. Prod: `https://precious-wildcat-890.eu-west-1.convex.site/…`. Preview: `https://ceaseless-dog-617.convex.site/…` [S21] | `https://www.tempoflow.dev/api/connections/executor/callback` (preview: `https://preview.tempoflow.dev/…`) [S21] |
| Where tokens are exchanged | Same place they are stored. One hop. | Next must pass `code` and `state` on to Convex. Two hops. |
| New code | One `httpAction` in `convex/http.ts`, like the RevenueCat webhook and `/mcp` routes [S20] | A Next route **and** a Convex endpoint for it to call |
| Logs | Convex logs. Whether they keep query strings: UNKNOWN | Vercel logs may keep the query string (holds the one-time `code`) (EXTRAPOLATED) |
| What Executor's consent screen shows | A `*.convex.site` host (less familiar to the person) | Tempo's own domain |
| Changes if Convex deployment changes | Yes: new redirect URI → re-register (automatic with DCR) | No |
| Ticket rule | Backend-only change (B07-07) | Touches `apps/web` **and** `convex/`, two tickets |

**Recommend A for B07.** It keeps tokens in one place and needs no web code. If Amit wants Tempo's domain on the
consent screen later, add a thin Next proxy route like `/api/mcp` today [S20]. The Convex contract does not change.
Whether hosted Executor accepts a `*.convex.site` redirect URI: UNKNOWN (spec: redirect URIs must be HTTPS or
localhost, which this is [S13]).

### 2.3 Client registration and scopes

- The spec order is: pre-registered client → Client ID Metadata Document (CIMD) → Dynamic Client Registration (DCR)
  → ask the user. [S11]
- In MCP `2026-07-28`, DCR is **deprecated** in favour of CIMD, but still allowed for servers without CIMD. [S11][S16]
- Executor 2 has DCR on [S8]. Whether hosted Executor supports CIMD: UNKNOWN.
- **B07: use DCR** (what Amit asked for: "client self-registration"). CIMD later, if Executor advertises
  `client_id_metadata_document_supported: true`. That needs a public JSON file on Tempo's web domain listing every
  redirect URI.
- DCR request (EXTRAPOLATED values): `client_name: "Tempo"`, `client_uri: {SITE_URL}`,
  `redirect_uris: [<callback>]`, `grant_types: ["authorization_code", "refresh_token"]`, `response_types: ["code"]`,
  `application_type: "web"` (the spec says clients **MUST** send a fitting value [S11]),
  `token_endpoint_auth_method`: `client_secret_basic` if the server lists it, else `none`.
- Keep one registered client per (issuer, redirect URI), shared by all users of that deployment. Key it by `issuer`.
  If the issuer changes, register again; never reuse a client id with another issuer. [S11]
- Scopes: use `scope` from the `WWW-Authenticate` challenge if present; else all `scopes_supported` from the
  protected resource metadata; add `offline_access` only if the authorization server lists it. [S10] For v1 that is
  `openid profile email offline_access` [S3]. For v2: UNKNOWN.

### 2.4 Callback checks (in this order)

1. Find the pending row by SHA-256 of `state`. Missing, used or expired → `?executor=expired`.
2. Mark it used in the same mutation (one use only), before any network call.
3. Check `iss` (RFC 9207, now a **MUST** in MCP `2026-07-28`): compare to the recorded issuer by plain string
   comparison. If the server says it sends `iss` and it is absent, reject. [S10]
4. If the query has `error`, stop → `?executor=denied`.
5. Token request: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`,
   `resource=<MCP URL>`. [S10]
6. Check the answer: `access_token` present, `token_type` Bearer. Note `expires_in`, `refresh_token`, `scope`.
7. Encrypt and save (section 3). Scrub the pending row's verifier.
8. Response headers: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`.
9. Redirect only to a fixed path on `SITE_URL`. Never to a URL taken from the request (no open redirect).

### 2.5 Connected state, reconnect, disconnect

| State | When | What the person sees (B07-08) |
|---|---|---|
| `not_connected` | No live connection | "Connect Executor" button |
| `connecting` | A pending row younger than 10 minutes | "Opening Executor…" |
| `connected` | Tokens saved and working | "Connected" badge, connected date, last used, **Disconnect** |
| `needs_reauth` | Refresh failed, or a second `401` after refresh, or the issuer changed | "Executor asked Tempo to sign in again." **Reconnect** |
| `unavailable` | The last call timed out or got `5xx` | "Executor isn't answering right now. Nothing changed." **Try again** |

**Disconnect** (`connections.disconnect`):

1. Ask once: "Tempo will stop using Executor. Your Executor account stays as it is."
2. If the server has a `revocation_endpoint`, revoke the refresh token, then the access token (RFC 7009), 5-second
   timeout each.
3. Scrub every encrypted field in Tempo and soft-delete the connection row, whatever step 2 returned.
4. Write an audit row (`disconnect`, revoked at Executor: yes/no).
5. If revocation failed or is not offered: "Disconnected in Tempo. To remove Tempo fully, open Executor and remove it
   there." How a person removes a client grant in hosted Executor: UNKNOWN (v2 has "Revoke connection" for scoped
   connections [S8]).

---

## 3. Token handling

### 3.1 Rules

- Tokens live in Convex only. They are never returned by any query, mutation or action. The browser only ever gets the
  authorization URL and a status.
- Tokens sit in their own table, read only by internal functions. Public queries read the connection row, which has no
  secret fields.
- Only Convex **actions** call Executor. Queries and mutations cannot call the network.
- The `Authorization: Bearer` header is built inside the fetch call and never stored or logged. Tokens never go in a
  URL. [S10]
- Tempo sends Executor only tokens that Executor's authorization server issued for that MCP URL. It never forwards a
  Tempo token or another service's token (no token passthrough). [S10][S13]

### 3.2 Encryption at rest

- AES-256-GCM with Web Crypto (`crypto.subtle`), a fresh 12-byte IV per value. (EXTRAPOLATED choice. Tempo already
  uses `crypto.subtle.digest` in Convex [S20]; whether `encrypt` with AES-GCM is available in Convex's default runtime:
  UNKNOWN. Fallback: a `"use node"` action with `node:crypto`.)
- Key: Convex env var **`TEMPO_CONNECTIONS_KEY`** (EXTRAPOLATED name): 32 random bytes, base64. A different value per
  deployment.
- Store `keyVersion` with every ciphertext so the key can be rotated. For rotation, an optional
  `TEMPO_CONNECTIONS_KEY_PREVIOUS` (EXTRAPOLATED) lets old values be read and re-encrypted.
- Additional authenticated data: `userId + connectionId + field name`, so a ciphertext cannot be moved to another row.
- Encrypted fields: access token, refresh token, DCR client secret (if any), PKCE verifier (pending rows).
- A missing key fails closed: connect is refused with a plain message, and nothing is stored in clear text.

### 3.3 Refresh

- Before each Executor call: if the access token expires within 60 seconds, refresh first.
- One refresh at a time per connection: take a short lease in a mutation (like `coach.claimTurn` [S20]). A second
  caller waits or reports "busy".
- Refresh request: `grant_type=refresh_token`, `refresh_token`, `client_id`, `resource=<MCP URL>`. Save the new
  refresh token if one comes back (public clients get rotated refresh tokens per the spec [S13]).
- On `401` from the MCP server: refresh once and retry once. A second `401` → `needs_reauth`.
- On `invalid_grant` from the token endpoint → `needs_reauth`, scrub tokens.
- On `403` with `error="insufficient_scope"`: do not loop. Set `needs_reauth` and ask the person to reconnect (step-up
  with the union of scopes [S10]).

### 3.4 Revoke on disconnect and on account deletion

- Disconnect: section 2.5.
- Account deletion today is a mutation (`softDeleteUserAccount`) that also revokes Tempo MCP tokens [S20]. Add:
  mark every Executor connection `revoking` and schedule an internal action (`ctx.scheduler.runAfter(0, …)`) that
  revokes at Executor and then scrubs. A sweep scrubs any row still `revoking` after 1 hour.
- Restoring a deleted account (30-day window) does **not** bring the connection back. The person connects again.

### 3.5 Never in the client, logs, screenshots or analytics

- Logs: error class names only, never messages, like `coach.reply` does today [S20]. Never log request or response
  bodies from Executor or its token endpoint.
- Analytics: no Executor tool names, inputs or results in PostHog. Count events only, if at all.
- Screenshots and e2e: the UI never renders a token, code, client id or client secret. E2E tests use a mocked
  connection; they never use a real Executor account.
- Error text shown to the person is Tempo's own copy, never text from Executor.

### 3.6 BLOCKED_USER_CHANGES (names only; Amit sets values, agents never do)

1. `TEMPO_CONNECTIONS_KEY` — new secret. Generate, save in 1Password `dev` first [S21], then set on the Convex test
   deployment (`ceaseless-dog-617`) and, at release, prod (`precious-wildcat-890`). Different value on each.
2. `EXECUTOR_MCP_URL` — new non-secret Convex env var. Confirm the value (`https://mcp.executor.sh/mcp` per Amit's
   reading; `https://executor.sh/mcp` per the v1 code).
3. `TEMPO_EXECUTOR_ENABLED` — new non-secret Convex switch, off by default (EXTRAPOLATED; a kill switch).
4. `SITE_URL` — exists on Convex already [S21]. Confirm it is the web origin on each deployment; the callback
   redirects there.
5. `CONVEX_SITE_URL` — built into Convex functions. Nothing to set; listed so nobody sets it by hand.
6. An Executor account for the real end-to-end check (Amit's own, free tier). Not an env var.

---

## 4. Tool policy for the coach

### 4.1 The policy

Tempo decides from the tool's own MCP annotations and a short Tempo list. The spec says annotations are hints and
clients **MUST** treat them as untrusted unless the server is trusted. [S14] Executor is the person's own account,
which is the trust we accept; the hints only ever make Tempo **more** careful, never less.

| Class | Which tools | Coach may run it… |
|---|---|---|
| **Auto** | `readOnlyHint: true` **and** `destructiveHint` not `true`, and on Tempo's allow list: `search`, `describe` (v2); `integrations`, `search` (v1 passthrough) | Without asking. Logged. Rate-limited. |
| **Card** | Everything else that is not blocked: `call`, `invoke`, `resume`, any tool with `readOnlyHint` false or missing, any unknown tool | Only after the person taps Accept on a Tempo approval card showing the exact tool, path and input. Every time. |
| **Blocked** | `execute` (runs a whole program; the card cannot preview its effects; up to 100 calls [S8]). `skills` for the coach (its text is instructions written by app authors, a prompt-injection path; Executor itself says "Skill text … never grant tool permissions" [S8]). | Never, in B07. |

Missing hints count as writing. The MCP defaults are `readOnlyHint: false` and `destructiveHint: true`. [S15]

### 4.2 Why `call` always needs a card

- `call` runs any app tool by path. Its MCP annotations describe `call` itself, not the app tool behind it. [S8]
- Search results do not carry a read/write flag. [S8]
- Executor 2 says approvals are declared per operation and "nothing is inferred from an operation looking read-only"
  [S9]. Tempo must not guess from a path like `…events.list` either.
- Executor's own approval only covers operations whose app asks for it. Other writes run at once. So Tempo's card is
  the only check that matches Tempo's rule ("asks you before every change it makes outside the app" [S19]).
- A later ticket can add "Always allow this read" per tool if Executor exposes a trustworthy read-only flag per app
  tool. Today: UNKNOWN whether it does over MCP.

### 4.3 The first coach flow (B07-08): "Look in my apps"

Goal: prove the whole path (consent, token, refresh, MCP call, policy, audit, errors) with no app data and no writes.

1. The coach shows a **Look in my apps** chip only when `connections.status` says `connected`.
2. The person taps it and types what they want ("my calendar", "email from school").
3. Action `coach.lookUpInExecutor({ conversationId, query })`:
   - `requireApprovedForAi` first, like `coach.reply` [S20];
   - rate check; refresh if needed;
   - MCP `tools/call` → `search` with `{ query }`, 15-second timeout;
   - one retry only on a network error (`search` is read-only);
   - audit row.
4. The reply is **templated, not model-written**: "Through Executor I can reach Google Calendar (3 tools) and
   Gmail (5 tools). I'll ask before I use any of them." Reasons: no model cost, nothing from Executor reaches the
   model, easy to test.
5. The saved assistant message carries `toolCalls.executorLookup = { query, apps: [{ name, toolCount }], total }`.
   No raw JSON is shown to the person (PRD: never) [S18].
6. Search results are not kept beyond that summary (promise: "Tempo doesn't keep copies of your messages" [S19]).

**Next step (not B07):** a card-gated `call` for one read (for example today's calendar), and only then results go to
the model, wrapped as untrusted data (section 6).

### 4.4 The approval card for later calls (outline for the ticket after B07)

- Reuse the coach proposal pattern: a proposal on the assistant message, `acceptProposal` / `rejectProposal`
  [S20]. New kind `externalCall`: `{ provider: "executor", tool: "call", path, input, why, effect: "read" | "change" |
  "unknown" }`, drawn from structured fields, never from model prose.
- Accept must be an **action** (it calls the network): mark accepted in a mutation, call Executor, record the outcome.
- The card says plainly: "This runs in your Executor account. Tempo can't undo it." (HARD_RULES §1 wants 5-minute
  Undo for AI changes [S17]; an external call cannot meet that. See section 8.)
- If Executor answers `approval-required` for the same call, Tempo shows that it is waiting, and resumes only with the
  person's explicit answer. Executor expires the request after 15 minutes. [S8]
- No confidence auto-apply for external calls (HARD_RULES §6.3 lists high-stakes categories that always need
  confirm [S17]).

### 4.5 Audit row (one per Executor call)

| Field | Notes |
|---|---|
| `userId`, `connectionId` | owner and connection |
| `tool` | MCP tool name (`search`, `call`, …) |
| `path` | app tool path for `call`, else empty |
| `decision` | `auto` / `approved` / `rejected` / `blocked` |
| `outcome` | `ok` / `error` / `approval_required` / `timeout` / `rate_limited` / `unauthorized` |
| `inputDigest` | SHA-256 of the input. Not the input. |
| `resultBytes`, `durationMs` | sizes and timing only |
| `messageId` | the coach message, if any |
| `createdAt`, `updatedAt`, `deletedAt` | HARD_RULES §5 audit fields [S17] |

No inputs and no results in the audit table. It is soft-deleted with the account and included in data export.

### 4.6 Rate limits (EXTRAPOLATED numbers; tune later)

| Limit | Value |
|---|---|
| Executor calls per coach turn | 1 in B07 |
| Executor calls per user | 30 per hour (window counter on the connection row, like `mcpTokens` [S20]) |
| Connect attempts per user | 5 per hour |
| Call timeout | 15 seconds |
| Result size accepted | 100 KB (matches Executor's own output cap for `execute` [S8]) |
| After 3 failures in 5 minutes | Skip Executor for 5 minutes, show "unavailable" |

Executor's own MCP rate limits on hosted: UNKNOWN. v1 has a per-organization execution rate limiter; numbers
UNKNOWN. [S3]

### 4.7 When Executor is down or says no

| Case | What the coach says (plain, no blame) | Status change |
|---|---|---|
| Timeout or `5xx` | "I couldn't reach Executor just now. Nothing changed. Want me to try again?" | `unavailable` (clears on next success) |
| `401` after one refresh | "Executor asked Tempo to sign in again. You can reconnect in Settings." | `needs_reauth` |
| Rate limited (Tempo or `429`) | "That's a lot of lookups for now. Let's try again in a bit." | none |
| App needs an account in Executor | "This app needs an account in Executor first. You can link it there." (Executor: "Never substitute another identity automatically." [S8]) | none |
| Not connected | Chip hidden. If called anyway: "Executor isn't connected." | none |

The coach chat keeps working without Executor in every case.

---

## 5. Proposed Convex shape (B07-07)

All names EXTRAPOLATED. Tables follow the repo's current pattern (`userId: v.id("users")`, `createdAt`, `updatedAt`,
`deletedAt`, `by_userId` indexes) [S17][S20].

### 5.1 Tables

**`connections`** (one live row per user and provider; no secrets)

| Field | Type |
|---|---|
| `userId` | `v.id("users")` |
| `provider` | `v.literal("executor")` (a union later) |
| `status` | `"connected" \| "needs_reauth" \| "unavailable" \| "revoking" \| "disconnected"` |
| `mcpUrl` | string (the resource) |
| `issuer` | string |
| `clientRowId` | `v.id("oauthClients")` |
| `scope` | optional string |
| `accountLabel` | optional string (if Executor sends one; UNKNOWN) |
| `connectedAt`, `lastUsedAt`, `lastErrorAt` | numbers |
| `windowStartMs`, `windowCount` | rate limit |
| `refreshLeaseUntil` | optional number |
| `createdAt`, `updatedAt`, `deletedAt` | audit |

Indexes: `by_userId`, `by_userId_provider_deletedAt`, `by_status` (for the sweep).

**`connectionSecrets`** (internal only; one row per connection)

| Field | Type |
|---|---|
| `connectionId` | `v.id("connections")` |
| `userId` | `v.id("users")` |
| `accessTokenCipher`, `refreshTokenCipher` | optional strings (base64 IV + ciphertext) |
| `accessTokenExpiresAt` | optional number |
| `keyVersion` | number |
| `createdAt`, `updatedAt`, `deletedAt` | audit |

Index: `by_connectionId`. On disconnect: set the cipher fields to `undefined` and stamp `deletedAt` (a scrub, not a
hard delete; HARD_RULES §5 forbids hard deletes [S17]).

**`oauthClients`** (one per deployment, issuer and redirect URI; shared)

`issuer`, `redirectUri`, `clientId`, `clientSecretCipher?`, `keyVersion`, `registrationEndpoint`, `tokenEndpoint`,
`revocationEndpoint?`, `authorizationEndpoint`, `codeChallengeS256: true`, `issParameterSupported?`, `createdAt`,
`updatedAt`. Index: `by_issuer_redirectUri`. No `userId` (not user data).

**`oauthPending`** (connect attempts; 10-minute life)

`userId`, `provider`, `stateHash`, `codeVerifierCipher`, `keyVersion`, `issuer`, `resource`, `redirectUri`,
`clientRowId`, `returnTo` (`"settings"` or `"coach"` only), `expiresAt`, `usedAt?`, `createdAt`, `updatedAt`,
`deletedAt?`. Indexes: `by_stateHash`, `by_userId`, `by_expiresAt`.

**`connectionCalls`** (audit; section 4.5). Indexes: `by_userId_createdAt`, `by_connectionId_createdAt`.

### 5.2 HTTP route

| Method and path | Handler |
|---|---|
| `GET /connections/executor/callback` | `connectionsHttp.executorCallback` (`httpAction`) — section 2.4 |

### 5.3 Public contract (what component tickets call)

| Name | Kind | Args | Returns |
|---|---|---|---|
| `connections.list` | query | none | `[{ provider, status, connectedAt?, lastUsedAt?, accountLabel?, scoped: boolean }]` — never secrets |
| `connections.status` | query | `{ provider: "executor" }` | `{ status: "not_connected" \| "connecting" \| "connected" \| "needs_reauth" \| "unavailable", connectedAt?, lastUsedAt?, enabled: boolean }` |
| `connections.startExecutorConnect` | action | `{ returnTo?: "settings" \| "coach" }` | `{ authorizationUrl: string }` |
| `connections.disconnect` | action | `{ provider: "executor" }` | `{ status: "disconnected", revokedAtProvider: boolean }` |
| `coach.lookUpInExecutor` | action | `{ conversationId, query }` | `{ status: "replied" \| "not_connected" \| "needs_reauth" \| "unavailable" \| "rate_limited" \| "busy" }` |

All of them: approved accounts only. `startExecutorConnect` and `lookUpInExecutor` also check
`TEMPO_EXECUTOR_ENABLED`.

### 5.4 Internal functions

| Name | Kind | Job |
|---|---|---|
| `connections.createPending` | internalMutation | save a pending row |
| `connections.consumePending` | internalMutation | find by state hash, mark used, return what the exchange needs |
| `connections.saveTokens` | internalMutation | write ciphertexts, set `connected` |
| `connections.secretsForCall` | internalQuery | ciphertexts for one connection (decrypted in the action) |
| `connections.claimRefresh` / `releaseRefresh` | internalMutation | refresh lease |
| `connections.markStatus` | internalMutation | `needs_reauth`, `unavailable`, back to `connected` |
| `connections.recordCall` | internalMutation | audit row + rate window |
| `connections.upsertOAuthClient` | internalMutation | DCR result per issuer |
| `connections.revokeForAccountDeletion` | internalAction | scheduled from account deletion |
| `connections.sweep` | internalMutation (cron, hourly) | scrub expired pending rows and stuck `revoking` rows |

Library code (plain functions, `fetch` passed in so tests need no network):

- `convex/lib/connections/crypto.ts` — AES-GCM encrypt/decrypt, key loading.
- `convex/lib/connections/oauth.ts` — discovery, DCR, PKCE, token, refresh, revoke.
- `convex/lib/connections/mcpClient.ts` — minimal Streamable HTTP JSON-RPC client over native `fetch` (HARD_RULES §2:
  native `fetch`, no HTTP libraries [S17]). It must accept both `application/json` and `text/event-stream` answers.
  Can reuse the JSON-RPC types in `convex/lib/mcp/jsonrpc.ts` [S20].
- `convex/lib/connections/policy.ts` — the auto / card / blocked table from 4.1.

Protocol version: start with `2025-11-25` (with `initialize`), which the v2 build lists [S8]. MCP `2026-07-28` drops
sessions and `initialize` [S16]; add it once hosted support is confirmed (UNKNOWN).

### 5.5 What the UI ticket (B07-08) needs

- **Settings → Connections** (`/settings/integrations`, design `settings-integrations.html` [S19]):
  - a new **Executor** row above "Coming later": name, one-line "Executor connects Tempo to the apps you already use.
    Tempo only looks, and asks before anything else.", and the state from 2.5;
  - **Connect Executor** → `connections.startExecutorConnect`, then `window.location.assign`;
  - **Disconnect** with a confirm dialog → `connections.disconnect`;
  - **Reconnect** for `needs_reauth`;
  - read `?executor=connected|denied|expired|error` once, toast, then `router.replace` without it;
  - when connected, the notice "Nothing is connected yet" must change;
  - English and Hebrew strings (the screen has both [S19]).
- **Coach**: the **Look in my apps** chip (only when connected), a small result card from `toolCalls.executorLookup`
  (app names and counts, no JSON), and the error copy from 4.7.
- **Never** render tokens, codes or client ids. Screenshots and e2e use a mocked `connections.status`.
- Mobile (Expo) is not covered here. The OAuth return on mobile needs a deep link: UNKNOWN whether B07-08 includes it.

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Prompt injection through tool results** (an email or calendar title that says "ignore your rules…") | B07: nothing from Executor reaches the model (templated reply). Later: wrap results in a delimited block labelled as data, cap size, strip links and markup, never let a result choose the next tool, and every non-read call still needs a card built from structured fields. The coach's output stays limited to today's proposal kinds, which already need Accept [S20]. |
| **Instructions from Executor skills** | `skills` blocked for the coach (4.1). |
| **Token leakage** | Server-side only; encrypted; separate internal table; no logs; no URLs; `no-store` on the callback; PKCE so a leaked `code` alone is useless; one-use `state` with a 10-minute life. |
| **Mix-up or fake authorization server** | Exact `issuer` check on metadata; `iss` check on the callback; PRM `resource` must equal the MCP URL; MCP URL comes from config, not from the person. [S10][S12] |
| **Open redirect** | Redirect only to fixed paths on `SITE_URL`; `returnTo` is an enum. |
| **Scope creep** (the plain URL grants "all apps available to you" [S8]) | Tempo's own policy limits what runs. Later: offer a scoped connection (Executor-side app list) as the guided path. |
| **Writes without Undo** | B07 has no write path. Later writes say "can't undo" on the card (section 8). |
| **Cost** | Executor usage counts against the person's own Executor plan (v1 free plan: 100,000 executions a month; pay-as-you-go $0.20 per 1,000 after [S6]; v2 pricing UNKNOWN). Tempo's rate limits cap it. B07 adds no model cost (templated reply). |
| **Executor down or changes its API** | Timeouts, `unavailable` state, kill switch `TEMPO_EXECUTOR_ENABLED`, coach keeps working. |
| **Endpoint confusion (v1 vs v2)** | Config URL + full discovery; nothing else hard-coded. |
| **Data leaves the EU** | Tempo prod Convex is `eu-west-1` [S21]; Executor v1 runs pinned to `aws:us-east-1` [S3]. Whether that matters for the privacy policy: owner decision (UNKNOWN legal). |
| **Pending accounts** | All contracts require an approved account, like coach and MCP tokens [S20]. |

---

## 7. UNKNOWN and EXTRAPOLATED

### 7.1 UNKNOWN

1. Whether `https://mcp.executor.sh/mcp` is the live hosted MCP endpoint (code read here uses `https://executor.sh/mcp`).
2. What the docs pages "The MCP endpoint" and "Add an MCP client" say (not readable from this sandbox).
3. The hosted v2 authorization server: issuer URL and its metadata.
4. Whether hosted Executor supports Client ID Metadata Documents.
5. Whether hosted v1 (WorkOS AuthKit) offers Dynamic Client Registration.
6. Hosted `scopes_supported` for v2.
7. Hosted token lifetimes and refresh-token rotation rules.
8. Whether hosted Executor offers token revocation (RFC 7009) for these clients.
9. How a person removes Tempo's grant inside hosted Executor.
10. Which MCP protocol versions hosted Executor accepts.
11. Whether the hosted tool list matches the v2 build (`search`, `describe`, `skills`, `call`, `execute`, `resume`).
12. Whether any MCP result exposes a per-app-tool read-only flag.
13. Hosted rate limits for MCP calls, registration and token requests.
14. Hosted v2 pricing and free-tier limits.
15. Whether hosted Executor accepts a `*.convex.site` redirect URI.
16. What Executor's consent screen shows about the client (name, redirect host).
17. Whether Executor returns an account label (email or team) to the client.
18. How Executor reports a revoked grant to a client (status code and body).
19. What a v1 "toolkit" holds.
20. Whether Convex HTTP logs keep query strings.
21. Whether AES-GCM `crypto.subtle.encrypt` works in Convex's default runtime.
22. Whether B07-08 covers mobile (Expo) and its deep-link return.
23. Whether sending data to a US-hosted Executor needs a privacy-policy change.

### 7.2 EXTRAPOLATED

1. `mcp.executor.sh` is Executor 2's MCP host (v2 keeps separate MCP and API origins).
2. Hosted Executor 2 behaves like the published v2 local build.
3. The hosted v2 issuer may be `https://executor.sh/api/auth`.
4. Env var names `TEMPO_CONNECTIONS_KEY`, `TEMPO_CONNECTIONS_KEY_PREVIOUS`, `EXECUTOR_MCP_URL`, `TEMPO_EXECUTOR_ENABLED`.
5. All table, field and function names in section 5.
6. The callback path `/connections/executor/callback`.
7. AES-256-GCM with key versions and row-bound associated data.
8. The 10-minute pending-state life.
9. The DCR request values in 2.3.
10. All rate-limit numbers in 4.6.
11. `elicitation_mode=model` is the right mode for Tempo.
12. A templated reply for the first coach flow.
13. Starting the MCP client at protocol `2025-11-25`.

---

## 8. Notes for ticket sync

1. **HARD_RULES §6.2** names `convex/proposals.ts`. It does not exist. Coach proposals live on
   `messages.toolCalls.coachProposal` with `acceptProposal` / `rejectProposal` / `undoProposal` in `convex/coach.ts`.
   [S17][S20]
2. **HARD_RULES §1** says every AI change can be undone for 5 minutes. A call that writes through Executor cannot be
   undone by Tempo. The rule needs an exception for external calls ("confirm, and say it can't be undone"), or
   external writes stay out. [S17]
3. **PRD F-100** says "heavy writes hard-refused". Amit's Track 2 brief says writes need approval in Tempo. "Heavy" is
   not defined. Decide before the first write ticket. [S18]
4. **TRD §6** says "Executor's call shape and env var names: UNKNOWN". It can link here. [S18]
5. **Screen name**: the design calls it "Connections"; the route and the English title say "Integrations"; Hebrew says
   "חיבורים" (connections). Pick one for B07-08. [S19]
6. **B07-07 scope**: section 5 is more than 3 files + 1 test (schema, `connections.ts`, `connectionsHttp.ts`,
   `http.ts`, four library files, account deletion hook). Split it, for example: (a) schema + crypto +
   `connections.ts`; (b) OAuth library + callback route; (c) MCP client + policy + `coach.lookUpInExecutor`.
7. **docs/ops/MCP.md** describes Tempo as an MCP server for Executor at protocol `2025-06-18`. MCP `2026-07-28` is the
   current spec and drops sessions and `initialize`. Not urgent, but worth a ticket. [S16][S20]
8. **Decision for Amit**: offer "use a scoped Executor connection" in B07-08, or later?

---

## 9. Sources

Executor (read 16 Oct 2026):

- **[S1]** Executor repo README, `UsefulSoftwareCo/executor` at `906bee5` (12 Oct 2026):
  https://github.com/UsefulSoftwareCo/executor — same HEAD as https://github.com/RhysSullivan/executor. The
  organization's public repo list (no Executor 2 source repo on it): https://github.com/orgs/UsefulSoftwareCo/repositories
- **[S2]** Executor 1 docs source: `apps/docs/mcp-proxy.mdx`, `concepts/policies.mdx`, `concepts/connections.mdx`,
  `hosted/cloud.mdx`, `index.mdx`:
  https://github.com/UsefulSoftwareCo/executor/tree/906bee5efc9b2bfc0d9341cd471a701314136144/apps/docs
- **[S3]** Executor Cloud v1 MCP auth: `apps/cloud/src/mcp/auth.ts`, `oauth-metadata.ts`, `jwt.ts`, `mount.ts`;
  `apps/cloud/wrangler.jsonc` (routes, placement, rate limiter):
  https://github.com/UsefulSoftwareCo/executor/tree/906bee5efc9b2bfc0d9341cd471a701314136144/apps/cloud
- **[S4]** Executor 1 MCP tools and annotations: `packages/hosts/mcp/src/tool-server.ts`:
  https://github.com/UsefulSoftwareCo/executor/blob/906bee5efc9b2bfc0d9341cd471a701314136144/packages/hosts/mcp/src/tool-server.ts
- **[S5]** v1 → v2 routing: `apps/cloud/src/edge/v2-edge-contract.json`, `apps/cloud/src/auth/v2-moved.ts`,
  `apps/cloud/wrangler.edge.jsonc`:
  https://github.com/UsefulSoftwareCo/executor/tree/906bee5efc9b2bfc0d9341cd471a701314136144/apps/cloud/src/edge
- **[S6]** Executor 1 plans: `autumn.config.ts`:
  https://github.com/UsefulSoftwareCo/executor/blob/906bee5efc9b2bfc0d9341cd471a701314136144/autumn.config.ts
- **[S7]** Executor Cursor plugin `mcp.json` (`https://executor.sh/mcp`):
  https://github.com/UsefulSoftwareCo/executor-cursor
- **[S8]** Executor 2 beta, npm `executor@2.0.0-beta.23` (15 Oct 2026) and its platform package
  `executor@2.0.0-beta.23-linux-x64`: https://www.npmjs.com/package/executor ·
  https://registry.npmjs.org/executor/-/executor-2.0.0-beta.23-linux-x64.tgz. Read as text only (README, web
  bundle strings, strings of the compiled runtime). Never run. Tool definitions, annotations, `elicitation_mode`,
  scoped connections, grant errors, OAuth server settings and limits come from here.
- **[S9]** Web search snippets of the live docs (pages themselves not reachable): https://executor.sh/docs ·
  https://executor.sh/docs/concepts/tools-and-approvals · https://executor.sh/docs/run/self-host ·
  https://executor.sh/docs/api-keys

MCP specification `2026-07-28` (read from the spec's GitHub source because modelcontextprotocol.io was not reachable):

- **[S10]** Authorization overview (roles, scope selection, `iss` check, resource parameter, token use, refresh,
  step-up): https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization ·
  source https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/index.mdx
- **[S11]** Client registration (CIMD, pre-registration, DCR deprecated, issuer binding):
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration
- **[S12]** Authorization server discovery (RFC 9728 and RFC 8414 order, issuer check):
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery
- **[S13]** Security considerations (audience binding, token theft, PKCE S256, redirect URIs, mix-up, confused deputy):
  https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations
- **[S14]** Tools (human in the loop; "clients MUST consider tool annotations to be untrusted unless they come from
  trusted servers"): https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- **[S15]** `ToolAnnotations` defaults (`readOnlyHint` false, `destructiveHint` true, `idempotentHint` false,
  `openWorldHint` true):
  https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts
- **[S16]** Changelog `2026-07-28` (stateless HTTP, no `initialize`, DCR deprecated, `iss` required):
  https://modelcontextprotocol.io/specification/2026-07-28/changelog

Standards named above: RFC 9728 (protected resource metadata) https://datatracker.ietf.org/doc/html/rfc9728 ·
RFC 8414 (authorization server metadata) https://datatracker.ietf.org/doc/html/rfc8414 · RFC 7591 (DCR)
https://datatracker.ietf.org/doc/html/rfc7591 · RFC 7636 (PKCE) https://datatracker.ietf.org/doc/html/rfc7636 ·
RFC 8707 (resource indicators) https://www.rfc-editor.org/rfc/rfc8707.html · RFC 9207 (`iss`)
https://datatracker.ietf.org/doc/html/rfc9207 · RFC 7009 (revocation) https://datatracker.ietf.org/doc/html/rfc7009 ·
OAuth 2.1 draft https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-13 · CIMD draft
https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00

Tempo (this repo, `integration` at `eb0b12c`):

- **[S17]** `docs/HARD_RULES.md` §1, §2, §5, §6.2, §6.3, §6.4, §13.
- **[S18]** `docs/PRD.md` (F-100, "never" list), `docs/TRD.md` §6, `docs/ROADMAP.md` (P3b).
- **[S19]** `docs/design/v3/screens/web/settings-integrations.html`; `apps/web/app/(tempo)/settings/integrations/page.tsx`;
  `apps/web/components/settings/IntegrationsList.tsx`; `apps/web/lib/i18n-groups/settings.ts` (`set.integ.*`).
- **[S20]** `convex/coach.ts` (proposals, Accept / Reject / Undo, 5-minute window, `claimTurn`, error logging);
  `convex/lib/approval.ts` (sign-up approval gate); `convex/lib/aiGate.ts`; `convex/http.ts`; `convex/mcp.ts`,
  `convex/mcpHttp.ts`, `convex/lib/mcp/*` (Tempo's own MCP server, token hashing, rate window);
  `convex/schema.ts` (`messages`, `mcpTokens`); `convex/lib/accountDeletion.ts`; `convex/lib/softDelete.ts`;
  `docs/ops/MCP.md`.
- **[S21]** `docs/ENVIRONMENTS.md` (deployments, secrets rule), `docs/DEPLOY.md` (`www.tempoflow.dev`),
  `docs/APP-FLOW.md` (`SITE_URL`), `factory/SLOTS.md` (secret names).
