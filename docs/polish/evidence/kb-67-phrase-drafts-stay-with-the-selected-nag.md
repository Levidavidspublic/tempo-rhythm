# KB-67 selected-nag phrase editing evidence

The existing `/settings/nags` route still mounts `NagsScreen`. Its actual selected-nag form now mounts `SelectedNagPhraseForm` and `NagSuggestionNotice`. Drafts, validation and suggestion feedback belong to each nag ID. A delayed add or suggestion for Maya's nag cannot clear Dana's newer draft or display a notice under Dana. A newer edit to the same nag survives the earlier response. The existing `nags.*` query/mutation/action calls and explicit derived-suggestion Accept path are unchanged. Phrase removal still offers its existing five-minute Undo.

The [contact sheet](./kb-67-phrase-drafts-stay-with-the-selected-nag.jpg) compares saved pre-edit source from integration commit `52bf2803e9105b25c2538aedd81a754a9fbfdedb` with the actual mounted current screen and the interactive gallery at 390 and 1280 px, English and Hebrew, light and dark. Both fixture bundles use fictional Maya, Dana and Yoni nags; the fixture stubs query, mutation and action boundaries and never invokes a live model or Convex instance. The before bundle is the original source saved before editing, using the same v3 token and screen styles. The saved baseline exactly matches that commit’s host source (SHA-256 `03e4630005751250cf9d0277a8ac30691d51aa9fa7f832ff59a173c345e54e6e`). No utility-class translation was needed; both isolated bundles use shared token/tempo CSS with external font imports removed, so these are component fixture views with fallback fonts rather than deployed shell screenshots. Each tile labels its ready state, width, locale and theme. A static contact sheet cannot prove concurrency, focus, or backend call counts; the hydrated browser assertions below exercise those paths.

## Browser findings

- A→B→A selection restores each unsent draft and its own validation/suggestion feedback. A held add success or rejection leaves B's text and focus alone. A newer same-A edit survives either response: success does not mark the newer draft Saved, and a failed earlier save is identified as the earlier phrase's failure without marking the newer field invalid. A current save failure focuses the matching input only while the person has not moved focus elsewhere.
- A held suggestion result, empty result, or rejection updates only A; B never displays the stale notice. A successful own-phrase add clears A's obsolete “add your own phrase first” note while keeping B's note. A's first-phrase live announcement remains attributed to A even when B is selected. Visible interpolated nag names are wrapped in auto-direction `bdi`. Rapid repeated Add or Suggest sends one call while the first is pending. Suggest writes nothing; an explicit Accept invokes `addPhrase({ source: "derived" })` and then `decidePhrase({ decision: "accept" })`. Reject is local.
- The mounted ready, loading, empty, error and signed-out states remain reachable; the existing removal Undo path still works. The gallery uses the real form and notice exports with controlled display states, while the behavioral checks mount the production screen with fictional boundaries.
- At 390/1280 px in en/he light/dark, one `h1` and one `main` render without horizontal scroll. Hebrew uses RTL layout; user phrases retain `dir=auto`. Controls are at least 44 px on phone; visible keyboard focus and reduced motion are checked in the browser.

The derived-suggestion Accept path already lacks a five-minute Undo toast in this base; this narrow ticket does not claim to repair it. The draft PR contains the full command table and any failure tails. Device screen-reader results, live account writes and live model behavior remain **UNKNOWN**. Hebrew copy is machine-drafted for Amit's native read.


## Verified runs

Source head: `1551b5fbaae6a15b82d645c82029286631a2ae41`. The evidence commit changes only this Markdown and the contact-sheet JPG.

| Check | Local result |
| --- | --- |
| Bun | 1.3.9 |
| Lint | exit 0; 5/5 tasks; 0 errors, 9 existing warnings |
| Typecheck | exit 0; 5/5 tasks |
| Full unit suite | exit 0; 3328 pass, 3 todo, 0 fail; 81132 assertions; 3331 tests across 202 files |
| Focused KB-67 hydrated fixture | exit 0; 27 pass, 0 fail; 114 assertions; 66.46s |
| Four scans/notices | four OK; 66 dependencies documented |
| Local E2E | exit 1; 26 pass, 89 credential-gated skip, 2 unrelated failures (`tests/e2e/task-views-core.spec.ts:14:7` and `tests/e2e/wiring/settings-account.spec.ts:16:9`) |
| Build | exit 0; 1/1 task; 2m4.221s |

Repeated Add submits produce exactly one `nags:addPhrase` call; repeated Suggest clicks produce exactly one read-only `nags:proposePhrases` call. Before explicit Accept there are zero add/decide writes. Accept produces exactly one derived `addPhrase` followed by one `decidePhrase(accept)`. Reject makes zero writes. A held A rejection preserves B textarea focus; on the same nag it preserves focus moved to the New nag input. Current validation/current save failure returns focus to the matching phrase input. Newer same-A edits remain current and unlabelled by the earlier response.

