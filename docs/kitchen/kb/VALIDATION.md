# KB lead validation — 19 Oct 2026

Only `docs/kitchen/kb/` changes in this draft. Source snapshot: `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The instructions in AGENTS.md required sandbox checks despite the user brief’s docs-only exemption. No checks were skipped to manufacture a pass.

## Document checks

- PASS: `bun -e "JSON.parse(require('fs').readFileSync('docs/kitchen/kb/queue.json','utf8'))"` on Bun 1.3.9.
- PASS: all 45 ticket files parse with the repository’s actual `frontMatter` export from `scripts/factory/scope-guard.mjs`; leading front matter preserves scope-guard compatibility.
- PASS: all required front-matter keys and ticket sections, exact queue/front-matter scope and dependency equality, 45 unique IDs, three batches of 15, one data ticket per batch, Astra data lanes.
- PASS: at most three implementation files and one test per ticket; no component backend/hot/route scope; one new copy group and CSS file per component ticket. Evidence outputs are separate and uniquely named.
- PASS: dependency graph is acyclic, queue order is topological, every KA file overlap is an explicit issue dependency, independent tickets have disjoint scopes.
- PASS: all 262 files under packages/ui and apps/web/components are present in the inventory (162 component modules and 100 supporting files). This proves census completeness, not visual conformance.
- PASS: `git diff --check`; changed-path assertion restricts every change to docs/kitchen/kb/.
- Planned count: 15 search / 19 history / 11 polish; 10 Astra / 35 Sol; 42 component / 3 data. Eleven entries have no unmerged product dependency.

These validations used temporary scripts under the execution workspace’s work directory; no validation tooling or product source was added outside the requested folder.

## Test results (cloud agent sandbox)

Bun **1.3.9**. No app, route, config, baseline or test file changed.

| Command | Result |
|---|---|
| `bun install --frozen-lockfile` | PASS, 2,000 packages installed |
| `bun run lint` | PASS, 0 errors; 10 existing warnings |
| `bun run typecheck` | PASS, 5/5 |
| `bun run test` | PASS, 3,301 pass / 0 fail / 3 TODO |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS, all four OK |
| `CI=1 bunx playwright test --reporter=line` | FAIL, 27 pass / 89 skip / 1 fail with installed Chromium 151 |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, 1/1 build task |

The browser failure is `tests/e2e/task-views-core.spec.ts:39`: after navigating to `/projects`, the test timed out waiting for the “Home reset” heading. Product code and this test are unchanged; the root cause is unresolved. This planning PR is complete as a draft artifact, but its checks are **not all green**. Fixing product code in this planning branch is outside its documentation-only scope; the later implementation authorization is handled in separate worker PRs.

The first browser attempt could not launch Playwright’s expected binary (1 pass / 88 skip / 28 launch failures). The CDN download returned HTTP 403. The rerun used the installed `/usr/bin/chromium` through a task-local `PLAYWRIGHT_BROWSERS_PATH`; no repository configuration changed. Bun’s release download also returned 403; the exact 1.3.9 binary was obtained from its version-pinned npm artifact. No real keys, accounts or preview/live URLs were used.

<details>
<summary>Last 20 lines: final browser run</summary>

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:4357) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:4400) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.7m)
```
</details>

<details>
<summary>Last 20 lines: initial missing-browser run</summary>

```text
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:26:7 › habits, brain dump and search wiring › /search mounts SearchScreen
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
    [chromium] › tests/e2e/wiring/harness.spec.ts:14:7 › wiring E2E harness › a route outside the wiring list still redirects
    [chromium] › tests/e2e/wiring/plan.spec.ts:9:7 › plan wiring › /plan shows the day timeline and not the scaffold placeholder
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/profile mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/preferences mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:7:7 › settings nags + memory wiring › /settings/nags renders the nags screen and nav links exist
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
    [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
  88 skipped
  1 passed (52.5s)
```
</details>

## Publication/owner gates

The draft is not a merge request. No labels, issue closures or review-bot requests are added. The initial PR had no linked lead issue, so scope-guard rejected it. The implementation follow-up now links a dedicated administrative planning issue #1176, whose scope is exactly docs/kitchen/kb/. No owner exception, label, rule change or false KA closure was needed. It is outside the KB-NN worker queue and authorizes no product implementation. Future backend tickets require Amit’s convex-arch label; Astra billing eligibility and held KA scopes remain owner decisions. Native accessibility and actual service behavior are UNKNOWN.


## Implementation follow-up: KB-69 expansion (19 Oct)

