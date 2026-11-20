# Sign-up approval gate (TEMPO-GATE-01 #687 / TEMPO-GATE-02 #688)

Amit approves every new account before it can use Tempo. After approval the person signs in freely.

## How it works
- New accounts are stored with `users.approvalStatus = "pending"` (Convex, `convex/lib/approval.ts`).
- A signed-in pending or revoked account sees only the **Waiting for approval** screen on every app route (`apps/web/components/approval/ApprovalGate.tsx`, wrapped around the `(tempo)` and `(bare)` layouts).
- Server side, every function that spends model money or writes coach chat rejects non-approved accounts with `ACCOUNT_PENDING_APPROVAL` before any provider call: `brain_dump.prioritize`, `nags.proposePhrases`, `memories.extractMemories`, `coach.sendMessage`, `messages.create`, `conversations.create`. New AI actions must call `requireApprovedForAi(ctx)` first.
- Accounts created before 7 Oct 2026 00:00 IDT with no status count as approved (existing users, e2e test users).
- Admins (always approved): `role: "admin"` on the users row, or an email in the Convex env var `TEMPO_ADMIN_EMAILS` (comma separated).

## Approve / revoke
- **Admin page:** `/admin/approvals` (signed in as an admin). Approve, Revoke, Back to pending.
- **CLI** (needs the deployment's deploy key; add `--prod` for live, Amit only):
  ```bash
  npx convex run approval:listByStatus '{"status":"pending"}'
  npx convex run approval:setStatusByEmail '{"email":"someone@example.com","status":"approved"}'
  npx convex run approval:setStatusByEmail '{"email":"someone@example.com","status":"revoked"}'
  ```
- **New e2e test user:** sign it up once, then approve it with the CLI line above on `ceaseless-dog-617`.

## Env vars (names only)
| Name | Where | Purpose |
|---|---|---|
| `TEMPO_ADMIN_EMAILS` | Convex (test + live) | admin emails, comma separated |
| `DEEPINFRA_API_KEY` | Convex (test + live) | the one AI provider key |
| `TEMPO_AI_MODEL` | Convex (optional) | model id, default `deepseek-ai/DeepSeek-V4.1-Flash` |

## Not in this version (PRD F-01a stricter form)
PRD F-01a also says the magic link is sent only after approval (a `signupRequests` row). Today a pending person can receive the link and sign in, but sees only the waiting screen and can't reach any AI/chat function. Moving the check before the email is a follow-up.
