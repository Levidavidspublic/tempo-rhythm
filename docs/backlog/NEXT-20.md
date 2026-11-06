# Next 20 product candidates, plus config tickets

Updated 6 Nov 2026 against the 5 Nov evening ladder. Format: [TICKET-STANDARD.md](./TICKET-STANDARD.md), copied from `docs/source-2026-11-01`. These are local draft corrections, not approved issues. Historical MVP-01 through MVP-20 identifiers map one-to-one to TF-01 through TF-20; the old prefix no longer assigns every ticket to MVP.

THE BAR: a mid-tier model, about two hours, would almost always build it with nothing left to decide. At most 3 files plus 1 test. STEPS stay inside SCOPE and MUTATES.

STATUS `approved-unsent` only if the ticket meets THE BAR. Otherwise `open`, with the question.

None of these are approved-unsent. Each one is missing exact English and Hebrew copy, or a decision this folder still marks UNKNOWN. No GitHub issue was opened. No label was added.

Shared gates, copied for every ticket: build, typecheck, lint, the ticket's tests, numbers or UNKNOWN, formatter, secret scan, forbidden-tech scan, scope guard, config guard, do not weaken a test. Jev is the judge exception Amit already named. REPORT lists every step.

## TF-01 Sign-in is a magic link

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after AUTH-CONTRACT
WHY: PRD sign-in. PRICING-AND-PLANS.
GOAL: Live sign-in offers a magic link and no password.
SCOPE: the sign-in screen only
MUTATES: UNKNOWN until the component file is named. Do not guess. Start from `apps/web/app/sign-in/page.tsx` and stop if the real form lives elsewhere.
STEPS: finish AUTH-CONTRACT and the exact-path code map first, then wire the existing form and its error states; implement the TESTS below. No auth backend change is included in this screen ticket.
DONE: the named UI test and AUTH-CONTRACT acceptance suite pass, including the real preview link check required by configuration; absence of a password field alone does not prove sign-in.
EVIDENCE: the test output.
DO NOT: touch `convex/auth*`, `.env`, or `.github/**`.
REPORT: files changed and the test line.
SPEC: exact EN and HE strings UNKNOWN.
TESTS: Given the auth contract and invited/pending fixtures, request and complete a single-use magic link; reject used, expired, malformed links and unsafe redirects; assert pending-user handling and no password field. This UI ticket depends on AUTH-CONTRACT and does not implement auth itself.
NUMBERS: UNKNOWN for this screen.
GATES: the shared gates.
Question: What is the exact English and Hebrew copy on the magic-link screen?

## TF-02 Day page is the front door

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after TF-01 and route code-map
WHY: APP-FLOW. Three day routes exist.
GOAL: One route is the day. The other two redirect to it.
SCOPE: one redirect
MUTATES: UNKNOWN. Candidates: `apps/web/app/(tempo)/today/page.tsx`, `plan/page.tsx`, `(bare)/daily-note/page.tsx`.
STEPS: do not start until the question is answered.
DONE: opening the other two URLs lands on the chosen day page.
EVIDENCE: one Playwright navigation.
DO NOT: delete a route's data.
REPORT: the chosen file and the test.
SPEC: UNKNOWN which URL is canonical.
TESTS: not writable until the URL is chosen.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: Which URL is the day: `/today`, `/plan`, or `/daily-note`?

## TF-03 Note hides JSON

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after NOTES-CONTRACT
WHY: SPEC. The person never sees JSON.
GOAL: A note body that contains a json-render block shows the block, not the raw JSON.
SCOPE: the note reader
MUTATES: at most the note page component plus one test. Paths UNKNOWN until read.
STEPS: read `apps/web/app/(tempo)/notes/[id]/page.tsx` and `p/[pageId]/page.tsx`. Edit only the one that renders the body.
DONE: valid blocks and surrounding markdown render correctly; malformed blocks fail safely; raw serialization is absent. Hiding the body does not pass.
EVIDENCE: the test output.
DO NOT: edit `convex/schema.ts`.
REPORT: the file and the assertion.
SPEC: the block's visible English and Hebrew labels are UNKNOWN.
TESTS: Given valid and malformed block fixtures with surrounding markdown, assert the intended block, preserved markdown, safe malformed state, and absence of raw JSON. An empty body must fail.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: What does that block say on screen in English and in Hebrew?

