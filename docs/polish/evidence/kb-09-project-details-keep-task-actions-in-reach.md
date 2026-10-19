# KB-09 project detail evidence

The production `/projects/[id]` screen mounts `ProjectTaskActions` in each task row and `ProjectDetailNotice` beside the project name. The page keeps the existing Convex query and mutation calls and uses their original arguments. The gallery is a controlled fictional view; the browser fixture also mounts the actual screen with fictional query and mutation responses.

The [contact sheet](./kb-09-project-details-keep-task-actions-in-reach.jpg) compares the saved pre-edit source with the new mounted screen at 390 and 1280 px, in English and Hebrew, light and dark. Both browser bundles use the same fictional Maya and Dana task data and the v3 tokens. The contact sheet crops blank viewport space to keep the screen content legible; browser assertions used the full viewport. The before bundle is taken from commit `52bf2803e9105b25c2538aedd81a754a9fbfdedb`, copied before the first edit. The project detail's visible action label was not present before; its completion checkbox was present.

## Browser findings

- The mounted screen shows an inline pending notice on rename, then a saved or error notice tied to the name field. A rejected mutation leaves the typed name intact. A stale response does not mark a newer draft as saved.
- For a new project with no tasks, leaving the name opens the first-task form and focuses its field. Canceling creation returns focus to the Add control on the mounted screen and in the gallery.
- The task completion control is keyboard reachable, has a task-specific accessible name, updates its checked state, and measures at least 44 px in each axis at 390 px.
- The hydrated gallery exercises default, empty, loading, error, disabled, and long-title states. At 390 and 1280 px it renders one `main` and one `h1`, and the document does not scroll horizontally.
- Hebrew uses RTL direction and machine-drafted copy. User-written task text uses `dir=auto`. Reduced motion was enabled for the browser checks.

The full command table and failure tails are in draft PR #1150. The fixture uses fictional data; these checks do not claim a live signed-in route or real backend writes. Device screen-reader results remain **UNKNOWN** until tested on a device. Hebrew wording needs Amit's native read.
