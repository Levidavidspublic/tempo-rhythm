# KB implementation handoff

Amit explicitly authorized implementation after the original planning request. This planning PR still contains documentation only. The separate implementation PRs below target `integration` as drafts; none is merged or deployed by this run. A pushed draft, passing CI and production readiness are different states. Read each PR's current check results and `Test results (cloud agent sandbox)` before continuing it.

The source audit of the first twelve pushed implementation PRs identifies 24 new named production views, excluding galleries and supporting helpers. KB-70 adds one more and KB-66 adds two. KB-67 adds two more and KB-75 adds two. This is **31 views across twenty-three pushed implementation drafts**, not 150 completed components. KB-73 polishes an existing control and adds no primary view. KB-74 also polishes an existing shell and adds no primary view. Browser fixtures use fictional data; they do not verify live accounts or deployed service behavior. Some mandatory local checks have nonzero results even where GitHub checks pass, and affected reports remain blocked/stuck.

| Ticket | Issue | Draft implementation PR | Mounted views / scope |
|---|---|---|---|
| KB-02 | #1153 | [#1160](https://github.com/Levidavidspublic/tempo-rhythm/pull/1160) | CaptureStatus, DraftRecoveryNotice; brain dump |
| KB-03 | #1157 | [#1162](https://github.com/Levidavidspublic/tempo-rhythm/pull/1162) | SearchStatus, SearchFilterSummary; personal-content search |
| KB-04 | #1141 | [#1147](https://github.com/Levidavidspublic/tempo-rhythm/pull/1147) | JournalDayHeading, JournalLoadMore; journal |
| KB-05 | #1142 | [#1149](https://github.com/Levidavidspublic/tempo-rhythm/pull/1149) | GoalProgressLabel, GoalEmptyState; goals list |
| KB-06 | #1143 | [#1151](https://github.com/Levidavidspublic/tempo-rhythm/pull/1151) | GoalProgressSummary, GoalDetailState; existing goal progress/state polish; original milestone request not delivered |
| KB-07 | #1146 | [#1148](https://github.com/Levidavidspublic/tempo-rhythm/pull/1148) | GoalProgressTable, ProgressRangeCaption; progress chart/table |
| KB-08 | #1144 | [#1152](https://github.com/Levidavidspublic/tempo-rhythm/pull/1152) | ProjectSummaryRow, ProjectListState; projects list |
| KB-09 | #1145 | [#1150](https://github.com/Levidavidspublic/tempo-rhythm/pull/1150) | ProjectTaskActions, ProjectDetailNotice; project detail |
| KB-10 | #1155 | [#1159](https://github.com/Levidavidspublic/tempo-rhythm/pull/1159) | MagicLinkStatus, SignInHelp; sign-in/shared auth form |
| KB-44 | #1154 | [#1158](https://github.com/Levidavidspublic/tempo-rhythm/pull/1158) | OnboardingStepSummary, OnboardingResumeNotice |
| KB-45 | #1156 | [#1163](https://github.com/Levidavidspublic/tempo-rhythm/pull/1163) | SignUpStatus, SignUpPrivacyLine; sign-up wrapper |
| KB-61 | #1181 | [#1185](https://github.com/Levidavidspublic/tempo-rhythm/pull/1185) | Existing HabitSheet request ownership; zero new primary views; 21 focused/full 3,322 cases pass; lint/typecheck/scans/build pass; local E2E 27 pass/1 fail/89 skip, install UNKNOWN |
| KB-64 | #1182 | [#1187](https://github.com/Levidavidspublic/tempo-rhythm/pull/1187) | Existing note Undo rejection/retry and late-success navigation; zero new primary views; 27 focused cases pass, full gates running |
| KB-66 | #1165 | [#1168](https://github.com/Levidavidspublic/tempo-rhythm/pull/1168) | ActivityLoadMore, ActivityEndStatus; activity |
| KB-67 | #1169 | [#1172](https://github.com/Levidavidspublic/tempo-rhythm/pull/1172) | SelectedNagPhraseForm, NagSuggestionNotice; reminder phrases |
| KB-69 | #1161 | [#1164](https://github.com/Levidavidspublic/tempo-rhythm/pull/1164) | ApprovalStatus, WaitingNameFeedback; approval waiting |
| KB-70 | #1166 | [#1167](https://github.com/Levidavidspublic/tempo-rhythm/pull/1167) | NotificationReadFeedback; notification read actions |
| KB-71 | #1175 | [#1177](https://github.com/Levidavidspublic/tempo-rhythm/pull/1177) | Existing shared Button phone targets at real callers; zero new primary views planned |
| KB-73 | #1170 | [#1173](https://github.com/Levidavidspublic/tempo-rhythm/pull/1173) | Existing ThemeToggle touch target and bilingual action label; zero new primary views |
| KB-74 | #1171 | [#1174](https://github.com/Levidavidspublic/tempo-rhythm/pull/1174) | Existing TempoShell mobile drawer focus; zero new primary views planned |
| KB-75 | #1178 | [#1179](https://github.com/Levidavidspublic/tempo-rhythm/pull/1179) | AdminStatusSummary, ApprovalRowFeedback; admin row concurrency/focus, independent row requests; corrective source and evidence pushed; required GitHub checks pass, local full-suite/E2E failures remain |

