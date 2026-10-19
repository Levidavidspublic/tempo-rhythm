# Kitchen run KB — plan, 19 Oct 2026

This draft is the plan. No product code is changed or represented as shipped. Base: `integration` at `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. No prior KB-SPEC or tickets existed in this checkout. The first three batches contain **45 fully specified tickets**: 15 search, 19 history, 11 polish; 10 Astra and 35 Sol; 42 component and 3 data. The next two batches bring the planned total to 75, within the requested 60–80 range. The implementation follow-up has also expanded KB-66/69/70: **48 written tickets total** (15 search, 19 history, 14 polish; 10 Astra planning lanes and 38 Sol; 45 component and 3 data).

## Inventory and boundaries

[INVENTORY.md](INVENTORY.md) covers every component module in `packages/ui` and `apps/web/components`: 162 modules plus 100 supporting files, source callers, statically reachable screens, v3 findings and ownership. Rendered compliance is UNKNOWN until checked. KA ownership is mapped from live issues #1094–#1131; #1135 remains KA's tracker. PR #1081 was OPEN when checked; its Wave-2/3 dependencies remain in force. PR #1090/#1089 behavior is the baseline, not new KB work. [RESEARCH.md](RESEARCH.md) records live Vane and Open WebUI source reads and the deliberate limitations of Tempo's bounded equivalents.

The three groups are search answers above KA-24/43, full history above KA-01/04/05/11/14, and component/polish gaps. KB adds a Library **inside existing `/history`**, new controls inside `/coach`, and Discover inside `/search`; it adds no route. New named components live in their mounted module, are used by the real screen in the same ticket, and have an exported gallery view and behavioral tests. The first pass specifies 84 named view exports; KB-66/69/70 add five scoped views. These are planning ceilings, not a quota. The remaining 27 title-only tickets can add up to roughly 54 more while staying below 150; reuse an existing suitable component instead of multiplying identical controls.

## Batch order and worker use

[queue.json](queue.json) is the authoritative written-ticket queue. It lists the three backend tickets first in dependency order, then all fourteen dependency-free tickets, then the remaining component tickets in dependency order. Each of batches 1–3 contains exactly fifteen tickets and one data ticket; batch 5 currently has three expanded component tickets; skip blocked entries instead of waiting. `wave` equals the numeric batch (1–3 or 5 for expanded KB-66/69/70); `batch: KB` remains the scope-guard run key. KB deps use KB IDs in JSON and TEMPO-KB IDs in front matter; KA deps are issue numbers. No same-file implementation work runs concurrently. Registration and evidence paths are ticket-specific, so there are no shared-file exceptions to schedule around.

- **Batch 1 (KB-01–15):** history metadata/search contract; nine immediate screen-polish jobs; source/citation refinements; Library list and filters.
- **Batch 2 (KB-16–30):** bounded search contract; modes, sources, domains, images/video, suggestions, widgets, Discover, answer actions/progress; history tags/archive and message queue.
- **Batch 3 (KB-31–45):** bulk/export/Undo contract; bulk actions, delete, Markdown/JSON, long transcripts, old-text matches, phone/native parity; onboarding/sign-up polish.

Start 19–20 Oct with Astra slots on KB-02/03 and seven Sol slots on KB-04–10, **subject to the code-model rule below**. KB-44/45 have no product dependency and can be pulled forward when a slot frees; batch numbers are packaging, not global barriers. Then take the first ready ticket matching a free lane; never wait on a blocked ticket when another is ready. After the allowance reset on **23 Oct (Asia/Jerusalem)**, resume the same queue at the first incomplete ready entry. No worker is instructed to call a paid API merely to consume allowance. Remaining quota, exact reset time and all-day utilization are UNKNOWN; nine permanently busy slots cannot be promised while KA holds reserve shared files.

## Data and privacy

Only KB-01, KB-16 and KB-31 are data tickets; each needs Amit's `convex-arch` label. Contracts are fully written inside the tickets that define/call them. KB-01 removes the current search ceiling with bounded resumable traversal and adds metadata receipts. KB-16 extends existing modules without generated-file edits, keeps ten searches/UTC day, the existing model tier/call/token ceilings, and no new services. KB-31 adds bounded export and atomic bulk actions with five-minute server-clock Undo. Existing Agent lifecycle metadata is preserved; mapped Agent transcript limitations are explicit, with a later bridge title. No orphan data migration, deployment, live backfill or server setup is authorized.

Every ticket repeats: no component edits to convex/hot/route files; no new package, key, paid service or env value; no OpenRouter/Composio; model calls only via ai_router; explicit Accept before AI changes and five-minute Undo; en/he copy and RTL; DESIGN §6 contrast, focus, 44 px phone controls and reduced motion. Hebrew is machine-drafted for Amit's native read. Downloads/shares warn before confirmation that copies cannot be recalled. Backend tests never make live model/provider calls.

## AGENTS.md wins — concrete differences from the brief

1. **Three implementation files + one test**, not about six. Each component ticket changes one already-mounted module, one new i18n group and one new CSS file; its gallery export stays in the module and its isolated browser fixture stays in the test. Copy and CSS register directly in that module, not shared `i18n.ts`/`globals.css`. Native tickets use the pure dictionary directly and register web CSS only in their scoped react-native-web gallery; native runtime styles use existing tokens. Data-only tickets add no unused CSS/copy/gallery files. Evidence files are outputs, not extra implementation files.
2. **Front matter comes before the title.** The inspected `scripts/factory/scope-guard.mjs:frontMatter` regex requires `---` at the start. Putting the brief's heading first would fail. Claude must preserve the leading block when filing issues.
3. **Sandbox checks still apply to this docs PR.** AGENTS has no docs-only exemption. Results are recorded in VALIDATION.md; missing infrastructure is UNKNOWN, not a pass. No product/check configuration is changed to make checks green.
4. **Code models must be mid-tier by billing** (AGENTS rule 10), while Amit requested Astra/Sol. During the explicitly authorized implementation follow-up, the lead assigned the independent UI tickets to Sol, including KB-02/03/44, and recorded that choice in their executable issues. Planning lane intent is retained for the other tickets; no Astra billing exception is assumed.
5. The single-branch/single-ticket rule applies to future worker implementation PRs. This requested lead artifact is one spec-line docs PR containing ticket definitions; it is not 45 implementation PRs. No issue is falsely closed, no labels or review bots are invoked, and nothing is merged.

HARD_RULES §6.3's older confidence auto-apply text conflicts with §1/§6.2 and the explicit brief. The plan follows explicit Accept, as the brief and current v3 §13 require; no automatic mutation is authorized.

## Claude handoff

After this draft opens, Claude files each still-unfiled written ticket verbatim as an issue (leading front matter intact), checks the implementation follow-up to avoid duplicate issues, maps TEMPO-KB dependencies to created issue numbers, retains KA issue links, and gives Amit one paste-ready Codex Cloud prompt per issue. A prompt includes repo, integration base, issue URL, lane/code-model rule, the entire ticket, no questions, draft-only/no merge, and AGENTS report instructions. Do not file later title-only entries as runnable issues. The current planning PR has no implementation issue to close; scope-guard may need an owner-approved planning issue after filing. Do not use KA #1135 as a fake Closes target.

## Implementation follow-up

Amit subsequently authorized product implementation and draft PRs. [IMPLEMENTATION.md](IMPLEMENTATION.md) maps the separate draft PRs, named production views and remaining delivery boundaries. KB-02–10 and KB-44/45 have been filed as implementation issues. Their draft PRs and sandbox checks are work in progress, not a claim of production readiness or feature parity. KB-69 was pulled forward after source review verified that a pending name save can overwrite a newer edit and sign-out rejection has no visible recovery. Its exact scope is [KB-69](tickets/KB-69.md), filed as [#1161](https://github.com/Levidavidspublic/tempo-rhythm/issues/1161). It has no KA file overlap and changes no approval policy. Remaining account/approval surfaces move to residual coverage under KB-75; they are not claimed as covered by KB-69.

## Next lead pass — remaining titles

Batch 4 (KB-46–60):
- KB-46 — Search answers explain missing or weak source coverage
- KB-47 — Source dates and freshness are shown only when verified
- KB-48 — Domain presets can be reused without broadening a search
- KB-49 — Uploaded-source questions connect to KA ingest and notebook context
- KB-50 — Discover remembers explicitly chosen topic preferences
- KB-51 — Structured weather and market widgets use approved sources
- KB-52 — Library retention and recovery explain what is still available
- KB-53 — Chats attach existing notes as explicit context
- KB-54 — Agent-backed conversations expose complete history through one read bridge
- KB-55 — Native search has image and video result parity
- KB-56 — Native citations and source previews remain accessible
- KB-57 — Native queued-message recovery has clear focus and announcements
- KB-58 — Search result families share consistent empty and error states
- KB-59 — Coach messages, proposal surfaces and voice controls finish v3 polish
- KB-60 — Template library, builder and study entry points finish residual polish

Batch 5 (KB-61–75):
- KB-61 — Habits, routines, tracking and insights close gaps remaining after KA
- KB-62 — Calendar and time-block surfaces close gaps remaining after KA
- KB-63 — Tasks and day-planning surfaces close gaps remaining after KA
- KB-64 — Notes, journal and capture surfaces close remaining reading gaps
- KB-65 — Memory and notebooks close remaining v3 and citation gaps
- KB-66 — **Expanded:** [Activity load more keeps the reader's place](tickets/KB-66.md), issue #1165. Other modules/goals/projects remain residual KB-75 work; do not file the broad title again.
- KB-67 — Nags and phrase editing have calm accessible states
- KB-68 — Billing and payment boundaries have complete accessible states
- KB-69 — **Expanded:** [Approval waiting stays clear while a name saves](tickets/KB-69.md); issue #1161. Do not file it again.
- KB-70 — **Expanded:** [Notification actions keep focus and submit once](tickets/KB-70.md), issue #1166. Other settings/You/notification modules remain residual KB-75 work; do not file the broad title again.
- KB-71 — Shared primitive families close verified v3 gaps at their callers
- KB-72 — Block and editor renderers close verified v3 gaps without a second renderer
- KB-73 — Brand, icon and marketing families close verified v3 gaps
- KB-74 — Shell, navigation and provider composition close accessibility gaps
- KB-75 — Remaining inventory rows have a verified mount or an explicit retirement decision

The next lead should read the 48 existing tickets and available implementation evidence first, refresh this inventory against integration, then expand the next three batches only if enough distinct work remains. There are 27 title-only tickets left across two reserved batches; a sixth batch is conditional on newly verified gaps, never duplicate tickets invented to hit a count. Keep at most one data ticket per new batch and use evidence to narrow broad family titles into compliant scopes.

## Needs Amit

- Apply `convex-arch` to KB-01/16/31 implementation PRs when reviewed; this lead never labels.
- Astra billing eligibility remains UNKNOWN. Independent UI implementation uses Sol under AGENTS; no owner exception is needed for those runs.
- Resolve held KA scopes #1110/#1112/#1129, or have the spec line split/release their reserved files. KB lists them where files overlap; skipping those deps to keep workers busy is forbidden. KA-11 Part A can unblock history without its held Part B when that completion is explicitly recorded by the owner.
- Provision/enable KA-24 services outside these worker scopes if live search is wanted; no environment values are set here.
- Native-read the machine-drafted Hebrew. Device VoiceOver/TalkBack checks remain a release responsibility, not a fabricated sandbox result.
- Any future multi-model comparison, richer live-data provider or increased model budget: **Needs Amit: runtime model and cost**. Such an executable ticket must be `hold: true`.
- Decide the complete Agent-history bridge scope and any necessary worker-scope exception for broad shared-primitive polish or a reusable gallery harness. Existing scoped fixture galleries do not wait for that decision.

## UNKNOWN

Live feature parity, production service configuration, model billing eligibility, available Codex quota/reset hour, native screen-reader results, rendered compliance of the inventory, unmerged KA implementation details and future Agent-history API. Specific sandbox results and document validation are in [VALIDATION.md](VALIDATION.md). None of these unknowns authorizes a guessed implementation, secret read, scope expansion or paid call.

## Spec correction: KB-06

The first pass incorrectly requested milestone rows and movement even though integration stores only goal progress/status and has no milestone or goal/task relationship API. KB-06 now specifies existing progress/state polish with exact verified API signatures. The implementation did not deliver milestones; that capability remains future backend work. Original validation gates and evidence paths are retained. This is a disclosed correction to a planning error, not a claim that the original feature was completed.
