import type { KeyboardEvent, Ref } from "react";
import type { RecallResult } from "../../../core/srs/recall";
import { Check, Edit, Info, Type } from "../icons";

/**
 * Typed recall (kitchen T3): the pieces FlashcardReview and FlashcardDeck share when the person
 * types what they remember before the card turns over. RecallField is the labelled answer field;
 * RecallVerdict shows what was typed and how it compares with the back, as an icon and a word
 * (never colour alone). The comparison itself is `compareRecall` in packages/core/srs/recall.ts.
 * Hook-free, so the views stay plain functions.
 */

export type RecallLabels = {
  /** Label of the answer field, and of the typed answer after Check, e.g. "Your answer". */
  yourAnswer: string;
  /** The button that turns the card over and compares, e.g. "Check". */
  check: string;
  matches: string;
  close: string;
  different: string;
  /** After Check with nothing typed, e.g. "No answer typed". Not an error. */
  empty: string;
};

export type RecallKeyAction = "check" | "clear";

/** What a key in the answer field asks for: Enter checks; Escape clears, when there is text. */
export function recallKeyAction(
  key: string,
  value: string,
  composing = false
): RecallKeyAction | null {
  if (composing) return null;
  if (key === "Enter") return "check";
  if ((key === "Escape" || key === "Esc") && value !== "") return "clear";
  return null;
}

type RecallKeyEvent = {
  key: string;
  preventDefault: () => void;
  nativeEvent?: { isComposing?: boolean };
};

/** The answer field's keydown handler. Returns the action it took, so a host can move focus. */
export function recallKeyDown(value: string, act: (action: RecallKeyAction) => void) {
  return (event: RecallKeyEvent): RecallKeyAction | null => {
    const action = recallKeyAction(event.key, value, event.nativeEvent?.isComposing === true);
    if (!action) return null;
    event.preventDefault();
    act(action);
    return action;
  };
}

export type RecallFieldProps = {
  value: string;
  labels: RecallLabels;
  onChange: (text: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
};

/** The labelled answer field. The label wraps the input, so no id is needed. */
export function RecallField({ value, labels, onChange, onKeyDown, inputRef }: RecallFieldProps) {
  return (
    <label className="tp-field tp-study-recall__field">
      <span className="tp-label">{labels.yourAnswer}</span>
      <input
        ref={inputRef}
        className="tp-input"
        type="text"
        dir="auto"
        data-action="recall-input"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
    </label>
  );
}

const VERDICT_ICON = { matches: Check, close: Edit, different: Info, empty: Type } as const;

export type RecallVerdictProps = {
  /** What the person typed. */
  typed: string;
  result: RecallResult;
  labels: RecallLabels;
};

/** The typed answer (when there is one) and the comparison in words. */
export function RecallVerdict({ typed, result, labels }: RecallVerdictProps) {
  const Icon = VERDICT_ICON[result];
  return (
    <div className="tp-study-recall" data-component="RecallVerdict" data-result={result}>
      {result === "empty" ? null : (
        <p className="tp-study-recall__given">
          <span className="tp-study-recall__label">{labels.yourAnswer}</span>{" "}
          <span dir="auto">{typed.trim()}</span>
        </p>
      )}
      <p className="tp-study-recall__verdict">
        <Icon className="tp-icon" />
        <span>{labels[result]}</span>
      </p>
    </div>
  );
}