## Named hydrated cases

1. English and Hebrew keys match and named views mount
2. mounted ready screen keeps one h1 and one main
3. loading, signed-out and empty states keep their existing mounts
4. query error retains existing retry state
5. A and B keep separate drafts across A to B to A selection
6. validation stays with the nag and labels the matching field
7. held A add succeeds without clearing B's newer draft
8. held A add rejection leaves B text and focus alone
9. newer same-A words survive earlier successful save
10. newer same-A words survive earlier rejected save with an attributed earlier-error notice
11. a failed add does not steal focus after moving to another control on the same nag
12. a current add failure focuses the matching phrase when focus intent stays
13. adding an own phrase clears only that nag's need-own suggestion note
14. A's first phrase announcement remains attributed to A after selecting B
15. held A suggestions settle on A after B is selected
16. held A empty suggestion result never appears under B
17. held A suggestion rejection never accuses B
18. rapid double Add phrase makes one mutation call
19. rapid double Suggest makes one read-only action call
20. derived phrase remains unwritten until explicit Accept, then uses two existing calls
21. Reject removes a local suggestion without a write
22. existing phrase removal still offers five-minute Undo
23. Hebrew form and email-free labels are RTL without horizontal overflow
24. phone targets and keyboard focus remain visible with reduced motion
25. gallery changes real form and notice views with A/B selection
26. long fictional nag text fits phone and desktop
27. source-derived before and mounted after evidence covers widths, locales and themes

## Third normal repair: isolated fixture lifecycle

The retained source/test ledger contains two implemented rounds: `6666fb0` (initial implementation) and `1551b5f` (feedback/focus repair). `bc6c4d4` and `f8514d7` changed evidence only. The owner-authorized KB FINISH handoff explicitly permits one third normal candidate for this fixture correction, with no fourth attempt presumed. Root will reopen issue #1169 and handle a follow-up draft PR because merged PR #1172 cannot be amended. This is an explicit procedural exception for the same scoped repair; it does not expand the product scope or authorize another repair round.

Merged source `c7447ad` has the same fixture bytes as `1551b5f`. Hosted PR #1159 job `119187961678` finished the named KB-67 cases, then failed its unnamed cleanup hook after 60 seconds (3472 pass, 3 todo, 1 fail). PR #1168 showed the same 60-second cleanup failure (3471 pass, 3 todo, 1 fail); root reports its unchanged rerun subsequently passed. The hook awaited `browser.close()` before stopping the server, so browser closure was the unresolved boundary and server release was blocked behind it. These receipts establish the failure, but do not establish why Chromium closure stalled or prove every native hang has been reproduced locally.

The third candidate changes only this evidence Markdown and the existing KB-67 test. All 27 original names, callback bodies and assertions remain intact, apart from moving temporary captures into the unique fixture directory. The 60-second default, 120-second setup and 300-second capture deadlines are unchanged. The fixture's Bun build/server, Playwright import and browser run in a fresh child process. Parent cases require both their fresh invocation's result and Bun's corresponding native pass line; a separate lifecycle case requires the exact case set, completed cleanup and authoritative child exit 0. No cached output, success marker or late callback can override a failed native test or exit.

Server stop, browser close and unique temporary-directory removal start independently, and all release results are awaited and propagated. A pending or rejected browser close cannot prevent server/directory cleanup from starting. Captures are temporary and removed with that directory; the existing committed contact sheet remains unchanged. Missing installed Playwright Chromium/system Chrome still fails explicitly.

Three additional isolated regressions cover pending browser close, rejected browser close with a real loopback server and temporary directory, and a real nonzero child exit despite successful-looking case records. The exit regression also checks a valid success, a native failed-case line, a mismatched invocation token, incomplete cleanup and a failed case result. These controlled failures validate cleanup independence and truthful failure reporting; they do not claim to reproduce Chromium's intermittent native shutdown stall.

Validation logs are retained in `/workspace/work/kb-finish/kb67-third/` for root handoff:

