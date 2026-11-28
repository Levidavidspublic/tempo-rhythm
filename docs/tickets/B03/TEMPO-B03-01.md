---
ticket: TEMPO-B03-01
batch: B03
type: data
lane: claude
scope:
  - convex/
depends_on: []
contract:
  - api.brain_dump.acceptPlan(args: {items: {title: string, urgency: "now"|"soon"|"later"}[]}) -> {created: number, taskIds: Id<"tasks">[]}
  - api.crisis.check(args: {text: string}) -> {isCrisis: boolean}
  - api.crisis.resourcesCard(args: {}) -> {title: string, body: string, resources: {label: string, detail: string}[]}
  - api.coach.sendMessage(args: {conversationId, content}) -> {success: true, crisis?: boolean}   # extended
  - api.coach.getSettings(args: {}) -> {dial: number, taskLoad: number, panicUntil: number|null, acceptedStreak: number}
  - api.coach.setDial(args: {dial: number}) -> {success: true}
  - api.coach.pressPanic(args: {}) -> {panicUntil: number, action: {text: string}}
  - api.coach.clearPanic(args: {}) -> {success: true}
  - api.coach.badDay(args: {}) -> {isBadDay: boolean, reason: "panic"|"low_activity"|null, suggestedLoad: number}
  - api.coach.currentProposal(args: {}) -> CoachProposal | null
  - api.coach.createProposal(args: {}) -> Id<"coachProposals">
  - api.coach.decideProposal(args: {proposalId, decision: "accept"|"reject"}) -> {status: "accepted"|"rejected", taskLoad: number}
  - api.nags.list(args: {}) -> Nag[]
  - api.nags.create(args: {label: string}) -> Id<"nags">
  - api.nags.addPhrase(args: {nagId, text: string, source: "user"|"derived"}) -> {phraseId: string}
  - api.nags.decidePhrase(args: {nagId, phraseId: string, decision: "accept"|"reject"}) -> {success: true}
  - api.nags.setEnabled(args: {nagId, enabled: boolean}) -> {success: true}
  - api.nags.remove(args: {nagId}) -> {success: true}
  - api.nags.proposePhrases(args: {nagId}) -> {proposals: string[]}
  - api.memory.remember(args: {content: string, sector?: Sector}) -> Id<"memories">
  - api.memory.recall(args: {query: string, limit?: number}) -> Memory[]
  - api.memory.list(args: {sector?: Sector, limit?: number}) -> Memory[]
  - api.memory.context(args: {limit?: number}) -> {text: string, count: number}
  - api.memory.forget(args: {memoryId}) -> {success: true}
  - api.memory.exportAll(args: {}) -> {filename: string, exportedAt: number, count: number, markdown: string}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: the 8 component tickets of batch B03 (TEMPO-B03-02 to TEMPO-B03-09)
