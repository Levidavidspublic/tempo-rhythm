// Kitchen study gallery (T3, Builder D): the study screens as the app draws them, with sample data
// and no backend, for screenshots of states the local dev server can't reach. Convex, next/link and
// next/navigation are swapped for stand-ins by build.ts; query fixtures live on window.__gallery
// under the function's name ("study.hub"). Some views click through the real components after they
// mount (Check, Submit, Ask the coach). Not part of the app. All people and data are fictional
// (DESIGN.md §13). Supports ?view=, ?theme=light|dark and ?lang=en|he.
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PageEditorView } from "@/components/notes/PageEditorView";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { ReviewHub } from "@/components/study/ReviewHub";
import { ReviewSession } from "@/components/study/ReviewSession";
import { StudySetScreen } from "@/components/study/StudySetScreen";
import { TurnIntoPreview } from "@/components/study/TurnIntoPreview";
import { TpIconSprite } from "@/components/tempo/TpIcon";

const params = new URLSearchParams(window.location.search);
const view = params.get("view") ?? "study-hub";
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
};
const setKind = kindFor[view] ?? "flashcards";
const setFixture =
  setKind === "quiz"
    ? getSet("studySets:4", { type: "quiz", data: quizData }, "quiz")
    : setKind === "test"
      ? getSet("studySets:5", { type: "test", data: testData }, "test")
      : getSet("studySets:1", { type: "flashcards", data: deckData }, "flashcards");

const queries: Record<string, unknown> = {
  "users.getProfile": profile,
  "study.hub":
    view === "study-hub-empty"
      ? { dueCount: 0, newCount: 0, reviewedToday: 0, sets: [] }
      : { dueCount: 12, newCount: 4, reviewedToday: 7, sets },
  "study.reviewQueue": { cards: view === "study-review-done" ? queueCards.slice(0, 1) : queueCards },
  "study.getSet": setFixture,
  "notes.getSafe": { _id: "notes:11", _creationTime: NOW - DAY, title: "Cell biology, unit 2", body: PAGE_BODY, updatedAt: NOW - DAY },
  "notes.backlinks": [],
  "notes.list": [],
};

const calls: Record<string, unknown> = {
  "study.review": { reviewId: "studyReviews:1", state: { dueAt: NOW + 6 * DAY, intervalDays: 6, ease: 2.6, repetitions: 2, lapses: 0 }, undoUntil: NOW + 5 * MIN },
  "study.undoReview": { success: true, state: null },
  "study.generate": { status: "unavailable", reason: "no_key" },
  "study.createFromPreview": { noteId: "notes:21", setId: "studySets:21", undoUntil: NOW + 5 * MIN },
  "study.undoCreate": { success: true, pageRemoved: true },
  "study.recordAttempt": { attemptId: "studyAttempts:2", percent: 33 },
  "study.removeSet": { success: true, undoUntil: NOW + 5 * MIN },
  "study.restoreSet": { success: true },
  "study.registerBlock": "studySets:1",
};

(window as unknown as { __gallery: unknown }).__gallery = { queries, calls };

/** Click through the real component after it mounts, one step at a time. */
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

function Main({ children }: { children: ReactNode }) {
  // The app shell gives its main area a side gutter; the gallery has no shell, so it adds 16 px.
  return (
    <main className="tp-app__main gallery-main" style={{ paddingInline: "var(--tp-space-4)" }}>
      {children}
    </main>
  );
}

const VIEWS: Record<string, () => ReactNode> = {
  "study-hub": () => <ReviewHub />,
  "study-hub-empty": () => <ReviewHub />,
  "study-review": () => <ReviewSession />,
  "study-review-done": () => {
    steps(click('[data-action="review-reveal"]'), click('[data-action="review-grade"][data-grade="good"]'));
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
  "study-test-score": () => {
    steps(
      click('[data-component="TestRunner"] input[type="radio"]'),
      click('[data-action="test-submit"]'),
      click('[data-action="test-submit-confirm"]'),
    );
    return <StudySetScreen setId="studySets:5" />;
  },
  "study-new-preview": () => <TurnIntoPreview from="notes:11" kind="flashcards" />,
  "study-new-nokey": () => {
    steps(click('[data-action="ask-coach"]'));
    return <TurnIntoPreview from="notes:11" kind="quiz" />;
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

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <LocaleProvider>
      <TpIconSprite />
      <Main>{(VIEWS[view] ?? VIEWS["study-hub"])()}</Main>
    </LocaleProvider>,
  );
}
