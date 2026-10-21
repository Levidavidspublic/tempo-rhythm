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
