// Kitchen study gallery (T3, Builder D): the study screens as the app draws them, with sample data
// and no backend, for screenshots of states the local dev server can't reach. Convex, next/link and
// next/navigation are swapped for stand-ins by build.ts; query fixtures live on window.__gallery
// under the function's name ("study.hub"). Some views click through the real components after they
// mount (Check, Submit, Ask the coach). Not part of the app. All people and data are fictional
// (DESIGN.md §13). Supports ?view=, ?theme=light|dark and ?lang=en|he.
// S9 adds plan-guided, plan-guided-edit and plan-guided-accepted: the GuidedPlanCard on a sample plan.
// Typed recall adds study-review-typed and study-review-typed-checked.
// Edit and Share on a saved set add study-set-edit, study-set-edit-changed and study-set-share
// (MOCKED: the sample deck below, with stand-in updateBlock answers).
// F-07 adds plan-replan-notice (the live plan screen, two sessions missed yesterday) and
// plan-replan-preview (the "Re-plan the rest" preview on a fixed, fictional week).
// "Ask about this set" adds study-set-ask (quotes from the page and the deck), study-set-ask-empty
// (nothing found, with the page link) and study-set-ask-he (a pointed Hebrew deck answering an
// unpointed question). MOCKED: the sample decks and pages below; the search itself is the real one.
// The whole-run review adds study-hub-truncated (a hub past its read budget says it shows the most
// recent sets). HARD_RULES §1 (Undo always takes back what the AI-made save made) adds three Undos
// that also took the changes made since, each said in words in a toast with Bring it back:
// study-new-undo-edited (the page changed after it was made), plan-undo-edited (a session is
// already done) and record-undo-edited (the saved page changed). MOCKED: the sample sets, plan and
// notes below, with stand-in Undo answers.
// The keyboard walk (a11y-walk.mjs) has calendar-month hold its chosen day in state, as CalendarViews
// does: with a fixed day the grid's arrow keys had nothing to move to.
// The states pass adds a gallery-wide mode per view (MODES below; mocks/convex-react.ts says what
// each does): loading, signed out, error (the screen's own error state) and offline. Its views:
// study-hub-loading, study-hub-signedout, study-hub-offline, study-review-badset (?set= names no
// set of yours), study-set-loading, study-set-notfound, study-new-nofrom (no ?from), record-signedout,
// record-offline (Save waits for the connection), record-checking (live words' availability still
// loading), plan-signedout and plan-offline (each after pressing Add these sessions), memory-loading
// and memory-error. MOCKED: the same sample data as above. An unknown ?view= renders a plain
// "Unknown gallery view" heading, so a stale shot list is caught.
// study-review-quizset: /study/review?set= naming a live quiz says Review is for flashcards, with
// a link to open the quiz (MOCKED: the sample quiz above; its queue is empty, as the server's is).
// Tempo's voice on the audio recap adds study-listen-tempo (reading in Tempo's voice, with the
// Voice choice), study-listen-tempo-fallback (Tempo's voice fails, the device's reads on, said in
// a polite line) and study-listen-tempo-budget (today's reading in Tempo's voice is used up).
// MOCKED: the sample page above, a stand-in studyVoice.speak that answers with a short silent WAV
// (or fails), and a stand-in device voice that reads quietly.
// S14 Telegram reminders add reminders-tg-unavailable (env missing), reminders-tg-connect,
// reminders-tg-waiting (after Connect, waiting for Start), reminders-tg-reconnect (the bot was
// blocked), reminders-tg-connected, reminders-tg-sent, reminders-tg-error, reminders-tg-nophrases
// and reminders-tg-disconnected (the Undo toast). MOCKED: the bot name, link code and nags are
// fictional, and the row is drawn from fixed props (TelegramChannelRow), not the live queries.
import { GuidedPlanCard } from "@tempo/ui";
import { type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MonthGrid, todayLocal } from "@/components/calendar/MonthGrid";
import { PlanPathScreen } from "@/components/calendar/plan/PlanPathScreen";
import { type WeekItem, WeekGrid } from "@/components/calendar/WeekGrid";
import { IngestSheetView } from "@/components/ingest";
import { MemoryManager } from "@/components/memory/MemoryManager";
import { MiniAppFrame } from "@/components/mini-app";
import { PageEditorView } from "@/components/notes/PageEditorView";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { ReviewHub } from "@/components/study/ReviewHub";
import { AudioRecapPlayer } from "@/components/study/recap/AudioRecapPlayer";
import { ListenScreen } from "@/components/study/recap/ListenScreen";
import type { SpeechEngine } from "@/components/study/recap/speech";
import type { TempoPiece, TempoVoiceSource } from "@/components/study/recap/tempoVoice";
import { ReviewSession } from "@/components/study/ReviewSession";
import { StudySetScreen } from "@/components/study/StudySetScreen";
import { TurnIntoPreview } from "@/components/study/TurnIntoPreview";
import { RecordScreen } from "@/components/study/record/RecordScreen";
import { RemindersChannelList } from "@/components/settings-reminders/RemindersSettings";
import { TelegramChannelRow } from "@/components/settings-reminders/TelegramChannel";
import { UndoToast } from "@/components/you/UndoToast";
import { ShareSheet } from "@/components/share";
import { TpIconSprite } from "@/components/tempo/TpIcon";
import { pt, shortDate } from "@/components/calendar/planCopy";
import { buildPreview, DEFAULT_FORM, guidedLabels, toGuidedSteps } from "@/components/calendar/plan/planForm";
import { ReplanNotice, ReplanPreview } from "@/components/calendar/plan/ReplanPanel";
import { type PlanTask, replanInput, replanNotice } from "@/components/calendar/plan/replanForm";
import { addDays, parseLocalDate, startOfWeek } from "../../../../packages/core/plan/calendar-math";
import { replanRest, replanWaysOut } from "../../../../packages/core/plan/replan";

const params = new URLSearchParams(window.location.search);
const view = params.get("view") ?? "study-hub";

/** The gallery-wide mode for a view (mocks/convex-react.ts); views not listed get none. */
const MODES: Record<string, "loading" | "signedOut" | "error" | "offline"> = {
  "study-hub-loading": "loading",
  "study-hub-signedout": "signedOut",
  "study-hub-offline": "offline",
  "study-set-loading": "loading",
  "record-signedout": "signedOut",
  "record-offline": "offline",
  "plan-signedout": "signedOut",
  "plan-offline": "offline",
  "memory-loading": "loading",
  "memory-error": "error",
};
const mode = MODES[view];
// The screens read the browser's flag (useOnline: navigator.onLine and its online / offline
// events), so offline views report it as false before anything mounts.
if (mode === "offline") Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
// A "-he" view is the Hebrew screen: set ?lang=he before the LocaleProvider reads it.
if (view.endsWith("-he") && !params.get("lang")) {
  params.set("lang", "he");
  window.history.replaceState(null, "", `?${params.toString()}`);
}
const theme = params.get("theme") === "dark" ? "dark" : "light";
const lang = params.get("lang") === "he" ? "he" : "en";
document.documentElement.setAttribute("data-theme", theme);
document.documentElement.style.colorScheme = theme;
document.documentElement.lang = lang;
document.documentElement.dir = lang === "he" ? "rtl" : "ltr";

