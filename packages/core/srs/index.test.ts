import { describe, expect, test } from "bun:test";
import * as core from "./index";

describe("study core index", () => {
  test("re-exports every module's public functions", () => {
    const names = [
      "newCardState",
      "reviewCard",
      "previewIntervals",
      "buildReviewQueue",
      "startSession",
      "answerCard",
      "sessionProgress",
      "startQuiz",
      "answerQuestion",
      "quizResult",
      "QUESTION_PLUGINS",
      "normalizeAnswer",
      "scoreTest",
      "outlineToFlashcards",
      "outlineToQuiz",
      "outlineToTest",
      "newBlockId",
      "itemIds",
    ];
    for (const name of names) expect(name in core).toBe(true);
  });
});
