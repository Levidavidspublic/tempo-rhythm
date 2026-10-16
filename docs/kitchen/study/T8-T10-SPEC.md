# T8–T10 — build spec (kitchen/tempo-study)

Same rules as `T3-SPEC.md` → "Rules every builder follows". Owned folders for this run: `apps/web/components/study/**`, `apps/web/components/calendar/**`, `apps/web/components/ingest/**`, `apps/web/components/memory/**`, `packages/core/**`, `packages/ui/src/study/**`, routes under `apps/web/app/(tempo)/study/**`, and new Convex modules this run creates. Everything else gets one-line hooks only, logged in the report.

## T8 — record a meeting, plan back from a deadline

### S3 PlanPath (`packages/core/plan/**`, pure)

`planBack({ today, deadline, topics: [{ title, weight? }], minutesPerDay, sessionMinutes, daysOff: weekday[], busy?: { [date]: minutes } })` → `{ sessions: [{ date, kind: "learn" | "review" | "practice" | "rest", topic?, minutes, title }], totalMinutes, daysUsed, shortBy: minutes }`.
- Work backwards from the deadline: the day before is light review + rest; the 2–3 study days before that hold practice tests (Bagrut-style when the topics come from a test block); learning fills the earlier days in proportion to `weight`, and each learn session gets review sessions at +1, +3 and +7 days when they fit before the practice phase.
- Never more than `minutesPerDay` (minus `busy`) on a day; skip `daysOff`. When it doesn't fit, `shortBy` says how many minutes are missing; the UI offers three ways out in plain words (fewer topics, longer days, a later date). No shaming.
- Dates are local `YYYY-MM-DD`; no clock inside. Tests: an exam in 3 weeks, an exam tomorrow, a full calendar, weekends off, Hebrew topic titles.

### S4 SessionScheduler (`apps/web/components/calendar/**`)

Real grids, built on the v3 classes (`components.md` §2.5): `WeekGrid` (7 day columns × hour rows, items positioned by start and length, fixed events solid + "Fixed", study sessions dashed + "Flexible", a "now" line) and `MonthGrid` (`.tp-month`, dots + "3 items" text, `aria-current="date"`, select a day). Move a session with buttons (earlier / later day, earlier / later 30 minutes, "Move to…" a day picked in the month grid); drag is optional and never the only way. Conflicts with fixed events are named in words. Data: `tasks.listDueInRange` and `calendar_events.listInRange`; a move calls `tasks.update` (`dueAt`). The `/calendar` Week and Month modes may switch from lists to these grids (CalendarViews is in this run's folder).

### Plan backend (`convex/plans.ts`, `convex/schema/plans.ts`, `convex-arch:`)

`studyPlans`: `userId`, `title`, `deadline` (date), `sourceSetId?`, `taskIds`, `createdAt`, `updatedAt`, `deletedAt?`, `by_userId`. `plans.createFromPreview({ title, deadline, sessions })` creates one task per session (`dueAt` = session start, `timeEstimate`, `projectName` = plan title, elastic) and the plan row, returns `{ planId, undoUntil }`; `plans.undoCreate({ planId })` soft-deletes them within 5 minutes; `plans.list`, `plans.get`. Enrol the table in account deletion like T3's tables.

### S7 RecordSession (`apps/web/components/study/record/**`, `convex/recordings.ts`)

- Consent first: a plain screen saying what happens (live words on screen, audio is never stored, only the notes you keep are saved) and a checkbox "Everyone here knows this is being recorded". No consent, no mic.
- Live transcript from Deepgram (English Flux lane from `convex/lib/voicePolicy.ts`), with a short-lived token minted by a new `recordings.grant` (its own content-free lease table `recordingSessions`, same daily minute budget as voice, EXTRAPOLATED). Audio frames go straight from the browser to Deepgram and are never written anywhere. Hebrew: Flux has no Hebrew and the Nova-3 lane is off in `voicePolicy` → Hebrew recording says so and offers typing.
- Pin: a button (and a key) that pins "now" with an optional note; pins show on a timeline.
- Stop → review: the transcript and pins become a page (note) and proposed tasks (lines like "I'll…", "we need to…", "by Friday"; plus the runtime model through `callLLM` when the key is there) shown as Accept / Edit / Reject cards with a 5-minute Undo. Nothing saves before Accept.
- Without `DEEPGRAM_API_KEY` the screen says live words aren't available and keeps "type or paste notes"; that path is fully testable.

## T9 — uploads and memory

### S2 IngestSheet (`apps/web/components/ingest/**`)

A sheet (bottom on phone, dialog from 768) with three tabs: File (`.txt`, `.md`, `.csv`, `.html` read in the browser; HTML is stripped to text), Paste, Photo. Photo uses the browser's built-in text detector when it exists (`TextDetector`); otherwise it says photo reading isn't available in this browser and offers Paste (a real OCR library is a new dependency: **Needs Amit**). PDF and Word need a library too: same. The result is a new page (`notes.create`) and the sheet offers "Turn into flashcards / quiz / practice test" (T3's `/study/new`). Size limit, empty file, wrong type, offline: each says so in words.

### S31 MemoryManager parity (`apps/web/components/memory/**`)

Compare `apps/web/components/memory/MemoryManager.tsx` with `docs/design/v3/screens/web/memory.html` and `memory-import.html` and close the gaps: search, filter by source, edit a memory (additive `memory.update` if missing), forget with a 5-minute Undo toast, forget all with a confirm, export, import link, empty / loading / error / offline, 390 px. List each gap and what you did in the report.

## T10 — stretch

- **S14 reminders through a messaging channel:** a `ReminderChannel` adapter interface (`id`, `label`, `connect`, `send(to, text)`), a registry with no live channel, a Settings → Reminders section listing channels as "Not connected yet", and a Convex action that would send a nag's own words through the chosen channel (refuses when none is connected). Which channel: UNKNOWN (PRD F-61) → Needs Amit. Nag text is only the user's own words (F-60).
- **S26 ShareSheet:** share a page or a study set: the system share sheet (`navigator.share`) when there is one, Copy link, Download Markdown, and for flashcards an Anki-friendly tab-separated export (PRD F-90). Nothing is published anywhere.
- **S24 MiniAppFrame:** a sandboxed `<iframe sandbox="allow-scripts">` with `srcdoc` and a strict CSP meta tag, no same-origin, a tiny `postMessage` bridge (size + "done"), shown only after the user approves the widget (PRD F-46). It never receives keys or user data beyond what the widget's block carries.