const NOW = Date.now();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const profile = { _id: "users:1", name: "Maya Ronen", greetingName: "Maya", email: "maya@example.com" };

const PAGE_BODY = `# Cell biology, unit 2

Mitosis: cell division that makes two identical cells
Meiosis: cell division that makes four cells with half the chromosomes
Osmosis: water moving across a membrane toward the saltier side
Diffusion: particles spreading from high to low concentration
Enzyme: a protein that speeds up a reaction without being used up

## Steps of mitosis

1. Prophase
2. Metaphase
3. Anaphase
4. Telophase
`;

// Kitchen T4 (S16): a Hebrew page for study-listen-he. Fictional.
const PAGE_BODY_HE = `# חלוקת תאים, יחידה 2

התא מתחלק בשתי דרכים. לכל דרך יש תפקיד משלה.

מיטוזה: חלוקת תא שיוצרת שני תאים זהים
מיוזה: חלוקת תא שיוצרת ארבעה תאים עם חצי מהכרומוזומים

## שלבי המיטוזה

1. פרופאזה
2. מטאפאזה
3. אנאפאזה
4. טלופאזה

נועה ביקשה לחזור על זה לפני הבוחן ביום ראשון. זה לוקח בערך 3.5 דקות.
`;

const sets = [
  { setId: "studySets:1", noteId: "notes:11", kind: "flashcards", title: "Cell biology, unit 2", itemCount: 24, dueCount: 9, newCount: 4, lastStudiedAt: NOW - DAY },
  { setId: "studySets:2", noteId: "notes:12", kind: "flashcards", title: "בניינים: פעל, נפעל, פיעל", itemCount: 30, dueCount: 3, newCount: 0, lastStudiedAt: NOW - 2 * DAY },
  { setId: "studySets:3", noteId: "notes:13", kind: "flashcards", title: "Modern history: causes of the First World War, with the dates Dana asked for", itemCount: 16, dueCount: 0, newCount: 0, lastStudiedAt: NOW - 3 * DAY },
  { setId: "studySets:4", noteId: "notes:14", kind: "quiz", title: "Photosynthesis check", itemCount: 10, dueCount: 0, newCount: 0, lastAttempt: { percent: 80, finishedAt: NOW - DAY } },
  { setId: "studySets:5", noteId: "notes:15", kind: "test", title: "מבחן תרגול בביולוגיה", itemCount: 6, dueCount: 0, newCount: 0 },
];

const deckData = {
  title: "Cell biology, unit 2",
  origin: "outline",
  cards: [
    { id: "c1", front: "Mitosis", back: "Cell division that makes two identical cells", hint: "Think: two of the same" },
    { id: "c2", front: "Meiosis", back: "Cell division that makes four cells with half the chromosomes" },
    { id: "c3", front: "Osmosis", back: "Water moving across a membrane toward the saltier side" },
    { id: "c4", front: "Enzyme", back: "A protein that speeds up a reaction without being used up" },
  ],
};

// "Ask about this set" in Hebrew: a pointed deck on the Hebrew page (study-set-ask-he). Fictional.
const deckDataHe = {
  title: "חלוקת תאים, יחידה 2",
  origin: "outline",
  cards: [
    { id: "h1", front: "מִיטוֹזָה", back: "חֲלוּקַת תָּא שֶׁיּוֹצֶרֶת שְׁנֵי תָּאִים זֵהִים" },
    { id: "h2", front: "מֵיוֹזָה", back: "חֲלוּקַת תָּא שֶׁיּוֹצֶרֶת אַרְבָּעָה תָּאִים" },
  ],
};

const quizData = {
  title: "Photosynthesis check",
  mode: "adaptive",
  origin: "coach",
  questions: [
    {
      id: "q1",
      prompt: "Where in the cell does photosynthesis happen?",
      choices: [
        { id: "a", text: "In the chloroplasts" },
        { id: "b", text: "In the nucleus" },
        { id: "c", text: "In the cell membrane" },
      ],
      answerId: "a",
      explanation: "Chloroplasts hold the chlorophyll that captures light.",
      difficulty: 1,
    },
    {
      id: "q2",
      prompt: "Which gas do plants take in for photosynthesis?",
      choices: [
        { id: "a", text: "Carbon dioxide" },
        { id: "b", text: "Oxygen" },
        { id: "c", text: "Nitrogen" },
      ],
      answerId: "a",
      difficulty: 1,
    },
    {
      id: "q3",
      prompt: "Put the energy path in order",
      choices: [
        { id: "a", text: "Light, then chlorophyll, then glucose" },
        { id: "b", text: "Glucose, then light, then chlorophyll" },
      ],
      answerId: "a",
      difficulty: 2,
    },
  ],
};

const testData = {
  title: "מבחן תרגול בביולוגיה",
  style: "bagrut",
  durationMin: 45,
  origin: "user",
  sections: [
    {
      id: "s1",
      title: "Part A: multiple choice",
      questions: [
        {
          plugin: "mcq",
          id: "m1",
          prompt: "Which organelle makes most of the cell's energy?",
          points: 10,
          choices: [
            { id: "a", text: "The mitochondrion" },
            { id: "b", text: "The ribosome" },
            { id: "c", text: "The Golgi body" },
          ],
          answerId: "a",
        },
        { plugin: "short", id: "s2", prompt: "Name the process plants use to make glucose.", points: 10, accepted: ["photosynthesis"] },
      ],
    },
    {
      id: "s3",
      title: "חלק ב: שאלה פתוחה",
      instructions: "Answer in full sentences.",
      questions: [
        {
          plugin: "bagrut",
          id: "b1",
          stem: "A plant is kept in the dark for two days.",
          parts: [
            { id: "p1", label: "א", prompt: "What happens to its starch stores?", points: 15, modelAnswer: "They go down: the plant uses starch for energy without light." },
            { id: "p2", label: "ב", prompt: "Suggest one way to test your answer.", points: 15, rubric: "Iodine test on a leaf, with a control leaf kept in light." },
          ],
        },
      ],
    },
  ],
};

