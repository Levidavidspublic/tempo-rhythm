# DEPLOY: release integration to production (one click)

For Amit. Workflow: `.github/workflows/release.yml` ("Release to production"). Script: `scripts/factory/release-gate.mjs`.
Times are Israel time (IDT).

## The button

1. GitHub → **Levidavidspublic/tempo-rhythm** → **Actions**.
2. Left list: **Release to production**.
3. Right side: **Run workflow** ▾ → branch **integration** (the default) → leave **Dry run** unticked → green **Run workflow**.

That is the only click. Only your account (Division6066) can run it. Anyone else's run stops in the first step.
Tick **Dry run** to run the whole gate without merging. Nothing goes live in a dry run.

## What it checks (the second gate)

All checks run on the exact integration commit you released (the "gate SHA").

1. **Preflight.** Pins the gate SHA. Checks that master can take the release: rulesets, history, merge method, token. A real run stops here if something is wrong. A dry run reports it and keeps going.
2. **Release PR.** Opens or updates one PR, integration → master, titled `Release YYYY-MM-DD`, label `release`, opened by Division6066.
3. **Full CI** on the gate SHA: lint, typecheck, unit tests, scans (forbidden tech, RAM-only, design tokens), third-party notices, local Playwright E2E, build.
4. **Secret scans**: gitleaks, trufflehog, scanner self-test. They cover every commit since master.
5. **Playwright against the integration preview.** It waits for the Vercel preview of the gate SHA. It runs the whole suite there with the protection bypass. If Vercel skipped that commit (no app change), it tests preview.tempoflow.dev, which serves the same app code.
6. **One Cursor Bugbot review** of the whole release PR. It runs only after steps 3 to 5 are green, so a red CI never costs a Bugbot run. If Bugbot already reviewed this exact SHA, that review counts. Otherwise the workflow posts `@cursor review` once.

Any red check or any Bugbot finding stops the release. The PR gets `blocked:amit` and a comment that lists what failed. There is no auto-fix on a release. Fix it on integration, then click again.

## Then it ships (real run only)

