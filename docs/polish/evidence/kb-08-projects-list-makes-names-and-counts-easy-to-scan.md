# KB-08 projects list evidence

The existing `/projects` screen groups tasks by `projectId`. This change leaves its query, filter, creation callback, and route destinations intact. Each project now mounts a `ProjectSummaryRow` with a wrapping name, a readable completion count, and separate labelled project and board links. `ProjectListState` supplies the mounted loading, empty, filtered, offline, and error views. A standalone `Kb08Gallery` renders the same exports with fictional Maya, Dana, and Yoni data.

The [contact sheet](./kb-08-projects-list-makes-names-and-counts-easy-to-scan.jpg) pairs source-derived before views with hydrated after views at 390 and 1280 px in English and Hebrew, light and dark. The before browser fixture uses the original checked-in `ProjectCard` source saved before editing, with only an enclosing gallery, locale provider, icon sprite, and fictional data. It is a controlled component comparison, not a claim that a signed-in production route was exercised. After views use the actual exported `Kb08Gallery` from source commit `1c0507c`, its real icon sprite, and the ticket CSS with v3 tokens and styles. All eight after images were recaptured on 19 October after the sprite mount was added.

## Browser findings

- Hydrated gallery rendered one `h1` and one `main` at both widths.
- Project and board links are separate keyboard stops. Enter activates the project callback; clicking the board link activates the board callback. Focus remains visible, and Shift+Tab returns to the prior link.
- Empty, loading, error, disabled, overflow, and offline controls changed the mounted views. Disabled rows contain no navigable anchor.
- Hebrew sets `dir=rtl` on the gallery; project names retain `dir=auto`; numeric fragments use LTR isolates. The count sentence follows the selected language direction.
- At 390 px, controls and links were at least 44 px in both dimensions. The document did not scroll horizontally at 390 or 1280 px in either locale or theme. Reduced motion was enabled in the browser run.

## Verification

The complete command table and failure tails are in the draft PR body. The focused `tests/unit/kb-08.test.tsx` includes 13 tests: empty projects, one project, count labels including 0/1, long name, no nested controls, disabled navigation, Hebrew count, offline state, filtered state, error/loading state, gallery landmark/render, en/he key parity, and a hydrated browser test for keyboard and responsive behavior.

Device screen-reader results remain **UNKNOWN** until tested on a device. This sandbox fixture does not verify live account data or backend behavior.