const getSet = (id: string, block: { type: string; data: { title: string } }, kind: string) => ({
  set: { setId: id, noteId: "notes:11", blockId: "blk_01JABCDEFGHJKMNPQRSTVWXYZ0", kind, title: block.data.title, itemCount: 4, createdByTempo: true, createdAt: NOW - DAY, updatedAt: NOW - DAY },
  note: { id: "notes:11", title: block.data.title },
  block: { id: "blk_01JABCDEFGHJKMNPQRSTVWXYZ0", ...block },
  blockVersion: "v1-gallery",
  states: { c1: { dueAt: NOW - MIN, intervalDays: 1, ease: 2.5, repetitions: 1, lapses: 0 }, c2: { dueAt: NOW + 3 * DAY, intervalDays: 6, ease: 2.6, repetitions: 2, lapses: 0 } },
  attempts: kind === "quiz" ? [{ attemptId: "studyAttempts:1", kind, score: 8, maxScore: 10, percent: 80, answers: [], startedAt: NOW - DAY, finishedAt: NOW - DAY }] : [],
});

const queueCards = [
  { setId: "studySets:1", setTitle: "Cell biology, unit 2", cardId: "c1", front: "Mitosis", back: "Cell division that makes two identical cells", hint: "Think: two of the same", state: { dueAt: NOW - MIN, intervalDays: 1, ease: 2.5, repetitions: 1, lapses: 0 } },
  { setId: "studySets:2", setTitle: "בניינים", cardId: "v1", front: "נפעל", back: "Passive of pa'al: נִכְתַּב, it was written", state: null },
  { setId: "studySets:1", setTitle: "Cell biology, unit 2", cardId: "c3", front: "Osmosis", back: "Water moving across a membrane toward the saltier side", state: null },
];

const kindFor: Record<string, "flashcards" | "quiz" | "test"> = {
  "study-deck": "flashcards",
  "study-quiz": "quiz",
  "study-quiz-feedback": "quiz",
  "study-test": "test",
  "study-test-score": "test",
  "study-set-edit": "flashcards",
  "study-set-edit-changed": "flashcards",
  "study-set-share": "flashcards",
  "study-review-quizset": "quiz",
};
const setKind = kindFor[view] ?? "flashcards";
const setFixture =
  setKind === "quiz"
    ? getSet("studySets:4", { type: "quiz", data: quizData }, "quiz")
    : setKind === "test"
      ? getSet("studySets:5", { type: "test", data: testData }, "test")
      : view === "study-set-ask-he"
        ? getSet("studySets:1", { type: "flashcards", data: deckDataHe }, "flashcards")
        : getSet("studySets:1", { type: "flashcards", data: deckData }, "flashcards");

const queries: Record<string, unknown> = {
  "users.getProfile": profile,
  "study.hub":
    view === "study-hub-empty"
      ? { dueCount: 0, newCount: 0, reviewedToday: 0, sets: [] }
      : view === "study-hub-truncated"
        ? { dueCount: 12, newCount: 4, reviewedToday: 7, sets, truncated: true }
        : { dueCount: 12, newCount: 4, reviewedToday: 7, sets },
  "study.reviewQueue": {
    cards: view === "study-review-done" ? queueCards.slice(0, 1) : view === "study-review-badset" || view === "study-review-quizset" ? [] : queueCards,
  },
  // A ?set= that names no set of yours, and a set that is gone: the server answers null.
  "study.getSet": view === "study-review-badset" || view === "study-set-notfound" ? null : setFixture,
  "notes.getSafe":
    view === "study-listen-he" || view === "study-set-ask-he"
      ? { _id: "notes:12", _creationTime: NOW - DAY, title: "חלוקת תאים, יחידה 2", body: PAGE_BODY_HE, updatedAt: NOW - DAY }
      : { _id: "notes:11", _creationTime: NOW - DAY, title: "Cell biology, unit 2", body: PAGE_BODY, updatedAt: NOW - DAY },
  "notes.backlinks": [],
  "notes.list": [],
};

const calls: Record<string, unknown> = {
  "study.review": { reviewId: "studyReviews:1", state: { dueAt: NOW + 6 * DAY, intervalDays: 6, ease: 2.6, repetitions: 2, lapses: 0 }, undoUntil: NOW + 5 * MIN },
  "study.undoReview": { success: true, state: null },
  "study.generate": { status: "unavailable", reason: "no_key" },
  "study.createFromPreview": { noteId: "notes:21", setId: "studySets:21", undoUntil: NOW + 5 * MIN },
  "study.undoCreate":
    view === "study-new-undo-edited"
      ? { success: true, pageRemoved: true, removedEdits: true, redoUntil: NOW + 5 * MIN }
      : { success: true, pageRemoved: true },
  "study.redoCreate": { success: true, pageRestored: true },
  "study.recordAttempt": { attemptId: "studyAttempts:2", percent: 33 },
  "study.removeSet": { success: true, undoUntil: NOW + 5 * MIN },
  "study.restoreSet": { success: true },
  "study.registerBlock": "studySets:1",
  // study-set-edit-changed: the page's block changed in another tab, so the save is refused.
  "study.updateBlock":
    view === "study-set-edit-changed"
      ? { status: "changed", version: "v2-gallery" }
      : { status: "saved", version: "v2-gallery", undoUntil: NOW + 5 * MIN },
  "study.undoUpdate": { status: "saved", version: "v1-gallery", undoUntil: NOW + 5 * MIN },
};