7. Waits until GitHub says the release PR can merge (the master ruleset's required checks are green).
8. **Convex prod** (precious-wildcat-890) deploys only if `convex/` changed since master. It deploys before the web, so the new web never calls missing functions.
9. Merges the release PR, pinned to the gate SHA. If integration moved during the gate, the merge refuses and you click again.
10. Checks that master now has exactly the tested code (master's tree equals the gate SHA's tree).
11. The master push makes Vercel deploy **tempo-web** to production. The workflow waits for that deployment to be READY.
12. Calls https://www.tempoflow.dev/api/health and checks it reports the new master commit.
13. Writes the result in the run summary and as a comment on the release PR.

## How long

Usually about 20 to 35 minutes:
- preflight and the PR: 1 to 2 min
- CI, scans and preview E2E, in parallel: about 5 min
- Bugbot: about 5 to 15 min (a big release takes longer)
- Convex (only when it changed): about 2 min
- Vercel production build: about 3 to 5 min, then the health check

Hard limits: 35 min for Bugbot, 60 min for the PR checks, 30 min for the Vercel deployment.

## What you'll see

- The run page shows each job: preflight, release PR, gate CI, gate secret scans, gate E2E on preview, gate Bugbot, gate verdict, release PR mergeable, Convex prod deploy, merge + verify production.
- Green run = live. The summary shows the merged master commit, the Vercel deployment link, and "commit … matches" from /api/health.
- Red run = stopped. The summary and the PR comment say where and why. If it stopped before the merge, nothing changed in production.
- Dry run = it stops after "gate verdict" with "Dry run: release gate GREEN" (or red), and a PR comment.

## Roll back (manual, never automatic)

**Web (Vercel, seconds):**
1. vercel.com → team **amit-levins-projects** → project **tempo-web**.
2. Production Deployment tile → **Instant Rollback** → pick the previous production deployment → **Continue** → **Confirm Rollback**. (Or Deployments tab → ⋮ on that row → Instant Rollback.)
3. CLI alternative: `vercel rollback <previous-deployment-url> --scope amit-levins-projects`.
4. Important: after a rollback Vercel stops putting new master pushes live. Before the next release, open tempo-web and click **Undo Rollback** (or `vercel promote <deployment-url>`). If you don't, the next release builds but stays hidden, and the health check fails.

**Convex (only if that release deployed Convex):**
1. Convex dashboard → production deployment **precious-wildcat-890** → Deployments → promote the previous deployment.
2. Or check out the last good commit and run `npx convex deploy` with the prod deploy key. Never paste the key anywhere.

**The code:** the bad change is still on master and integration. Revert it on integration with a normal PR, then click Release again.

## One-time setup before the first real release (Amit, in GitHub settings)

Status 6 Oct 2026, ~12:50 IDT. Steps 2 to 6 are **done** (approved by Amit 12:44 IDT; JSON backups of every setting before the change are kept outside the repo). Only step 1, the token, is still open.
The workflow checks all of these in preflight and names any that are missing. A dry run works before they are done. It just reports them.

1. **Release token (OPEN).** Add repo secret `FACTORY_BATCH_TOKEN`: a Division6066 fine-grained token, repo tempo-rhythm only, 365 days max. Permissions: Contents, Pull requests, Issues and Workflows = Read and write; Administration = Read only, so preflight can read master protection (Metadata read is automatic). The repo is public, so reading checks and deployments needs nothing extra. The workflow uses it to open the PR, ask Bugbot, label and merge. Workflows write is needed because a release merges workflow files into master.
2. **(done)** **factory-live ruleset** (Settings → Rules → Rulesets → factory-live): delete the rule **Restrict updates**. With no bypass list, it blocks every merge into master, including yours. Also untick **Require branches to be up to date before merging**. Keep the 5 required checks.
3. **(done)** **Classic master protection** (Settings → Branches → master): untick **Require branches to be up to date** and **Require linear history**.
4. **(done)** **Allow merge commits** (Settings → General → Pull Requests). The release uses a merge commit, so master keeps integration's history and the next release has no conflicts. The integration merge queue stays squash.
5. **(done: integration 58c296b, tree unchanged; temporary bypass removed)** **One-time history sync.** Today master's tip (007d28a, the 4 Oct squash of #327) is not in integration's history. That makes integration → master conflict in 40 files. Record it once in integration with a merge that changes no files. Integration's ruleset allows no direct push, so add yourself as a bypass on factory-integration for a minute, then:
   ```bash
   git fetch origin
   git checkout -B release-sync origin/integration
   git merge -s ours origin/master -m "sync: record master in integration history (no file changes)"
   git diff --stat origin/integration HEAD   # must print nothing
   git push origin release-sync:integration
   ```
   Then remove the bypass. Alternative: reset master to 06bde50, which has the same files as 007d28a. That is a force push to master, so it is your call.
6. **(done)** **Convex prod key** (only when a release changes `convex/`, which the first one does): environment secret `CONVEX_DEPLOY_KEY_LIVE` on the GitHub environment **Production**. It must be a deploy key for `prod:precious-wildcat-890`. The workflow checks the prefix and never prints it.
   Recommended hardening (still open): Settings → Environments → **Production** → Deployment branches and tags → **Selected branches**: `integration` and `master`. Today any branch's workflow job that names `environment: Production` can read this key.

Why not squash into master? A squash commit is never in integration's history. So every later release conflicts again and needs step 5 again. If you still want squash, set repo variable `RELEASE_MERGE_METHOD=squash` and redo step 5 after each release.

## Optional: a second click (off by default)

You asked for one click, so the merge needs no approval. If you ever want a confirm button, create a GitHub environment named `release-approval` with required reviewer Division6066. Then add `environment: release-approval` to the `pr-ready` job in release.yml (one line, config PR). GitHub then shows **Review deployments → Approve** after the gate is green. Don't put the reviewer on **Production**: Vercel also writes that environment, and the Convex job uses it.

## Settings it reads (names only)

| Name | Kind | Needed for | Exists (6 Oct 2026) |
|---|---|---|---|
| `FACTORY_BATCH_TOKEN` | repo secret | PR, Bugbot request, labels, merge | **no** |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | repo secret | Playwright on the protected preview | yes |
| `CONVEX_DEPLOY_KEY_LIVE` | secret on environment Production | Convex prod deploy (only when convex/ changed) | yes (set 6 Oct) |
| `RELEASE_MERGE_METHOD` | repo variable, optional | `merge` (default) or `squash` | not set (merge) |
| `RELEASE_PREVIEW_SPECS` | repo variable, optional | narrow the preview Playwright run | not set (whole suite) |
| `RELEASE_PREVIEW_URL` | repo variable, optional | fallback preview URL | not set (preview.tempoflow.dev) |
| `RELEASE_PRODUCTION_ENVIRONMENT` | repo variable, optional | Vercel's GitHub deployment environment | not set (Production) |
| `RELEASE_HEALTH_URL` | repo variable, optional | health URL | not set (www.tempoflow.dev/api/health) |

`deploy-live.yml` skips master pushes made by this workflow (commit trailer `Release-Workflow: release.yml`). That way one release never deploys twice.
