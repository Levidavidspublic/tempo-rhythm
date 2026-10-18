import { Check, Info } from "../icons";
import { fillNodes } from "./shared";

/**
 * S22 ScoreCard: the end of a quiz or a practice test. Score, percent, pass or below the pass mark
 * in words (with an icon, never colour alone), a per-section breakdown, "Review the ones you
 * missed" and "Try again". Warm and plain: no points-as-pressure, no ranking.
 */

export type ScoreCardLabels = {
  /** Heading, e.g. "Your score". */
  title: string;
  /** e.g. "{score} of {max} points" or "{score} of {max} right". */
  score: string;
  /** e.g. "{percent}%". */
  percent: string;
  /** e.g. "At or above the pass mark of {passMark}%." */
  passed: string;
  /** e.g. "Below the pass mark of {passMark}% this time." */
  below: string;
  /** Heading over the section list, e.g. "By section". */
  sections: string;
  /** One section's line, e.g. "{score} of {max}". */
  sectionScore: string;
  reviewMissed: string;
  tryAgain: string;
};

export type ScoreCardSection = { title: string; score: number; max: number };

export type ScoreCardProps = {
  score: number;
  max: number;
  percent: number;
  /** Shown only when set. `passed` says which side of it the score is. */
  passMark?: number;
  passed?: boolean;
  sections?: readonly ScoreCardSection[];
  /** How many items were missed; "Review the ones you missed" shows only when above 0. */
  missedCount?: number;
  onReviewMissed?: () => void;
  onTryAgain?: () => void;
  labels: ScoreCardLabels;
};

export function ScoreCard({
  score,
  max,
  percent,
  passMark,
  passed,
  sections,
  missedCount = 0,
  onReviewMissed,
  onTryAgain,
  labels,
}: ScoreCardProps) {
  const showPass = passMark !== undefined && passed !== undefined;
  return (
    <section className="tp-artifact tp-study-score" data-component="ScoreCard">
      <header className="tp-artifact__head">
        <h2 className="tp-artifact__title">{labels.title}</h2>
      </header>
      <div className="tp-artifact__body">
        <p className="tp-study-score__total">{fillNodes(labels.score, { score, max })}</p>
        <p className="tp-study-score__percent">{fillNodes(labels.percent, { percent })}</p>
        {showPass ? (
          <p className="tp-study-score__pass" data-result={passed ? "passed" : "below"}>
            {passed ? <Check className="tp-icon" /> : <Info className="tp-icon" />}
            <span>{fillNodes(passed ? labels.passed : labels.below, { passMark })}</span>
          </p>
        ) : null}
        {sections && sections.length > 0 ? (
          <div className="tp-study-score__sections">
            <h3 className="tp-label">{labels.sections}</h3>
            <ul className="tp-study-score__list">
              {sections.map((section, index) => (
                <li className="tp-study-score__row" key={`${index}-${section.title}`}>
                  <span dir="auto">{section.title}</span>
                  <span>
                    {fillNodes(labels.sectionScore, { score: section.score, max: section.max })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {(missedCount > 0 && onReviewMissed) || onTryAgain ? (
        <footer className="tp-artifact__foot">
          {missedCount > 0 && onReviewMissed ? (
            <button
              type="button"
              className="tp-btn tp-btn--secondary"
              data-action="score-review-missed"
              onClick={onReviewMissed}
            >
              {labels.reviewMissed}
            </button>
          ) : null}
          {onTryAgain ? (
            <button
              type="button"
              className="tp-btn tp-btn--primary"
              data-action="score-try-again"
              onClick={onTryAgain}
            >
              {labels.tryAgain}
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