## TF-04 Brain-dump thread

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after CHAT-CONTRACT
WHY: PRD chat.
GOAL: A brain dump stays in one thread and can start another thread.
SCOPE: coach thread list
MUTATES: UNKNOWN. Start at `apps/web/app/(tempo)/coach/page.tsx` and `convex/conversations.ts`. That is already two areas. Split before building. This ticket is the screen only.
STEPS: do not start until MUTATES is one screen plus one test.
DONE: UNKNOWN until the screen file is fixed.
EVIDENCE: a Playwright test that two threads stay separate.
DO NOT: edit schema.
REPORT: blocked until the question is answered.
SPEC: copy UNKNOWN.
TESTS: Given two threads, When the person opens the second, Then the first body's text is not shown.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: Is the brain dump `coach` or `brain-dump`? Pick one file.

## TF-05 Push back with a proposal

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after PROPOSAL-CONTRACT
WHY: SPEC item 5 and 6.
GOAL: "Move this to this" creates a proposal card, not a silent write.
SCOPE: one proposal card
MUTATES: the card component plus one test. Path UNKNOWN. Kit export is `SoftCard` or a new card. A new export needs a ticket that names the file.
STEPS: do not add a component until the path is named.
DONE: the card shows Accept, Edit, and Reject.
EVIDENCE: a test for the three controls.
DO NOT: auto-apply. The confidence clash is not decided.
REPORT: the path.
SPEC: EN and HE labels UNKNOWN.
TESTS: Given a proposal, When it renders, Then Accept, Edit, and Reject are present and no mutation has run.
NUMBERS: undo at least 5 minutes, from HARD_RULES. The toast copy is UNKNOWN.
GATES: the shared gates.
Question: What are the English and Hebrew labels for Accept, Edit, and Reject?

## TF-06 Do not auto-apply

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Codex · code model: mid-tier
WHEN: Alpha; blocked on owner confidence-policy decision
WHY: HARD_RULES 6.2 clashes with 6.3.
GOAL: Alpha uses one approved rule for coach writes.
SCOPE: the proposal guard only
MUTATES: UNKNOWN. `convex/lib/coachProposalGuard.ts` is a candidate. Confirm by reading. Plus one test.
STEPS: do not edit until Amit picks the rule.
DONE: a test that a coach write does not land before the chosen rule allows it.
EVIDENCE: the test.
DO NOT: edit `convex/schema.ts`.
REPORT: the rule he picked.
SPEC: UNKNOWN which rule.
TESTS: not final until the rule is picked.
NUMBERS: confidence 0.8 is the old auto-apply line. It is not the winner yet.
GATES: the shared gates.
Question: For Alpha, does every coach write ask first, or may confidence at or above 0.8 apply and then undo?

## TF-07 Template can be turned on

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: UNPLACED; whether Alpha exposes templates is UNKNOWN
WHY: current APP-FLOW candidate; the morning ROADMAP exit is historical.
GOAL: Approving a template makes it usable, and it can be turned off.
SCOPE: the template run screen
MUTATES: UNKNOWN. Candidates under `apps/web/app/(tempo)/templates/` and `(bare)/templates/`. Pick one.
STEPS: read both trees. Edit one screen plus one test.
DONE: a test turns a template on and off.
EVIDENCE: the test.
DO NOT: edit schema.
REPORT: the file.
SPEC: EN and HE copy UNKNOWN.
TESTS: Given a template, When the person approves it, Then it is usable, and When they turn it off, Then it is not offered.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: Does Alpha expose templates, and which existing route is canonical?

## TF-08 Memory import review

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha memory-import candidate; after NOTES-CONTRACT; exact scope remains OPEN
WHY: current APP-FLOW candidate; the morning ROADMAP exit is historical. Settings memory import.
GOAL: Pasted memory shows a review list. Nothing is kept until the person says so.
SCOPE: `apps/web/app/(tempo)/settings/memory/import/page.tsx` plus one test, if that file is the screen. Confirm by reading.
MUTATES: that page and one test file.
STEPS: read the page first. If the logic is in Convex, stop. That would be a second ticket.
DONE: a test that a rejected row is not stored.
EVIDENCE: the test.
DO NOT: write raw export text into a new table.
REPORT: files.
SPEC: column labels UNKNOWN in Hebrew.
TESTS: Given three import rows, When one is rejected, Then that row is absent after save.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: What is the English and Hebrew text on the keep and reject controls?

