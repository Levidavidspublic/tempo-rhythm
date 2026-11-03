# Feature test — 2026-10-06

**16 works, 5 broken, 39 not-wired.** Draft only. Do not merge.

Approved re-run (after 13:16 IDT): brain-dump AI on `/today` works, coach chat send works and survives reload. `/brain-dump` Sort it is still the scaffold. `/settings/nags` is still 404, so phrase suggestions were not reached. The earlier `ACCOUNT_PENDING_APPROVAL` errors were the approval gate doing its job while this inbox was pending. That gate row is **works**.

| | |
|---|---|
| Base URL | `https://preview.tempoflow.dev` |
| `/api/health` commit | `9f097bf` |
| Run time | Sweep about 13:35 IDT. Approved re-run about 13:46 IDT. |
| Sign-in | Magic link for the approved disposable inbox. Storage state stayed in `/tmp`. |
| Playwright browser | system Chrome (`channel: "chrome"`). This sandbox does not have Playwright's downloaded Chromium. |

The integration deployment `https://tempo-1hhdkf59f-amit-levins-projects.vercel.app` returned HTTP 302 to Vercel SSO. `VERCEL_AUTOMATION_BYPASS_SECRET` was unset, so that host was not used. `preview.tempoflow.dev` returned HTTP 200 with no `x-vercel-mitigated` header.

While that inbox was pending, coach returned `ACCOUNT_PENDING_APPROVAL: your account is waiting for approval.` After approval, the same inbox got a coach reply and a server brain-dump plan.

## Top breaks

1. **Calendar add is refused.** The Day/Week/Month screen is there. Submit shows `Sign in again to add calendar events.` The new title never appears.
2. **Notes pin did not stick.** A note title was entered. The control never became Unpin. The saved shot is the sign-in wall.
3. **Insights stays on skeletons.** The heading is there. The cards are empty pulses. No numbers, calm empty copy, or Retry in the shot.
4. **`/settings/passkeys` stays on the sign-in wall** while the same session could open `/today` and `/tasks`.

## Not wired yet (waiting on f3-2 / B05)

These routes do not mount the merged component. Scaffold means the old Beta preview screen (`Continue in beta`).

- `/today` — real Today screen, but no DayPlanPanel, CarryOverStrip, HabitCheckInStrip, or DayPlanSummary. Carry-over also returns nothing when there are no older tasks, so an empty strip cannot be told apart from “not mounted”.
- `/plan` — scaffold. No DayTimeline, no TimeBlockDialog.
- `/habits` — HabitsScreen is mounted (`Add a tiny habit`). HabitsLibrary (`#habits-library-name`) is not. `/habits/[id]` is scaffold, so the 6-week grid is absent.
- `/brain-dump` — still scaffold after approval, so Sort it is not mounted. The live AI control is “Turn this into a plan” on `/today`, and that one works.
- `/settings/nags` and `/settings/memory` — still HTTP 404 after approval, so phrase suggestions were not reached.
- `/templates`, `/templates/run/starter:daily-page`, `/templates/builder?from=starter:daily-page` — scaffold.
- `/onboarding`, `/settings/profile`, `/settings/preferences`, `/billing`, `/search` — scaffold.
- Smoke scaffolds: `/journal`, `/routines`, `/routines/missing-sweep-id`, `/goals`, `/goals/progress`, `/goals/missing-sweep-id`, `/activity`, `/command`, `/ask-founder`, `/empty-states`, `/daily-note`, `/settings/integrations`, `/templates/sketch`, `/billing/trial-end`, `/about`, `/changelog`.

Shell greeting on `/today` used the mailbox name, not the word User. The profile form itself is still the scaffold, so the delete-account guard was not tested.

## Re-run after f3-2 lands

```bash
node scripts/e2e/magic-link-login.mjs --base "$PLAYWRIGHT_BASE_URL" --out /tmp/tempo-state.json
PLAYWRIGHT_BASE_URL=<url> TEMPO_E2E_STORAGE_STATE=/tmp/tempo-state.json VERCEL_AUTOMATION_BYPASS_SECRET=<from env> bunx playwright test tests/e2e/feature-sweep.spec.ts --reporter=list
```

