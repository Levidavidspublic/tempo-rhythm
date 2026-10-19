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

The browser failure is `tests/e2e/task-views-core.spec.ts:39`: after navigating to `/projects`, the test timed out waiting for the “Home reset” heading. Product code and this test are unchanged; the root cause is unresolved. This planning PR is complete as a draft artifact, but its checks are **not all green**. Fixing product code is outside the authorized scope.

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

The draft is not a merge request. No labels, issue closures or review-bot requests are added. Since Claude files the issues after this PR opens, there is no planning issue in a Closes clause; the existing scope-guard may reject that until an owner-approved planning issue exists. This is an acknowledged gate, not a falsely linked KA issue. Future backend tickets require Amit’s convex-arch label; Astra billing eligibility and held KA scopes remain owner decisions. Native accessibility and actual service behavior are UNKNOWN.


## Implementation follow-up: KB-69 expansion (19 Oct)

Amit subsequently authorized separate product implementation PRs. This planning branch still changes only `docs/kitchen/kb/`. KB-69 was expanded and filed as #1161 after source review; the other account/approval inventory rows remain explicitly assigned to later work. Independent UI workers use the lead-assigned Sol model under AGENTS; the original Astra planning lane is not an execution exception.

Documentation checks rerun after this update: queue JSON parses; all 46 tickets match the queue and pass the actual scope-guard front-matter parser; required fields, scope caps, component hot-file ban, dependency order, KA overlap dependencies, independent scopes, and all 262 inventory paths pass. Batches 1–3 retain 15 tickets and one data ticket each; batch 5 now includes the single expanded KB-69 component ticket. `git diff --check` passes. The application checks above apply to the unchanged integration product baseline; they were not rerun merely for this documentation update. Implementation PRs carry their own current checks and limitations.


## Further independently scoped follow-ups: KB-66 and KB-70

The lead expanded the reserved activity and notification titles after reviewing their real callers and existing APIs. KB-66 (#1165) covers final-chunk focus and truthful end-of-current-snapshot copy; KB-70 (#1166) covers delayed read focus and duplicate Mark all read submissions. Other surfaces from those broad titles remain explicitly residual inventory work. Both are component tickets with disjoint scopes, no KA dependency, three implementation files plus one test and evidence.

The queue now has 48 entries, including three expanded components in batch 5. JSON/front-matter identity, scope caps, data-ticket limits, dependency order, KA ownership overlaps, independent scopes and complete inventory checks pass after this update. Original application baseline results above remain unchanged; separate worker PRs report implementation checks.
