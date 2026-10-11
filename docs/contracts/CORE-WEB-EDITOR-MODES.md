# Contract CORE-WEB-EDITOR-MODES: Markdown mode fidelity and licensed editor reuse

Ticket: #840 (TEMPO-CORE-EDITOR-MODES-01), batch CORE-WEB. Held. Document only: no code, no dependency, no schema, no scope change.
Baseline: `integration` at `9cf7985c6cc9a7b78dc9a805f832bc9bdab2ba79`, read on 2026-10-11 and merged into this branch in fix round 2. The first draft was written against `6cca80734d623c6db479d733bd5ab17cde6c8582`. The code map in sections 2 and 3 was re-run against the head above, and every file that changed in between was re-read.
Status: PROPOSED. Merging this file admits no writer, installs nothing and changes no policy. Every implementation named below needs its own admission.

## 0. How to read this document

| Tag | Meaning |
|---|---|
| ADOPTED-ENGINEERING (AE) | An engineering rule that follows from a cited source (PRD, TRD, HARD_RULES, merged code, ticket text). It binds the later split tickets once this file is merged. It never admits a writer, adds a dependency or changes a policy. |
| OWNER-DECISION (OD) | Needs Amit's explicit decision: a new editor framework, a license, a persisted representation, privacy or retention, spend. Each carries a recommended default. The default is not adopted until Amit says so, and any ticket that depends on it stays held. |
| EXTRAPOLATED | The author's inference. No source says it. Flagged for review. |
| UNKNOWN | Not verifiable from the sources available. Reported, not guessed. |

Citations: `path:line` is the baseline above. The page-block codec is merged on integration. It landed in `convex/lib/blocks.ts` with #826 at `5fc1e67f011e58909bbe3b004f30dfa2d9394385`. Then #879 (closes #802) at `9cf7985c6cc9a7b78dc9a805f832bc9bdab2ba79` moved it to `packages/utils/src/blocks.ts`, exported from `packages/utils/src/index.ts`, and left `convex/lib/blocks.ts` as a re-export. Codec citations below are to `packages/utils/src/blocks.ts:line` at the baseline. The earlier PR head `1af128b21b95ca202d6c8f556ebadf489e0904cf` that the first draft probed is byte-identical to the file merged at `5fc1e67` (empty `git diff` of that path). #879 is not a pure move: it also makes fence-looking lines inside raw HTML blocks prose (K-06). The section 7 fixtures were therefore re-run on the relocated file in fix round 2 (section 7.3). "Issue #n" means ticket text read on 2026-10-11, not code.

Two inputs were not available to the author: the 9 October inventory (`Tempo-Flow-Blinko-Ticket-Inventory-2026-10-09.md`, Library `libfile_23df3ad6ba9c8191a8ee8be9a355e50d`, version 1) and the owner's 7 October page-core brief. The four mode names come from the WHY line of #840. Their definitions in section 4 are therefore EXTRAPOLATED.

Precedence used: the owner's 10 October doc pack, Part A, wins over the repo docs. Part A locks the design system to shadcn primitives and Tailwind v4, calls FlyonUI conflicting, leaves 21st.dev's license UNKNOWN, and names Blinko as a comparator (not a code source).

### 0.1 DONE clause to section

| DONE clause (#840) | Where |
|---|---|
| Mode-by-format matrix: supported, unsupported, decision-required | Section 6 |
| Focused tests | Section 11 (coverage) and section 12 (commands) |
| Later splits of at most 3 files plus 1 test | Section 12 |
| Raw user Markdown can be intentional | Section 5, rules B-05 and B-06 |
| Internal Tempo block JSON is never casually exposed | Section 5, rules B-04 to B-09 and B-17 |
| Framework, license or representation change stays held | Section 10, OD-01 to OD-03 and OD-07 |

## 1. Summary

1. **Raw and Split are reachable without a new editor framework.** They compose #790 (PageView, a renderer) and #791 (PageEditor, segmented prose editing). Both are held and unmerged. This is segmented source editing. It is not Live Preview and it is not Rich Text, and it must not be labelled so (AE-02).
2. **Live Preview and full Rich Text need a new editor engine.** That is OD-01. Recommended default: no engine in the next-week scope. If Amit wants Live Preview, authorize a time-boxed spike of a source-as-document engine (CodeMirror 6 edits the Markdown text itself, so unedited regions cannot change; document-model engines do not). Defer full Rich Text.
3. **The Markdown string in `notes.body` stays the only persisted representation** (AE-01). Any second persisted representation is OD-02. Recommended default: reject.
4. **Boundary hazards were reproduced on the merged codec (`packages/utils/src/blocks.ts`).** Deleting the one line break between a prose line and a following Tempo fence turns a valid block into plain visible prose. Appending text directly after a closing fence at end of body turns it into an unclosed fence that swallows the text. Typing only an unclosed `json tempo` opener in prose before an existing block pairs it with that block's closer and turns the existing block into a broken segment. Typing an unclosed raw HTML opener such as `<!--` there turns the block into visible prose (the codec's raw HTML rule, K-06). In both cases the round trip still holds, so the codec itself reports nothing. Section 5 (AE-04, AE-14, B-17) and section 7 (BD-01 to BD-12) fix the rules and the tests.
5. **Candidates and licenses.** Registry licenses on 2026-10-11: MIT for react-markdown, remark-gfm, CodeMirror 6, Tiptap, Lexical, Milkdown, MDXEditor, `@uiw/react-md-editor` and `vditor`; **MPL-2.0 for `@blocknote/core` and `@blocknote/react`**. HARD_RULES section 3 lists MPL as acceptable, but MPL-2.0 is file-level copyleft, so an MPL-2.0 candidate needs the section 3 license-boundary check before admission (AE-11). That check is not done here: UNKNOWN. Some transitive packages carry other licenses: Milkdown's tree has one `(MPL-2.0 OR Apache-2.0)` package and `vditor`'s tree has an Apache-2.0 one. Plate is excluded by default because its resolved tree pulls in client-state libraries that HARD_RULES section 2 forbids (the names are in that file and are not repeated here). BlockNote's XL packages are `GPL-3.0 OR PROPRIETARY`. Blinko's editor code is GPL-3.0 and must not be copied. MDXEditor has one transitive package with no license field (UNKNOWN).
6. **The repo's component test harness cannot prove bidi, IME, selection or clipboard behavior.** Those need a real browser. Signed-in Playwright specs skip without `TEMPO_E2E_STORAGE_STATE`, so preview proof is a separate later gate.
7. **Eight later splits** are proposed in section 12 (S-01 to S-08), each at most 3 files plus 1 test, none admitted. S-08 (the oversized-body download) is the only access path for an oversized note and depends on OD-06.

## 2. Evidence baseline

### 2.1 Pins

