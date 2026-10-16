import { Pause, Volume } from "../icons";

/**
 * ReadAloudButton (kitchen T4, components.md §2.10): a toggle that reads a piece of text aloud.
 * `.tp-btn.tp-btn--ghost.tp-btn--sm.tp-readaloud[aria-pressed]` with `[data-label]`; the volume
 * icon swaps to pause while it reads, and the word switches "Read aloud" / "Stop reading", so the
 * state never rests on the icon alone.
 *
 * Presentational: the host owns the speech engine (see apps/web/components/study/recap) and
 * passes whether this text is the one being read, plus every word.
 */

export type ReadAloudLabels = {
  /** e.g. "Read aloud". */
  read: string;
  /** e.g. "Stop reading". */
  stop: string;
};

export type ReadAloudButtonProps = {
  text: string;
  /** True while this text is being read. */
  pressed: boolean;
  onToggle: (text: string) => void;
  labels: ReadAloudLabels;
  disabled?: boolean;
};

export function ReadAloudButton({ text, pressed, onToggle, labels, disabled }: ReadAloudButtonProps) {
  const label = pressed ? labels.stop : labels.read;
  return (
    <button
      type="button"
      className="tp-btn tp-btn--ghost tp-btn--sm tp-readaloud"
      data-component="ReadAloudButton"
      data-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onToggle(text)}
    >
      {pressed ? <Pause className="tp-icon" /> : <Volume className="tp-icon" />}
      <span>{label}</span>
    </button>
  );
}