// ---- The other screens this run built (calendar, plan, record, ingest, memory, reminders, share,
// mini-app). Dates are relative to today, because the components read the real clock.
const today = todayLocal();
const he = lang === "he";
const weekStart = startOfWeek(today, { weekStartsOn: he ? 0 : 1 });
const at = (date: string, hour: number, minute = 0) => {
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, hour, minute).getTime();
};
const weekItems: WeekItem[] = [
  { id: "e1", date: addDays(weekStart, 0), startMinute: 9 * 60, durationMinutes: 60, kind: "fixed", title: he ? "שיעור ביולוגיה" : "Biology lesson" },
  { id: "t1", date: addDays(weekStart, 0), startMinute: 9 * 60 + 30, durationMinutes: 45, kind: "flexible", title: he ? "חזרה: מיטוזה" : "Review: mitosis", movable: true },
  { id: "t2", date: addDays(weekStart, 1), startMinute: 17 * 60, durationMinutes: 45, kind: "flexible", title: he ? "תרגול בגרות" : "Practice test", movable: true },
  { id: "e2", date: addDays(weekStart, 2), startMinute: 14 * 60, durationMinutes: 60, kind: "fixed", title: he ? "חוג שחייה" : "Swimming club" },
  { id: "t3", date: addDays(weekStart, 3), startMinute: 16 * 60 + 30, durationMinutes: 30, kind: "flexible", title: he ? "כרטיסיות: אוסמוזה" : "Cards: osmosis", movable: true },
  { id: "t4", date: addDays(weekStart, 4), startMinute: 18 * 60, durationMinutes: 90, kind: "flexible", title: he ? "ללמוד: פוטוסינתזה" : "Learn: photosynthesis", movable: true },
];
const monthItems = [
  ...weekItems,
  { id: "m1", date: addDays(today, 6), startMinute: 10 * 60, durationMinutes: 60, kind: "fixed" as const, title: "Exam" },
  { id: "m2", date: addDays(today, 6), startMinute: 16 * 60, durationMinutes: 30, kind: "flexible" as const, title: "Rest" },
  { id: "m3", date: addDays(today, 9), startMinute: 17 * 60, durationMinutes: 45, kind: "flexible" as const, title: "Review" },
];
const planTasks = [1, 2, 3, 4, 5].map((n) => ({
  _id: `tasks:p${n}`,
  title: he ? ["ללמוד: תאים", "ללמוד: מיטוזה", "חזרה: תאים", "ללמוד: פוטוסינתזה", "תרגול בגרות"][n - 1] : ["Learn: cells", "Learn: mitosis", "Review: cells", "Learn: photosynthesis", "Bagrut practice"][n - 1],
  dueAt: at(addDays(weekStart, n - 1), 17),
  timeEstimate: 45 * MIN,
  status: "todo",
  projectName: "Biology bagrut",
}));
// F-07: a saved plan with one session done and two missed yesterday; the rest still ahead.
const replanNoticeView = view === "plan-replan-notice";
const replanTitles = he
  ? ["ללמוד: תאים", "ללמוד: מיטוזה", "חזרה: תאים", "ללמוד: פוטוסינתזה", "חזרה: מיטוזה", "תרגול בגרות"]
  : ["Learn: cells", "Learn: mitosis", "Review: cells", "Learn: photosynthesis", "Review: mitosis", "Bagrut practice"];
const replanTasks = [
  [-2, 17, 0, "done"],
  [-1, 17, 0, "todo"],
  [-1, 17, 45, "todo"],
  [1, 17, 0, "todo"],
  [2, 17, 0, "todo"],
  [3, 17, 0, "todo"],
].map(([day, hour, minute, status], n) => ({
  _id: `tasks:r${n + 1}`,
  title: replanTitles[n],
  dueAt: at(addDays(today, day as number), hour as number, minute as number),
  timeEstimate: 45 * MIN,
  status,
  projectName: "Biology bagrut",
}));
Object.assign(queries, {
  "plans.list": view === "plan-scheduler" || replanNoticeView ? [{ _id: "studyPlans:1", title: "Biology bagrut" }] : [],
  "plans.get": replanNoticeView
    ? { plan: { _id: "studyPlans:1", title: "Biology bagrut", deadline: addDays(today, 10), taskIds: replanTasks.map((task) => task._id) }, tasks: replanTasks }
    : { plan: { _id: "studyPlans:1", title: "Biology bagrut", deadline: addDays(today, 14), taskIds: planTasks.map((task) => task._id) }, tasks: planTasks },
  "calendar_events.listInRange": replanNoticeView
    ? []
    : [{ _id: "calendar_events:1", title: he ? "שיעור ביולוגיה" : "Biology lesson", startsAtMs: at(addDays(weekStart, 1), 17, 30) }],
  "tasks.listDueInRange": view === "plan-scheduler" ? planTasks : replanNoticeView ? replanTasks : [],
  "recordings.availability":
    view === "record-consent"
      ? { live: true, reason: null, minutesLeft: 42, proposals: true }
      : view === "record-checking"
        ? undefined
        : { live: false, reason: "no_key", minutesLeft: 0, proposals: false },
  "memory.list":
    view === "memory-empty"
      ? []
      : [
          { _id: "memories:1", content: he ? "לומדת לבגרות בביולוגיה, המבחן באמצע יוני" : "Studying for the biology bagrut, the exam is in mid June", createdAt: NOW - 2 * DAY },
          { _id: "memories:2", content: he ? "מעדיפה ללמוד אחרי חמש בערב, בקטעים של 45 דקות" : "Prefers to study after 5 pm, in 45-minute blocks", createdAt: NOW - 5 * DAY },
          { _id: "memories:3", content: "Swimming club on Wednesdays at 2 pm, so no study sessions then. Likes flashcards for vocabulary and short quizzes for science, and wants a rest day before each exam.", createdAt: NOW - 9 * DAY, importedFrom: "chatgpt" },
          { _id: "memories:4", content: he ? "אוהבת שמזכירים לה בעדינות, בלי לחץ" : "Likes gentle reminders, never pushy ones", createdAt: NOW - 20 * DAY, importedFrom: "claude" },
        ],
});
Object.assign(calls, {
  "plans.createFromPreview": { planId: "studyPlans:1", undoUntil: NOW + 5 * MIN },
  "plans.replan": { undoUntil: NOW + 5 * MIN, moved: 2, removed: 0 },
  "plans.undoReplan": { restored: 2 },
  "plans.undoCreate":
    view === "plan-undo-edited"
      ? { removedTasks: 4, removedDone: 1, redoUntil: NOW + 5 * MIN }
      : { removedTasks: 4 },
  "plans.redoUndo": { restoredTasks: 4 },
  "recordings.saveSession": { noteId: "notes:41", taskIds: ["tasks:41"], undoUntil: NOW + 5 * MIN },
  "recordings.undoSave":
    view === "record-undo-edited"
      ? { success: true, removedTasks: 0, removedEdits: true, redoUntil: NOW + 5 * MIN }
      : { success: true, removedTasks: 1 },
  "recordings.redoUndo": { success: true, restoredTasks: 0 },
  "notes.create": "notes:31",
  "memory.update": { success: true },
});

(window as unknown as { __gallery: unknown }).__gallery = { queries, calls, mode };

/** Click through the real component after it mounts, one step at a time. */
/** A voice that is listed but can't speak: every reading fails at once (the "voice stopped" state). */
const failingVoice: SpeechEngine = {
  available: () => true,
  speak: (_text, options) => {
    const timer = window.setTimeout(() => options.onError?.("voice-unavailable"), 50);
    return { cancel: () => window.clearTimeout(timer) };
  },
};

/** A device voice that reads without a sound and never finishes (the fallback views). MOCKED. */
const quietVoice: SpeechEngine = {
  available: () => true,
  speak: () => ({ cancel: () => {} }),
};

/** Two seconds of silence as a WAV, standing in for Tempo's voice. MOCKED: no provider. */
function silentWav(seconds = 2, rate = 8000): ArrayBuffer {
  const samples = seconds * rate;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const data = new DataView(buffer);
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) data.setUint8(at + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  data.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  text(36, "data");
  data.setUint32(40, samples * 2, true);
  return buffer;
}

