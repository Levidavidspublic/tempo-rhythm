# WALK — Default-off Voice Agent declaration, 22 October 2026

status: blocked (publication and full checks pending)
ticket: #1287

Only the canonical .env.example changes: one explanatory comment and blank TEMPO_VOICE_AGENT_ENABLED= declaration. The frozen parent is #1271 at 5d8182924f510409517718375542beb11c44134f. Every existing byte remains unchanged; no actual environment or runtime source was read or changed by this declaration task.

The comment documents server-only scope, literal true activation, blank/false OFF, protocol conformance required before activation, and independent Hebrew clinical routing OFF. It describes #1253's supplied admission/HTTP contract; this declaration does not implement, verify or enable that runtime gate. No provider keys, live calls, schema, packages, routes, deployment or charges.

## Test results (cloud agent sandbox)

Bun 1.3.9. Candidate 1 declaration verification PASS: exact appended two-line declaration/comment, only one new NAME, no duplicate active names, blank value. A blank separator also precedes the addition. No app test added for a documentation-only change.

UNKNOWN: bun install --frozen-lockfile; bun run lint; bun run typecheck; bun run test; all four scans; local Playwright; build; hosted CI; CodeRabbit and guards. Root owns the allocated checkout checks and publication. No screenshot is needed for a server-side template declaration.

Changed: .env.example plus this evidence folder only. parent.env.example and prepare.ts are scratch verification material and MUST NOT be published. Manifest records the exact final template hash.

notes for ticket sync: #1270/#1271 is the parent; #1253 consumes this name. This ticket grants no activation permission and does not claim live protocol conformance.