Amit subsequently authorized separate product implementation PRs. This planning branch still changes only `docs/kitchen/kb/`. KB-69 was expanded and filed as #1161 after source review; the other account/approval inventory rows remain explicitly assigned to later work. Independent UI workers use the lead-assigned Sol model under AGENTS; the original Astra planning lane is not an execution exception.

Documentation checks rerun after this update: queue JSON parses; all 46 tickets match the queue and pass the actual scope-guard front-matter parser; required fields, scope caps, component hot-file ban, dependency order, KA overlap dependencies, independent scopes, and all 262 inventory paths pass. Batches 1–3 retain 15 tickets and one data ticket each; batch 5 now includes the single expanded KB-69 component ticket. `git diff --check` passes. The application checks above apply to the unchanged integration product baseline; they were not rerun merely for this documentation update. Implementation PRs carry their own current checks and limitations.


## Further independently scoped follow-ups: KB-66 and KB-70

The lead expanded the reserved activity and notification titles after reviewing their real callers and existing APIs. KB-66 (#1165) covers final-chunk focus and truthful end-of-current-snapshot copy; KB-70 (#1166) covers delayed read focus and duplicate Mark all read submissions. Other surfaces from those broad titles remain explicitly residual inventory work. Both are component tickets with disjoint scopes, no KA dependency, three implementation files plus one test and evidence.

The queue now has 48 entries, including three expanded components in batch 5. JSON/front-matter identity, scope caps, data-ticket limits, dependency order, KA ownership overlaps, independent scopes and complete inventory checks pass after this update. Original application baseline results above remain unchanged; separate worker PRs report implementation checks.

## KB-06 planning correction

The title, goal, exact existing API contract and steps now match supported goal progress/state data. The unsupported milestone capability is explicitly not delivered and requires a future backend scope. All mandatory checks remain unchanged. The 48-ticket documentation validator and diff whitespace check pass; no application source changed in this planning branch.

## KB-67 independently scoped follow-up

KB-67 (#1169) now covers a verified cross-reminder draft/async-response defect in the mounted NagsScreen. Its existing API signatures are explicit; legacy unmounted nag modules remain residual work. The queue has 49 tickets, four expanded batch-5 components and fifteen independent jobs. Documentation schema, scope, dependency and full-inventory validation pass. No product source changed in this branch.

## KB-73 existing theme control polish

KB-73 (#1170) fixes a verified 36 px target and English-only accessible action label on the real landing theme button. All 107 open PR file lists were checked for a competing ThemeToggle writer; none was found. It adds no primary production view. The queue has 50 tickets, five expanded batch-5 components and sixteen independent jobs; documentation schema/scope/dependency/inventory checks pass.

## KB-74 mobile drawer focus repair

KB-74 (#1171) covers a source-confirmed mobile drawer keyboard/focus defect. All 107 open PR file lists show no active TempoShell writer. Held #858 gates its future workspace navigation feature; this distinct user-authorized repair leaves that ticket and its destinations unchanged and records serialization/rebase for later overlap. Sidebar is not edited (PR #1081/KA #1124 ownership). The queue has 51 tickets and seventeen independent assignments; documentation validation passes.

## Exact existing contracts and sixteenth implementation draft

The ten original polish tickets KB-02/03/04/05/07/08/09/10/44/45 now spell out their existing call-site function names, arguments and return shapes instead of delegating that information to source exports. These are verified integration APIs, not new backend work. KB-06 already received the same correction. Product scope, dependencies, behavior and required gates are unchanged. KB-73 now has draft PR #1173; the implementation index distinguishes sixteen pushed drafts from the 29 primary views and the still-pending KB-74. The 51-ticket documentation validator and diff whitespace check pass; no app checks are repeated for these docs-only changes.

## KB-71 shared phone button targets

The shared button primitive has 36/40 px variants mounted on real screens. KB-71 (#1175) now scopes a 44 px phone-target repair while preserving public/ref/asChild/form semantics and desktop sizes, with actual AdminApprovals and DayPlanPanel fixtures. All 109 open PR file lists (including complete pagination of four large PRs) and 285 open issue bodies had no competing exact-path owner; KA scopes do not overlap. It adds zero primary views. The queue now has 52 tickets: original45 plus seven batch-5 components; eighteen independent assignments. Documentation schema/scope/dependency/inventory validation passes. KB-74 is now pushed in draft PR #1174, bringing implementation drafts to seventeen.

## Rejected KB-68 candidates and route reachability correction

The lead did not file polish work merely to increase a count. BillingPlan's apparent null-plan spinner is hidden by the existing profile gate, so no visible defect was demonstrated. The legacy PaywallModal does omit accessible selected-plan state, but its only route callers, `/page2` and `/page3`, redirect to `/dashboard` in Next config before rendering; Navbar has no current static importer. The two payment inventory rows now distinguish static imports from an active mount. These modules need a later mount/retirement review, not an orphan gallery presented as live product polish. No payment, routing or source behavior was changed.

## Carry-over ownership and study dependency recheck

Live GitHub reads on 19 Oct confirm PR #1053 is an open draft from `kitchen/polish-pass` into integration, and PR #1081 is an open draft from `kitchen/tempo-study` into `kitchen/polish-pass`. PR #1053 already changes CarryOverStrip.tsx to add v3 rows, localized actions and visible mutation errors. KB-63 was not admitted as duplicate independent work; its title/inventory now call for residual focus, checkbox-label and weekday-locale review after that existing work lands. This run does not merge either PR or move their target branches.

## Planning issue linkage

The lead created administrative issue #1176 for this actual documentation artifact and linked it to PR #1140. Scope-guard permits only data/component classifications; the issue uses the stricter non-backend component classification, with documentation-only scope and no implementation files. It is not a 53rd worker ticket, a backend authorization or a dispatcher job. Local scope judgment against the complete PR path list passes. Existing sandbox failures remain reported; fixing this link does not turn those failures into passes.

## Open polish overlap and current remote checks

The broader 109-open-PR audit identified PR #1053 overlap for KB-02/10/44/69 that the initial KA-only ownership audit missed. Their expected merge is now small-conflict and their WHEN text requires reconciliation before integration; IMPLEMENTATION.md records the specific behaviors to retain. No product code or dependency contract changes. The 52-ticket schema/scope/DAG/inventory validation still passes. GitHub checks on planning head 772615a, including scope-guard after issue #1176 linkage, are green. The earlier local browser failure remains reported and is not erased by remote success.

KB-71 first source/test commit 9f26833 is pushed in draft PR #1177, bringing the implementation total to eighteen drafts and still 29 primary new views. Its browser evidence and formal local gates are pending at this snapshot.

## KB-75 independently scoped admin actions

The admin screen has a verified cross-row pending-state race and an active route mount. The 110-open-PR audit found no competing AdminApprovals host owner; KB-71 owns only shared Button. KB-75 now defines exact existing approval contracts, per-row request isolation, safe bilingual feedback and focus recovery without changing authorization/policy. Its two planned views are mounted in the same scoped host. The broader residual mount/retirement audit remains next-lead work, not an outcome claimed for this narrow repair. The queue has 53 tickets (50 component/3 data), 19 independent assignments, eight batch-5 expansions and 22 remaining title-only entries. No product source changed in this planning branch.

KB-75 first source/test commit 947e49f is pushed in draft PR #1179. The source-audited implementation count is now nineteen drafts and 31 primary new views; current checks and evidence remain pending for that new draft. The lead checked all 53 files with the actual scope-guard frontMatter parser and JSON parser, and the full documentation validator passes.

## 20 Oct continuation and KB-76

Document checks pass for all **54** written tickets: exact scope-guard front matter, Bun JSON parse, required sections, queue/scope/dependency consistency, 3 batches of 15 plus 8 batch-5 entries and KB-76 in batch 6, at most one data ticket per batch, hot-file restrictions, acyclic dependency order, all KA overlaps and disjoint independent scopes. All 262 inventoried paths remain covered. This documentation branch still contains no product changes.

The fresh ownership audit inspected 112 open PRs with 3,838 complete file entries and 288 active issues. All nineteen pushed implementation branches also passed an exact changed-file versus ticket-scope audit. KB-76 covers a separately verified source-traced Undo request ownership bug; its worker must reproduce it before claiming the fix. It adds no new primary view. Application validation is recorded per implementation PR; local disk/PATH/dependency failures remain in those reports even after environment-only repair. No baseline/config relaxation was made.

## KB-61/64 expansion and twentieth implementation draft

All **56** written tickets pass JSON parsing, the actual scope-guard front-matter parser and the full schema/scope/dependency/inventory validator. Counts: three original batches of fifteen, ten expanded batch-5 components, and KB-76 in batch 6; 53 component and 3 data tickets. Each original batch retains one data ticket. All 262 inventory paths are accounted for; this branch changes documentation only. KB-61/64 narrow existing reserved family titles to independently verified child-component bugs, without claiming the rest of those families polished. There are 22 filed assignments and 20 remaining title-only entries.

KB-76 is pushed in draft #1183 (source 499745a; evidence 13763ab), bringing the implementation count to twenty drafts and still 31 primary new views. Its original real-caller regression fails before the fix; final focused validation passes 27 cases, including both pointer and keyboard retry. The lead reviewed the before/after en/he, phone/desktop, light/dark contact sheet. Mandatory full gates remain pending at this snapshot. KB-75 final report preserves two local full-suite performance failures and one E2E navigation timeout despite passing GitHub checks; it is blocked, not production-ready.

## KB-77 shared Input target follow-up

The queue and exact scope-guard front matter now validate for **57** tickets (54 component, 3 data; 23 polish, 19 history, 15 search; 47 Sol and 10 Astra planning lanes). The full dependency/scope/262-path inventory validator passes. Batch 6 now has two independent component fixes; 20 reserved title-only entries remain, 77 total planned entries. KB-77 is issue #1184 and is active before first push; it polishes an existing mounted Input and adds no primary view. Its audit measured 40px phone geometry and found no owner among 113 open PRs / 3,847 complete file entries. Root changes remain documentation-only.

## Scope-parser correction from the KB-61 remote gate

The KB-61 remote scope gate exposed a lead validation mistake: KB-61/64/77 had valid YAML with indentless lists, but the repository's minimal frontMatter parser requires indented list entries and returned empty scopes. The previous check only asserted that the parser returned an object; its reported acceptance did not prove scope extraction. The three ticket files and issues #1181/#1182/#1184 now use two-space list indentation, with exactly the same six paths and no scope widening. No application, test, config or repair budget changed.

The strengthened check compares every parsed scope and dependency array plus ticket/run/type/lane/wave/browser/hold/overlap flags against queue.json. All **57** tickets now match exactly. The full YAML/schema/dependency/inventory validator also passes. Future leads must compare parsed values, not just parser truthiness. KB-61's next ordinary reporting update lets its scope check reread corrected issue metadata; no check was waived.

Reproduce the strengthened parser check from the repository root (Bun 1.3.9):

```sh
bun -e '
import { frontMatter } from "./scripts/factory/scope-guard.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
const root = "docs/kitchen/kb";
const queue = JSON.parse(fs.readFileSync(`${root}/queue.json`, "utf8"));
for (const ticket of queue) {
  const parsed = frontMatter(fs.readFileSync(`${root}/tickets/${ticket.id}.md`, "utf8"));
  assert.ok(parsed, ticket.id);
  assert.deepEqual(parsed.scope, ticket.scope, `${ticket.id}: scope`);
  assert.deepEqual(parsed.depends_on, ticket.deps.map(dep => typeof dep === "number" ? `#${dep}` : `TEMPO-${dep}`), `${ticket.id}: deps`);
  const expected = { ticket: `TEMPO-${ticket.id}`, batch: "KB", type: ticket.type, lane: ticket.lane, wave: ticket.batch, browser_test: ticket.type === "component", overlap_test: false, hold: false };
  for (const [key, value] of Object.entries(expected)) assert.equal(parsed[key], String(value), `${ticket.id}: ${key}`);
  assert.ok(["clean", "small-conflict"].includes(parsed.expected_merge), ticket.id);
}
console.log(`${queue.length} exact parser comparisons PASS`);
'
```

## KB-78 continuation, 20 Oct

Current counts: **58 written tickets**, 55 component / 3 data; 15 search / 19 history / 24 polish; 10 Astra / 48 Sol planning lanes. The initial three batches retain 15 tickets and one data ticket each. Batch 5 has ten expanded components, batch 6 has KB-76/77/78. Twenty title-only entries remain, 78 planned entries total. There are 24 filed implementation assignments, 23 pushed drafts and active KB-78 (#1188); the audited new-primary-view count remains 31.

KB-78's original real ExecutorConnection caller reproduces busy Confirm losing focus to BODY and Tab reaching the background while the alert dialog stays open, with exactly one fictional disconnect call. Complete file ownership excludes release-promotion #728 and finds no competing implementation owner. The Controls inventory row now records this verified finding. A separate named-import audit corrects six primitive rows whose barrel reachability had implied a /history mount without a named import. All 262 inventory paths remain present. ThemeProvider's source-traced storage-error/DOM-update gap is reserved by #1053 and is not a competing ticket.

KB-61 and KB-77 final reporting heads f8c7cc6 / 7912c5f pass all five required remote checks; their reported local E2E/install limitations remain. KB-77 additionally retains one full-suite history-normalization timing failure. KB-64 has 27 passing focused cases; full unit is 3,327 pass, 1 fail, 3 todo: unchanged page-summary closingTagsOpenOnEveryLine took 3,353.662ms against 3,000ms. E2E/build remain active. KB-76's final reporting head still fails scoped ci/Test after three rounds and remains stuck. No green historical head replaces a current failure.

Exact scope-guard value comparisons and the full schema/dependency/scope/inventory validator pass all 58 tickets. The root diff remains confined to docs/kitchen/kb/. Earlier numbered snapshots above are historical, not current totals.
