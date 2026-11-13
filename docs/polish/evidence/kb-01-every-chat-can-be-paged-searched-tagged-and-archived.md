# WALK — KB-01 preparation, 22 October 2026

Prepared implementation and focused tests; not deployed, merged, or declared done.

Base: `origin/integration` at `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`.

Replacement files in this scratch directory:

- `convex/schema.ts`
- `convex/conversations.ts`
- `convex/messages.ts`
- `convex/kb_01.test.ts` (new)

Only these four files are implementation deliverables. The `node_modules`, `convex/lib`, and `convex/_generated` entries are read-only dependency symlinks, not deliverables. Downloaded upstream Unicode/runtime research files are scratch references, not copied application code and must not be committed.

## Decisions for the shared register

| Date | Decision | Schema / contract effect |
| --- | --- | --- |
| 2026-10-22 | Amit authorized preparation of KB-01 architecture; Amit supplies `convex-arch` later. | No deployment or environment change. Existing dependency reconciliation, owner label, all guards, CI and clear CodeRabbit remain merge gates. |
| 2026-10-22 | Add optional `conversations.tags: string[]` and `archivedAt: number`. | No existing row rewrite or backfill. Missing tags mean an empty array; missing archivedAt means active. Existing list omits archived rows, while get remains readable. |
| 2026-10-22 | Add optional `conversations.libraryRevision: number`. | Default zero; every successful metadata write and Undo increments it. Undo compares receipt revision and result metadata before restoring. |
| 2026-10-22 | Add optional `conversations.libraryReceipts: Array<{token:string;requestKey:string;appliedRevision:number;undoUntilMs:number;previous:{tags?:string[];archivedAt?:number;deletedAt?:number};result:{tags?:string[];archivedAt?:number;deletedAt?:number}}>`. | Maximum 32 unexpired receipts, reject overflow, prune expired receipts only during an explicit metadata write. No transcripts/provider output. Five-minute server-clock Undo, independent owner check, exact request-key payload idempotency. |
| 2026-10-22 | Do not add KA folder or pin fields before KA-01 lands. | The API reads future optional metadata and currently returns null for absent folder/pinnedAt. No duplicate KA writer or schema. Reconcile with the eventual KA fields before merging. |
| 2026-10-22 | Root approved native index ordering for bounded stable traversal. | Chats sort by updatedAt, _creationTime, _id descending; messages by createdAt, _creationTime, _id descending. This corrects the ticket's simplified timestamp/ID tie ordering. Existing indexes suffice; no new index or table. |
| 2026-10-22 | Use a compound opaque receipt locator with a random nonce and SHA-256 payload digest. | The conversation ID bounds lookup but grants no access; every operation independently verifies owner and exact persisted receipt token. Raw request payloads and user IDs are not embedded in the token. |
| 2026-10-22 | Full case folding is tested against Unicode 15.1 default C/F mappings on Bun 1.3.9. | NFC literal substring search maps folded UTF-16 units back to complete original grapheme spans. This is a documented Unicode version, not a guarantee for newly introduced Unicode 17 characters. No imported mapping table or package. |

## Implemented behavior

`conversations.libraryPage`, `messages.historyPage`, `messages.searchPage`, `conversations.setLibraryMetadata`, and `conversations.undoLibraryChange` have argument and return validators matching KB-01. Anonymous reads and unapproved writes are denied. Foreign and missing IDs/tokens share `unavailable` errors. Returned rows are allowlists, excluding owner, thread IDs and receipt data.

Queries use existing owner/parent indexes and installed convex-helpers pagination. A slice targets 24 conversations or 99 messages, leaving room for one lookahead read. Actual index-iterator instrumentation asserts the 25-conversation / 100-message maximum; empty filtered slices retain a continuation. Full traversal reaches chat 201 and message 81. A search-hit history cursor opens the exact hit even with a one-item page. Cursor v1 validates owner, kind, normalized filters/query, and key shapes; resumed records undergo ownership checks.

Mapped Agent chats remain visible and return `legacy_only` coverage for the legacy transcript. No Agent store read/write, persona, memory or council work was introduced. Archive, tags and Undo leave non-KB metadata intact.

## Test results (cloud agent sandbox)

Bun: `1.3.9`. Root authorized only focused backend tests in this scratch workspace; a full validation worktree was unavailable.

| Command / check | Result |
| --- | --- |
| `bun test convex/kb_01.test.ts` — first focused run | 17 pass, 1 fail, 880 assertions, 2.84 s. A test incorrectly expected Hebrew original UTF-16 end 10; the correct original end is 9. No implementation change was needed. See focused-1.log. |
| `bun test convex/kb_01.test.ts` — second focused run | 21 pass, 0 fail, 891 assertions, 2.26 s. Corrected the expectation and added equal-timestamp, filter-intersection and real indexed-read instrumentation cases. See focused-2.log. |
| Unicode scalar comparison | 1,112,064 scalar values compared to official Unicode 15.1 default C/F mappings; zero differences. This is runtime-specific evidence. |
| Convex default-runtime source review | Standard Intl is retained; setup removes only deprecated Intl.v8BreakIterator. Runtime docs explicitly list SubtleCrypto. This is source evidence, not a deployment test. |
| `bun install --frozen-lockfile` | UNKNOWN: pending actual branch validation; reused existing dependency symlink for scratch tests. |
| `bun run lint` | UNKNOWN: pending actual branch validation. |
| `bun run typecheck` | UNKNOWN: pending actual branch validation, including generated API/schema type inference against the replacements. |
| `bun run test` | UNKNOWN: full suite pending actual branch validation. |
| Four required scans | UNKNOWN: pending actual branch validation; no new package or vendored source. |
| Local Playwright / production build | UNKNOWN: pending coordinator's allocated validation slot. Backend ticket has no new visual screen. |
| CI, owner guards, CodeRabbit | UNKNOWN: no PR created by this worker. |

Tests cover anonymous/foreign/pending access, complete pagination, original offsets for NFC Hebrew and expanding case folds, bounded reads, cursor binding, empty chats/slices, archive/list/get/Undo, exact idempotency, receipt cap and pruning, five-minute boundaries, intervening edit/deletion conflict, title hits, mapped legacy coverage, equal timestamps and intersected filters.

## References and limitations

- Unicode reference: https://raw.githubusercontent.com/unicode-org/unicodetools/main/unicodetools/data/ucd/15.1.0/CaseFolding.txt
- Convex runtime docs: https://github.com/get-convex/convex-backend/blob/main/npm-packages/docs/docs/functions/runtimes.mdx
- Convex Intl setup: https://github.com/get-convex/convex-backend/blob/main/npm-packages/udf-runtime/src/00_misc.ts

The independent fold algorithm special-cases dotless i, capital sharp S and Cherokee, using standard runtime case conversion for other characters. Official Unicode data was used only as an external verification oracle and is not bundled. Actual deployed V8/ICU compatibility remains unverified without an authorized deployment; do not call that a passed live check.

Do not merge the files blindly over another branch's changes. Root owns rebase/reconciliation, issue contract updates, the owner-label gate and the eventual evidence artifact under the ticket's approved evidence path. No files were changed in an active checkout, and this worker made no GitHub writes.
