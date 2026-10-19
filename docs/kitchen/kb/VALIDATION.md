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