## TF-09 Hebrew layout

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha web; phone parity belongs to MVP
WHY: SPEC item 11.
GOAL: Choosing Hebrew sets the page to right-to-left. Numbers and code stay left-to-right.
SCOPE: the direction switch on one layout
MUTATES: UNKNOWN. `apps/mobile/lib/rtl.ts` exists. The web layout file is UNKNOWN. One file plus one test.
STEPS: find the web layout that sets `dir`. Edit that file only.
DONE: a test that Hebrew sets `dir` to `rtl`.
EVIDENCE: the test.
DO NOT: reverse stored markdown.
REPORT: the file.
SPEC: the control's copy UNKNOWN.
TESTS: Given Hebrew, When the shell renders, Then direction is rtl, and a time sample is still ltr.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: Where does the person switch language on the web?

## TF-10 Gmail connect, no raw mail stored

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Reason for the account, Codex for the code · code model: mid-tier
WHEN: UNPLACED for a single Gmail connection; recurring/multiple-account/automatic checks belong to Gen 1.1/1.5
WHY: PRD part 4. HARD_RULES 6.4.
GOAL: Gmail can connect through Executor. A raw message body is not written to Convex.
SCOPE: the connect button and the RAM-only check
MUTATES: UNKNOWN. Stop if it needs more than 3 files plus 1 test.
STEPS: read `convex/lib/connections/`. Do not print secrets.
DONE: `bun run scan:ram-only-audit` exits 0, and a test shows the body is not in the mutation args.
EVIDENCE: both outputs.
DO NOT: touch `.env` or print a token.
REPORT: files, with secret names only.
SPEC: button copy UNKNOWN.
TESTS: Given a fake message body, When the scanner returns, Then the body is not in the stored row.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: What should the Gmail button say in English and Hebrew?

## TF-11 Voice round trip

STATUS: open

FOR: Tempo Flow · tempo-rhythm · assigned voice worker; code role: mid-tier
WHEN: MVP voice; depends on the separate voice contract
WHY: PRD voice.
GOAL: One English and one Hebrew voice round trip. Hard prompts go to GLM 5.3 Flash or DeepSeek.
SCOPE: the voice screen
MUTATES: UNKNOWN. Mobile file `apps/mobile/app/(tempo)/voice-call.tsx` exists. Web file UNKNOWN.
STEPS: use the separately assigned 6 Nov voice brief and contract; do not require a GPU choice before testing the authorized initial API chain.
DONE: UNKNOWN.
EVIDENCE: a recording of one interrupted round trip, with no secret on screen.
DO NOT: rent a GPU. Amit does that.
REPORT: blocked.
SPEC: separate voice contract pending; exact endpoint, interruption, latency and cost evidence remain OPEN. This ticket does not select a GPU or rental term.
TESTS: not writable yet.
NUMBERS: current voice entitlements UNKNOWN; 300/1,800 are historical figures, not active acceptance limits. See PRICING.
GATES: the shared gates.
Question: Which unresolved choices remain after the separately assigned voice contract and preview test? Do not re-ask the superseded GPU-first question.

## TF-12 Visible thinking

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after CHAT-CONTRACT
WHY: UX-GUIDELINES. A reply with no visible work looks untrusted.
GOAL: While the coach request is in flight, the screen shows a working state.
SCOPE: the coach transcript
MUTATES: one component plus one test. Path UNKNOWN.
STEPS: read the coach page. Edit the status element only.
DONE: a test that the working state is present before the reply.
EVIDENCE: the test.
DO NOT: fake a delay. Show the real in-flight state.
REPORT: the file.
SPEC: the working-state words in EN and HE are UNKNOWN.
TESTS: Given a request that has not returned, When the transcript renders, Then the working state is visible and the reply is not.
NUMBERS: skeleton after 100 ms is the hard-rules line for content areas. Whether this state uses a skeleton is UNKNOWN.
GATES: the shared gates.
Question: What should the working state say in English and in Hebrew?

## TF-13 Empty day welcomes

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after the day route and copy are resolved
WHY: HARD_RULES section 1.
GOAL: An empty day does not shame. A return after missed days says welcome back.
SCOPE: the day empty state
MUTATES: one component plus one test.
STEPS: do not write the sentence until he sets it.
DONE: the test looks for the exact string he set.
EVIDENCE: the test.
DO NOT: use the words "streak broken" or "lazy".
REPORT: the string.
SPEC: exact copy UNKNOWN.
TESTS: Given no tasks, When the day renders, Then the welcome string is present and the banned words are absent.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: What is the welcome sentence in English and in Hebrew?