| Item | State on 2026-10-11 | Source |
|---|---|---|
| integration head | `9cf7985c6cc9a7b78dc9a805f832bc9bdab2ba79` (`[TEMPO-B06-P04] Extract one pure shared block codec to @tempo/utils (#879)`), merged into this branch in fix round 2. First-draft head: `6cca80734d623c6db479d733bd5ab17cde6c8582` (#835). | `git rev-parse origin/integration` |
| Merged B06 support | #813 at `b0eb1de6fc9a46777e8ce85418f99bc9c82a0f43` (root Agent and shared-codec dependency pins). #824 at `0c5b4279847b8f21c1bafff9813fe55a1770fe30` (`zod` 4.3.6 declared directly in `packages/utils/package.json:12-14`). **#826 at `5fc1e67f011e58909bbe3b004f30dfa2d9394385`** (#786 B06-00 page block foundation: `convex/lib/blocks.ts`, `convex/lib/blocks.test.ts`, `pageType` and `date` on `notes` and the `noteBlocks` table in `convex/schema.ts`, all inactive). #827 at `fe9fa97ffee4c3cb9943a1e781d4b7a4fc9ddda1` (carries the #814 Agent test dependency scaffold and the Convex test pin). #875 at `b62abefab0567333aeb6acb52dcaa7cd5f0454f5` (closes #800: `@json-render/core` and `@json-render/react` 0.21.0 pinned in `packages/ui/package.json:21-26`; no catalog and no `./blocks` export yet). #872 at `d659d5d130678eb2ce4e4d71f53e72688597c6e9` (the root `test` script now includes `packages`, C-14). #879 at `9cf7985c6cc9a7b78dc9a805f832bc9bdab2ba79` (closes #802: the codec now lives in `packages/utils/src/blocks.ts` with `packages/utils/src/blocks.test.ts`, `convex/lib/blocks.ts` is a re-export, and raw HTML block handling is added, K-06). | git log; issue #802 |
| Open, unmerged | PR #825 (PRD amendment, only `docs/PRD.md`; that file is unchanged since the first draft). Other open PRs were not re-listed. | first-draft PR list (88 open PRs, two pages), not re-counted |
| Held, not started | #787 #788 #789 #790 #791 #792 #795 #801 #803 #804 #805 #808 #828 #831 #837 #838 #839 #841 to #858. #802 is done (#879). | issue text; git log |
| Absent from integration | `apps/web/components/page/`, `packages/ui/src/blocks/`, `notes.save`, `getOrCreateToday`, `patchBlock`, undo, any function that imports the codec or writes `noteBlocks` (only the schema, the account-deletion list and tests reference them), and every Markdown or editor dependency | `git ls-tree`, `convex/schema.ts:331-362`, `:364-465`, `convex/lib/accountDeletion.ts:27`, `bun.lock` search |

The #444 run plan (comment of 2026-10-11) lists the codec and reader lane as serial (#802, #803, #804, #805; #802 has merged as #879), the block UI lane as serial (#788, #789, #790, #791, #792), the deps lane as serial (#814, #800, #801; the first two have merged, #827 and #875), and the schema lane as one owner (#786, #807, #828, #841, #846, #851, #860). It lists this ticket among the parallel contract documents (#837, #838, #840).

### 2.2 Path ownership for this ticket's one scoped path

`docs/contracts/CORE-WEB-EDITOR-MODES.md` does not exist on integration. No remote branch matches `t/840*`. No title or branch among the 88 open PRs names this path. Per-PR file lists were not fetched for all 88, except #825 (`docs/PRD.md` only) and #826 (now merged; it did not touch this path). Residual overlap risk: UNKNOWN.

### 2.3 Contracts that do not exist yet (reported, not invented)

- PageView and PageEditor props, the `page-segments` adapter and `page-edit-state` API (#790, #791). Only ticket prose exists.
- `notes.save`, `patchBlock`, `undo` signatures. Issue #787 *proposes* `save({noteId, body, expectedVersion, requestId})` and `patchBlock({noteId, blockId, patch, expectedVersion, requestId})`. They are EXTRAPOLATED, not merged.
- The editor's own import of the codec. The browser-safe codec is exported from `@tempo/utils` (`packages/utils/src/index.ts:22-37`). `apps/web` already resolves that package (`apps/web/tsconfig.json:29`, `apps/web/next.config.ts:8`, and an existing import in `apps/web/components/habits/HabitEnergySuggestions.tsx`), but no editor code imports the codec yet.
- The json-render catalog and block components (#788). Only the packages are pinned (#875). No catalog, registry or `./blocks` export exists.
- The 9 October inventory and the 7 October brief (see section 0).

## 3. Current code map (verified on the baseline)

Re-verified in fix round 2 against the baseline above. The rows whose files changed since the first draft were re-read and updated: C-10 (`bun.lock`, `packages/ui/package.json`), C-14 (`package.json`) and C-16 (`convex/schema.ts`). The other cited files are unchanged between the two heads (`git diff --stat`).

| ID | Fact | Cite |
|---|---|---|
| C-01 | The note detail editor is one native `<textarea aria-label="Note body">` bound to the raw `notes.body` string, plus a title `<input>`. There is no mode switch, no preview, no `dir` attribute. | `apps/web/components/notes/NotesScreen.tsx:378-399` |
| C-02 | Saving is a 500 ms debounce calling `api.notes.update({noteId, title, body})`. There is no revision or request id. There is no `try/catch`, so a rejected save leaves "Saving" showing. The unmount flush is `void updateNote(...)`. | `apps/web/components/notes/NotesScreen.tsx:246-265`; `convex/notes.ts:122-141` |
| C-03 | The backend update accepts any string body with no length validator and patches it last-write-wins. | `convex/notes.ts:122-136`, `:162` |
| C-04 | The note loads into local state once per note id. Later reactive changes are ignored. | `apps/web/components/notes/NotesScreen.tsx:235-244` |
| C-05 | The mounted `/notes` list renders `plainPreview(note.body)`. That helper skips every fenced block and every line that looks like JSON. It is a heuristic. | `apps/web/app/(tempo)/notes/page.tsx:2-6`; `apps/web/components/notes-pages/NotesList.tsx:214`; `apps/web/components/notes-pages/filterNotes.ts:11-39` |
| C-06 | A second, local `NotesList` inside `NotesScreen.tsx` renders `snippet(note.body)`, the first 140 raw characters. It is reachable from the editor's delete-undo view, so a fence payload would show there once structured bodies exist. | `apps/web/components/notes/NotesScreen.tsx:43-47`, `:160`, `:315-326` |
| C-07 | Raw bodies also reach list search, global search snippets and MCP read tools. `noteView` returns `body`. | `convex/notes.ts:40-46`; `convex/search.ts:57-68`, `:102-109`; `convex/mcpTools.ts:41-49` |
| C-08 | Markdown rendering today is two private, duplicated subsets: headings 1 to 3, bullet and task lists, paragraphs, all as text nodes. No inline emphasis, links, code, tables, ordered lists, blockquotes, fences or `dir`. Task checkboxes are `disabled`. | `apps/web/components/template-builder/TemplateForm.tsx:28-77`, `:79-140`; `apps/web/components/template-run/TemplateRun.tsx:17-66`, `:68-125` |
| C-09 | A stacked "source then preview" composition already exists in the template builder: textarea, then a Preview section. It is not side by side, not synchronized, and has no modes. | `apps/web/components/template-builder/TemplateForm.tsx:249-262` |
| C-10 | No Markdown renderer or editor dependency exists. `apps/web/package.json` lists none of react-markdown, remark, rehype, CodeMirror, ProseMirror, Tiptap, Lexical, Slate, Plate, Milkdown, MDXEditor, BlockNote, Vditor or json-render, and `bun.lock` has none of the Markdown or editor names. The one related change since the first draft is `@json-render/core` and `@json-render/react` 0.21.0 in `packages/ui/package.json:21-26` and `bun.lock` (#875), not in `apps/web`. `@tailwindcss/typography` is a devDependency but no `prose` class is used in `apps/web`. | `apps/web/package.json:20-51`, `:42`; `packages/ui/package.json:21-26`; `bun.lock` search 2026-10-11 |
| C-11 | Direction: the root element is hard-coded `lang="en" dir="ltr"`. No `dir="auto"` exists anywhere in `apps/web/components`. The only `dir=` attributes are fixed `dir="rtl"` wrappers. PRD F-71 and F-72 are not implemented in any note surface. | `apps/web/app/layout.tsx:72-73`; `apps/web/components/Navbar.tsx:151`, `:300`; `apps/web/components/app/PageHeader.tsx:11`; `apps/web/components/payments/PaywallModal.tsx:131`; `docs/PRD.md:166-167` |
| C-12 | Web UI primitives are `button`, `card`, `dialog`, `input`, `label`. The shared `packages/ui` primitives are Button, CoachBubble, Field (an input wrapper), HabitRing, Pill, Ring, SoftCard, TaskRow. Neither has a tabs, toggle-group or textarea primitive. Web Radix dependencies are accordion, dialog, icons, label, slot. | `apps/web/components/ui/`; `packages/ui/src/primitives/`; `apps/web/package.json:24-28` |
| C-13 | Component tests run under `bun:test` plus `react-dom` with a hand-rolled DOM. Testing Library, jsdom and happy-dom are not dependencies. | `apps/web/components/template-builder/TemplateForm.test.tsx:1-5` |
| C-14 | The root `bun run test` is `bun test convex apps/web/lib tests/unit packages` (`packages` was added by #872). It does not discover `apps/web/components/**`. Tests under `tests/unit` can import app code by relative path. | `package.json:18`; `tests/unit/checklist_undo.test.ts:2` |
| C-15 | Signed-in Playwright specs skip without `TEMPO_E2E_STORAGE_STATE`. The existing notes spec proves a plain-string textarea round trip only. | `tests/e2e/screens/notes-save.spec.ts:3`, `:11` |
| C-16 | `notes` has `title`, `body`, `pinned`, `periodType` (daily, weekly, monthly, none), `pageType?` (daily, weekly, project, plain, template), `date?` (a local `YYYY-MM-DD` string), `aiGenerated?`, timestamps and `deletedAt?`. `noteBlocks` is a disposable, derived index of validated blocks (page-meta, task, template, broken) keyed by user, note and block id. Nothing writes it yet. | `convex/schema.ts:331-362`, `:364-465` |
| C-17 | `notes.getSafe` returns `null` for a malformed id, another user's note or a deleted note, and the UI shows a calm not-found. | `convex/notes.ts:62-75`; `apps/web/components/notes/NotesScreen.tsx:338-340` |
| C-18 | Note deletion has a 5 minute UI Undo and a 30 day server restore eligibility. They are different clocks. | `convex/lib/softDelete.ts:1-13`; `convex/notes.ts:186-215` |

### 3.1 The merged codec (`packages/utils/src/blocks.ts`, from #826, relocated by #879)

Properties relied on below. The codec is merged and inactive: no screen or Convex function imports it yet, only tests and the compatibility re-export do. The rules in sections 5 to 8 are phrased as required properties of the editor, not as codec details.

| ID | Fact | Cite |
|---|---|---|
| K-01 | Limits: body 1,048,576 UTF-16 units, block 65,536, 256 blocks, JSON depth 16. | `packages/utils/src/blocks.ts:3-11` |
| K-02 | A segment is `markdown`, `valid` or `broken`, each with `source`, `start`, `end`. | `packages/utils/src/blocks.ts:79-92` |
| K-03 | A body over the limit returns one `broken` segment spanning the whole body. | `packages/utils/src/blocks.ts:201-204` |
| K-04 | An unclosed `json tempo` fence returns a `broken` segment from the opener to the end of the body, and parsing stops. | `packages/utils/src/blocks.ts:219-229` |
| K-05 | `serializeTempoBlocks` concatenates each segment's original `source`. It is lossless for unchanged segments and is not a JSON generator. | `packages/utils/src/blocks.ts:279-282` |
| K-06 | A fence-looking line inside a CommonMark raw HTML block is prose, not a fence. Only start conditions 1 to 5 are modeled (`<script`, `<pre`, `<style`, `<textarea`, a comment, a processing instruction, a declaration, CDATA), each ending at its explicit marker. Conditions 6 and 7 are not. An unclosed raw HTML block runs to the end of the body, so later fences are prose and not `unclosed_fence` (BD-12). | `packages/utils/src/blocks.ts:100-122`, `:132-141` |

## 4. Vocabulary

### 4.1 Modes (EXTRAPOLATED definitions)

| Mode | Definition | Document the user edits | Needs a new engine |
|---|---|---|---|
| Raw | The user edits Markdown source text. | Source text | No (Tier 0 is segmented textareas plus protected block controls, #791) |
| Read | Rendered, read-only page. Block controls emit typed callbacks. | None | No (#790) |
| Split | Raw pane and Read pane over the same draft. | Source text | No (composition of #790 and #791, section 8) |
| Live Preview | One pane. The buffer is Markdown source. Syntax is rendered inline except where the cursor is. | Source text | Yes (OD-01) |
| Rich Text | One pane. The surface is a structured document that is serialized back to Markdown. | Structured document | Yes (OD-01, OD-03) |

The distinction that decides fidelity: in Raw, Split and Live Preview the thing being edited is the source text, so an unedited region cannot change. In Rich Text the thing being edited is a document tree, and the Markdown comes from a serializer.

### 4.2 Segment terms

Prose segment: a `markdown` segment. Protected block: a `valid` or `broken` segment. Only prose segments are free text. Terms follow the codec in K-02.

### 4.3 Tiers

Tier 0: needs only merged code plus the already-ticketed renderer (#801, react-markdown) plus #790 and #791. Tier 1: needs a new editor engine.

## 5. Source versus internal JSON: boundary rules

Persisted truth is the body string. "Source" below means user-visible and user-owned Markdown. "Internal JSON" means the payload of any fence whose info string is exactly `json tempo`, valid or broken.

| ID | Tag | Rule | Basis |
|---|---|---|---|
| B-01 | AE | The Markdown string `notes.body` is the only persisted representation. No mode persists a second form. A Rich Text document tree is in-memory view state and is discarded on unmount. | `docs/TRD.md:83`; `docs/BACKEND-SCHEMA.md:66` |
| B-02 | AE | Edits apply to the original source by span. Only prose segments the user edited change. Every protected block's bytes are copied unchanged from the last loaded canonical body. A valid block's bytes change only through a typed block operation (the `+ Task` control and tick, via the canonical codec and #787 `patchBlock`), never through free text. | #791 steps 2 and 3; K-02, K-05 |
| B-03 | AE | An unchanged document round-trips byte for byte in every mode and across mode switches, and entering or leaving a mode with no edit makes zero save calls. | K-05 |
| B-04 | AE | Boundary guard. The codec recognizes a Tempo fence only when its opener is three backticks and `json tempo` at column 0 of a line, and it ends the fence only on a line of three backticks followed by optional spaces or tabs (`packages/utils/src/blocks.ts:96-98`, `:155-156`). So the editor must keep a line terminator at every prose and block boundary: a prose segment that precedes a block ends with one, and a block that precedes prose ends with one. When the user's text lacks the terminator, the editor appends one: the terminator of the adjacent line, else the first terminator in the body, else LF (EXTRAPOLATED choice). That single added terminator is the only byte change allowed outside the edited prose. | BD-01 to BD-06 |
| B-05 | AE | Classification is done by the shared codec only. No editor, preview or list may decide "this looks like JSON" by heuristic. A fence is internal JSON only if the codec says so. Look-alikes (indented opener, tilde fence, different case, inside a blockquote or list item, inside a raw HTML block such as a comment or `pre`, ordinary `json` fence) are the user's own text and are shown as typed. | RT-07, RT-09, RT-14 to RT-17, RT-21, RT-22 |
| B-06 | AE | Raw user Markdown is intentional. Showing user-authored text, including user-authored JSON in an ordinary fence, is not an exposure. The exposure test is: does any surface render the payload of a Tempo fence? | `docs/PRD.md:91` |
| B-07 | AE | No surface renders Tempo fence source, valid or broken: not text content, not `value` or `defaultValue`, not `title`, `aria-*` or `alt`, not error messages, not `document.title`, not the clipboard on copy or cut, not drag data, not print output, not logs or analytics. Block cards show only the permitted visible fields (task title, template name) and generic text for broken blocks. | `docs/PRD.md:91`, `:249`; `docs/TRD.md:231`; `docs/APP-FLOW.md:148`; #790 step 4 |
| B-08 | AE | A Markdown renderer is only ever given prose segments, never the whole body. Observed: react-markdown 10.1.0 renders a `json tempo` fence as `<pre><code class="language-json">` with the payload visible (section 7.5), so one call with the whole body is a leak. | RT-FENCE in section 7.5 |
| B-09 | AE | Re-segmentation happens only at commit points (load, successful save response, mode switch, blur), never per keystroke and never while an IME composition is active. Text typed or pasted into a prose segment is user prose, kept as bytes, and classified by the codec at the next commit like any loaded text, provided the protected-block guard (B-17) passes. Invariant: visible prose plus protected spans equals the saved body. Nothing visible is dropped. Nothing hidden is saved that a protected span does not own. | BD-07 to BD-12 |
| B-10 | AE | Block deletion and reorder are never side effects of text editing. Backspace or Delete at a boundary, select-all then delete, and cut across a placeholder leave every protected block in place. No ticket defines an explicit remove or reorder control (UNKNOWN), so Tier 0 has none. | BD-05 |
| B-11 | AE | Raw HTML in the source is preserved but never rendered or executed. No `dangerouslySetInnerHTML`. Observed: react-markdown escapes it as literal text. | #790 DO NOT; section 7.5 |
| B-12 | AE | A body over the codec's 1,048,576 unit limit is never truncated, rewritten or shown as a single hidden card with an empty editor. The editor opens it read-only: a calm notice, no editable control, no write. The codec cannot classify such a body (K-03), so no surface may render its content in-page, because a Tempo fence payload could sit inside it (B-07). The only access path is an explicit, owner-initiated download of the exact raw bytes. It is owned by split S-08 and depends on OD-06 (OWNER-DECISION, recommended default yes, not adopted until Amit answers), so this contract claims only the safe read-only state for FM-22 and does not claim access. Today's plain textarea does show an oversized body (C-01, C-03), so the mount split S-05 stays held until S-08 ships or Amit answers OD-06 by accepting a notice-only state for oversized notes. The notice never implies the content is lost. | K-03; FT-03; S-08 |
| B-13 | AE | Errors and logs never include body text or block source. A failed save keeps the draft and shows a calm message. | #791 step 3 |
| B-14 | AE | Accessibility: every mode control and block control is keyboard reachable, labelled, with a visible focus state. Mode changes are announced politely. Textareas have labels. Block placeholders have accessible names built from permitted visible fields, never JSON. | `docs/HARD_RULES.md:207-215` |
| B-15 | AE, EXTRAPOLATED | Direction: every prose textarea and every rendered paragraph, list item, heading, blockquote and table cell carries `dir="auto"`. Code blocks and inline code are `ltr`. A block card does not force a direction: each visible user-authored field in it (task title, template name) carries `dir="auto"`, and the card chrome follows the page direction. Only technical strings are `ltr`. | `docs/PRD.md:166-167`; C-11 |
| B-16 | OWNER-DECISION (OD-04) | Whether a user may see the source of a block, and how a broken block is recovered. Recommended default in section 10.2. | |
| B-17 | AE | Protected-block preservation guard. Let `base` be the last loaded or last successfully saved canonical body and `P(base)` the `valid` and `broken` segments of `parseTempoBlocks(base)`. Before every save request, and before adopting a re-segmentation at a commit point (B-09), the editor runs the shared codec on the candidate body (the edited prose composed with the protected spans, B-02 and B-04) and requires every block in `P(base)` to be still there as the same block: a `valid` block with the same block id and the same bytes, in the same relative order; a `broken` block with the same bytes, matched by `blockId` when it has one and otherwise by order. New blocks in the candidate (a complete fence the user typed, a `+ Task`) are allowed and are classified by the codec. Typed block operations (tick, patch) are their own writes through #787 `patchBlock`, and each success replaces `base` (SP-03), so a draft save needs no exemption. If any base block is missing, merged into another segment, reclassified, reordered or changed, the editor refuses the write. Refusal means: no save call and no partial save; no repair and no automatic closing of a fence, because B-04 allows one added line terminator and nothing else; the draft stays exactly as typed and editable in its prose segment; the failing re-segmentation is not adopted, so the protected block keeps its card and the Read and Split previews render the last candidate that passed; and a calm message says the text would hide part of the page, that nothing was lost and that it has not been saved, without quoting body text or JSON (copy is EXTRAPOLATED, owned by the UI brief). The check re-runs on the next edit and the save goes ahead once the candidate passes. It covers typing, paste, drag, undo and redo, and IME commit alike, because it tests the whole candidate and not where the text was entered. The codec cannot do this alone: it round-trips every body, including one that swallowed a block (BD-08). | BD-08 to BD-12; K-04, K-05, K-06 |

## 6. Mode-by-format matrix

Cell codes. **S** supported: the contract requires it, with the named fixtures. **P** partial by design: source preserved, behavior degrades as stated. **U** unsupported: source preserved byte for byte where applicable, never rendered, executed or produced. **D** decision-required: cannot be claimed until an OWNER-DECISION is answered and the section 9.5 fixture run passes. **S\*** supported only after a named gap in section 9.3.1 is addressed.

Live Preview and Rich Text are D in every row because both need OD-01. The engine class sets the starting expectation (section 9.4).

| ID | Format | Raw | Read | Split | Live Preview | Rich Text | Notes and fixtures |
|---|---|---|---|---|---|---|---|
| FM-01 | Plain paragraphs | S | S | S | D | D | RT-02 |
| FM-02 | Headings (ATX and setext) | S | S | S | D | D | MD-05. Read maps levels to design tokens. |
| FM-03 | Emphasis, strong, inline code | S | S | S | D | D | MD-01. Strikethrough is P in Read and Split until the GFM plugin (CG-12). |
| FM-04 | Links: inline, reference, autolink | S | S | S | D | D | MD-07, MD-08, LNK-1 to LNK-3. Read uses the library's default scheme allowlist (CG-14). |
| FM-05 | Bullet, ordered, nested lists | S | S | S | D | D | MD-02. Marker style and start number kept in Raw. |
| FM-06 | Markdown task-list items | S | P | P | D | D | MD-03. Prose, not Tempo tasks (OD-08). Without the GFM plugin Read shows `[ ]` as text. With it, a disabled checkbox. |
| FM-07 | GFM tables | S | P | P | D | D | MD-04. Without the plugin Read shows the table source as a paragraph. After the preflight (S-03) it renders. |
| FM-08 | Fenced and inline code, ordinary info strings | S | S | S | D | D | MD-10. No syntax highlighting (U, CG-11). Code is `ltr`. |
| FM-09 | Blockquote, thematic break | S | S | S | D | D | MD-09 |
| FM-10 | Images | S | P | P | D | D | MD-15b. The default renderer emits `<img src>`, which fetches a remote URL. Tier 0 must not load remote media (OD-05, CG-13). Alt text or a link only. |
| FM-11 | Raw HTML | S | U | U | U | U | MD-11. Preserved in source. Read shows it escaped. |
| FM-12 | Wiki links `[[Title]]` | S | P | P | D | D | MD-15a. Literal text. `noteLinks` is not built (OD-09). |
| FM-13 | Hebrew-only paragraph | S\* | S | S | D | D | MD-13. Needs CG-03. Browser behavior of a single textarea is UNKNOWN until S-06. |
| FM-14 | Mixed Hebrew and English in one paragraph, numbers, URLs | S\* | S | S | D | D | MD-13, MD-14 |
| FM-15 | Mixed-direction paragraphs in one note (F-72) | P | S | S | D | D | A native textarea has one base direction per element. Per-paragraph behavior is browser dependent (UNKNOWN until S-06). Read gets it per paragraph. |
| FM-16 | Valid Tempo block (page-meta, task, template) | S | S | S | D | D | RT-03, RT-04, RT-11, RT-13. Raw shows a protected control, never JSON. |
| FM-17 | Broken Tempo block | S | S | S | D | D | RT-05, RT-10. Quiet card, bytes preserved. Recovery is OD-04. |
| FM-18 | Unclosed `json tempo` fence | P | P | P | D | D | RT-06. Everything from the opener to the end of the body is one protected broken segment, so later prose is preserved but not editable. FT-04. An opener typed before an existing block is refused by B-17 (BD-08 to BD-10, BD-12). |
| FM-19 | Look-alike fences | S | S | S | D | D | RT-07, RT-08, RT-09, RT-14 to RT-17, RT-21, RT-22. Ordinary text or code. |
| FM-20 | Line endings (LF, CRLF, CR) and final newline | S | S | S | D | D | RT-04, RT-02, BD-06. Rich Text risks normalization. |
| FM-21 | Unicode: emoji, joiners, combining marks (niqqud) | S | S | S | D | D | MD-12 |
| FM-22 | Body over 1,048,576 units | P | P | P | D | D | RT-12, RT-18. B-12: read-only safe state with a calm notice, no edit, no write, no in-page render of the body (it cannot be classified, K-03). Bytes are preserved. Access to the content is not claimed here: it is the owner-initiated download owned by S-08 and dependent on OD-06 (OWNER-DECISION). S-05 is held on it (B-12). |
| FM-23 | Undo and redo | S (within one segment) | n/a | S (within one segment) | D | D | Native per textarea. Cross-segment undo is U at Tier 0 (CG-05). |
| FM-24 | Spellcheck, autocorrect, IME, mobile keyboards, find in page | S | S | S | D | D | Native textarea. Contenteditable and canvas-like engines trade these off (EXTRAPOLATED). |
| FM-25 | Front matter, math, diagrams, footnotes, callouts | S (as text) | U | U | U | U | No source requires them. |

## 7. Round-trip specification and fixtures

### 7.1 Properties

| ID | Property |
|---|---|
| RTP-A | No-op: body, open in mode M, close with no edit: persisted body identical, zero write calls. |
| RTP-B | Local edit: edit inside one prose segment: the composed body differs from the original only inside that segment's span, plus at most one boundary-guard terminator (B-04). |
| RTP-C | Mode switch: body, edit in M1, switch to M2, switch back: draft identical, no write on a switch. |
| RTP-D | Reload: the saved body re-parses to the same segment kinds and spans. |
| RTP-E | Block operation: a typed block operation changes only that block's source. Every other byte is identical. |
| RTP-F | Protected-block preservation: for any edit, either every protected block of the base body is found in `parseTempoBlocks(candidate)` with the same kind, id and bytes, or the write is refused (B-17). |

### 7.2 Synthetic constants

`TASK_A`, `TASK_B`, `META` are fences (opener line, one JSON line, closer line, each ended by LF unless a fixture says CRLF). `TASK_DUP` reuses `TASK_A`'s id.

~~~~markdown
```json tempo
{"type":"task","id":"blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6","v":1,"data":{"title":"Email supervisor","status":"now","order":1,"inelastic":false}}
```
~~~~

- `TASK_A`: id `blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6`, title `Email supervisor`, status `now`, order 1.
- `TASK_B`: id `blk_01K5F3Z8Q4E1N3P5R7T9V1X3Z5`, title `Second`, status `later`, order 2.
- `META`: id `blk_01K5F3Z8Q0A7M2N4P6R8T0V2X4`, type `page-meta`, data `{"pageType":"daily","date":"2026-10-11","tags":["uni"]}`.
- `TASK_DUP`: id of `TASK_A`, title `Copy`, order 3.
- `BROKEN`: a Tempo fence whose body line is `{ nope }`.
- "Opener": the line of three backticks followed by `json tempo`. "Closer": the line of three backticks.

### 7.3 Codec fixtures and observed segmentation

Observed on 2026-10-11 (Bun 1.3.9, `zod` 4.3.6). RT-01 to RT-20 were first run on a scratch copy of the codec at PR head `1af128b` (byte-identical to the file merged at `5fc1e67`). In fix round 2 they were re-run with a scratch script directly against the relocated `packages/utils/src/blocks.ts` at the baseline, and every segment sequence below came out unchanged. RT-21 to RT-23 are new in fix round 2 and cover the raw HTML rule (K-06). This is not a repo test; the repo's own codec tests are `convex/lib/blocks.test.ts` and `packages/utils/src/blocks.test.ts`. In every case `serializeTempoBlocks(parseTempoBlocks(body)) === body` held. `\n` and `\r\n` are literal escapes.

| ID | Body | Segments observed |
|---|---|---|
| RT-01 | empty string | markdown |
| RT-02 | `"Hello\nSecond line\n"` | markdown |
| RT-03 | `"# Thursday\n\n"` + `META` + `"\nSlept badly. See [[Thesis outline]].\n\n"` + `TASK_A` | markdown, valid page-meta, markdown, valid task |
| RT-04 | `"Intro\r\n\r\n"` + `TASK_A` with CRLF + `"Outro\r\n"` | markdown, valid task, markdown |
| RT-05 | `TASK_A` + `"\n"` + `BROKEN` + `"\n"` + `TASK_B` | valid task, markdown, broken malformed_json, markdown, valid task |
| RT-06 | `"Before\n\n"` + opener + `"{\"type\":\"task\"\n\nAfter text the user typed\n- a list\n"` (no closer) | markdown, broken unclosed_fence (the typed text after the opener is inside the broken segment) |
| RT-07 | an ordinary `json` fence containing `{"a":1}` | markdown |
| RT-08 | a four-backtick `markdown` fence wrapping `TASK_A` | markdown |
| RT-09 | a tilde fence `~~~json tempo` wrapping the task JSON | markdown |
| RT-10 | `TASK_A` + `TASK_DUP` | valid task, broken duplicate_id |
| RT-11 | `TASK_A` + `TASK_B` with no blank line | valid task, valid task |
| RT-12 | `"x"` repeated 1,048,577 times | broken body_too_large (one segment, whole body) |
| RT-13 | `"שלום world\n\n"` + `TASK_A` + `"\nעברית and English\n"` | markdown, valid task, markdown |
| RT-14 | opener preceded by one space | markdown |
| RT-15 | opener `JSON TEMPO` in capitals | markdown |
| RT-16 | opener, JSON line and closer each prefixed `> ` | markdown |
| RT-17 | the three fence lines indented four spaces under a list item | markdown |
| RT-18 | `"y"` repeated exactly 1,048,576 times | markdown |
| RT-19 | `<div onclick="x()">hi</div>` and `<script>alert(1)</script>` | markdown |
| RT-20 | opener `json tempo` followed by two spaces | valid task |
| RT-21 | `<!--` on its own line, then `TASK_A`, then `-->` | markdown (the fence is inside an HTML comment, so it is prose) |
| RT-22 | `<pre>` on its own line, then `TASK_A`, then `</pre>` | markdown |
| RT-23 | `<!-- note -->` on one line, then `TASK_A` | markdown, valid task (a closed comment does not hide the next fence) |

### 7.4 Boundary-hazard fixtures

BD-01 to BD-07 were observed as in section 7.3 and re-run in fix round 2. BD-08 to BD-12 were observed in fix round 2 with a scratch script directly against the relocated `packages/utils/src/blocks.ts` (Bun 1.3.9, `zod` 4.3.6; not a repo test). `serializeTempoBlocks(parseTempoBlocks(body)) === body` was true in every case. "Naive compose" means replacing a segment's text and concatenating, with no guard.

| ID | Edit | Naive compose result | Required result (B-04) |
|---|---|---|---|
| BD-01 | Body `"Intro\n"` + `TASK_A`. Prose edited to `"Intro"` (line break deleted). | markdown only. The block is gone as a block and its JSON is now visible prose. | Guard appends `"\n"`. Segments markdown, valid task. |
| BD-02 | Body is a fence whose closer is the last line with no final newline. User appends `"tail"` directly. | broken unclosed_fence. | Guard inserts a terminator first. valid task, markdown. |
| BD-03 | `TASK_A` + `TASK_B` adjacent. User inserts `"note"` between them without a terminator. | valid task, markdown. The second block is lost. | Guard appends `"\n"` to the inserted prose. valid task, markdown, valid task. Needs an insertion point between adjacent blocks (CG-07). |
| BD-04 | Body `"Top\n"` + `TASK_A` + `"Bottom\n"`. Clear the first prose, then separately the last. | valid task, markdown. markdown, valid task. | Same. Both prose areas stay editable when empty. |
| BD-05 | Clear all prose in BD-04's body. | valid task. | Same. Block survives (B-10). |
| BD-06 | CRLF document. User types `"Hi\n"` in the prose before a block. | markdown, valid task. Mixed line endings result. | Guard uses the document's own terminator. No mixed endings introduced. |
| BD-07 | User types or pastes a complete fence into prose. User types only an opener at the end of the body, with no later closer. | markdown, valid task. markdown, broken unclosed_fence (the text after the opener is swallowed, nothing before it). | Classified at the next commit only (B-09), and only if B-17 passes. Nothing is silently dropped. The opener with nothing after it is BD-11 and FT-04. An opener before an existing block is BD-08. |
| BD-08 | Body `"Intro\n"` + `TASK_A` + `"Outro\n"`. The user types only an opener line at the end of the Intro prose, with no closer. | markdown, broken malformed_json (no `blockId`), markdown. The typed opener pairs with `TASK_A`'s closer, so `TASK_A` is no longer a valid block and its id is in no segment. Same result with CRLF line endings. The round trip still holds, so the codec reports nothing. | B-17 refuses the save and the commit. The editor model stays markdown, valid task, markdown. The draft is kept and a calm message shows. |
| BD-09 | As BD-08, with `TASK_A` + `TASK_B` adjacent after the Intro. | markdown, broken malformed_json, valid task (`TASK_B`), markdown. Only the first block is swallowed, so a check that some block still exists is not enough. | B-17 refuses. Every base block is checked by id and bytes. |
| BD-10 | Body `"Intro\n"` + `TASK_A`. The user types or pastes a complete fence with `TASK_A`'s id and a different title in front of `TASK_A`. | markdown, valid task (the new fence), broken duplicate_id (the original `TASK_A`, same id). The original is reclassified as broken. | B-17 refuses, because the original is no longer the same block. A copy placed after the original passes: the copy becomes the broken duplicate (FT-05). |
| BD-11 | Body `"Intro\n"` + `TASK_A` + `"Outro\n"`. The user types only an opener after `"Outro\n"`, at the very end. | markdown, valid task, markdown, broken unclosed_fence. `TASK_A` is untouched. | B-17 passes: every base block is found unchanged. The new broken segment is the FT-04 case. |
| BD-12 | Body `"Intro\n"` + `TASK_A` + `"Outro\n"`. The user types only a raw HTML opener on its own line, `<!--` or `<pre>`, at the end of the Intro prose, with no end marker. | markdown only. The unclosed HTML block runs to the end of the body (K-06), so `TASK_A` and everything after it become one prose segment, and the JSON of `TASK_A` would show as ordinary prose in Read and Split. With `TASK_A` + `TASK_B` after `<pre>`, both are lost. A closed comment (`<!-- x -->`) on its own line changes nothing (RT-23). | B-17 refuses, because the base block is no longer a block. The draft is kept and the previews keep the last passing candidate. |

### 7.5 Markdown rendering fixtures

Observed by rendering with react-markdown 10.1.0 on React 19.2.3 (server render), with and without remark-gfm 4.0.1, on 2026-10-11. Scratch run, not a repo test.

| ID | Input | Without GFM plugin | With GFM plugin |
|---|---|---|---|
| MD-01 | emphasis with `*` and `_`, strong with `**` and `__`, `~~strike~~`, and inline code | em, em, strong, strong, the text `~~e~~`, code | `~~e~~` becomes `<del>` |
| MD-03 | `- [ ] open`, `- [x] done`, `- plain` | list items with literal `[ ]` and `[x]` | disabled checkboxes |
| MD-04 | GFM table with alignment row and a Hebrew cell | one paragraph containing the pipe text | a real table with alignment styles |
| MD-05 | setext headings | h1 and h2 | same |
| MD-06 | two-space and backslash hard breaks | `<br/>` | same |
| MD-08 | `<https://example.com>` and a bare URL | the angle-bracket form links, the bare URL does not | both link |
| MD-10 | ordinary `json` fence | `<pre><code class="language-json">` | same |
| MD-11 | raw `<div onclick>` and `<script>` | escaped as literal text | same |
| MD-15a | `[[Thesis outline]]` | literal text | same |
| MD-15b | `![alt text](https://example.com/x.png)` | `<img src="https://example.com/x.png">` and a preload link | same |
| LNK-1 | `[click](javascript:alert(1))` | `href=""` | same |
| LNK-2 | `[click](data:text/html;base64,...)` | `href=""` | same |
| LNK-3 | `mailto:` and `tel:` links | `mailto:` kept, `tel:` becomes `href=""` | same |
| RTL-1 | Hebrew paragraph, English paragraph, Hebrew with a date and URL | three `<p>` elements, no `dir` attribute | same |
| RT-FENCE | a `json tempo` fence passed whole to the renderer | `<pre><code class="language-json">` showing the payload | same |

Fixtures with no observed column yet (to be written with the tests): MD-02 mixed list markers, ordered list starting at 3, two nesting depths; MD-07 reference-style links; MD-09 nested blockquote and thematic-break variants; MD-12 a Hebrew word with niqqud marks, a joiner emoji sequence (U+1F469 U+200D U+1F4BB) and `e` followed by U+0301; MD-13 Hebrew paragraph, English paragraph, then a Hebrew paragraph with a number and URL; MD-14 the same text with and without a final newline.

## 8. Split View by composition of #790 and #791

### 8.1 What the two tickets give (ticket prose only, EXTRAPOLATED until merged)

- #790 PageView: renders prose and catalog blocks in source order, accepts a canonical body or validated segments, uses `dir=auto` on paragraphs, disables raw HTML and unsafe URL schemes, renders broken blocks as safe cards, does not mutate the body.
- #791 PageEditor: editable Markdown prose segments around rendered block controls, `+ Task` through the canonical codec, a save of the complete canonical body with revision and request id, draft kept on error, a stale revision surfaced without overwriting, no raw fenced-body editor.

### 8.2 Composition

Split = PageEditor (Raw presentation) next to PageView fed the editor's current draft.

| ID | Tag | Rule |
|---|---|---|
| SP-01 | AE | The editor owns the draft. PageView receives segments parsed by the shared codec from that draft. There is exactly one codec. No second parser. |
| SP-02 | AE | In Split, the preview pane is display-only for blocks. Block controls (tick, `+ Task`) live in the editor pane and in Read mode. This keeps one writer. |
| SP-03 | AE | Writes are serialized per page: a draft save and a block patch go through one in-order queue, each carrying the revision returned by the previous one. A failed write stops the queue and keeps the draft. This relies on the proposed #787 revision contract (EXTRAPOLATED). |
| SP-04 | AE | Switching among Raw, Read and Split never loses an unsaved draft and never triggers a save. |
| SP-05 | AE, EXTRAPOLATED | The preview update is deferred and low priority so typing is never blocked. No debounce value or size budget is adopted. It must be measured on a body near the 1,048,576 limit. UNKNOWN until measured. |
| SP-06 | AE, EXTRAPOLATED | Below a width breakpoint Split collapses to one pane with a Raw and Read switch. No scroll synchronization in the first slice. |
| SP-07 | AE | The mode preference is a per-device convenience stored in `localStorage` inside `try/catch`, never in Convex, never in the body. |

### 8.3 Verdict

Feasible at Tier 0, with no new editor framework, once #790 and #791 merge and the page folder is free. It needs a new split ticket for the composition (S-04) and for the gaps CG-01, CG-07 and CG-09. It is **not** live-rich editing. In Split the left pane is a source editor and the right pane is a read-only render. Calling it Live Preview or Rich Text would misstate it (AE-02).

## 9. Licensed candidates, exclusions and gaps

### 9.1 How candidates were screened

Registry metadata was read from `registry.npmjs.org` on 2026-10-11. Dependency trees were resolved with `npm install --package-lock-only --ignore-scripts` in scratch directories outside the repo (react-markdown and remark-gfm were also installed in a scratch directory for the section 7.5 render; nothing was installed in the repo) and each tree was screened for license fields and for the HARD_RULES section 2 forbidden names (`docs/HARD_RULES.md:19-36`). The repo's own `scan:forbidden-tech` checks workspace manifests and source imports only (`scripts/scan-forbidden-tech.ts`), so transitive names need this separate screen. License text and behavior claims were not legally or functionally reviewed. React peer ranges are metadata only; nothing was installed or run against Next.js 16 or React 19.2.3 except react-markdown (section 7.5).

### 9.2 Candidates

| Candidate (latest on 2026-10-11) | Class | License (registry) | React peer | Resolved tree | Fits | Main risk |
|---|---|---|---|---|---|---|
| `react-markdown` 10.1.0 | Renderer | MIT | `>=18` | 104 packages: MIT 103, ISC 1. No forbidden names. | Read, Split (Tier 0). Named in #801. | Does not add `dir`, loads remote images, drops `tel:` (section 7.5). |
| `remark-gfm` 4.0.1 | Renderer plugin | MIT | none | included above | Tables, task lists, strikethrough, bare-URL autolinks (observed, section 7.5) | Not in #801's scope. Needs its own preflight (S-03). |
| CodeMirror 6: `@codemirror/view` 6.43.14, `state` 6.7.6, `lang-markdown` 6.5.2, `commands` 6.11.1 (optional React wrapper `@uiw/react-codemirror` 4.25.12) | Source-as-document editor | MIT | none (wrapper `>=17`) | 22 packages, all MIT. No forbidden names. | Raw (replacing the textarea), Live Preview | Live Preview behavior and protected ranges must be built. Bidi and IME quality UNKNOWN until a spike. |
| Tiptap 3: `@tiptap/react`, `@tiptap/markdown`, `@tiptap/starter-kit` 3.31.4 | ProseMirror document model | MIT | `^17 \|\| ^18 \|\| ^19` | 59 packages, all MIT. Includes `prosemirror-model` 1.25.12 and `marked` 17.0.6. | Rich Text | Serializer normalization (section 9.4). Markdown extension coverage not verified. |
| Lexical: `lexical`, `@lexical/react`, `@lexical/markdown` 0.52.0 | Document model | MIT | `>=18.x` | 38 packages, all MIT. | Rich Text | Pre-1.0 version number; API stability is an inference. Serializer normalization. |
| Milkdown: `@milkdown/kit`, `@milkdown/react` 7.22.3 | ProseMirror plus remark pipeline | MIT | `*` | 215 packages: MIT 211, one `(MPL-2.0 OR Apache-2.0)`, BSD-2 1, BSD-3 1, ISC 1. Includes `prosemirror-model` and `remark-parse`. | Rich Text | Large tree. Theme CSS against Tailwind v4 and the design lock. The one `(MPL-2.0 OR Apache-2.0)` package goes through the same section 3 check (AE-11). |
| MDXEditor: `@mdxeditor/editor` 4.3.2 | Packaged editor | MIT | `>= 18 \|\| >= 19` | 249 packages. Includes `lexical` 0.48.0 and `codemirror` 6.0.2. **One transitive package, `format` 0.2.2 (via `fault`), declares no license: UNKNOWN.** | Rich Text, source view | The unlicensed transitive package blocks it until resolved. MDX orientation is an assumption. |
| `@blocknote/core`, `@blocknote/react` 0.55.0 | Block-tree document model | MPL-2.0 (registry). Needs the HARD_RULES section 3 license-boundary check (AE-11) before admission: not done, UNKNOWN | Not recorded | Not screened: UNKNOWN | Rich Text | Its in-memory block tree is permitted (B-01). Its Markdown import and export fidelity (section 9.4) and its transitive screen (AE-11) are UNKNOWN. It is ruled out only for an implementation that persists the tree or its JSON (OD-02). |
| `@uiw/react-md-editor` 4.1.2 | Packaged textarea plus preview | MIT | `>=16.8.0` | 149 packages: MIT 143, ISC 4, BSD-2 2. Includes `react-markdown` 10.1.0 and `rehype-raw` 7.0.0. | Split-like | Ships its own renderer, including raw-HTML support. Competes with #790 and #791, which #264's 9 October amendment forbids. Not recommended. |
| `vditor` 4.0.0 | Packaged editor | MIT | n/a | 2 packages: MIT 1, Apache-2.0 1 (`diff-match-patch`). | Possibly several modes (project documentation, unverified here) | Runtime asset loading, React fit and Tailwind fit are UNKNOWN. Not recommended without a spike. |

License note. The candidates' own packages are MIT, except `@blocknote/core` and `@blocknote/react`, which are MPL-2.0. HARD_RULES section 3 allows MPL (`docs/HARD_RULES.md:41`), but MPL-2.0 is file-level copyleft, so any MPL-2.0 package, direct or transitive, needs the section 3 license-boundary check before admission (AE-11). Transitive licenses are in the "Resolved tree" column. License text was not legally reviewed (section 9.1).

### 9.3 Excluded by default, and why

| Item | License or fact | Reason |
|---|---|---|
| `platejs` 53.3.15 and `@platejs/markdown` | MIT (129 packages, 128 MIT and 1 Apache-2.0) | The resolved tree requires four packages, two families, that HARD_RULES section 2 lists as forbidden client-state libraries, reached through `@platejs/core`. The names are in `docs/HARD_RULES.md:28` and are deliberately not repeated here (`docs/HARD_RULES.md:19`; `docs/PRD.md:249`). Overriding is OD-07. |
| `@blocknote/xl-*` (for example `xl-multi-column` 0.55.0) | `GPL-3.0 OR PROPRIETARY` | HARD_RULES section 3 (`docs/HARD_RULES.md:40-41`). |
| Blinko editor code | `LICENSE` at the repository root is GNU GPL version 3 (header read 2026-10-11) | #840 DO NOT, HARD_RULES section 3, and BSL 1.1 conversion. Blinko stays a product comparator. Only the LICENSE header and the root `package.json` were read. No source code was read or reused. Clean-room behavior only. |
| Code from Memos or Joplin | Forbidden | `docs/TRD.md:228`; `docs/PRD.md:249` |
| 21st.dev components | License UNKNOWN (owner doc pack, Part A) | Not usable until the license is known. |
| FlyonUI | Conflicts with the design lock (Part A; `docs/TRD.md:226`) | |

### 9.3.1 Component gaps

| ID | Gap | Tier 0 handling |
|---|---|---|
| CG-01 | No segmented control or tabs primitive (C-12). `@radix-ui/react-tabs` is not a web dependency. | Build the mode switch from the existing `Button` with `aria-pressed` or radio semantics. A new Radix package needs a notices preflight. |
| CG-02 | No shared Markdown renderer. Two private subsets exist (C-08). | #790 replaces both. Do not extend them. |
| CG-03 | No `dir="auto"` on any note surface (C-11), and react-markdown emits none (section 7.5). | `components` overrides for paragraph, list item, headings, blockquote and table cells (B-15). |
| CG-04 | No toolbar, list continuation or Tab indent in a native textarea. | Ship without. Any later toolbar inserts text through the span-edit path only (B-02). |
| CG-05 | No cross-segment selection or undo. | Per-textarea native undo. Cross-segment undo is U. |
| CG-06 | Keyboard traversal between prose segments and block controls is unspecified. | Needs a rule in S-04. |
| CG-07 | No insertion point between adjacent blocks or at the ends (BD-03, BD-04). | An always-present, possibly empty prose segment at each boundary. |
| CG-08 | Block removal and reorder are unspecified (B-10). | None at Tier 0. UNKNOWN who owns it. |
| CG-09 | No scroll sync and no responsive collapse for Split. | SP-06. |
| CG-10 | No DOM library (C-13). Bidi, IME, selection and clipboard cannot be proven. | Real-browser Playwright (S-06). |
| CG-11 | No syntax highlighting for code. | Not required (U). |
| CG-12 | `remark-gfm` is not in #801's scope. | S-03. Until then FM-06 and FM-07 are P. |
| CG-13 | The default renderer emits `<img src>`, which makes a remote request. | Override `img`, or transform the URL. OD-05. |
| CG-14 | #790 says "unsafe URL schemes" without a list. The library default keeps `http`, `https`, `mailto` and blanks `javascript:`, `data:` and `tel:` (observed). | Accept the library default for the first slice (EXTRAPOLATED). |

### 9.4 Fidelity expectation by engine class (EXTRAPOLATED)

- **Source-as-document engine** (CodeMirror 6 class). The edited object is the text, so unedited regions cannot change. Lossless by construction. The open work is hiding syntax, atomic protected ranges, and per-line direction.
- **Document-model engine** (ProseMirror, Lexical, Slate classes). The Markdown comes from a serializer. AST serializers commonly normalize emphasis markers, bullet markers, ordered-list numbering, table padding and alignment, hard-break style, escapes, reference-style links, HTML blocks, setext versus ATX headings, code-fence marker, thematic-break character, link title quotes, autolink brackets, entities, line endings and the final newline. This is general behavior and is **not verified for any candidate here**. AE-03 requires span-level edits so untouched segments cannot be normalized. A candidate may normalize only inside a segment the user touched, and only with OD-03 approved.

### 9.5 What a spike must produce before any OD-01 answer

A spike is a separate, separately admitted ticket. It must output, per candidate: the section 7 fixtures run as a byte diff for RTP-A to RTP-E; Hebrew, English and mixed-direction behavior in Chromium, Firefox and WebKit; IME composition behavior; keyboard and screen-reader behavior against `docs/HARD_RULES.md:207-215`; selection, clipboard and paste behavior for protected ranges (BT-03); bundle size delta; Next.js 16 client-component and SSR behavior; the full notices text; the HARD_RULES section 3 license-boundary check for any MPL-2.0 package in the tree (AE-11); and confirmation that the engine's CSS does not introduce a second global utility stack (`docs/HARD_RULES.md:31`) or arbitrary hex values (`scripts/scan-design-tokens.ts`).

## 10. Decisions

### 10.1 ADOPTED-ENGINEERING

| ID | Decision | Basis |
|---|---|---|
| AE-01 | The Markdown string in `notes.body` is the only persisted representation. | B-01 |
| AE-02 | Ship Tier 0 modes (Raw, Read, Split) by composition before any engine decision. Tier 0 behavior is never labelled "Rich Text" or "Live Preview". Suggested labels: Raw, Read, Split. | #840 DO NOT (no relabeling of segmented editing) |
| AE-03 | Edits apply by span. Untouched segments, and every protected block, keep their bytes. | B-02 |
| AE-04 | The boundary guard (B-04) is part of every compose path. | BD-01 to BD-06 |
| AE-05 | Classification is by the shared codec only. No heuristics, no second parser. | B-05; #786 DO NOT |
| AE-06 | Re-segmentation at commit points only, never mid-composition. | B-09 |
| AE-07 | Split is display-only for blocks in the preview pane, with one serialized writer. | SP-02, SP-03 |
| AE-08 | The preview uses react-markdown as ticketed in #801, with raw HTML disabled and only prose segments passed in. `remark-gfm` 4.0.1 (MIT) is recommended through its own preflight. Until then tables, task lists and strikethrough render as source text (P). | #801; section 7.5 |
| AE-09 | Mode preference is per device, `localStorage` in `try/catch`, never in Convex or the body. | SP-07 |
| AE-10 | Bidi, IME, selection and clipboard claims require a real-browser test. A hand-rolled DOM test cannot support them. Skipped signed-in specs are not preview proof. | C-13, C-15 |
| AE-11 | Every engine candidate passes HARD_RULES section 3 (license) and a transitive HARD_RULES section 2 screen. GPL code is never copied. A candidate under MPL-2.0 (BlockNote core and react), or with an MPL-2.0 package in its tree (Milkdown's `(MPL-2.0 OR Apache-2.0)` one), also gets the section 3 license-boundary check, recorded in its spike output (section 9.5): no restriction on shipping under BSL 1.1 or converting to Apache 2.0, copyright headers and notices preserved, no MPL-covered file copied or modified. | `docs/HARD_RULES.md:19-43`, `:41-43` |
| AE-12 | An oversize body opens read-only with a notice, no edit and no write, and is not rendered in-page. It is never truncated or rewritten. The only access path is the explicit download owned by S-08 and conditional on OD-06; until OD-06 is answered no access path is claimed and S-05 is held. | B-12 |
| AE-13 | `dir="auto"` on prose textareas, rendered text blocks and the visible user-authored fields of block cards. Only code and technical strings are `ltr`. No block card forces `ltr`. | B-15 (EXTRAPOLATED) |
| AE-14 | The protected-block preservation guard (B-17) runs before every save and every re-segmentation commit. A failing guard refuses the write, keeps the draft, and never repairs or auto-closes a fence. | B-17; BD-08 to BD-12 |

### 10.2 OWNER-DECISION

| ID | Question | Recommended default | Holds |
|---|---|---|---|
| OD-01 | Adopt a new editor framework for Live Preview or Rich Text? | No, not in the next-week scope. Ship Raw, Read and Split. If Live Preview is wanted, authorize a time-boxed, separately admitted spike of CodeMirror 6 (section 9.5). Defer full Rich Text. | Any Live Preview or Rich Text ticket; S-07 |
| OD-02 | Allow any second persisted representation (document tree, CRDT, block store, HTML)? | No. Keep `notes.body` Markdown as the sole truth (AE-01). The rule is no second persisted representation. An in-memory editor tree that is serialized back to Markdown only is not one. | Any implementation that persists a tree or its JSON (an in-memory tree is allowed, B-01) |
| OD-03 | If a Rich Text mode ever ships: may it normalize Markdown inside a segment the user edited? | No. Byte-exact or do not ship. Never normalize untouched segments. | Rich Text |
| OD-04 | May a user ever see the source of a block, and how is a broken or unclosed block recovered? | No source view for valid blocks (PRD F-02). Broken blocks: a quiet card only in the first slice, with honest "no Undo" where no operation handle exists. Later, an explicit "show as plain text" action with confirmation and a 5 minute Undo through #787 and #828. | Any recovery ticket |
| OD-05 | May the preview load remote images or other remote media? | No. Alt text or a link only. Coordinate with #838 and #854. | Image rendering |
| OD-06 | What do search, list and MCP readers get for a structured body? | Search and list use the #803 safe projection. MCP gets the safe projection plus block ids and titles. Raw bytes only in an explicit owner-initiated export. That export is also the only way to reach an oversized body (B-12), owned by S-08; no in-page display of one. No existing ticket is known to own it: UNKNOWN. (EXTRAPOLATED) | S-08; S-05 for any note whose body may exceed the limit; a reader ticket not named in #803's scope |
| OD-07 | Admit each new dependency? | `remark-gfm` yes, through its own preflight. Any engine only after OD-01. Plate stays excluded unless Amit overrides the client-state rule in HARD_RULES section 2. | S-03 and S-07 |
| OD-08 | Is a Markdown `- [ ]` item a Tempo task? | No. It is prose with a read-only checkbox in Read. The task mapping is owned by #837 and #856. | TODO integration |
| OD-09 | How do `[[wiki links]]` render? | Literal text until `noteLinks` exists. | Link rendering |

## 11. Coverage the later tickets must include

Synthetic data only. No real notes, secrets or provider calls.

### 11.1 Boundary tests

| ID | Test |
|---|---|
| BT-01 | For every RT fixture: open in each mode, close with no edit. Persisted body identical, zero save calls (RTP-A). |
| BT-02 | Edit inside one prose segment of RT-03, RT-04, RT-11, RT-13. The diff against the original is confined to that segment plus at most one boundary-guard terminator (RTP-B). |
| BT-03 | For every fixture with a valid or broken block: the strings `{"type"`, `"v":1`, `json tempo` and `blk_` do not appear in container text, any `value`, any `title`, `aria-*` or `alt`, any error message, `document.title`, or the copy and cut clipboard payload. |
| BT-04 | BD-01 to BD-06: after compose and re-parse, the block set equals the set before the edit. |
| BT-05 | The editor's segmentation equals the shared codec's for every RT fixture. The test imports the codec and compares kinds and spans. |
| BT-06 | RT-07, RT-09, RT-14 to RT-17 appear in Raw exactly as typed and in Read as ordinary text or code. |
| BT-07 | MD-13, MD-14 and RTL-1: each rendered text block has `dir="auto"` and each prose textarea has `dir="auto"`. A block card with a Hebrew title has `dir="auto"` on the title field and no `dir="ltr"` on the card. Real-browser check of the visual base direction (S-06). |
| BT-08 | No re-segmentation and no save fires between `compositionstart` and `compositionend`. |
| BT-09 | The renderer is never called with a string that contains a Tempo fence (B-08). |
| BT-10 | Protected-block preservation (B-17). BD-08, BD-09, BD-10 and BD-12: the pure guard refuses with zero save calls, the draft is byte for byte as typed, the editor model still shows `TASK_A` as a card, no message contains body text, `{"type"`, `"v":1`, `json tempo` or `blk_`, and the Read and Split previews still show the block. After the typed opener is removed, the same draft saves and every base block's bytes are identical. BD-11 passes the guard, saves and leaves `TASK_A` unchanged. A CRLF variant of BD-08 and the `<pre>` variant of BD-12 are included. The pure guard is tested on candidate bodies (S-02); typing, paste, undo and IME entry of the opener are checked in a real browser (S-06). |

### 11.2 Failure tests

| ID | Test |
|---|---|
| FT-01 | A rejected save keeps the draft, shows a calm error without body text, and a retry works. No duplicate writes. |
| FT-02 | A stale revision surfaces a conflict and never overwrites the newer server body or discards the local draft. |
| FT-03 | RT-12 and RT-18: over the limit opens read-only with a notice, no editable control, no in-page render of the body and no write. At the limit behaves normally. This test is required of every mode and does not depend on OD-06. S-08's own test, which exists only if OD-06 admits the download, asserts that the download returns the exact bytes with no transformation and logs no body text. |
| FT-04 | RT-06: the broken card shows, the text after the opener is preserved, and no fabricated Undo appears. |
| FT-05 | RT-10 and pasting a copied block: the second block is a broken card. Both are preserved. |
| FT-06 | Mode switch with a dirty draft and an in-flight save: nothing lost, one save. |
| FT-07 | A reactive re-render never resets an unsaved edit in any mode. |
| FT-08 | Select-all then delete in a prose segment leaves every block (BD-05). |
| FT-09 | A malformed, foreign or deleted note id shows the calm not-found state (C-17). |
| FT-10 | A navigation with a pending debounce flushes exactly one write, for a draft that passes B-17. A draft that fails it is FT-11. |
| FT-11 | A guard refusal (BD-08): a retry without a changed draft is refused again with zero writes, no loop and no duplicate message. A mode switch keeps the refused draft and its flag (SP-04). A stale revision or a failed write never clears the refusal. A navigation with a refused draft flushes zero writes. Whether the page warns before leaving is UNKNOWN (UI brief). No local copy of the draft is kept in browser storage (OT-03). |

### 11.3 Ownership tests

| ID | Test |
|---|---|
| OT-01 | Mode and engine components import nothing from `@/convex/_generated/api`. They take props and emit typed callbacks. A static import-graph test enforces this. |
| OT-02 | Only the host component calls save or patch APIs. A test counts calls. |
| OT-03 | The editor's own browser storage is only the documented mode-preference key (SP-07; the name is set in S-01). A test snapshots `localStorage` before mounting, uses the editor in every mode, and expects the only added or changed entry to be that key. It never asserts a total key count, because other features legitimately own other keys (theme and dyslexia preferences, task views, calendar events, tracking migration state). It also expects no new `sessionStorage` entry and no new IndexedDB database. |
| OT-04 | Each split PR touches only its SCOPE. The existing `scope-guard` check enforces this. |
| OT-05 | A soft-deleted or foreign note never reaches an editor component (C-17). |

## 12. Later splits

Each split is at most 3 source or document files plus 1 test. All paths are EXTRAPOLATED, none is admitted, and each needs its own admission: pin the final merged heads of the prerequisites it touches (#786, #801, #802, #790, #791, #795 as applicable), re-run the code map, and prove exclusive path ownership. The root `bun run test` does not discover `apps/web/components/**` (C-14), so each split names its own command. Modules placed in `apps/web/lib/` and tests placed in `tests/unit/` are discovered by the root command.

| ID | Scope | Focused command | Serial after | Notes |
|---|---|---|---|---|
| S-01 | `apps/web/lib/page-modes.ts`; test `apps/web/lib/page-modes.test.ts` | `bun test apps/web/lib/page-modes.test.ts` | none (pure data) | Mode names, the section 6 matrix as typed data, the preference key. Discovered by `bun run test`. |
| S-02 | Boundary-guard and protected-block-guard compose helper (B-04 and B-17): inside #791's `page-edit-state.ts` if it can satisfy BT-02, BT-04 and BT-10, otherwise `apps/web/lib/page-compose.ts` plus test | `bun test apps/web/lib/page-compose.test.ts` | none for the codec (#802 merged as #879; import from `@tempo/utils`) | Overlap risk with #791. Reconcile before admission. |
| S-03 | `apps/web/package.json`, `bun.lock`, `THIRD-PARTY-NOTICES.md` (remark-gfm 4.0.1) | frozen install, `bun run check:notices`, `bun run scan:forbidden-tech` | #801 (the #814 and #800 lock edits have merged, #827 and #875) | Preflight only. Same-PR notices. |
| S-04 | `apps/web/components/page/PageSplit.tsx`, `apps/web/components/page/page-split-state.ts`; test `apps/web/components/page/PageSplit.test.tsx` | `bun test apps/web/components/page/PageSplit.test.tsx` | #790, #791 merged and the page folder released; S-01 | Addresses CG-01, CG-06, CG-07, CG-09 and implements SP-01 to SP-07. |
| S-05 | `apps/web/components/page/NotePageCore.tsx` (a #795 file); test `tests/e2e/screens/page-core-modes.spec.ts` | `bunx playwright test tests/e2e/screens/page-core-modes.spec.ts` | #795 merged, S-04, and S-08 or an OD-06 answer that accepts a notice-only state for oversized notes (B-12) | Mount only. Skips without storage state. |
| S-06 | Test only: `tests/e2e/screens/page-editor-bidi.spec.ts` | `bunx playwright test tests/e2e/screens/page-editor-bidi.spec.ts` | S-05 | Real-browser bidi, IME, selection, clipboard (BT-03, BT-07). Preview proof is a separate gate. |
| S-07 | Not scoped | not applicable | OD-01 and OD-07 answered | Engine spike or dependency preflight. Held. |
| S-08 | Oversized-body owner download: `apps/web/lib/page-body-download.ts` (pure: a Blob of the exact bytes and a safe file name), `apps/web/components/page/PageOversizeDownload.tsx`; test `apps/web/components/page/PageOversizeDownload.test.tsx` | `bun test apps/web/components/page/PageOversizeDownload.test.tsx` | OD-06 answered; S-01; #790 and #791 merged and the page folder released | OWNER-DECISION-dependent, held. Owns B-12's only access path. S-04 renders the read-only state with its calm notice (FT-03); S-08 adds the explicit, owner-initiated download control and the exact-bytes helper. It never renders or logs the body. Mounting is S-05. No existing ticket is known to own this: UNKNOWN. |

Path ownership notes. `apps/web/components/page/` is shared serially by #790 and #791. `NotesScreen.tsx` is owned in order by #805, then #795, then #843 to #845. `convex/notes.ts` is owned by #787. `convex/schema.ts` is in the single schema lane. Manifests, `bun.lock` and notices are in the serial deps lane. None of these may be touched by a split out of turn.

## 13. Verification record for this document

State of the work: **coded**: nothing (document only). **Locally tested**: the scratch probes in sections 7.3 to 7.5 (RT-21 to RT-23 and BD-08 to BD-12 added in fix round 2, with every RT and BD fixture re-run on the relocated codec) and the repository checks below. **Preview-proven**: nothing.

| Check | Result on 2026-10-11 |
|---|---|
| Bun | 1.3.9 |
| `bun install --frozen-lockfile` | PASS (1742 packages) |
| `bun run lint` | PASS. 5 of 5 tasks, forced uncached run (`--force`), repeated with this file present. 1 existing warning in `@tempo/ui`. |
| `bun run typecheck` | PASS. 5 of 5 tasks, forced uncached run (`--force`), repeated with this file present. |
| `bun run test` | PASS, 544 pass, 0 fail, 63 files, both runs |
| `scan:forbidden-tech`, `scan:ram-only-audit`, `scan:design-tokens`, `check:notices` | PASS, PASS, PASS, PASS, both runs |
| `CI=1 bunx playwright test --reporter=line` | First run (file absent): UNKNOWN, 1 passed, 83 skipped, 28 failed, all 28 with `browserType.launch: Executable doesn't exist` for `chromium_headless_shell-1234`, which was not installed yet. Later run with this file present: 28 passed, 84 skipped, 0 failed. The skips are the specs that need `TEMPO_E2E_STORAGE_STATE` or a preview URL, which AGENTS.md expects. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, uncached (`--force`, 36 s) |
| Fix round 2: after merging `origin/integration` at `9cf7985` (docs only) | Bun 1.3.9. `bun install --frozen-lockfile`: PASS. `bun run scan:forbidden-tech`: PASS. The other checks in this table were run on the earlier head and were not re-run in this round: UNKNOWN on the merged head, although only this Markdown file changed. |

A Markdown file under `docs/` does not feed any of these checks. The exact final head and its own run are recorded in the PR body under "Test results (cloud agent sandbox)". Section-by-section review: each section was read against its cited lines, and a script checked that every `path:line` citation points at an existing line (66 citations in the first draft; 84 in fix round 2, counting continuation ranges such as `:122-123`). The script checks that the line exists, not that its content still matches. For the files that changed between the two heads the content was re-read by hand (C-10, C-14, C-16, K-01 to K-06).

## 14. Notes for ticket sync

Build tickets do not edit tickets or docs. These are observations for the spec line.

1. #805 and #795: the local `NotesList` snippet in `NotesScreen.tsx` still renders raw body characters (C-06). Both own that file.
2. #803: MCP `noteView` and `notes.list` search still return raw bodies (C-07). The ticket text names NotesScreen and `convex/search.ts` only. UNKNOWN whether another ticket covers the MCP reader.
3. #801: names react-markdown only. Tables, task lists, strikethrough and bare-URL autolinks need `remark-gfm` (observed). Add S-03 or accept P cells.
4. #791: specify the boundary guard (B-04), the protected-block preservation guard (B-17: an unclosed opener typed before a block must refuse the save, not swallow the block) and an always-present boundary insertion point (CG-07). Its text says only that hidden spans are preserved exactly. #787 could re-run the same B-17 check against the stored previous body so a client bug cannot swallow a block (EXTRAPOLATED; UNKNOWN whether that is in its scope). No ticket owns block removal or reorder (CG-08).
5. #790: list the allowed URL schemes (CG-14), add `dir="auto"` through `components` (CG-03), and never pass the whole body to the renderer (B-08).
6. #802: merged as #879 (`9cf7985`), so its text "the actual merged codec" is now true. #879 is not a pure move: fence-looking lines inside raw HTML blocks are now prose (K-06), so a user typing `<!--` before a block can turn the block into prose (BD-12), which B-17 guards. The codec does not model CommonMark HTML block conditions 6 and 7 (block-level tags such as `<div>`), per #879's description (not probed here); a CommonMark renderer given the whole body could therefore disagree with the codec, which is one more reason B-08 passes prose segments only.
7. #787: `notes.update` has no body length bound (C-03). The codec limit is 1,048,576 UTF-16 units (K-01). Whether Convex's own document limit is lower: UNKNOWN, not verified here.
8. Docs: no canonical doc defines Raw, Split, Live Preview or Rich Text. PRD F-03 says "write markdown; blocks draw as their own elements" (`docs/PRD.md:92`). If OD-01 is answered, the spec line may want a mode definition.
9. `apps/web/components/notes/NotesScreen.tsx:260-264`: a rejected save is unhandled and the unmount flush ignores errors (C-02). Not in this ticket's scope.
10. The root element is hard-coded `dir="ltr"` (C-11). PRD F-71 is not met at the shell level either.
11. No known ticket owns the oversized-body owner download (B-12, S-08). It depends on OD-06, and the mount split S-05 is held on it so that an oversized note, which the plain textarea shows today, does not become unreachable.
12. HARD_RULES section 3 lists MPL as acceptable, while an MPL-2.0 editor dependency (BlockNote core and react) still needs the license-boundary check (AE-11). The spec line may want to state where that check is recorded.