/** A stand-in for the listen screen's Tempo voice source. MOCKED. */
function galleryTempo(kind: "playing" | "fails" | "budget"): TempoVoiceSource {
  return {
    availability: kind === "budget" ? { status: "budget", charsLeft: 0 } : { status: "available", charsLeft: 18_400 },
    online: true,
    fetchPiece: async (): Promise<TempoPiece> => {
      if (kind === "fails") throw new Error("Gallery: Tempo's voice is down");
      return { status: "audio", audio: silentWav(), mime: "audio/wav", count: 6 };
    },
  };
}

function steps(...actions: (() => void)[]) {
  let i = 0;
  const run = () => {
    const action = actions[i++];
    if (!action) return;
    action();
    window.setTimeout(run, 150);
  };
  window.setTimeout(run, 250);
}
const click = (selector: string) => () => (document.querySelector(selector) as HTMLElement | null)?.click();
/** Type into a React-controlled field the way a person would (the native setter, then input). */
const fill = (selector: string, value: string) => () => {
  const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

const PLAN_TOPICS = he ? "תאים\nמיטוזה ומיוזה | 2\nפוטוסינתזה\nגנטיקה" : "Cells\nMitosis and meiosis | 2\nPhotosynthesis\nGenetics";
const RECORD_NOTES = he
  ? "פתחנו בחזרה על מיטוזה.\nאני אשלח את דוח המעבדה עד יום חמישי.\nהמורה הזכירה שהמבחן בעוד שבועיים.\nלא לשכוח להביא את המחברת."
  : "We went over mitosis again.\nI will send the lab report by Thursday.\nThe teacher said the test is in two weeks.\nDon't forget to bring the workbook.";
const INGEST_TEXT = he
  ? "# פרק 3: נשימה תאית\n\nהתא מפרק גלוקוז כדי לקבל אנרגיה.\nהתהליך קורה במיטוכונדריה."
  : "# Chapter 3: cell respiration\n\nThe cell breaks down glucose to get energy.\nIt happens in the mitochondria and needs oxygen.";
const WIDGET = `<button id="b" style="font:inherit;padding:8px 14px">Flip a coin</button><p id="o"></p><script>b.onclick=()=>{o.textContent=Math.random()<.5?"Heads":"Tails"}</script>`;

function MiniApp({ html, approved }: { html: string; approved: boolean }) {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  return (
    <MiniAppFrame
      html={html}
      title={he ? "מטבע" : "Coin flip"}
      approvedFingerprint={approved ? fingerprint : null}
      onApprove={setFingerprint}
    />
  );
}

/**
 * The headings the app puts around a view that the gallery shows on its own (the plan page's h1 and
 * its "Your plan" h2, a notes page's title and a section, the calendar's week h2), visually hidden so the shot doesn't change. Without
 * them axe flags a page with no h1, or an h3 straight after the h1, that the app never shows.
 */
function AppHeadings({ h1, h2, children }: { h1?: string; h2?: string; children: ReactNode }) {
  return (
    <>
      {h1 ? <h1 className="tp-sr-only">{h1}</h1> : null}
      {h2 ? <h2 className="tp-sr-only">{h2}</h2> : null}
      {children}
    </>
  );
}

// S14 Telegram row states (MOCKED: fictional bot, code and nags).
const TG_URL = "https://t.me/TempoSampleBot?start=MOCKEDsampleCodeMOCKEDsample0";
type TgRowProps = Partial<Parameters<typeof TelegramChannelRow>[0]>;
function TelegramReminders({ row, toast = false }: { row: TgRowProps; toast?: boolean }) {
  const telegram = { id: "telegram", label: "Telegram", connected: false, available: true, ...(row.channel ?? {}) };
  const channels = [
    { id: "whatsapp", label: "WhatsApp", connected: false, available: false },
    telegram,
    { id: "sms", label: "SMS", connected: false, available: false },
  ];
  const phrases = he
    ? [
        { value: "nags:1::p1", label: "עציצים: להשקות את העציצים, הם אוהבים להיות ירוקים" },
        { value: "nags:2::p1", label: "מפתחות: מפתחות, ארנק, טלפון" },
      ]
    : [
        { value: "nags:1::p1", label: "Plants: Water the plants, you like them green" },
        { value: "nags:2::p1", label: "Keys: Keys, wallet, phone" },
      ];
  return (
    <Page title={he ? "תזכורות" : "Reminders"}>
      <RemindersChannelList
        channels={channels}
        telegram={
          <TelegramChannelRow
            waitingUrl={null}
            phrases={phrases}
            selected={phrases[0]?.value ?? ""}
            busy={null}
            status={null}
            onConnect={() => {}}
            onSelect={() => {}}
            onTest={() => {}}
            onDisconnect={() => {}}
            {...row}
            channel={telegram}
          />
        }
      />
      {toast ? (
        <UndoToast title={he ? "Telegram נותק." : "Telegram disconnected."} untilMs={Date.now() + 4 * 60 * 1000 + 37 * 1000} onUndo={() => {}} onClose={() => {}} />
      ) : null}
    </Page>
  );
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="tp-page">
      <header className="tp-pagehead">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

const planSteps = (deadlineDays: number, minutes: string, ...then: (() => void)[]) =>
  steps(
    fill('input[name="title"]', he ? "בגרות בביולוגיה" : "Biology bagrut"),
    fill('input[name="deadline"]', addDays(today, deadlineDays)),
    fill('textarea[name="topics"]', PLAN_TOPICS),
    fill('input[name="minutesPerDay"]', minutes),
    ...then,
  );

/** A fictional two-week plan for a chemistry test, the way the plan screen would preview it. */
function GuidedPlanSample({ mode }: { mode: "pending" | "edit" | "accepted" }) {
  const preview = buildPreview(
    {
      ...DEFAULT_FORM,
      title: lang === "he" ? "מבחן בכימיה" : "Chemistry test",
      deadline: "2026-10-30",
      topicsText: lang === "he" ? "קשרים כימיים\nחומצות ובסיסים | 2\nסטוכיומטריה" : "Chemical bonds\nAcids and bases | 2\nStoichiometry",
      minutesPerDay: 60,
      sessionMinutes: 40,
      startTime: "16:30",
    },
    "2026-10-19",
    lang,
  );
  if (preview.status !== "ok") return null;
  const steps = toGuidedSteps(preview.sessions, lang);
  const statuses = mode === "accepted" ? { [steps[0]?.id ?? ""]: "done" as const, [steps[1]?.id ?? ""]: "doing" as const } : undefined;
  return (
    <div className="tp-page tp-page--wide tp-plan">
      <GuidedPlanCard
        title={lang === "he" ? "מבחן בכימיה" : "Chemistry test"}
        steps={steps}
        labels={guidedLabels(lang)}
        status={mode === "accepted" ? "accepted" : "pending"}
        undoUntilMs={mode === "accepted" ? NOW + 5 * MIN : undefined}
        stepStatuses={statuses}
        initialEditing={mode === "edit"}
        formatDate={(date) => shortDate(lang, date)}
        onAccept={() => {}}
        onReject={() => {}}
        onUndo={() => {}}
        onStepStatus={() => {}}
      />
    </div>
  );
}

/**
 * "Re-plan the rest" on a fixed, fictional week (so the shot doesn't depend on the clock): Tuesday
 * 20 Oct 2026 at 18:00, the test on Friday 23 Oct, 90 minutes a day. Three sessions were missed on
 * Monday and the Bagrut practice now overlaps swimming on Wednesday: three move, one doesn't fit.
 */
function ReplanSample() {
  const [leaveOut, setLeaveOut] = useState(false);
  const names = he
    ? ["ללמוד: תאים", "ללמוד: מיטוזה", "חזרה: תאים", "ללמוד: גנטיקה", "תרגול בגרות", "ללמוד: פוטוסינתזה", "חזרה: מיטוזה"]
    : ["Learn: cells", "Learn: mitosis", "Review: cells", "Learn: genetics", "Bagrut practice", "Learn: photosynthesis", "Review: mitosis"];
  const rows: Array<[string, number, number, number, PlanTask["status"]]> = [
    ["2026-10-18", 17, 0, 45, "done"],
    ["2026-10-19", 17, 0, 45, "todo"],
    ["2026-10-19", 17, 45, 45, "todo"],
    ["2026-10-19", 18, 30, 45, "todo"],
    ["2026-10-21", 17, 0, 90, "todo"],
    ["2026-10-22", 17, 0, 45, "todo"],
    ["2026-10-22", 17, 45, 45, "todo"],
  ];
  const tasks: PlanTask[] = rows.map(([date, hour, minute, minutes, status], n) => ({
    _id: `tasks:s${n + 1}`,
    title: names[n] ?? "",
    status,
    dueAt: at(date, hour, minute),
    timeEstimate: minutes * MIN,
  }));
  const input = replanInput({
    deadline: "2026-10-23",
    tasks,
    source: { events: [{ id: "e1", title: he ? "חוג שחייה" : "Swimming club", startsAtMs: at("2026-10-21", 17, 30) }], tasks: [] },
    now: { date: "2026-10-20", minute: 18 * 60 },
    overrides: { minutesPerDay: 90 },
  });
  if (!input) return null;
  const result = replanRest(input);
  const notice = replanNotice(result);
  return (
    <div className="tp-page tp-page--wide tp-plan">
      <div className="tp-plan__replan" data-component="ReplanPanel">
        {notice ? <ReplanNotice lang={lang} notice={notice} open onToggle={() => {}} controls="rp-sample" /> : null}
        <div id="rp-sample">
          <ReplanPreview
            lang={lang}
            result={result}
            titles={new Map(tasks.map((t) => [t._id, t.title]))}
            deadline={input.deadline}
            ways={replanWaysOut(input)}
            leaveOut={leaveOut}
            onLeaveOut={setLeaveOut}
            onUseDate={() => {}}
            onUseMinutes={() => {}}
            onAccept={() => {}}
            onCancel={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

/** The month grid as CalendarViews holds it: the chosen day is state, so arrow keys move the choice. */
function MonthSample() {
  const { year, month } = parseLocalDate(today);
  const [selected, setSelected] = useState(today);
  return <MonthGrid year={year} month={month} items={monthItems} today={today} selected={selected} lang={lang} onSelectDay={setSelected} onMonthChange={() => {}} />;
}

function Main({ children }: { children: ReactNode }) {
  // The app shell gives its main area a side gutter; the gallery has no shell, so it adds 16 px.
  return (
    <main className="tp-app__main gallery-main" style={{ paddingInline: "var(--tp-space-4)" }}>
      {children}
    </main>
  );
}

/** A ?view= the gallery doesn't have: said plainly, so a stale shot list is caught. */
function UnknownView({ name }: { name: string }) {
  return <h1 data-gallery-unknown="">Unknown gallery view: {name}</h1>;
}

const VIEWS: Record<string, () => ReactNode> = {
  "plan-guided": () => (
    <AppHeadings h1={pt(lang, "pp.title")} h2={pt(lang, "pp.preview.h")}>
      <GuidedPlanSample mode="pending" />
    </AppHeadings>
  ),
  "plan-guided-edit": () => (
    <AppHeadings h1={pt(lang, "pp.title")} h2={pt(lang, "pp.preview.h")}>
      <GuidedPlanSample mode="edit" />
    </AppHeadings>
  ),
  "plan-guided-accepted": () => (
    <AppHeadings h1={pt(lang, "pp.title")} h2={pt(lang, "pp.preview.h")}>
      <GuidedPlanSample mode="accepted" />
    </AppHeadings>
  ),
  "plan-replan-notice": () => <PlanPathScreen />,
  "plan-replan-preview": () => (
    <AppHeadings h1={pt(lang, "pp.title")}>
      <ReplanSample />
    </AppHeadings>
  ),
  "study-hub": () => <ReviewHub />,
  "study-hub-empty": () => <ReviewHub />,
  "study-hub-truncated": () => <ReviewHub />,
  "study-hub-loading": () => <ReviewHub />,
  "study-hub-signedout": () => <ReviewHub />,
  "study-hub-offline": () => <ReviewHub />,
  "study-review-badset": () => <ReviewSession setId="studySets:404" />,
  "study-review-quizset": () => <ReviewSession setId="studySets:4" />,
  "study-set-loading": () => <StudySetScreen setId="studySets:1" />,
  "study-set-notfound": () => <StudySetScreen setId="studySets:404" />,
  "study-new-nofrom": () => <TurnIntoPreview kind="flashcards" />,
  "study-review": () => <ReviewSession />,
  "study-review-done": () => {
    steps(click('[data-action="review-reveal"]'), click('[data-action="review-grade"][data-grade="good"]'));
    return <ReviewSession />;
  },
  // Typed recall: "Type answers" on, an answer half typed; then a near miss checked ("Almost",
  // with Hard marked as suggested). Fictional answers.
  "study-review-typed": () => {
    steps(click('[data-component="TypeAnswersToggle"] [role="switch"]'), fill('[data-action="recall-input"]', "Cell division that makes two"));
    return <ReviewSession />;
  },
  "study-review-typed-checked": () => {
    steps(
      click('[data-component="TypeAnswersToggle"] [role="switch"]'),
      fill('[data-action="recall-input"]', "Cell divison that makes two identical cells"),
      click('[data-action="review-check"]'),
    );
    return <ReviewSession />;
  },
  "study-deck": () => <StudySetScreen setId="studySets:1" />,
  "study-quiz": () => <StudySetScreen setId="studySets:4" />,
  "study-quiz-feedback": () => {
    // Every sample answer is choice a: pick b (not quite) and check, to show the feedback.
    steps(click('[data-component="Quiz"] input[value="b"]'), click('[data-action="quiz-check"]'));
    return <StudySetScreen setId="studySets:4" />;
  },
  "study-test": () => <StudySetScreen setId="studySets:5" />,
  // Edit a saved deck: the edit list in place of the deck, Save changes the one primary.
  "study-set-edit": () => {
    steps(click('[data-action="edit-set"]'));
    return <StudySetScreen setId="studySets:1" />;
  },
  // A save refused because the block changed in its page meanwhile: said in words, with Reload.
  "study-set-edit-changed": () => {
    steps(
      click('[data-action="edit-set"]'),
      fill("#st-ed-c1-b", he ? "חלוקה לשני תאים זהים" : "Splitting into two identical cells"),
      click('[data-action="save-edit"]'),
    );
    return <StudySetScreen setId="studySets:1" />;
  },
  // Share a saved deck: the set's ShareSheet (Markdown, and Anki for flashcards).
  "study-set-share": () => {
    steps(click('[data-action="share-set"]'));
    return <StudySetScreen setId="studySets:1" />;
  },
  // Ask about this set: open the panel, type a question, Find it. The page and the deck answer.
  "study-set-ask": () => {
    steps(
      click('[data-action="ask-set"]'),
      fill('[data-action="ask-set-input"]', "How does diffusion differ from osmosis?"),
      click('[data-action="ask-set-find"]'),
    );
    return <StudySetScreen setId="studySets:1" />;
  },
  // Nothing in the page or the deck says: the answer says so, with a way to the page.
  "study-set-ask-empty": () => {
    steps(
      click('[data-action="ask-set"]'),
      fill('[data-action="ask-set-input"]', he ? "מי גילה את הפוטוסינתזה?" : "Who discovered photosynthesis?"),
      click('[data-action="ask-set-find"]'),
    );
    return <StudySetScreen setId="studySets:1" />;
  },
  // Hebrew: a pointed card and the unpointed page both answer an unpointed question.
  "study-set-ask-he": () => {
    steps(
      click('[data-action="ask-set"]'),
      fill('[data-action="ask-set-input"]', "מה קורה במיוזה?"),
      click('[data-action="ask-set-find"]'),
    );
    return <StudySetScreen setId="studySets:1" />;
  },
  "study-test-score": () => {
    steps(
      click('[data-component="TestRunner"] input[type="radio"]'),
      click('[data-action="test-submit"]'),
      click('[data-action="test-submit-confirm"]'),
    );
    return <StudySetScreen setId="studySets:5" />;
  },
  // Kitchen T4 (S16): the audio recap. The browser's own voices decide whether Play shows.
  "study-listen": () => <ListenScreen from="notes:11" mode="recap" />,
  "study-listen-he": () => <ListenScreen from="notes:12" mode="recap" />,
  "study-listen-voice-error": () => {
    steps(click('[data-action="recap-play"]'));
    return <AudioRecapPlayer noteId="notes:11" title="Cell biology, unit 2" body={PAGE_BODY} mode="recap" engine={failingVoice} />;
  },
  // Tempo's voice (studyVoice.speak, MOCKED) reads the recap; Play pressed, Voice offered.
  "study-listen-tempo": () => {
    steps(click('[data-action="recap-play"]'));
    return <AudioRecapPlayer noteId="notes:11" title="Cell biology, unit 2" body={PAGE_BODY} mode="recap" engine={quietVoice} tempo={galleryTempo("playing")} />;
  },
  // Tempo's voice fails on the first sentence: the device's voice reads on, said in a polite line.
  "study-listen-tempo-fallback": () => {
    steps(click('[data-action="recap-play"]'));
    return <AudioRecapPlayer noteId="notes:11" title="Cell biology, unit 2" body={PAGE_BODY} mode="recap" engine={quietVoice} tempo={galleryTempo("fails")} />;
  },
  // Today's reading in Tempo's voice is used up: no Voice choice, the device's voice reads.
  "study-listen-tempo-budget": () => (
    <AudioRecapPlayer noteId="notes:11" title="Cell biology, unit 2" body={PAGE_BODY} mode="recap" engine={quietVoice} tempo={galleryTempo("budget")} />
  ),
  "study-new-preview": () => <TurnIntoPreview from="notes:11" kind="flashcards" />,
  // Accept, then Undo after the page changed: the set and its page go, and a toast says so with
  // Bring it back.
  "study-new-undo-edited": () => {
    steps(click('[data-action="accept"]'), click('[data-component="UndoToast"] .tp-btn--secondary'));
    return <TurnIntoPreview from="notes:11" kind="flashcards" />;
  },
  "study-new-nokey": () => {
    steps(click('[data-action="ask-coach"]'));
    return <TurnIntoPreview from="notes:11" kind="quiz" />;
  },
  "calendar-month": () => (
    <Page title={he ? "לוח שנה" : "Calendar"}>
      <MonthSample />
    </Page>
  ),
  "calendar-week": () => (
    <Page title={he ? "לוח שנה" : "Calendar"}>
      <WeekGrid weekStart={weekStart} items={weekItems} today={today} nowMinute={16 * 60} lang={lang} onMove={() => {}} />
    </Page>
  ),
  "calendar-mover": () => {
    steps(click('[data-component="WeekGrid"] button[data-item-id="t1"]'), click('[data-component="ItemMover"] [data-move="to"]'));
    return (
      <Page title={he ? "לוח שנה" : "Calendar"}>
        <AppHeadings h2={he ? "שבוע" : "Week"}>
          <WeekGrid weekStart={weekStart} items={weekItems} today={today} nowMinute={16 * 60} lang={lang} onMove={() => {}} />
        </AppHeadings>
      </Page>
    );
  },
  "plan-preview": () => {
    planSteps(21, "90");
    return <PlanPathScreen />;
  },
  "plan-short": () => {
    planSteps(3, "30");
    return <PlanPathScreen />;
  },
  "plan-scheduler": () => <PlanPathScreen />,
  // Signed out and offline: the form still plans on the device; Add these sessions says why it
  // sent nothing.
  "plan-signedout": () => {
    planSteps(21, "90", click('[data-action="guided-accept"]'));
    return <PlanPathScreen />;
  },
  "plan-offline": () => {
    planSteps(21, "90", click('[data-action="guided-accept"]'));
    return <PlanPathScreen />;
  },
  // Add the sessions, then Undo after one is done: the plan goes, and a toast says so with Bring
  // it back.
  "plan-undo-edited": () => {
    steps(
      fill('input[name="title"]', he ? "בגרות בביולוגיה" : "Biology bagrut"),
      fill('input[name="deadline"]', addDays(today, 21)),
      fill('textarea[name="topics"]', PLAN_TOPICS),
      fill('input[name="minutesPerDay"]', "90"),
      click('[data-action="guided-accept"]'),
      click('[data-action="guided-undo"]'),
    );
    return <PlanPathScreen />;
  },
  "record-consent": () => <RecordScreen />,
  "record-signedout": () => <RecordScreen />,
  "record-checking": () => <RecordScreen />,
  // Offline: typed notes reach review, and Save says it waits for the connection.
  "record-offline": () => {
    steps(click(".tp-form__actions .tp-btn--primary"), fill("#rec-typed", RECORD_NOTES), click(".tp-rec-dock .tp-btn--primary"), click('[aria-describedby="rec-save-note"]'));
    return <RecordScreen />;
  },
  "record-typing": () => {
    steps(click('.tp-form__actions .tp-btn--primary'), fill("#rec-typed", RECORD_NOTES), click(".tp-rec-pins .tp-btn--secondary"));
    return <RecordScreen />;
  },
  "record-review": () => {
    steps(click('.tp-form__actions .tp-btn--primary'), fill("#rec-typed", RECORD_NOTES), click(".tp-rec-dock .tp-btn--primary"));
    return <RecordScreen />;
  },
  // Save typed notes, then Undo after the page changed: the save goes, and a toast says so with
  // Bring it back.
  "record-undo-edited": () => {
    steps(
      click(".tp-form__actions .tp-btn--primary"),
      fill("#rec-typed", RECORD_NOTES),
      click(".tp-rec-dock .tp-btn--primary"),
      click('[aria-describedby="rec-save-note"]'),
      click('[data-component="UndoToast"] .tp-btn--secondary'),
    );
    return <RecordScreen />;
  },
  "ingest-paste": () => <IngestSheetView initialTab="paste" initialText={INGEST_TEXT} onClose={() => {}} onSave={async () => "notes:31"} online photoSupported />,
  "ingest-photo-unsupported": () => <IngestSheetView initialTab="photo" onClose={() => {}} onSave={async () => "notes:31"} online photoSupported={false} />,
  "ingest-done": () => {
    steps(click('[role="dialog"] button[type="submit"]'));
    return <IngestSheetView initialTab="paste" initialText={INGEST_TEXT} onClose={() => {}} onSave={async () => "notes:31"} online photoSupported />;
  },
  "memory-list": () => <MemoryManager />,
  "memory-edit": () => {
    steps(click(".mm-row-actions button"));
    return <MemoryManager />;
  },
  "memory-empty": () => <MemoryManager />,
  "memory-loading": () => <MemoryManager />,
  "memory-error": () => <MemoryManager />,
  reminders: () => (
    <Page title={he ? "תזכורות" : "Reminders"}>
      <RemindersChannelList
        channels={[
          { id: "whatsapp", label: "WhatsApp", connected: false },
          { id: "telegram", label: "Telegram", connected: false },
          { id: "sms", label: "SMS", connected: false },
        ]}
      />
    </Page>
  ),
  "reminders-tg-unavailable": () => <TelegramReminders row={{ channel: { id: "telegram", label: "Telegram", connected: false, available: false } }} />,
  "reminders-tg-connect": () => <TelegramReminders row={{}} />,
  "reminders-tg-waiting": () => <TelegramReminders row={{ waitingUrl: TG_URL }} />,
  "reminders-tg-reconnect": () => (
    <TelegramReminders row={{ channel: { id: "telegram", label: "Telegram", connected: false, available: true, needsReconnect: true } }} />
  ),
  "reminders-tg-connected": () => <TelegramReminders row={{ channel: { id: "telegram", label: "Telegram", connected: true, available: true } }} />,
  "reminders-tg-sent": () => (
    <TelegramReminders
      row={{ channel: { id: "telegram", label: "Telegram", connected: true, available: true }, status: { tone: "ok", text: "rem.tg.sent" } }}
    />
  ),
  "reminders-tg-error": () => (
    <TelegramReminders
      row={{
        channel: { id: "telegram", label: "Telegram", connected: true, available: true },
        status: { tone: "error", text: "rem.tg.err.rate_limited" },
      }}
    />
  ),
  "reminders-tg-nophrases": () => (
    <TelegramReminders row={{ channel: { id: "telegram", label: "Telegram", connected: true, available: true }, phrases: [] }} />
  ),
  "reminders-tg-disconnected": () => <TelegramReminders row={{}} toast />,
  "share-sheet": () => (
    <ShareSheet
      systemShare
      onClose={() => {}}
      target={{ kind: "set", title: deckData.title, markdown: PAGE_BODY, url: "/notes/notes:11", cards: deckData.cards.map((c) => ({ front: c.front, back: c.back })) }}
    />
  ),
  "miniapp-approve": () => (
    <AppHeadings h1="Cell biology, unit 2" h2={he ? "לנסות בעצמך" : "Try it yourself"}>
      <div className="tp-paper">
        <MiniApp html={WIDGET} approved={false} />
      </div>
    </AppHeadings>
  ),
  "miniapp-stopped": () => {
    steps(click('[data-component="MiniAppFrame"] .tp-btn--secondary'));
    // This widget reloads its own frame, which counts as navigating it: the frame is taken down.
    return (
      <AppHeadings h1="Cell biology, unit 2" h2={he ? "לנסות בעצמך" : "Try it yourself"}>
        <div className="tp-paper">
          <MiniApp html={`<p>Loading</p><script>setTimeout(()=>location.reload(),50)</script>`} approved />
        </div>
      </AppHeadings>
    );
  },
  "page-menu-turn-into": () => {
    steps(click('[data-component="PageMenu"] button[aria-haspopup="menu"]'));
    return (
      <div className="tp-paper">
        <PageEditorView
          noteId="notes:11"
          title="Cell biology, unit 2"
          initialBody={PAGE_BODY}
          body={PAGE_BODY}
          pinned={false}
          saveState="saved"
          confirmingDelete={false}
          onTitleChange={() => {}}
          onBodyChange={() => {}}
          onTogglePin={() => {}}
          onAskDelete={() => {}}
          onConfirmDelete={() => {}}
          onCancelDelete={() => {}}
          backHref="/notes"
        />
      </div>
    );
  },
};

const renderView = VIEWS[view];
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <LocaleProvider>
      <TpIconSprite />
      <Main>{renderView ? renderView() : <UnknownView name={view} />}</Main>
    </LocaleProvider>,
  );
}
