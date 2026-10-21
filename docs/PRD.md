# Tempo Flow product requirements

Updated 2026-10-21. Documentation draft for review; implementation and live acceptance are separate.

## Verdict and authority

Tempo Flow is a planner built around user-owned Markdown pages. It should make capturing, choosing and completing a next step understandable and reversible. The default-branch product contracts govern; a newer branch report can show work or a proposal without changing an accepted rule.

## Main journeys

| Journey | Expected result | Acceptance boundary |
|---|---|---|
| Enter the app | An approved session reaches Today; pending access is explained | Exercise the actual sign-in and approval path, not a bypass |
| Capture and plan | A brain dump becomes reviewable task/page proposals | Reject changes nothing; accepted results survive reload |
| Write a page | Edit Markdown with inline rendered blocks and backlinks | Exact source fidelity, failed-save recovery and no hidden payload exposure |
| Plan the day | Choose intention, top three, capacity and time blocks | Local-day calculations, conflicts and unplaced work remain visible |
| Ask for help | Chat beside the page produces inspectable proposals | Accept/Edit/Reject and a five-minute Undo; no silent state change |
| Resume later | Pages, tasks and conversations remain findable | Honest empty/loading/error/offline states and bounded pagination |

The assistant's tone is calm and specific. Empty states offer a next action; interruptions and skipped days must not be framed as failure. English and Hebrew share the same product contract.

## Scope and proof

MVP and Gen 1 are defined in ROADMAP.md. A listed capability is a requirement or dated source report, never a claim of a running release. Read acceptance by exact revision, environment and user-visible result.

## Beta entry and approval gap

- What: Free manually approved beta, email magic link, waiting page and reactive transition to Today are documented; all approved beta users get access. Evidence status: AUTHOR_REPORTED_PREVIEW_AND_DEFAULT_IMPLEMENTATION.
- When: decided UNKNOWN (first seen 2026-10-05)
- Why: EXTRAPOLATED synthesis: Offer a comprehensible first-use loop without implying paid-product readiness.
- How: Default implementation permits pending users to receive a link and sign in before waiting, whereas PRD says approval before sending the link. October 19 demo still requires preview walk and owner release; some auth copy remains English. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S124](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/ops/APPROVAL-GATE.md), [S95](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/demo/DEMO-SCRIPT.md), [S69](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/PRD.md), [S129](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/sprint/RUN-LOG.md)

## Markdown is page truth

- What: notes.body is the sole persisted page-content truth; CodeMirror live preview and GFM reading, canonical notes route, wiki links/picker/backlinks, and page-based daily/weekly/journal/template content. Evidence status: OWNER_DECISIONS_RECORDED_IN_DEFAULT_SPEC.
- When: decided 2026-10-12 (first seen 2026-10-12)
- Why: EXTRAPOLATED synthesis: Preserve a modifiable, exportable document without competing stored representations.
- How: Decorations and disposable derived indexes are allowed. Plain Markdown checkboxes remain prose. Source records October 12 settlement; implementation and mixed-line-ending browser proof remain separate. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S91](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/CORE-WEB-EDITOR-MODES.md), [S92](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/CORE-WEB-NOTES.md), [S103](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/design/v3/OVERNIGHT-RUN.md)

## Protected blocks and safe editing

- What: Valid and broken structured blocks are protected cards; no internal payload leakage through UI, selection, accessibility text, logs or safe readers. Evidence status: SETTLED_REQUIREMENTS_AND_PROPOSED_ENGINEERING.
- When: decided UNKNOWN (first seen 2026-10-12)
- Why: EXTRAPOLATED synthesis: Prevent content corruption and hidden structured-data exposure while preserving ordinary user code.
- How: Occurrence-bound byte/order guards, serialized revision-aware saves, retained drafts on failures, five-minute recovery and explicit oversized-body download are specified. Whole-page export interpretation is EXTRAPOLATED; IME/bidi/clipboard and backend-size feasibility require proof. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S91](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/CORE-WEB-EDITOR-MODES.md)

## Stable task indexes and lifecycle

- What: Task blocks are authoritative; linked typed tasks retain stable IDs across removal and return. Ordinary unlinked tasks remain separate. Evidence status: SETTLED_REQUIREMENTS_NOT_RUNTIME_PROOF.
- When: decided 2026-10-12 (first seen 2026-10-12)
- Why: EXTRAPOLATED synthesis: Keep planner, coach, focus and MCP references valid without a second content authority.
- How: Canonical body writer re-derives indexes atomically. Trashed source notes leave linked tasks read-only; account deletion differs. Five-minute Undo, inclusive thirty-day restore and physical purge are distinct. Nested tags remain held. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S92](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/CORE-WEB-NOTES.md), [S87](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/B01.md), [S88](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/B02.md)

