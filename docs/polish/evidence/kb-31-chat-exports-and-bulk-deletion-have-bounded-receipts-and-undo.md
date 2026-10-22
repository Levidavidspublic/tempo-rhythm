# WALK — KB-31 preparation, 22 October 2026

Implementation and focused tests are prepared. This is not a deployment, merge or completed full-validation claim.

Stack base: the frozen KB-01 scratch files under `/workspace/work/overnight/kb01-oct22`, originally based on integration `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`. Root must publish/reconcile the parent stack first.

## Deliverables

- `convex/conversations.ts`: replacement, adding bulk metadata/delete, atomic bulk Undo and paged recoverable receipts.
- `convex/messages.ts`: replacement, adding snapshot exports and parent-version updates for existing message create/remove.
- `convex/kb_31.test.ts`: new, 22 behavioral tests.

**Schema changes: NONE.** The schema symlink points to frozen KB-01 solely for scratch tests. Do not copy symlinks, dependency folders or this local handoff as product source. Approved repository evidence destination: `docs/polish/evidence/kb-31-chat-exports-and-bulk-deletion-have-bounded-receipts-and-undo.md`.

## Decisions for root's register / issue contract

| Date | Decision | Effect |
| --- | --- | --- |
| 2026-10-22 | Amit authorized KB-31 architecture preparation. | Owner convex-arch label, original KB-01/KB-16/KA-01 dependency reconciliation, green CI, CodeRabbit and all guards remain merge gates. |
| 2026-10-22 | Root approved export selection limit 1–25; bulk remains 1–50. | The previous promise to revalidate all 50 chats on every page contradicted the 25-chat per-call limit. Client export consumers must batch larger selections. No silent cap or truncation. |
| 2026-10-22 | Reuse KB-01 receipt fields without changing schema. | Per-chat receipt includes prior/result tags, archive and deletion metadata; all members preflight before any patch. Bulk retry hash includes ordered selection and operation, canonicalizes object property order, and never persists raw request data in the token. |
| 2026-10-22 | Preserve native composite order. | Export messages are oldest first by createdAt, _creationTime, _id. Receipt traversal uses existing updatedAt, _creationTime, _id descending. No new index. |
| 2026-10-22 | Existing messages.create/remove advance parent.updatedAt monotonically. | Deleting an older message now invalidates an export. This also handles same-clock creates/removals. Future KA content-edit writers must uphold the same parent-version invariant before reconciliation/merge. |

## Export guarantees and limits

`messages.exportPage` checks every selected owner and mapped-Agent status before emitting any record. Each snapshot binds owner, ordered selection, parent updatedAt, libraryRevision, a SHA-256 digest of allowed header fields, and the newest live message ID found with the existing live-message index. Every page recomputes and compares all fences. Tombstoning a selected conversation or changing its header/version/fence aborts with `export_changed`; mapped Agent content is `export_unsupported`. Unknown/foreign rows remain unavailable. Cursor version, digest, index, header state and native message key shapes are validated.

Each invocation reads at most 25 selected conversation rows. Each chat gets one indexed live-message boundary lookup. The transcript slice then targets at most `99 - selectedChatCount` rows, leaving one read for lookahead: at most 100 indexed message reads total, including initialization. Empty/system-only slices preserve continuation. An export contains one conversation header followed by messages in native oldest-first order. Client cancellation simply discards cursor/snapshot: no server files, jobs or stored export state exist.

All records use explicit field allowlists. System and tombstoned messages, user IDs, tool calls, provider metadata/errors, Agent IDs and receipt data are excluded. Sources contain only title/site/URL. Unicode and original content are preserved. Markdown escaping, ISO timestamp formatting, final JSON envelope and the irreversible-download warning are client responsibilities; this backend ticket does not implement or claim them.

There is no existing public message content-edit endpoint in the scoped base. The existing add/remove endpoints are covered. Other existing coach writes append messages and advance their parent; the newest-live-message fence also detects same-clock appends. Future writers that edit exported content in place must advance the parent version. Direct administrative database edits bypassing that invariant are not claimed to be detected.

## Bulk / Undo guarantees

All selected rows, payloads, request keys and receipt capacities are validated before patches. A missing/foreign member or a full receipt set leaves every member unchanged. Delete changes only the parent tombstone, preserves earlier parent and message deletion timestamps, and leaves message rows untouched. A retry returns the original receipts; changed payload/selection with the same key conflicts.

Bulk Undo validates ownership, exact token, expiry, current revision and result metadata for every member before restoring any. It preserves unrelated title changes. A receipt is valid through exactly committedAt + 300000 ms. The receipt query includes deleted conversations and returns only unexpired receipts that still match the current revision/metadata, so consumed or conflicting receipts are not advertised as available Undo.

## Test results (cloud agent sandbox)

Bun 1.3.9. Root authorized lightweight focused tests only; another worktree held the full validation slot.

| Check | Result |
| --- | --- |
| `bun test convex/kb_31.test.ts`, first run | 22 pass, 0 fail, 76 assertions, 1.54 s. `focused-1.log`. |
| Same focused command, after canonical property-order hardening | 22 pass, 0 fail, 77 assertions, 902 ms; exit 0. `focused-2.log`. |
| Instrumented export read budget | Exactly 25 selected-chat reads and 100 message reads in the 25-chat/110-message fixture, counting all boundary lookups and transcript lookahead. |
| Frozen KB-01 regression suite / full tests | UNKNOWN: pending coordinator's actual branch validation. |
| Frozen lockfile install, lint, typecheck, four scans, Playwright, build | UNKNOWN: pending actual branch and allocated full validation slot. |
| CI, owner label, CodeRabbit | UNKNOWN: worker did not create or modify a PR. |

Tests cover 50-member bulk limit, 25-member export limit, atomic foreign/capacity failure, parent-only deletion, old tombstones, exact retries, Unicode tag normalization, Undo conflict/expiry, anonymous/pending/foreign access, receipt pagination, explicit JSON/Markdown input allowlists, second-page export, message 81 and chat 201, every-selected-chat version changes, old-message deletion, same-clock append, cancelled/restarted exports, owner/selection cursor binding, Agent rejection before output, empty slices, equal timestamp ordering and measured read bounds.

No active checkout was edited. No public write, secret, paid service, package, environment change or deployment occurred. Root owns publication, integration reconciliation, evidence placement and all remaining gates.
