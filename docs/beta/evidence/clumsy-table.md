# Clumsy-user pass: findings

> Screenshot paths below point to the conductor's scratch folder and were not committed. The worst ones are in `clumsy-worst.jpg` and `clumsy-hebrew-gaps.jpg` here. Each fix PR carries its own before/after sheet in `docs/polish/evidence/`.

Preview https://preview.tempoflow.dev, test account "Dana", 16 Oct 2026. Variants: 1280 light en (`1280-l-en`) and 390 dark he (`390-d-he`) unless noted.
Everything created is named `clumsy …`. Screenshot paths are relative to this folder.
Known tags: "fixed in #N (open)" = an open PR already covers it; "#964 (merged later)" = covered by #964.

| # | feature | clumsy action | variant | expected | happened | severity | known? | screenshot |
|---|---|---|---|---|---|---|---|---|
| 1 | /daily-note | open the route | all 8 | A daily note page | A developer scaffold. It shows "Reference: screens-1.jsx", "Primary action / Secondary action", "Billing UI is shown for hierarchy validation only". In Hebrew it is all English (124 words). | major | no | shots/matrix/daily-note--390-light-en.png |
| 2 | /ask-founder | open; click "Continue in beta" and "Review guidance" | all 8 | A way to send the founder a note | The same developer scaffold ("Reference: screens-6.jsx", "Route states"). Neither button does anything. There is no text box, form or email link. /billing and /settings/integrations both link here. It also has two `<main>` elements. | major | no | shots/G-ask-founder-1280-light-en.png |
| 3 | Today: day plan | type a 500-character intention (no spaces), press "This is my day" | all widths | Long text wraps | "Your day" shows it on one line. The page becomes 2509 to 3185 px wide in every variant. At 390 dark he the first screen is blank black. Fixed by shortening it with "Edit plan". | major | no (#967 is the greeting, not this) | shots/E-today-390-dark-he-yourday.png, shots/J-today-long-intention-390-dark-he.png |
| 4 | Today: brain-dump panel | open Today in dark mode | 1280 dark en, 390 dark he | Readable in dark | The panel's header and "Prioritized output" card are near-white cards with pale text. You cannot read the heading or the help text. | major | no (#1002 covers English and lanes, not contrast) | shots/F-today-bd-panel-1280-dark-en.png |
| 5 | /tasks | add a task without touching Project | 1280-l-en, 390-d-he | Task goes to Inbox / no project | Project is prefilled "Home reset". Every new task gets a "Home reset" chip. /projects then lists a "Home reset" project the user never made. | major | no | shots/A-tasks-he-390-dark-he.png |
| 6 | /tasks | double-click "Add task" | 1280-l-en | One task | Two identical tasks. | major | probably fixed in #965 (open), "double create guard" | — |
| 7 | /habits | double-click "Add habit" | 1280-l-en | One habit | Two identical habits. (Double Enter makes one.) | major | no (check whether #965 covers habits) | shots/C-habits-after-create-1280-light-en.png |
| 8 | /projects | "Start a first project", type a name, press Enter, then Back | 1280-l-en | Project saved with that name | The project and its name are gone. It is only saved once you add a task. Nothing warns you. | major | no | shots/D-projects-new-1280-light-en.png |
| 9 | /brain-dump | "Sort it" (AI), then browser Back, then Forward | 1280-l-en | Dump and plan still there | Both the sorted plan and the typed dump are gone. The model call is wasted and the text has to be typed again. | major | no | shots/E-brain-dump-sorted-1280-light-en.png |
| 10 | /tracking | log a block of 99999 minutes | 1280-l-en | "Up to 8 hours" hint | "That block did not save. Try once more." A retry can never work. Server error in the console. | major | fixed in #968 (open) | shots/C-tracking-after-1280-light-en.png |
| 11 | /calendar | open in Hebrew | all 4 he | Hebrew | The whole page is English: title, form labels, "Day events", "Due tasks", empty texts (41 words). | major | no | sheets/he-gaps-1280-dark-he.jpg |
| 12 | /history | open in Hebrew | all 4 he | Hebrew | The whole page is English: "Conversation history", "Pick up a conversation…", "Threads", "No messages…" (43 words). | major | no | sheets/he-gaps-1280-dark-he.jpg |
| 13 | Today | open in Hebrew | all 4 he | Hebrew | 169 English words: "Plan for today", "Set intention…", "Your day", "Up next", Low/Medium/High, "Habits today", the brain-dump panel, "Match your energy". | major | partly: greeting #964 (merged later), panel fixed in #1002 (open); day plan, Your day and energy cards not known | shots/matrix/today--1280-dark-he.png |
| 14 | /history | open | all 8 | Correct count | "1 saved threads". An empty "New Conversation" (0 messages) is listed as a saved thread. | minor | no | shots/matrix/history--390-light-en.png |
| 15 | /tracking | open with 0 habits | all 8 | Plain empty text | "Longest among 0 habits: 0." The page has two `<main>` elements. | minor | `<main>`: fixed in #981 (open); wording: no | shots/matrix/tracking--390-light-en.png |
| 16 | /plan, /templates/builder, /today | screen-reader structure | all 8 | One h1 | /plan and /templates/builder have no h1. /today has two. | minor | no | shots/matrix/plan--390-light-en.png |
| 17 | /tracking | 0 or −5 minutes, press "Log this block" | 1280-l-en | An in-app message | Nothing logs, and the app shows no message (only the browser's own field bubble). | minor | no | — |
| 18 | /tasks | delete a task (Delete, Confirm delete) | 1280-l-en | Undo, like notes, goals and coach | Gone at once, no Undo. | minor | no | shots/A-tasks-after-delete-1280-light-en.png |
| 19 | /tasks | Edit a task, press Enter; press Escape | 1280-l-en | Enter saves, Escape cancels | Enter does nothing (you must click "Save task"). Escape leaves the editor open. | minor | no | — |
| 20 | /tasks | type a title, go to Today, press Back | 1280-l-en | Draft kept | Draft gone. | minor | no | — |
| 21 | Notes page | type, then reload or Back within half a second | 1280-l-en | Text kept, or a "not saved yet" warning | The last words are lost. No beforeunload warning. (A 0.7 s pause is enough to save.) | minor | no | — |
| 22 | Notes page | open the ⋯ page menu, press Escape | 390-d-he | Menu closes | Menu stays open (4 items). | minor | no | shots/B-notes-menu-390-dark-he.png |
| 23 | /routines | "New routine", then Start without editing | 1280-l-en | A starter step or a clear "add steps" | The body is `#routine` and an empty "1.". Start opens a run with no step and no Done button. | minor | no | shots/C-routines-list-1280-light-en.png |
| 24 | Routine run | Skip a step, then reload | 1280-l-en | Resume at step 2 | Restarts at step 1. The skip is forgotten (tally says "Skipped: 0"). | minor | no | shots/D-routine-finish-1280-light-en.png |
| 25 | /templates | open in Hebrew | all 4 he | Hebrew | Built-in template names and outlines are English (Daily page, Weekly page, Meeting notes…; 74 words). | minor | no | sheets/he-gaps-1280-dark-he.jpg |
| 26 | /coach, /plan | open in Hebrew | all 4 he | Hebrew | /coach: "How the coach pushes", "Steady", "Panic", "Today's plan" (26 words). /plan: "Day timeline", "Nothing planned yet", "Click a time to add a block", "Now" (10 words). | minor | no | shots/matrix/coach--1280-dark-he.png |
| 27 | Sidebar / pages | Hebrew user opens the sidebar | 390-d-he | Hebrew page names | Auto-made pages are titled "Week 42" and "Friday, 16 October" in English. | minor | no | shots/K-sidebar-open-390-dark-he.png |
| 28 | Today | coach proposal cards in the Today chat | 390-d-he | No sideways scroll | The page is 15 px too wide and the top bar is clipped on the right. | minor | no | shots/K-today-390-dark-he.png |
| 29 | Ctrl+K | open, then Escape | 1280-l-en | Focus returns to where you were | Focus lands on `<body>`. | minor | no | shots/F-cmdk-1280-light-en.png |
| 30 | /goals | "Write a first goal" / "New goal" | 1280-l-en | Ask for a name | Makes a goal called "New goal" at once (Undo offered). It says "Showing 1 goals". | cosmetic | no | shots/D-goals-1280-light-en.png |
| 31 | /calendar | open | all 8 | A plain title | Title "One source for every calendar view" reads like spec text. | cosmetic | no | shots/matrix/calendar--390-light-en.png |
| 32 | Notes page | ⋯ menu, "Export .md" | 1280-l-en | File with the title and body | The body only (the title is just in the file name). An empty page gives a 0-byte file. | cosmetic | no | — |
| 33 | /modules, /notifications, /week | open in Hebrew | he | Hebrew | Headings "Modules" and "Notifications" in English. /week's loading text "Loading note." is English and has 2 `<main>`. | cosmetic | no | — |
| 34 | /tasks | press Enter in the title (single and double) | 1280-l-en | Adds one task | Adds nothing. (At 390 he, Enter or a click added one.) | major | fixed in #983 (open) | — |
| 35 | /tasks | submit an empty title | 1280-l-en | A hint | Add is disabled and there is no hint. | minor | fixed in #965 (open) | shots/A-tasks-empty-1280-light-en.png |
| 36 | /tasks | open in Hebrew | 390-d-he | Hebrew | Labels and chips ("medium priority", "medium energy", "Task title"…) are English (34 words). | minor | fixed in #983 (open) | shots/A-tasks-he-390-dark-he.png |
| 37 | Notes | rename a page in tab A, look at tab B | 1280-l-en | Tab B updates | Tab B keeps the old title. | major | fixed in #969 (open) | — |
| 38 | /tracking | open in Hebrew | he | Hebrew | English page (59 words). | minor | fixed in #981 (open) | — |
| 39 | Top bar | crumbs on /tasks, /goals, /projects | all | Right section name | "Pages › Tasks", "Pages › Goals", "Pages › Projects". | cosmetic | fixed in #992 (open) | shots/A-tasks-500-1280-light-en.png |
| 40 | /week | look for "This week at a glance" | 1280-l-en | The glance block | Not on the weekly page (Focus / Days / Carry forward only). | minor | #964 (merged later) | shots/D-week-1280-light-en.png |
| 41 | Today | greeting in Hebrew | he | Hebrew | "Hi, Dana" and "One calm screen to start from…" in English. | minor | #964 (merged later) | shots/K-today-390-dark-he.png |

## Counts
- All rows: 41. Blocker 0, major 15, minor 21, cosmetic 5.
- New, not covered by an open PR: 31 (rows 1–5, 7–9, 11–33). Major 11, minor 16, cosmetic 4. Rows 13 and 15 count here even though part of each is known.
- Already covered: 10 (rows 6, 10, 34–41). Open PRs #965, #968, #983, #969, #981, #992; #964 merged later.

## Fix map (16 Oct, end of wave 5)

The "Known" column above is what was known during the pass. This is where each row stands now. "#N" is an open draft PR that fixes it, with its own before/after proof.

| rows | fixed by |
|---|---|
| 1, 2 | #1023 (no scaffold pages) |
| 3 | #1022 |
| 4 | #1026 |
| 5 | #1020 |
| 6 | #965 |
| 7, 8 | #1025 |
| 9 | #1058 (the dump and the plan survive Back, Forward and a reload) |
| 10 | #968 |
| 11, 12, 14, 31 | #1024 |
| 13 | #964 (greeting), #1002 (panel), #1022 (day plan), #1021 (energy card), #1056 (habit strip) |
| 15 | #981 fixes the two `<main>`; the "0 habits" wording is still open |
| 16 | #1057 fixes /plan and /templates/builder; /today's two h1s are Amit's call |
| 18, 19 | #1039 |
| 22, 32 | #1050 |
| 26 | #1038, plus #1054 (/coach's "Today's plan" card) and #1055 (/plan's time-block dialog) |
| 28 | #1056. The real cause was a long habit name pushing "Check" off the screen, not the coach cards. |
| 29 | #1052 |
| 34–41 | as in the table |

**Still open:** rows 17, 20, 21, 23, 24, 25, 27, 30, 33, and the parts of 15 and 16 noted above. All are minor or cosmetic. Every major has a fix PR.

## Notes
- Model calls used: 3 of 6. One each for the Today coach chat, the /coach proposal and /brain-dump "Sort it". Double Enter in the coach box sent one message, and double-clicking "Sort it" showed one plan.
- The session stayed signed in for the whole resumed pass. Every chunk saved its state at the end.
- Cleanup: the 500-character intention was shortened back with "Edit plan", so /today is no longer wide.
- Test data left on the account, all with a `clumsy` prefix: tasks, habits, notes, a routine with 3 steps, a calendar event, a plan block, a template, a nag, a memory, focus blocks, a "New goal", and the "Home reset" project from task defaults.