## Daily planner core

- What: Day plans, intention/top-three/energy, carry-over, local-day habits, fixed/flexible time, calendar and focus tracking form the planner loop. Evidence status: DEFAULT_CONTRACTS_AND_LATER_BRANCH_BUILD_REPORTS.
- When: decided UNKNOWN (first seen 2026-10-18)
- Why: EXTRAPOLATED synthesis: Fit planned work to capacity without shame or false streak pressure.
- How: Default B01-B04 contracts specify typed ownership and mounting; later branch reports deadline-back planning, week/month grids and re-planning with conflict/unplaced previews. A ticket or component does not prove the route is wired. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S87](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/B01.md), [S88](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/B02.md), [S89](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/B03.md), [S90](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/B04.md), [S130](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/tickets/B01/TEMPO-B01-01.md), [S131](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/tickets/B01/TEMPO-B01-02.md), [S260](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/RUN-LOG.md)

## Coach actions and approval

- What: Coach should show exact proposed changes with Accept/Edit/Reject and five-minute Undo; fixed fixed safety handling stops model coaching. Evidence status: DEFAULT_RULE_WITH_INTERNAL_CONFLICT.
- When: decided UNKNOWN (first seen 2026-10-05)
- Why: EXTRAPOLATED synthesis: Keep user control, recovery and predictable safety boundaries.
- How: Default rules also retain high-confidence auto-apply wording, creating a contradiction. Later kitchen plans explicitly require acceptance. No blanket policy resolution is invented here. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S63](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/CURSOR_RULES.md), [S66](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/HARD_RULES.md), [S69](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/PRD.md), [S2](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/KB-SPEC.md), [S95](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/demo/DEMO-SCRIPT.md)

## Memory and life graph