| KB-76 | #1180 | [#1183](https://github.com/Levidavidspublic/tempo-rhythm/pull/1183) | Existing shared UndoToast request ownership; zero new primary views; 27 focused and 3,328 full-suite cases pass; local E2E 26 pass/2 fail/89 skip, install UNKNOWN |

| KB-77 | #1184 | [#1186](https://github.com/Levidavidspublic/tempo-rhythm/pull/1186) | Existing Input 44px phone targets at Today/Plan callers; zero new primary views; 18 focused cases pass, full gates running |

All these implementation assignments use Sol under AGENTS.md's mid-tier rule, including the explicitly reassigned KB-02/03/44 planning lanes. Claude must not file duplicate issues or prompts for these twenty-three pushed assignments. The remaining written and title-only tickets stay in KB-SPEC/queue; read their dependencies before starting.

## Boundaries that remain

- Perplexica/Vane-level web answers are **not delivered** by the personal-search polish PR. KA-24 #1116, KA-43 #1126 and their study dependency PR #1081 were still open at the 20 Oct continuation; the KB search contract/UI dependencies remain in force.
- Full chat Library/history is **not delivered** by these polish PRs. KA-01 #1094 and the KB data contracts are still prerequisites.
- Better memory/embeddings is **not delivered**. KA-20 #1112 is held for the runtime-model/cost decision; KA-25 #1117 depends on it.
- KB-06 does not invent milestone storage or goal/task relationships absent from integration. The lead corrected that unsupported requirement in the specification on 19 Oct; the PR delivers existing-state/progress polish only. Milestones still require a future backend scope. This correction does not turn failing local checks into a pass.
- Brain dump's existing Save as page path has Undo; its accepted-task path does not have that control. KB-02 does not invent an undo backend or claim that gap is fixed.
- The existing outer auth modal titles remain English outside KB-10/45 scopes. The scoped inner forms/wrappers are bilingual; complete modal-shell localization remains residual work.
- KB-67 fixes draft/feedback ownership across reminder selection. Existing derived-phrase acceptance lacks a five-minute Undo toast; this narrow UI fix does not claim to repair it.
- No Vane/Open WebUI code was copied. Open WebUI contributes UX comparison only. No new provider, secret, paid call, environment value, label, review-bot request or merge was authorized here.

## Existing polish branch overlap