Use an approved test user if you need coach. A brand-new mail.tm inbox hits `ACCOUNT_PENDING_APPROVAL`.

## Results

| PR | Feature | Route | Status | Error | Screenshot |
|---|---|---|---|---|---|
| #599 | DayPlanPanel (intention, top tasks, energy) | /today | not-wired | component heading/controls absent | docs/reports/feature-test-2026-10-06/dayplanpanel-intention-top-tasks-energy.png |
| #598 | CarryOverStrip | /today | not-wired | heading absent. CarryOverStrip returns null when there are no older open tasks, so an empty list is indistinguishable from not mounted | docs/reports/feature-test-2026-10-06/carryoverstrip.png |
| #633 | HabitCheckInStrip | /today | not-wired | component heading/controls absent | docs/reports/feature-test-2026-10-06/habitcheckinstrip.png |
| #643 | DayPlanSummary (one-tap done) | /today | not-wired | component heading/controls absent | docs/reports/feature-test-2026-10-06/dayplansummary-one-tap-done.png |
| #603 | DayTimeline | /plan | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/daytimeline.png |
| #625 | TimeBlockDialog | /plan | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/timeblockdialog.png |
| #635 | HabitsLibrary | /habits | not-wired | component heading/controls absent; HabitsScreen is mounted instead | docs/reports/feature-test-2026-10-06/habitslibrary.png |
| #638 | HabitDetail 6-week grid | /habits/missing-sweep-id | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/habitdetail-6-week-grid.png |
| #632 | Brain dump Sort it | /brain-dump | not-wired | ScaffoldScreen (Beta preview). Sort it is not mounted. Re-checked after approval. | docs/reports/feature-test-2026-10-06/brain-dump-sort-and-accept.png |
| #632 | Brain dump AI (Turn this into a plan) | /today | works | Server planner returned 4 ordered lines (Reply to Sam now, kettle, walk, receipt) after the account was approved. | docs/reports/feature-test-2026-10-06/brain-dump-ai-approved.png |
| #632 | Brain dump crisis card | /brain-dump | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/brain-dump-crisis-card.png |
| #637 | Coach dial and panic | /coach | not-wired | ACCOUNT_PENDING_APPROVAL: your account is waiting for approval. Coach dial is not on the page. | docs/reports/feature-test-2026-10-06/coach-dial-and-panic.png |
| #644 | Coach daily proposal | /coach | not-wired | ACCOUNT_PENDING_APPROVAL: your account is waiting for approval. Plan my day is not on the page. | docs/reports/feature-test-2026-10-06/coach-daily-proposal.png |
| #647 | Coach crisis card | /coach | broken | Recorded while the inbox was pending: message input stayed disabled. Not re-sent after approval. | docs/reports/feature-test-2026-10-06/coach-crisis-card.png |
| old | Coach chat send and reload | /coach | works | After approval, send survived reload. Reply: What's the smallest step you could take without any resistance? Start there — that's the whole assignment. | docs/reports/feature-test-2026-10-06/coach-chat-send-and-reload.png |
| #693 | Approval gate | /coach | works | While the inbox was pending, conversations.create returned ACCOUNT_PENDING_APPROVAL: your account is waiting for approval. That rejection is the gate. After approval the same inbox can chat. | docs/reports/feature-test-2026-10-06/coach-chat-send-and-reload.png |
| #652 | Nag list | /settings/nags | not-wired | route 404 | docs/reports/feature-test-2026-10-06/nag-list.png |
| #654 | Nag phrase suggestions | /settings/nags | not-wired | route 404. Suggest was not reached. Re-checked after approval. | docs/reports/feature-test-2026-10-06/nag-phrases-and-suggestions.png |
| #653 | Memory settings | /settings/memory | not-wired | route 404 | docs/reports/feature-test-2026-10-06/memory-settings.png |
| #602 | TemplatesLibrary | /templates | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/templateslibrary.png |
| #604 | TemplateRun | /templates/run/starter:daily-page | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/templaterun.png |
| #628 | Template builder and editor | /templates/builder?from=starter:daily-page | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/template-builder-and-editor.png |
| #631 | Onboarding name step | /onboarding | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/onboarding-name-step.png |
| #636 | Profile name and delete guard | /settings/profile | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/profile-name-and-delete-guard.png |
| #640 | Preferences and notifications | /settings/preferences | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/preferences-and-notifications.png |
| #648 | Billing plan card | /billing | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/billing-plan-card.png |
| #649 | Search grouped results | /search?q=zzsmuwjeq2snomatch | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/search-grouped-results.png |
| #663 | Calendar events | /calendar | broken | Sign in again to add calendar events. The new title never appeared in the list. | docs/reports/feature-test-2026-10-06/calendar-events.png |
| #662 | Focus blocks | /tracking | works | logged a 10 minute block, reload kept it, Remove + Undo restored it | docs/reports/feature-test-2026-10-06/focus-blocks.png |
| #664 | Insights | /insights | broken | Insights heading is visible but the cards are still empty skeletons. No numbers, calm empty state, or Retry in the shot. | docs/reports/feature-test-2026-10-06/insights.png |
| #670 | Notes list | /notes | broken | Pin did not become Unpin. The screenshot is the sign-in wall. | docs/reports/feature-test-2026-10-06/notes-list.png |
| smoke | /tasks | /tasks | works | task inbox renders | docs/reports/feature-test-2026-10-06/smoke-tasks.png |
| smoke | /tasks/energy | /tasks/energy | works | | docs/reports/feature-test-2026-10-06/smoke-tasks-energy.png |
| smoke | /tasks/checklists | /tasks/checklists | works | | docs/reports/feature-test-2026-10-06/smoke-tasks-checklists.png |
| smoke | /tasks/priority | /tasks/priority | works | | docs/reports/feature-test-2026-10-06/smoke-tasks-priority.png |
| smoke | /journal | /journal | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-journal.png |
| smoke | /routines | /routines | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-routines.png |
| smoke | /routines/missing-sweep-id | /routines/missing-sweep-id | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-routines-missing-sweep-id.png |
| smoke | /goals | /goals | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-goals.png |
| smoke | /goals/progress | /goals/progress | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-goals-progress.png |
| smoke | /goals/missing-sweep-id | /goals/missing-sweep-id | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-goals-missing-sweep-id.png |
| smoke | /projects | /projects | works | | docs/reports/feature-test-2026-10-06/smoke-projects.png |
| smoke | /projects/missing-sweep-id | /projects/missing-sweep-id | works | task view titled from the id | docs/reports/feature-test-2026-10-06/smoke-projects-missing-sweep-id.png |
| smoke | /projects/missing-sweep-id/kanban | /projects/missing-sweep-id/kanban | works | | docs/reports/feature-test-2026-10-06/smoke-projects-missing-sweep-id-kanban.png |
| smoke | /activity | /activity | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-activity.png |
| smoke | /history | /history | works | | docs/reports/feature-test-2026-10-06/smoke-history.png |
| smoke | /command | /command | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-command.png |
| smoke | /ask-founder | /ask-founder | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-ask-founder.png |
| smoke | /empty-states | /empty-states | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-empty-states.png |
| smoke | /daily-note | /daily-note | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-daily-note.png |
| smoke | /settings/integrations | /settings/integrations | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-settings-integrations.png |
| smoke | /settings/passkeys | /settings/passkeys | broken | sign-in wall still showing | docs/reports/feature-test-2026-10-06/smoke-settings-passkeys.png |
| smoke | /templates/sketch | /templates/sketch | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-templates-sketch.png |
| smoke | /billing/trial-end | /billing/trial-end | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-billing-trial-end.png |
| smoke | /dashboard | /dashboard | works | | docs/reports/feature-test-2026-10-06/smoke-dashboard.png |
| smoke | /about | /about | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-about.png |
| smoke | /changelog | /changelog | not-wired | ScaffoldScreen (Beta preview) | docs/reports/feature-test-2026-10-06/smoke-changelog.png |
| smoke | /contact | /contact | works | | docs/reports/feature-test-2026-10-06/smoke-contact.png |
| smoke | /privacy | /privacy | works | | docs/reports/feature-test-2026-10-06/smoke-privacy.png |
| smoke | /terms | /terms | works | | docs/reports/feature-test-2026-10-06/smoke-terms.png |

Machine-readable copy: `docs/reports/feature-test-2026-10-06/results.json`.
