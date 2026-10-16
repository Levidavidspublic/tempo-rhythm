import type { QuizQuestion, TestData } from "@tempo/utils";
import type { AdaptiveQuizLabels } from "./AdaptiveQuiz";
import type { FlashcardDeckLabels } from "./FlashcardDeck";
import type { FlashcardReviewLabels } from "./FlashcardReview";
import type { ScoreCardLabels } from "./ScoreCard";
import type { TestRunnerLabels } from "./TestRunner";
import type { RecallLabels } from "./TypedRecall";

/** Synthetic English labels and data for the study component tests. */

export const scoreLabels: ScoreCardLabels = {
  title: "Your score",
  score: "{score} of {max} points",
  percent: "{percent}%",
  passed: "At or above the pass mark of {passMark}%.",
  below: "Below the pass mark of {passMark}% this time.",
  sections: "By section",
  sectionScore: "{score} of {max}",
  reviewMissed: "Review the ones you missed",
  tryAgain: "Try again",
};

export const recallLabels: RecallLabels = {
  yourAnswer: "Your answer",
  check: "Check",
  matches: "Matches",
  close: "Close",
  different: "Different",
  empty: "No answer typed",
};

export const deckLabels: FlashcardDeckLabels = {
  deck: "Flashcard",
  front: "Front",
  back: "Back",
  hint: "Hint:",
  position: "{current} of {total}",
  showBack: "Show back",
  showFront: "Show front",
  previous: "Previous",
  next: "Next",
  shuffle: "Shuffle",
  keys: "Space flips. Arrows move.",
  recall: recallLabels,
  typedKeys: "Enter checks. Escape clears.",
};

export const reviewLabels: FlashcardReviewLabels = {
  card: "Card to review",
  front: "Front",
  back: "Back",
  hint: "Hint:",
  showAnswer: "Show answer",
  progress: "{done} done, {left} to go",
  gradeGroup: "How well did you know it?",
  grades: { again: "Again", hard: "Hard", good: "Good", easy: "Easy" },
  intervalOne: "{days} day",
  intervalMany: "{days} days",
  undo: "Undo",
  doneTitle: "All done for now",
  doneBody: "You reviewed {count} cards.",
  keys: "Space shows the answer. 1 to 4 grade it.",
  recall: recallLabels,
  suggested: "Suggested",
  typedKeys: "Enter checks. Escape clears. Then 1 to 4 grade it.",
};

export const quizLabels: AdaptiveQuizLabels = {
  position: "Question {current}",
  check: "Check",
  next: "Next",
  pickFirst: "Pick an answer to check it.",
  right: "Right.",
  notQuite: "Not quite. The answer is: {answer}",
  answerMark: "Answer",
  scoreCard: { ...scoreLabels, score: "{score} of {max} right" },
};

export const testLabels: TestRunnerLabels = {
  pick: "Answer {pick} of these {total}.",
  question: "Question {number}",
  points: "{points} points",
  yourAnswer: "Your answer",
  part: "Part {label}",
  submit: "Submit",
  minutesLeft: "{minutes} min left",
  secondsLeft: "{seconds} s left",
  pause: "Pause",
  resume: "Resume",
  paused: "Paused",
  timeUp: "Time is up. Submit when you're ready.",
  confirmTitle: "Submit your answers?",
  confirmOpen: "These are still open:",
  confirmAllAnswered: "Every question has an answer.",
  openItem: "{section}, question {number}",
  confirmSubmit: "Submit",
  keepGoing: "Keep going",
  markTitle: "Mark your written answers",
  markIntro: "Compare each part with the model answer and give yourself points.",
  modelAnswer: "Model answer",
  rubric: "Rubric",
  nothingWritten: "Nothing written.",
  givePoints: "Your points (0 to {max})",
  seeScore: "See my score",
  scoreCard: scoreLabels,
};

export const quizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "What makes ATP?",
    choices: [
      { id: "a", text: "Mitochondria" },
      { id: "b", text: "Ribosome" },
    ],
    answerId: "a",
    explanation: "Mitochondria run cellular respiration.",
    difficulty: 1,
  },
  {
    id: "q2",
    prompt: "Where is DNA kept?",
    choices: [
      { id: "a", text: "Nucleus" },
      { id: "b", text: "Membrane" },
    ],
    answerId: "a",
    difficulty: 2,
  },
];

/** Section A: pick 2 of 3 (mcq 10, short 10, mcq 10). Section B: one Bagrut question (5 + 15). */
export const practiceTest: TestData = {
  title: "Biology practice paper",
  style: "bagrut",
  durationMin: 2,
  sections: [
    {
      id: "A",
      title: "Section A",
      instructions: "Short questions.",
      pick: 2,
      questions: [
        {
          plugin: "mcq",
          id: "a1",
          prompt: "Which organelle makes ATP?",
          points: 10,
          choices: [
            { id: "x", text: "Mitochondria" },
            { id: "y", text: "Nucleus" },
          ],
          answerId: "x",
        },
        {
          plugin: "short",
          id: "a2",
          prompt: "Name the cell's control centre.",
          points: 10,
          accepted: ["nucleus", "גרעין"],
        },
        {
          plugin: "mcq",
          id: "a3",
          prompt: "Which builds proteins?",
          points: 10,
          choices: [
            { id: "x", text: "Ribosome" },
            { id: "y", text: "Vacuole" },
          ],
          answerId: "x",
        },
      ],
    },
    {
      id: "B",
      title: "Section B",
      questions: [
        {
          plugin: "bagrut",
          id: "b1",
          stem: "Describe the cell membrane.",
          parts: [
            {
              id: "p1",
              label: "א",
              prompt: "What is it made of?",
              points: 5,
              modelAnswer: "A phospholipid bilayer.",
              rubric: "5 for bilayer, 2 for lipids only.",
            },
            { id: "p2", label: "ב", prompt: "What does it do?", points: 15 },
          ],
        },
      ],
    },
  ],
  origin: "user",
};