## TF-14 Break

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: UNPLACED; the evening ladder did not assign the old break feature
WHY: historical morning break candidate; current stage and behavior remain UNKNOWN.
GOAL: From the day, the person can start a break.
SCOPE: one control
MUTATES: UNKNOWN. Mobile has `breathwork.tsx`. Web has no break route.
STEPS: do not add a route until he says what a break is.
DONE: UNKNOWN.
EVIDENCE: a test that the control opens that break.
DO NOT: invent a meditation script.
REPORT: blocked.
SPEC: UNKNOWN.
TESTS: not writable yet.
NUMBERS: duration UNKNOWN.
GATES: the shared gates.
Question: What is the intended break behavior and its product level?

## TF-15 Lecture notes are a note

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha plain lecture note; StudyFetch-like tools belong to Gen 1
WHY: PRD study job. APP-FLOW says there is no lecture route.
GOAL: A lecture note is a note with a page type the person can filter.
SCOPE: the note create control
MUTATES: one screen plus one test. Do not add a table. `notes.pageType` already allows daily, weekly, project, plain, template. Lecture is not in that list.
STEPS: do not add a union value. That would edit `convex/schema.ts`, which this set of tickets must not touch.
DONE: UNKNOWN until he says lecture notes use an existing page type.
EVIDENCE: a test that the chosen type saves.
DO NOT: edit `convex/schema.ts`.
REPORT: the type he chose.
SPEC: UNKNOWN.
TESTS: not writable until the type is chosen.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: Which existing page type should a lecture note use?

## TF-16 Plan prices on the billing screen

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: OPEN; price facts are settled but checkout placement and entitlements are not
WHY: PRICING.
GOAL: The billing screen shows $20 and $50 a month, and says $50 adds the voice feature. Minute entitlements remain UNKNOWN.
SCOPE: `apps/web/app/(tempo)/billing/page.tsx` if that is the screen. Confirm by reading. Plus one test.
MUTATES: that page and one test.
STEPS: do not map the prices onto `basic` or `pro` until he says.
DONE: the test finds both prices and does not find the word Stripe.
EVIDENCE: the test.
DO NOT: call Whop or Paddle from this ticket. That is config.
REPORT: the file.
SPEC: the sentence under the prices, in EN and HE, is UNKNOWN. The prices themselves are $20 and $50.
TESTS: Given the billing page, When it renders, Then $20 and $50 are shown and Stripe is absent.
NUMBERS: $20 and $50 are decided prices. Voice minutes and plan identifier mapping remain UNKNOWN; do not turn historical numbers into active entitlements.
GATES: the shared gates.
Question: Which schema plan is $20, and which is $50?

## TF-17 Beta tester gate

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Amit approves people, Codex writes the check · code model: mid-tier
WHEN: Alpha; after AUTH-CONTRACT
WHY: PRICING. Schema already has `betaAccess` and `approvalStatus`.
GOAL: A tester Amit approved gets premium. A pending account does not.
SCOPE: the approval check
MUTATES: one function file plus one test. Path UNKNOWN. Do not edit `convex/auth*`.
STEPS: read `convex/approval.ts` and `convex/lib/approval.ts`. Edit one of them only if the check is already there. If the change needs schema, stop.
DONE: a test that `pending` is rejected and `approved` tester is allowed.
EVIDENCE: the test.
DO NOT: print the allow-list.
REPORT: the file.
SPEC: the waiting-room sentence UNKNOWN.
TESTS: Given approvalStatus pending, When the gate runs, Then access is denied.
NUMBERS: `BETA_MAX_TESTERS` is a name in `.env.example`. The cap's meaning for this test is UNKNOWN.
GATES: the shared gates.
Question: What should a waiting tester see, in English and Hebrew?

## TF-18 No guest on live

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Codex · code model: mid-tier
WHEN: Alpha; after AUTH-CONTRACT and the environment mapping
WHY: PRICING. Guest sign-in is preview only.
GOAL: The production build has no guest sign-in control.
SCOPE: the sign-in screen's guest control
MUTATES: one file plus one test.
STEPS: find the guest control. Hide it when the env is production. The env name that means production is UNKNOWN. Do not invent it.
DONE: a test for both modes.
EVIDENCE: the test.
DO NOT: edit `.env`.
REPORT: the env name he confirms.
SPEC: UNKNOWN env name.
TESTS: Given Deployment, assert guest UI is absent and direct guest access is rejected server-side by AUTH-CONTRACT. Given Preview, assert the explicitly approved guest behavior. UI hiding alone is not an access-control proof.
NUMBERS: none.
GATES: the shared gates.
Question: Which env name means production for this check?

