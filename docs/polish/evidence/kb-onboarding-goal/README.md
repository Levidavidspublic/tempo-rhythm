# WALK — Optional onboarding goal, 22 October 2026

status: stuck (candidate 3 scoped lint failure; source frozen)
ticket: #1293

## Code map and behavior

The base is a49aecff60ee53ead608bf56b0a2b1a7f6bd058b, on t/1293-onboarding-goal, prepared from frozen #1158 onboarding polish and current integration by the lead. Existing OnboardingFlow has five steps, NameStep in step two, and a separate create/update notes path in step four. GoalsScreen reads goals.list and creates with goals.create; goals.update validates ownership and returns the same goal ID. This ticket changes none of those backend functions or the five-step completion contract. Legacy #477/#278 and protected PRs are untouched.

Step four now mounts OnboardingGoal after the existing brain-dump textarea. A title and optional description are controlled by the parent flow. A separately labeled Add goal button calls goals.create with trimmed title and nonempty optional description, only after explicit action. Blank input submits nothing. The parent owns the submitted snapshot, one in-flight request identity and the successful goal ID through Back/Continue and conditional panel unmounts. Subsequent explicit saves call goals.update on that ID; clearing the description sends an empty string. Duplicate clicks are fenced before awaiting the mutation.

Skip and Finish never submit or retry a goal. Note creation/update remains separate and unchanged. An unconfirmed save preserves the draft and shows no Saved claim; the copy directs people to check Goals before retrying. A successful save exposes the normal /goals link and explains editing after setup. There is no inferred goal selection, task creation, coach-context integration, target date, AI call or browser-storage draft. This is direct user-authored goal creation, not an AI Accept operation.

OnboardingGoalGallery exports a local fictional example of the same controlled mounted panel. All copy is in the self-contained onboarding-goal group; English/Hebrew are complete and Hebrew is machine-drafted for Amit's native read. The panel uses existing token classes, logical sizing, auto direction for entered text, native buttons and associated labels. No CSS/central registration/config/route/package/backend/schema/environment change.

## Test results (cloud agent sandbox)

Bun 1.3.9, no browser or external account/provider requests.

| Check | Actual result |
| --- | --- |
| New mounted React DOM suite, candidate 1 | Setup error: root test could not resolve react/jsx-dev-runtime; no cases ran |
| Candidate 2 | Setup error: naked next/link could not resolve from root test; no cases ran |
| Candidate 3 | 14 pass, 0 fail, 56 assertions, 5.14s |
| Existing OnboardingFlow suite unchanged | 11 pass, 0 fail, 35 assertions, 2.18s |
| Existing releaseOnboardingGate suite unchanged | 14 pass, 0 fail, 46 assertions, 2.19s |
| Candidate 3 scoped Biome | 5 errors: Bun global undeclared at new test lines319–323 |
| git diff --check | Pass |

The runtime implementation was unchanged across these attempts. Test fixes replaced JSX with createElement in the root harness and resolved framework imports/mocks from the web workspace, following the existing release-gate harness. The final tests mount real React components in a small synthetic DOM. They cover blank/explicit create, payload trimming, empty-description omission, duplicate clicks, failure/draft retention, update/description clearing, Skip and Finish independence, successful and pending IDs across step navigation, failed-update retry, unchanged brain dump, labels/focus, Hebrew text/direction, and zero implicit creation. They do not establish actual browser geometry, keyboard event delivery, focus painting or network behavior.

The precise remaining lint correction is a named resolveSync import from bun and replacement of five Bun.resolveSync references. It was not applied after the third candidate's failure. The three-attempt rule is being honored; the lead has the exact blocker. No assertion, deadline or configuration was weakened.

UNKNOWN: mandatory install, full lint/typecheck/tests/four scans, local Playwright/build, gallery and flow screenshots at390/1280 EN/HE light/dark, no-overflow/touch/focus rendering, hosted CI/CodeRabbit/guards and preview behavior. The exclusive browser/full/typegraph slot belongs to another assigned lane. No fabricated screenshots or preview claim.

## Delivery

Four scoped files are listed with SHA256 in source-hashes.json and the scratch manifest. Evidence includes the raw setup failures, passing unit receipts and exact lint failure. The root lead owns commits, publication, shared status and all merge gates; this worker performed no public write or commit for #1293.

changed: OnboardingFlow.tsx, OnboardingGoal.tsx, onboarding-goal.ts, tempo-onboarding-goal.test.tsx, scoped evidence
unknowns: browser/full checks and current review gates
notes for ticket sync: optional real goal only; wider personalization remains separate. No fourth repair attempt performed.
