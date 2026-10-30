# Release step (Worker 6). DO NOT RUN until Scout Orchestrator says "loops stable".
Gate 0: 5-7 consecutive stable loops on integration, confirmed in writing by Scout. Not by me.

1. Freeze: note integration SHA and the current production deployment ID (rollback target).
2. Second CodeRabbit review on the release PR (integration -> main). Counts toward its limit; skip and stop if limit reached. Pass = no unresolved critical/major comments.
3. Cursor agent test of every change in preview: one mid-tier agent per merged PR since last release. It runs user-test/run-loop.sh against the release preview plus the PR's own acceptance steps. Pass = all YES.
4. Security gates (all must pass):
   - `npm audit --omit=dev --audit-level=high` = 0 high/critical
   - secret scan (gitleaks) = 0 findings
   - OWASP ZAP baseline against preview = 0 high (https://www.zaproxy.org/docs/docker/baseline-scan/)
   - Sign-in check list all YES (checklists/CHECKLISTS.md)
   - No change to repo permissions, tokens or security settings in the diff
5. Production, invite-only: merge release PR -> Vercel production build. Access limited to invite list. Mechanism: UNKNOWN (app-level allowlist or Vercel deployment protection; not confirmed in repos). Never change protection settings without Amit (AT).
6. Watch 60 min: user test against production + Vercel runtime errors.
7. Bug found -> instant rollback, no discussion:
   `vercel rollback <previous-deployment-url> --scope <team>` (https://vercel.com/docs/cli/rollback)
   or promote previous: `vercel promote <deployment-url>` (https://vercel.com/docs/cli/promote) / dashboard Instant Rollback (https://vercel.com/docs/instant-rollback).
   Then reopen the ticket as "send back for rewrite" and tell Scout.
Convex: live Convex never by hand (COMMON-RULES). Convex deploy path for release: UNKNOWN.