WHEN: first in the batch; components depend on it
WHY: docs/PRD.md §5 "Nags: Phrases are the user's own words or derived from them. No stock copy, no emoji. A nag with no accepted phrase can't be switched on." §5 "Adaptive coach: Dial 0–10, panic button, bad-day detection, 10-second action, realism checker, forgiveness contract, graduated load 2→4 tasks. Accept / reject is law." §5 "Memory: One adapter (remember / recall / context / forget / export) on Convex over the existing `memories` table." §6 "the model proposes, the user accepts, code writes. The model never writes to the database." §6 "Crisis words return a fixed resources card, with no model call." §11 Q6 (brain dump kept as a page: UNKNOWN, so it is not kept).
GOAL: provide every NEW function in docs/contracts/B03.md with exactly the listed args and return shapes
SCOPE: convex/ only (schema, functions, tests, and the regenerated convex/_generated/)
MUTATES: convex/schema.ts (new tables `nags`, `coachSettings`, `coachProposals` with the indexes in the contract; `memories` unchanged); new convex/nags.ts, convex/memory.ts, convex/crisis.ts; extend convex/coach.ts (new queries/mutations, and a crisis branch in `sendMessage`) and convex/brain_dump.ts (add the `acceptPlan` mutation beside the existing `prioritize` action); new pure helpers convex/lib/crisisWords.ts, convex/lib/nagPhrase.ts, convex/lib/coachLoad.ts, each with a test; regenerated convex/_generated/
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`) for convex/ and the callers of `memories`, `tasks`, `conversations` and `coach.sendMessage`; read convex/lib/requireUser.ts, convex/memories.ts, convex/brain_dump.ts, convex/coach.ts and convex/tasks.ts.
2. Schema: add `nags`, `coachSettings`, `coachProposals` as in the contract's Schema section. Do not change existing tables.
3. convex/lib/crisisWords.ts: a fixed lower-case word/phrase list and `isCrisisText(text)`. convex/crisis.ts: `check` and `resourcesCard`. The card text is fixed in code, generic, and says plainly that country-specific numbers are not set up yet (PRD §6: per-country source UNKNOWN). It never calls `callLLM`.
4. convex/coach.ts: extend `sendMessage` so crisis text stores the user message plus the fixed card as the assistant message and returns `{success: true, crisis: true}` with no model call; non-crisis behaviour and existing tests stay unchanged. Add `getSettings`, `setDial`, `pressPanic` (one 10-second action from a fixed list, picked by code), `clearPanic`, `badDay`, `currentProposal`, `createProposal`, `decideProposal` per the contract. Put the load rule in convex/lib/coachLoad.ts as pure functions: 3 accepts in a row -> +1 up to 4; reject -> 2; bad day -> 2; realism = sum of task minutes against available minutes (minutes from the task's estimate field if it has one, else 25). Copy never shames.
5. convex/nags.ts: `list`, `create`, `addPhrase`, `decidePhrase`, `setEnabled`, `remove`, `proposePhrases`. convex/lib/nagPhrase.ts: `validatePhrase(text)` rejecting empty text, text over 140 characters and any emoji (regex `\p{Extended_Pictographic}`). `proposePhrases` is an action: load the nag through an internal query, call `callLLM` (tier "fast") with the accepted user phrases, return at most 3 strings, write nothing; map `AiAuthError`, `AiRateLimitedError` and `AiUpstreamError` to friendly errors as convex/brain_dump.ts does.
6. convex/memory.ts: `remember`, `recall`, `list`, `context`, `forget` (soft delete), `exportAll` (markdown, one section per sector, filename `tempo-memories-YYYY-MM-DD.md`). Exclude rows with `deletedAt`. Use `requireUser`. Leave convex/memories.ts untouched.
7. convex/brain_dump.ts: add the `acceptPlan` mutation (1 to 6 items, trimmed non-empty titles; inserts `tasks` rows like `tasks.createQuick`: now=high, soon=medium, later=low, status todo). Nothing else is stored.
8. Tests: pure tests for crisisWords, nagPhrase and coachLoad; convex tests for nags, memory, coach and `brain_dump.acceptPlan` in the style of convex/coach.test.ts and convex/notes.test.ts.
9. Regenerate and commit `convex/_generated/` (`bunx convex codegen`; needs Convex auth, see factory/SLOTS.md). If codegen cannot run, report `blocked: missing secret <NAME>` and stop.
10. `bun run lint && bun run typecheck && bun run test`.
11. Note: it deploys to the TEST deployment (ceaseless-dog-617) only on merge, via convex-deploy-test. Never deploy yourself.
DONE: every NEW contract name exists in convex/_generated/api.d.ts with the listed shapes; `bun test convex` passes including the new tests; lint and typecheck green.
EVIDENCE: test output; list of contract names -> file:line; `grep -c callLLM convex/crisis.ts convex/lib/crisisWords.ts` prints 0 for both.
DO NOT:
- don't change files outside convex/
- don't deploy; never touch the live deployment
- don't rename or remove existing functions other tickets use (`coach.sendMessage` keeps its args; its return only gains an optional `crisis`)
- don't write any model output to the database except through a mutation the user triggered by accepting
- don't edit apps/, packages/ or docs; hot files (pages, nav) go to the merge agent through REPORT
REPORT: contract names created (file:line), anything that couldn't match the contract and why. Notes for ticket sync: the per-country crisis data source (PRD §6) and nag delivery beyond in-app (PRD §11 Q2) are UNKNOWN. Include the hot-file list from docs/contracts/B03.md.