## TF-19 Undo toast

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: Alpha; after TF-05 and PROPOSAL-CONTRACT
WHY: HARD_RULES. At least 5 minutes.
GOAL: After an accepted AI change, undo shows the time left and can reverse that change.
SCOPE: the toast
MUTATES: one toast component plus one test. `packages/ui` has no Toast export. Mobile has `apps/mobile/components/v3/Toast.tsx`. The web file is UNKNOWN.
STEPS: find the web toast. If there is none, this ticket is only the new file plus the test, and the path must be named first.
DONE: a test that undo is offered and a failed undo does not drop a newer edit.
EVIDENCE: the test.
DO NOT: shorten the 5 minutes.
REPORT: the path.
SPEC: toast copy UNKNOWN.
TESTS: Given PROPOSAL-CONTRACT fixtures, assert availability through the exact five-minute boundary, successful restore, stale-revision/conflicting-edit rejection, repeated-click handling, and failed undo preserving newer content. Timing and revision semantics must be fixed by that prerequisite.
NUMBERS: 5 minutes, from HARD_RULES section 1.
GATES: the shared gates.
Question: What is the undo sentence in English and Hebrew, and which web file owns the toast?

## TF-20 Shame-free habit row

STATUS: open

FOR: Tempo Flow · tempo-rhythm · lane Cursor · code model: mid-tier
WHEN: UNPLACED for this habit surface; shame-free copy remains a standing rule
WHY: UX. `HabitRing` exists. It must not scold.
GOAL: A missed habit does not say the streak is broken.
SCOPE: `packages/ui/src/primitives/HabitRing.tsx` plus one test, if the words live there. Confirm by reading.
MUTATES: that file and one test.
STEPS: read the file. If the words are in the app instead, stop and name that file. Do not edit both.
DONE: a test that the banned phrase is absent.
EVIDENCE: the test.
DO NOT: add points or a new badge.
REPORT: the file.
SPEC: the replacement sentence UNKNOWN.
TESTS: Given a missed habit, When the ring renders, Then "streak broken" is absent.
NUMBERS: UNKNOWN.
GATES: the shared gates.
Question: What should a missed habit say, in English and Hebrew?

## Contract prerequisites

[BUILD-CONTRACT-GAPS.md](../product/BUILD-CONTRACT-GAPS.md) names AUTH-CONTRACT, DATA-CONTRACT, NOTES-CONTRACT, CHAT-CONTRACT, PROPOSAL-CONTRACT, and TEST-FOUNDATION. These are OPEN architecture work items, not ready factory tickets. Exact path discovery is agent work; missing owner policy/copy remains explicitly OPEN.

## Config tickets

These match [CONFIG-PLAN.md](../product/CONFIG-PLAN.md). They are not code-bar tickets. STATUS is open where that file says a name or an owner is UNKNOWN.

| ID | Owner | STATUS | Question |
|---|---|---|---|
| CFG-01 | Amit, then Reason | open | Check the existing Resend account first; assigned configurator may create/store named keys. New account or legal consent remains Amit's. |
| CFG-02 | Amit, then Reason | open | NONE for the shape. Amit approves testers. |
| CFG-03 | Reason | open | Use Dev/Test/Preview/Deployment from docs/ENVIRONMENTS.md; Test and Preview share the existing test deployment. New Firebase mapping OPEN. |
| CFG-04 | Reason, Amit if sign-in is needed | open | Is `tempoflow.dev` still the production domain? |
| CFG-05 | Codex, then Reason | open | Which env name holds the GLM key? Do not invent it. |
| CFG-06 | Amit, then Reason | open | What is the Deepgram env name in Convex? |
| CFG-07 | Assigned voice worker | open | Separate 6 Nov voice brief and TF-11 contract; GPU is not the first prerequisite. |
| CFG-08 | Amit | open | Which schema plan is $20, and which is $50? Same question as TF-16. |
| CFG-09 | Amit | open | Same plan-name question for Paddle. |
| CFG-10 | Amit for consent, Reason for wiring | open | Gmail button copy. Same question as TF-10. |
| CFG-11 | Reason | open | NONE for the shape. Do not print a token. |
| CFG-12 | Assigned CI worker | open | Named CI changes are authorized in the separate 6 Nov config lane; this docs change edits no workflow. |
| CFG-13 | Assigned automation worker | open | Cost/cap evidence before a test, then pause; no activation from this docs draft. |
| CFG-14 | Codex, Amit for the account | open | What should a crisis screen say, and when does it offer breathing, a therapist, or ERAN? |

## Counts

Product candidates: 20 (not all MVP). STATUS approved-unsent: 0. STATUS open: 20.
Config tickets: 14. All open.
GitHub issues created: 0.