A complete open-PR file audit found that open draft [#1053](https://github.com/Levidavidspublic/tempo-rhythm/pull/1053) also changes four hosts already used by KB drafts. The initial KA-only ownership audit missed this broader overlap. These drafts must be reconciled before integration; their separate green checks do not test a combined result. Compare the merge-base proposal, not an older branch's whole file, and preserve current integration behavior:

| KB draft | Shared host | Reconciliation required |
|---|---|---|
| KB-02 / #1160 | BrainDumpScreen | Retain integration’s existing accepted “Now” task scheduling/Open today behavior and two-hour tab draft/plan/choice retention. #1053’s older snapshot lacks that retention; preserve KB recovery/status when reconciling error handling and saved-page tracking. Accepted-task Undo remains a gap. |
| KB-10 / #1159 | SignInForm | Reconcile #1053’s offline guard, validation summary and typed send errors with KB bilingual feedback/focus. Preserve its exported AuthCardLoading used by its changed auth routes, plus current auth props/callbacks. |
| KB-44 / #1158 | OnboardingFlow | Retain #1053's brand span in the loading Card alongside KB progress/resume behavior. |
| KB-69 / #1164 | WaitingForApproval | Preserve integration's optional name form and KB revision-aware feedback; #1053's older file lacks that form. Review its WaitingCard, revoked contact link and sign-out feedback without replacing the current host wholesale. |

No rebase, merge or extra source attempt is implied here. PR #728 is an integration-to-master release promotion, not a competing implementation owner; PR #403 is an older explicitly “DO NOT MERGE” mock branch. KB-63 remains deferred because #1053 already implements its carry-over polish. Study PR #1081 targets #1053's branch.

## Needs Amit

[AGENTS.md](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/AGENTS.md), “Failing and stuck,” says: “After the 3rd failure: stop and report `stuck` with the last error. Don't make a 4th attempt, and don't widen scope to get it to pass.” KB-02, KB-03, KB-04, KB-44, KB-66, KB-70, KB-74 and KB-76 have reached the repository’s three-attempt repair limit and are reported stuck. Further source/test repair needs an explicit retry-budget exception; this run does not reset attempts or create duplicate tickets. Exact failing checks and evidence remain on their PRs.

Held KA persona/memory/council scopes (#1110/#1112/#1129), runtime model/cost choices, the backend `convex-arch` owner gate when dependencies are ready, search service provisioning, native Hebrew review, and release/device accessibility decisions remain with Amit. These do not block independent scoped UI work. Follow the repository's three-attempt limit on stuck tickets; do not evade it with a duplicate issue or an out-of-scope baseline/config edit.

## UNKNOWN

Live search quality and service configuration, complete Agent-backed chat history, native screen-reader behavior, remaining quota/reset hour and production readiness. Current CI results and sandbox failure causes are recorded per PR, not inferred from this index. Shared-machine timing failures and post-build wrapper hangs are reported as observed; they are not silently counted as successful commands.

## 20 Oct continuation

All nineteen pushed implementation branches passed an exact changed-path audit against their ticket scopes. Overnight validation exposed disk exhaustion and an ignored runner PATH failure; generated caches were removed, the runner environment repaired, and affected checks rerun without changing application or test configuration. Reports preserve initial failures. A separate dependency repair restores missing ignored workspace package links before KB-71 validation.

The fresh ownership audit covered 112 open PRs (3,838 file entries) and 288 active issues. KB-76 now covers a new source-traced race in existing shared UndoToast: a pending request can close a newer toast after its own component unmounts. It is a separate defect, not a retry-budget reset. ResultGroup is reserved by held #850; ProfileForm and HabitCheckInStrip remain owned by #1053. Their residual issues are not competing implementation assignments.

KB-61 ([#1181](https://github.com/Levidavidspublic/tempo-rhythm/issues/1181)) and KB-64 ([#1182](https://github.com/Levidavidspublic/tempo-rhythm/issues/1182)) narrow two reserved family titles to separate, unowned child components: a late habit save closing a newer sheet, and note Undo rejection without recovery. KB-61 is now pushed as draft #1185 after the original mounted-caller bug and parent-removal commit race were reproduced and fixed; all 21 final focused cases pass. KB-64 is now pushed as draft #1187 with all 27 final focused cases passing, including keyboard retry and late successful restoration retaining the restored-note URL; remaining full gates are running. KB-76 ([#1180](https://github.com/Levidavidspublic/tempo-rhythm/issues/1180)) is now pushed as draft #1183: the original mounted-caller failure was reproduced, and 27 final focused cases pass, including pointer and keyboard retry. Its mandatory gates are complete: lint/typecheck/scans/build pass; full unit suite is 3,328 pass, 0 fail, 3 todo; local E2E is 26 pass, 2 fail, 89 skip; exact frozen install remains UNKNOWN. It is now reported stuck after the final reporting head’s scoped CI failure. All three polish existing controls and add zero primary views. Claude must skip all 23 filed assignments.

KB-75 final local recovery results: lint/typecheck/build/four scans pass and all 22 scoped cases pass. The full-suite rerun retains two page-summary performance failures (3,321 pass, 3 todo, 2 fail); E2E retains one task-view navigation timeout (27 pass, 89 skip, 1 fail). Required GitHub checks pass, but the issue report remains blocked. No extra source repair or test/config relaxation was made.

KB-77 ([#1184](https://github.com/Levidavidspublic/tempo-rhythm/issues/1184)) is pushed as draft #1186, with 18 focused cases passing and its remaining mandatory gates running. The refreshed 113-open-PR / 3,847-file-entry audit found no Input owner. Its existing 40px phone height was measured with compiled application CSS; the scoped fix targets 44px at real Today/Plan callers without editing those KA-owned screens. It adds zero primary views. Claude must skip this already filed assignment too.

KB-76 source/test head 499745a is frozen after three actual implementation/check rounds; final evidence/report head 6bf810c preserves the original failing regression, earlier focused failure, corrected runs, pointer trace and exact mandatory gate outcomes. The first draft had green GitHub checks; reporting-only head 6bf810c now fails ci/Test. The annotation at tests/unit/kb-76.test.tsx:636 expected UndoToast to contain “Change B” but found no UndoToast within 5,000ms. That wrapper line covers multiple cases; exact failing case/counts are UNKNOWN because job-log download returned 403. Other four required checks pass. Further source/test repair requires an explicit retry-budget exception; no fourth attempt is authorized by this run.

KB-61 completed all mandatory local gates: focused 21 and full unit 3,322 pass, 0 fail, 3 todo; lint/typecheck/scans/build pass; local E2E 27 pass, 89 skip, 1 task-view Home reset failure. The frozen install is UNKNOWN. Evidence discloses missing fixture font assets and system fallback fonts; production-font geometry is not claimed. Source/tests remain frozen after three rounds. Final reporting and GitHub checks must be read at the latest head.

All 23 filed implementation assignments now have pushed draft PRs into integration. Their code and evidence remain separate from this documentation-only plan. KB-61 final reporting head f8c7cc6 has corrected scope metadata; local E2E/install limitations remain. KB-64 source/test e4303b1 and first evidence 18ab10e preserve the original rejection proof, the late-success navigation regression and all candidate failures. KB-77 source/test 758a0fc and first evidence eab626d preserve original 40px and current 44px caller measurements. KB-64/77 full validation is still active at this snapshot.
