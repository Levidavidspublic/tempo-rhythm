import type {
  AdaptiveQuizLabels,
  FlashcardDeckLabels,
  FlashcardReviewLabels,
  ScoreCardLabels,
  TestRunnerLabels,
} from "@tempo/ui";
import type { StudyBlockType } from "@tempo/utils";
import type { MessageKey } from "@/lib/i18n";

/**
 * The words the @tempo/ui study components take as `labels`, from the study i18n group
 * (lib/i18n-groups/study.ts). Pure: pass the locale's `t`.
 */

export type StudyT = (key: MessageKey) => string;

export function deckLabels(t: StudyT): FlashcardDeckLabels {
  return {
    deck: t("st.dk.deck"),
    front: t("st.rv.front"),
    back: t("st.rv.back"),
    hint: t("st.rv.hint"),
    position: t("st.dk.position"),
    showBack: t("st.dk.showBack"),
    showFront: t("st.dk.showFront"),
    previous: t("st.dk.previous"),
    next: t("st.dk.next"),
    shuffle: t("st.dk.shuffle"),
    keys: t("st.dk.keys"),
  };
}

export function reviewLabels(t: StudyT): FlashcardReviewLabels {
  return {
    card: t("st.rv.card"),
    front: t("st.rv.front"),
    back: t("st.rv.back"),
    hint: t("st.rv.hint"),
    showAnswer: t("st.rv.showAnswer"),
    progress: t("st.rv.progress"),
    gradeGroup: t("st.rv.gradeGroup"),
    grades: { again: t("st.rv.again"), hard: t("st.rv.hard"), good: t("st.rv.good"), easy: t("st.rv.easy") },
    intervalOne: t("st.rv.intervalOne"),
    intervalMany: t("st.rv.intervalMany"),
    undo: t("st.rv.undo"),
    doneTitle: t("st.rv.doneTitle"),
    doneBody: t("st.rv.doneBody"),
    keys: t("st.rv.keys"),
  };
}

export function scoreLabels(t: StudyT, unit: "points" | "right"): ScoreCardLabels {
  return {
    title: t("st.sc.title"),
    score: unit === "points" ? t("st.sc.points") : t("st.sc.right"),
    percent: t("st.sc.percent"),
    passed: t("st.sc.passed"),
    below: t("st.sc.below"),
    sections: t("st.sc.sections"),
    sectionScore: t("st.sc.sectionScore"),
    reviewMissed: t("st.sc.reviewMissed"),
    tryAgain: t("st.sc.tryAgain"),
  };
}

export function quizLabels(t: StudyT): AdaptiveQuizLabels {
  return {
    position: t("st.qz.position"),
    check: t("st.qz.check"),
    next: t("st.qz.next"),
    pickFirst: t("st.qz.pickFirst"),
    right: t("st.qz.right"),
    notQuite: t("st.qz.notQuite"),
    answerMark: t("st.qz.answerMark"),
    scoreCard: scoreLabels(t, "right"),
  };
}

export function testLabels(t: StudyT): TestRunnerLabels {
  return {
    pick: t("st.ts.pick"),
    question: t("st.ts.question"),
    points: t("st.ts.points"),
    yourAnswer: t("st.ts.yourAnswer"),
    part: t("st.ts.part"),
    submit: t("st.ts.submit"),
    minutesLeft: t("st.ts.minutesLeft"),
    secondsLeft: t("st.ts.secondsLeft"),
    pause: t("st.ts.pause"),
    resume: t("st.ts.resume"),
    paused: t("st.ts.paused"),
    timeUp: t("st.ts.timeUp"),
    confirmTitle: t("st.ts.confirmTitle"),
    confirmOpen: t("st.ts.confirmOpen"),
    confirmAllAnswered: t("st.ts.confirmAllAnswered"),
    openItem: t("st.ts.openItem"),
    confirmSubmit: t("st.ts.confirmSubmit"),
    keepGoing: t("st.ts.keepGoing"),
    markTitle: t("st.ts.markTitle"),
    markIntro: t("st.ts.markIntro"),
    modelAnswer: t("st.ts.modelAnswer"),
    rubric: t("st.ts.rubric"),
    nothingWritten: t("st.ts.nothingWritten"),
    givePoints: t("st.ts.givePoints"),
    seeScore: t("st.ts.seeScore"),
    scoreCard: scoreLabels(t, "points"),
  };
}

/** "Flashcards" / "Quiz" / "Practice test". */
export const KIND_KEY: Record<StudyBlockType, MessageKey> = {
  flashcards: "st.kind.flashcards",
  quiz: "st.kind.quiz",
  test: "st.kind.test",
};

/** The icon each kind wears beside its word (never the icon alone). */
export const KIND_ICON = { flashcards: "card", quiz: "question", test: "checklist" } as const;

/** A count in words: the ".one" key for 1, the ".many" key (with {n}) otherwise. */
export function countKey(base: "st.row.cards" | "st.row.questions" | "st.due" | "st.new" | "st.today" | "st.review.sub" | "st.due.newOnly", n: number): MessageKey {
  return `${base}.${n === 1 ? "one" : "many"}` as MessageKey;
}