- What: Visible recall/import/edit/forget/export and private cross-thread context are targets; inferred links must remain distinct from explicit links. Evidence status: DEFAULT_TARGET_AND_PARTIAL_BUILD_REPORTS.
- When: decided UNKNOWN (first seen 2026-10-05)
- Why: EXTRAPOLATED synthesis: Make contextual assistance inspectable and controllable.
- How: Default adapter/life-graph/Reflect design is not table/runtime proof. Confirmed-memory and branch manager reports coexist with held semantic-index/provider/cost work; imports save only kept/edited information. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S69](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/PRD.md), [S80](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/TRD.md), [S231](https://github.com/Levidavidspublic/tempo-rhythm/issues/1117), [S236](https://github.com/Levidavidspublic/tempo-rhythm/issues/1112), [S260](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/RUN-LOG.md), [S313](https://github.com/Levidavidspublic/tempo-rhythm/issues/821), [S315](https://github.com/Levidavidspublic/tempo-rhythm/pull/899)

## Study branch capabilities

- What: PR1081 reports flashcards, adaptive quiz, review hub/SM-2, practice tests, scoring, Turn into previews, typed recall, editing, Anki/Markdown sharing and quote-only Ask this set. Evidence status: AUTHOR_REPORTED_BRANCH_BUILD.
- When: decided UNKNOWN (first seen 2026-10-18)
- Why: EXTRAPOLATED synthesis: Turn owned content into study material while retaining source evidence and learning history.
- How: Study remains separate from Today. Explicit acceptance and Undo are reported; typed matching is local rather than semantic grading. Notes autosave/version races and runtime/provider proof remain unresolved. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: Gen 1
- From: [S260](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/RUN-LOG.md), [S263](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/study/T3-SPEC.md), [S265](https://github.com/Levidavidspublic/tempo-rhythm/pull/1081)

## Recording and client extraction

- What: Recording consent, transient live transcript/pins and explicit notes/tasks save; later branch adds local photo OCR, PDF text and DOCX extraction before review. Evidence status: AUTHOR_REPORTED_BRANCH_BUILD.
- When: decided UNKNOWN (first seen 2026-10-12)
- Why: EXTRAPOLATED synthesis: Preserve useful words while avoiding raw audio/file retention and cross-account leakage.
- How: Account pinning, cancellation and parser/size bounds are reported. Real browser parsing, PDF Hebrew order, photo rotation and OCR CDN/self-host choice remain unverified. This temporary ingest path differs from retained resource uploads. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S257](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/THIRD-PARTY-NOTICES.md), [S260](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/RUN-LOG.md), [S264](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/study/T8-T10-SPEC.md), [S265](https://github.com/Levidavidspublic/tempo-rhythm/pull/1081), [S93](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/contracts/CORE-WEB-RESOURCES.md)

## Modules and sandboxed widgets

- What: Modules require preview and approval, with off/Plain mode and built-in fallbacks; code execution is bounded and isolated. Evidence status: DEFAULT_TARGET_WITH_UNMOUNTED_BRANCH_FRAME.
- When: decided UNKNOWN (first seen 2026-10-05)
- Why: EXTRAPOLATED synthesis: Allow user-shaped planning without silent arbitrary execution.
- How: Default template/view/job/script targets are broader than reported branch frame. PR1081 frame approval binds exact code but frame was not mounted in product pages. Security claims remain within authored test scope. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: MVP
- From: [S69](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/PRD.md), [S80](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/TRD.md), [S106](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/design/v3/components.md), [S260](https://github.com/Levidavidspublic/tempo-rhythm/blob/684c07fd436d9079f74492c3d74abd6a2670a263/docs/kitchen/RUN-LOG.md)

## Private search and Library expansion

- What: KB proposes full paginated Library, tags/archive, message search, bulk deletion/Undo, exports, serial queue, phone/native parity and a broad polish pass. Evidence status: OCTOBER_19_DRAFT_PLAN.
- When: decided UNKNOWN (first seen 2026-10-19)
- Why: EXTRAPOLATED synthesis: Remove old lifetime ceilings and make retained conversations reachable without confusing partial Agent history with complete transcripts.
- How: 45 written tickets plus 30 title-only later placeholders. Owner-scoped cursors, bounded scans and versioned receipts are specified; complete Agent bridge and dependency releases remain held. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: Later
- From: [S2](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/KB-SPEC.md), [S5](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-01.md), [S18](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-14.md), [S19](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-15.md), [S34](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-30.md), [S35](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-31.md), [S37](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-33.md), [S38](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-34.md), [S39](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-35.md), [S40](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-36.md), [S41](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-37.md), [S45](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-41.md), [S46](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-42.md), [S47](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-43.md)

## Bounded web search

- What: Speed/Balanced/Quality, source/domain controls, explicit media lookups, citations, suggestions, Discover and deterministic calculator are proposed. Evidence status: OCTOBER_19_DRAFT_CONTRACT.
- When: decided UNKNOWN (first seen 2026-10-19)
- Why: EXTRAPOLATED synthesis: Improve evidence access within existing request, model and token budgets.
- How: No silent provider fallback or automatic typeahead/Discover refresh. Quality permits at most two safe page reads; external payloads stay transient. Comparator research is pattern evidence, not implemented parity or licensing clearance. Current runtime is UNKNOWN; cited source claims were not rerun.
- Status: Later
- From: [S3](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/RESEARCH.md), [S20](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-16.md), [S21](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-17.md), [S22](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-18.md), [S23](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-19.md), [S24](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-20.md), [S25](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-21.md), [S26](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-22.md), [S27](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-23.md), [S28](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-24.md), [S29](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-25.md), [S30](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-26.md), [S31](https://github.com/Levidavidspublic/tempo-rhythm/blob/e7a120e2a07011768d04ea080d443448ee760dbb/docs/kitchen/kb/tickets/KB-27.md)

## Notebooks and grounded study proposals

- What: October 19 tickets propose topic notebooks with user-selected source text, bounded source pieces, cited Ask/Find, summaries and accepted study previews.
- When: decided UNKNOWN (first seen 2026-10-19)
- Why: Keep generated answers and study materials grounded in the chosen notebook.
- How: Private stored chunks, limits, credit requirements and source terms need the stated dependency resolution. No saved answers or general parity is inferred; mobile is a separate proposed port.
- Status: Later
- From: [S212](https://github.com/Levidavidspublic/tempo-rhythm/issues/1131), [S213](https://github.com/Levidavidspublic/tempo-rhythm/issues/1130), [S216](https://github.com/Levidavidspublic/tempo-rhythm/issues/1127), [S218](https://github.com/Levidavidspublic/tempo-rhythm/issues/1125), [S219](https://github.com/Levidavidspublic/tempo-rhythm/issues/1124), [S220](https://github.com/Levidavidspublic/tempo-rhythm/issues/1123)

## Day context and optional utilities

- What: Opt-in rounded place/day context, dictionary lookup, focus radio and a disabled-by-default quote interface are proposed.
- When: decided UNKNOWN (first seen 2026-10-19)
- Why: Add useful context without intrusive or unconsented location behavior.
- How: Retain server cache/credit/terms gates and explicit radio IP disclosure. No personal place, schedule or calendar data is included in this master.
- Status: Later
- From: [S208](https://github.com/Levidavidspublic/tempo-rhythm/issues/1096), [S227](https://github.com/Levidavidspublic/tempo-rhythm/issues/1121), [S233](https://github.com/Levidavidspublic/tempo-rhythm/issues/1115), [S243](https://github.com/Levidavidspublic/tempo-rhythm/issues/1105)

## Held personas and council

- What: Named personas and multi-model council remain held proposals; council is production-off and lacks a settled backend in the captured ticket.
- When: decided UNKNOWN (first seen 2026-10-19)
- Why: Preserve the current dial-only contract and spending boundaries.
- How: Do not turn the proposal into a ready task until the recorded owner/policy/dependency gates resolve. Role names belong in future executable tickets.
- Status: Later
- From: [S214](https://github.com/Levidavidspublic/tempo-rhythm/issues/1129), [S238](https://github.com/Levidavidspublic/tempo-rhythm/issues/1110), [S66](https://github.com/Levidavidspublic/tempo-rhythm/blob/52bf2803e9105b25c2538aedd81a754a9fbfdedb/docs/HARD_RULES.md)
## Additional product requirements

Voice is an alternative input/output mode and must preserve the same explicit action approval, interruption and recovery rules as text. Current end-to-end device acceptance is UNKNOWN. Fixed safety responses are deterministic and independent of the generative assistant; activation requires the existing reviewed contract.

Templates help create daily, weekly, journal and project pages. Generated templates or modules need preview and acceptance. A read-only canvas must distinguish saved content from proposed changes. Reminders use editable wording and explicit channel controls.

Document resources are distinct from transient import processing. User-selected retained files follow their separate quota, access, deletion and export contract; a scanner must not silently acquire retention rights.

## Exclusions and unresolved outcomes

No competing persisted page format, automatically retained raw import, unapproved executable module, silent external action or automatic promotion to live is adopted. Comparative-product parity is UNKNOWN; pattern research does not establish parity. Desktop/extension delivery and native store acceptance remain separately gated. Calendar dates for launch and Gen 1 are UNKNOWN.

Commercial and sensitive background material is outside this public packet. Its omission does not decide product policy.

## Latest default-branch change checked during this run

On 2026-10-21 the default branch advanced to `c7447ad9ad5a71326b211d1de80d54091a280683`. The six changed paths implement KB-67 selected-reminder phrase editing plus styles, localized copy, tests and evidence. No canonical contract or repository instruction changed in that delta.

The recorded behavior keeps drafts, validation and suggestion feedback attached to the selected reminder ID; delayed responses cannot clear another draft or overwrite newer text. Suggestions persist only after explicit acceptance. The committed evidence reports 27 hydrated fixture passes and 3,328 unit passes, with two unrelated local E2E failures and 89 credential-gated skips. These are author-reported fixture results, not new tests in this run or live-account proof. The pre-existing derived-suggestion acceptance path still lacks its own Undo toast; native review and live behavior remain UNKNOWN.

Issue #1169 is now closed after PR #1172. This was an independently observed repository change, not an issue action performed by this documentation task.

Source: [KB-67 evidence](https://github.com/Levidavidspublic/tempo-rhythm/blob/c7447ad9ad5a71326b211d1de80d54091a280683/docs/polish/evidence/kb-67-phrase-drafts-stay-with-the-selected-nag.md).

## Default branch snapshot on 2026-10-21: additional recovery and focus work

The pinned default branch snapshot is `542f2cf361a595cc6e4556ba742ff3c4368d0374`. Relative to the preceding snapshot, five changes add the following behavior without changing canonical product contracts or repository instructions:

- KB-61: a submitted habit-sheet save owns only its originating sheet instance. Closing and reopening cannot let an old response close or alter a new draft; closing does not cancel the underlying save.
- KB-64: note Undo failures stay in the existing notice, with explicit retry inside the original absolute deadline. Duplicate activation is guarded; accepted work can settle after the deadline without overriding successful parent navigation. Fulfillment alone is not a restoration receipt.
- KB-70: notification actions guard duplicate submissions and preserve focus that has moved away from the pending row.
- KB-73: the landing theme control has a localized next-action accessible name, a 44 px target and visible keyboard focus.
- KB-74: the narrow navigation drawer contains keyboard focus, makes the background inert, supports dismissal and restores an appropriate visible opener. Other overlays and route navigation retain their own focus ownership.

The committed evidence reports focused fixture passes, but also failed or unknown local required checks for several changes. Those failures remain material despite reported remote CI success. This documentation task did not repeat the tests. Live persistence, device screen readers and native-language review remain UNKNOWN.

Public evidence is under `docs/polish/evidence/` at the pinned snapshot, in the KB-61, KB-64, KB-70, KB-73 and KB-74 Markdown reports.
