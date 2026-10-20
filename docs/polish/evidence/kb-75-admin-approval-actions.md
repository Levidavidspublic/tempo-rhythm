# KB-75 admin approval actions evidence

The existing `/admin/approvals` route mounts `AdminApprovals` inside the Tempo shell. The revised host mounts `AdminStatusSummary` and `ApprovalRowFeedback`. Each row now holds its own synchronous request guard, pending state and safe, attributed result. Starting decisions for Maya and Dana concurrently leaves Dana pending when Maya settles. A rapid second click on one row sends one unchanged `approval:setStatus({ userId, status })` call. The reactive admin query remains authoritative for statuses, order and the count of accounts shown; the backend returns at most 500 live accounts, so the count is explicitly qualified. The admin-only query skip and server authorization remain unchanged.

The [contact sheet](./kb-75-admin-approval-actions.jpg) compares the exact original source frozen from integration commit `52bf2803e9105b25c2538aedd81a754a9fbfdedb` before editing with the real mounted current host and the interactive gallery at 390/1280 px, English/Hebrew, light/dark. The baseline screen still displays its original English copy under the Hebrew locale. The fixture uses fictional Maya, Dana and Yoni accounts and stubs only the Convex query/mutation boundary; no live account is read or changed. The current and baseline use real `Button`, `LocaleProvider`, compiled app Tailwind/v3 CSS and the actual component source. The gallery composes the two production view exports; its interactive controls are not a replacement for the mounted host tests.

## Browser findings

- Loading is distinct from zero; an initial non-admin/signed-out state never subscribes to admin rows; empty and loaded counts describe shown rows only. Admin rows have no decision buttons. The fixture verifies exact mutation arguments and reactive status/order after a decision.
- Separate held requests for Maya and Dana preserve independent pending state through Maya success or error. The retry acts on only its original row/status; raw backend text is never rendered. A removed-row response is discarded. Keyboard focus recovers in the changed row after the initiating button disappears, while a reader's move to another control is respected.
- English and Hebrew copy and dates render in en-US/he-IL formats. Names use auto direction; email remains isolated LTR. The 390/1280 light/dark matrix checks one shell main and one h1, 44 px phone actions, large-text containment and no horizontal overflow. Visible keyboard focus and near-zero reduced-motion durations are browser-asserted.

The screenshot sheet is visual evidence only; the clean-child mounted browser tests provide mutation/focus assertions. Device screen-reader results and live admin authorization/writes remain **UNKNOWN**. Hebrew copy is machine-drafted for Amit's native read. Full command results and any failure tails are in draft PR #1179.

## Capture provenance and regression cases

The original source was frozen at 2026-10-19 21:29 UTC before edits. All 24 screenshots were captured during the passing fixture run at 2026-10-19 21:47–21:48 UTC. Current captures use first source head `947e49f1b1bf06f7d63468881e48ce72d1e62b18` plus the explicit `Set<string>` type annotation; this annotation has no runtime effect. The capture-only test timeout adjustment changes no UI behavior. The existing contact sheet was inspected again on 2026-10-20 before the corrective push.

The focused command `bun test tests/unit/kb-75.test.tsx` passed 22 named cases with 23 expectations and zero failures (157.88 seconds; Bun 1.3.9, local Chromium). The source names are:

- dictionary keys match and Hebrew is present
- loading distinct from zero
- non-admin skips list query
- empty list is explained
- pending count is qualified to shown rows
- admin row has no decisions
- exact status mutation arguments
- rapid same-row submit is single call
- different rows remain pending independently
- A success leaves B pending
- A error leaves B pending
- same-row error has reachable retry
- raw backend error never appears
- removed-row completion is discarded
- query controls status and reordering
- focus recovers when initiating button disappears
- late completion never steals moved focus
- English and Hebrew date labels and copy
- long email is isolated and wraps in RTL
- phone and desktop matrix has one main h1 and 44 px actions
- visible focus and reduced motion
- both named views render in interactive gallery
