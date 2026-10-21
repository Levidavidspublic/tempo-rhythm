# Page action recovery — #1249

WALK — Candidate 1 passes the focused browser evidence. Mandatory repository validation, remote CI and CodeRabbit remain pending; this is not a production or preview completion claim.

Captured 2026-10-21 UTC with Bun 1.3.9. Base: `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. Original NotesScreen blob: `b9435f54157cc49a746aa07944f6fe615bf96708` (unchanged between the saved original base and this base). Tested NotesScreen blob: `ae6cab36d00cbae11109f6440e3229d952a8e258`. Test blob: `743d928492dc2140acda5720402f5a63a4e4d4a6`. Source, test and evidence are committed together; no provider, account or deployed environment was called.

The fixture mounts the actual NotePage, PageEditorView, CodeMirror editor and CoachPageProvider. Stable synthetic query/mutation boundaries provide fictional notes and controllable rejections. The `Flush fixture page` button is test instrumentation. These are browser component tests, not authenticated persistence E2E.

## Results

| Command | Result |
| --- | --- |
| `PAGE_RECOVERY_BASELINE=<saved-original-NotesScreen.tsx> bun test tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0; 3 pass, 0 fail; 26 expectations; 111.68 s. [Log](baseline.log). |
| `bun test tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0; 19 pass, 0 fail; 83 expectations; 191.67 s. First browser candidate. [Log](candidate-1.log). |
| Scoped Biome lint from `apps/web`: `bun run node_modules/.bin/biome lint components/notes/NotesScreen.tsx ../../tests/unit/tempo-page-error-recovery.test.tsx` | Exit 0, two files checked. Earlier root-cwd invocation failed resolving the existing shared config; correct package cwd fixed invocation without changing configuration. |
| Scoped `tsc --noEmit --pretty false --project <scratch-config-extending-web-tsconfig>` | Initial exit 2: fixture Response received a Buffer type unsupported by this DOM signature. Fixed with an owned ArrayBuffer. Subsequent pre-browser exit 0; this is not full repository typecheck. |
| Generated fixture entry/build TypeScript syntax parsing | Both parse without diagnostics. |
| `git diff --check` | Exit 0. |
| Required install, lint, typecheck, full tests, four scans/notices, Playwright and placeholder-Convex build | UNKNOWN: not yet run for this candidate; lead coordinates the shared heavy-validation slot. |

The baseline proves the original save rejection leaves Saving visible and the original pin rejection produces an unhandled fictional error. The current tests prove retained dirty title/body, explicit retry, duplicate suppression, ordered saves, stale-note isolation, dirty flush before delete, canceled delete intent, failure without URL/Undo change, successful deletion plus existing Undo, real coach flush rejection, pagehide/visibility recovery, and exact Markdown preservation for plain/daily/weekly/project/template pages. No caught action path emitted a console/page error. Only a successful removal changes the URL and starts the existing five-minute Undo.

## Actual screenshots

Each pair uses the same fictional body, retains the original page-meta bytes and was captured from the actual editor. Before images load the saved original NotesScreen; after images load the tested source. Both matrices use reduced motion. The after matrix also verifies visible keyboard focus, Enter retry, at least 44px retry height, EN/HE direction and no horizontal overflow.

| Width / language / theme | Before | After |
| --- | --- | --- |
| 390 / EN / light | [Before](before-390-en-light.png) | [After](after-390-en-light.png) |
| 390 / EN / dark | [Before](before-390-en-dark.png) | [After](after-390-en-dark.png) |
| 390 / HE / light | [Before](before-390-he-light.png) | [After](after-390-he-light.png) |
| 390 / HE / dark | [Before](before-390-he-dark.png) | [After](after-390-he-dark.png) |
| 1280 / EN / light | [Before](before-1280-en-light.png) | [After](after-1280-en-light.png) |
| 1280 / EN / dark | [Before](before-1280-en-dark.png) | [After](after-1280-en-dark.png) |
| 1280 / HE / light | [Before](before-1280-he-light.png) | [After](after-1280-he-light.png) |
| 1280 / HE / dark | [Before](before-1280-he-dark.png) | [After](after-1280-he-dark.png) |

Visual inspection: the EN desktop notice sits above the existing page; the HE mobile dark notice flows RTL and retains the focused retry target. Existing translated copy and token classes are reused; Hebrew remains for Amit's native read before production.

## Preserved diagnostic failures

Initial scoped type diagnostic (full output in [scoped-types-initial.log](scoped-types-initial.log)):

```text
tests/unit/tempo-page-error-recovery.test.tsx(92,36): error TS2345: Argument of type 'Buffer<ArrayBufferLike>' is not assignable to parameter of type 'BodyInit | null | undefined'.
  Type 'Buffer<ArrayBufferLike>' is missing the following properties from type 'URLSearchParams': size, append, delete, get, and 2 more.
```

Initial scoped lint invocation, from the wrong directory:

```text
Failed to resolve the configuration from ../../packages/config/biome.json
module not found
```

No product check was weakened. Browser cleanup closed owned pages, browser and server and removed only its temporary fixture build directory.

## UNKNOWN and follow-ups

- Exact cause of the preview red three-error badge.
- Authenticated persistence, deployed preview behavior and real-device screen-reader behavior.
- Full repository validation, current remote CI and CodeRabbit disposition for this candidate.
- Existing wiki-link creation and unmount best-effort save error handling remain outside this ticket. No sidebar/codec, checkbox, route, backend, model, schema or environment change.
- Older overlapping #1053/#1081 and held migration drafts #795/#805 were left untouched and need later reconciliation. KA #1101 expressly excludes NotesScreen. Protected #1193/#1198 and held #1110/#1112/#1129 were untouched.