| Check | Third-candidate local result |
| --- | --- |
| Bun | PASS: 1.3.9 |
| Frozen install | UNKNOWN: exit 124 after the authorized 120-second resolution bound; tail remains `bun install v1.3.9 (cf6cdbbb)` / `Resolving dependencies` |
| Lint | PASS: exit 0; 5/5 tasks; 7.352s; 9 existing web warnings and 1 existing UI warning |
| Typecheck | PASS: exit 0; 5/5 tasks; 2m18.393s |
| Focused KB-67 fixture and lifecycle regressions | FAIL: exit 1; child 29 pass, 1 fail, 109 assertions (173.25s); parent 29 pass, 2 fail, 29 assertions (173.71s). All 27 original behavioral cases passed; the added rejected-close regression expected stopped `Server.port === -1`, but Bun 1.3.9 returned `0`. The parent exit guard also failed as required. |
| Full suite, scans/notices, E2E, build | Not launched: third normal candidate failed; stop under the three-attempt rule. Root owns any subsequent decision and remote operations. |

Root owns the subsequent broad suite, scans/notices, E2E, build and remote operations. No product, config, dependency, timeout, skip or contact-sheet change is included.


Third-candidate disposition: **stuck**. This is an assertion/candidate failure, not an environment-only diagnostic. At the third-candidate handoff, no source/test correction or rerun had been made after that failed run, and no fourth attempt was presumed; the subsequent explicit authorization is recorded below. The native Chromium hang did not occur in this run: the child reported `cleanupComplete: true` and exited 1 because of the new regression's unsupported port assumption. The controlled pending-close and real nonzero-child-exit regressions passed. The directory-removal assertion follows the failed port assertion and therefore was not reached in that regression; its `finally` still awaited server stop and directory removal. It would be incorrect to claim that the entire regression passed or that this candidate is green.

Failure tail retained in `focused.log`:

```text
Expected: -1
Received: 0
at tests/unit/kb-67.test.tsx:861:34
(fail) KB-67 fixture lifecycle > browser close rejection still stops the real server and removes its unique directory
(fail) KB-67 fixture lifecycle > isolated fixture exits successfully after every named case and cleanup
29 pass
2 fail
29 expect() calls
Ran 31 tests across 1 file. [173.71s]
```

## Fourth and final candidate: existing owner-authorized additional pass

After receiving the third-candidate failure, root explicitly reconciled the authorization: KB-67 has three normal source/test candidates and zero additional passes consumed. The owner's KB FINISH instruction grants one additional repair pass to exhausted KB drafts; its named stuck-ticket list is inclusive, not an exclusive limit. Root therefore explicitly authorized this fourth and final source candidate under that existing authority. No fifth candidate is authorized or presumed. Root retains the reopened-issue/follow-up-PR procedural exception and all remote operations.

This additional pass changes only the added regression's unsupported stopped-port assumption. It captures the real server URL before shutdown, proves that URL serves the probe before cleanup, then requires a real fetch to that same URL to reject after the controlled browser-close rejection. The existing directory-removal assertion remains and must execute. All 27 original behavioral cases, their assertions, the 60/120/300-second deadlines, missing-browser failure, clean-child isolation and authoritative exit checks remain unchanged. The third-candidate failure above remains historical failure evidence and is not relabelled as a pass.

Fourth-candidate logs are retained in `/workspace/work/kb-finish/kb67-final/`:

| Check | Fourth/final-candidate local result |
| --- | --- |
| Bun | 1.3.9; unchanged from the retained version proof |
| Frozen install | UNKNOWN retained from the unchanged dependency graph: exit 124 after 120s; no resolution retry |
| Lint | PASS: exit 0; 5/5 tasks; 632ms (cached); existing warning results retained |
| Typecheck | PASS: exit 0; 5/5 tasks; 681ms (cached) |
| `bun test tests/unit/kb-67.test.tsx` under its individual heavy lock | PASS: parent 31 pass, 0 fail, 91 assertions, 121.39s; child 30 pass, 0 fail, 110 assertions, 121.08s, authoritative exit 0 and cleanup complete |
| Full suite, scans/notices, E2E, build | Pending root-owned mandatory gates; no local pass claimed |

The child passed all 27 preserved behavioral cases and all three lifecycle regressions. The rejected-close regression now reached both the actual post-stop fetch rejection and directory-removal assertion. The parent separately verified the exact named case set, each native pass line, completed cleanup and exit 0. The failed third-candidate 29/2 result remains recorded above. This is the one owner-authorized additional pass, not a reset of the normal three-attempt ledger; no further source candidate is authorized here.

After the final proof, no unique `work/kb67-*` directories or executing recorded fixture descendants remained. Two exited Chromium descendants remained as PID-1-owned zombies in the container; they are not executing browser jobs and cannot be reaped by this fixture process. The earlier failed run likewise left two exited PID-1-owned Chromium zombies. No broad runner or remote operation was launched by this handoff.

The native Chromium cleanup hang did not reproduce in either focused run. The controlled pending/rejected close and nonzero child-exit checks support cleanup independence and truthful reporting; they do not prove that every possible native hang is eliminated. Root owns all subsequent mandatory gates and remote operations.
