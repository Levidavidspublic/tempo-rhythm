import { type ComponentRenderProps, JSONUIProvider, Renderer } from "@json-render/react";
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { BROKEN_BLOCK_MESSAGES } from "../blocks/block-spec";
import type { BrokenBlockCardProps, TaskBlockProps } from "../blocks/catalog";
import {
  BookOpen,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Edit,
  Leaf,
  Play,
  Refresh,
  Repeat,
  Target,
  Trash,
} from "../icons";
import { fillNodes, fillText } from "../study/shared";
import {
  cleanSteps,
  formatStepClock,
  GUIDED_LIMITS,
  GUIDED_STEP_STATUSES,
  type GuidedStep,
  type GuidedStepError,
  type GuidedStepKind,
  type GuidedStepStatus,
  groupSteps,
  guidedEditReducer,
  guidedStepSpecs,
  statusOf,
  summarizeGuidedPlan,
  validateGuidedPlan,
} from "./guided-plan";
import { useUndoCountdown } from "./useUndoCountdown";

/**
 * S9 GuidedPlanCard: a step plan as a proposal (HARD_RULES §1, §6.2). Grown from the coach's
 * decision card: the `.tp-proposal` look, each step drawn as a catalog `TaskBlock` through the
 * json-render bridge (display only, no checkbox binding), plus what a plan needs on top: when
 * each step happens, its kind, optional groups (weeks), an inline editor, and per-step status
 * once the plan is accepted.
 *
 * Presentational. Every word comes from `labels`; the host owns saving. Accept hands the host the
 * edited steps; Undo shows for as long as `undoUntilMs` lasts (5:00 from the host's save).
 * Status buttons appear only after Accept. Colour never carries meaning alone: kinds and statuses
 * are a word and an icon.
 */

export type GuidedPlanStatus = "pending" | "accepted" | "undone" | "rejected";

export type GuidedPlanLabels = {
  /** The kind chip in the head, e.g. "Plan". */
  kind: string;
  /** Where Accept puts the plan, e.g. "Adds to your calendar". */
  target?: string;
  /** "{steps} sessions on {days} days, {hours} h {minutes} min in all." */
  summary: string;
  /** Accessible name of the step list, e.g. "Plan steps". */
  list: string;
  /** "{n} min". */
  minutes: string;
  kinds: Record<GuidedStepKind, string>;
  statuses: Record<GuidedStepStatus, string>;
  /** Accessible name of a step's status buttons: "Status of {title}". */
  statusGroup: string;
  accept: string;
  accepting: string;
  edit: string;
  doneEditing: string;
  reject: string;
  undo: string;
  /** Screen-reader text for the countdown: "{time} left to undo". */
  undoLeft: string;
  /** While Undo is open. */
  accepted: string;
  /** After the Undo window. */
  kept: string;
  undone: string;
  rejected: string;
  /** Under the editor: how it works, and that nothing is saved yet. */
  editHint: string;
  /** "Name of step {n}". */
  nameField: string;
  /** "Minutes for step {n}". */
  minutesField: string;
  /** "Move {title} earlier". */
  moveUp: string;
  /** "Move {title} later". */
  moveDown: string;
  /** "Remove {title}". */
  remove: string;
  /** Per-step problems; `minutesRange` may use {min} and {max}. */
  errors: Record<GuidedStepError, string>;
  tooFew: string;
};

export type GuidedPlanCardProps = {
  title: string;
  steps: readonly GuidedStep[];
  labels: GuidedPlanLabels;
  status?: GuidedPlanStatus;
  /** True while the host saves or takes back. */
  busy?: boolean;
  /** Unix ms when Undo closes. Undo shows while it lies ahead. */
  undoUntilMs?: number;
  /** Step id → status. Missing ids read as To do. */
  stepStatuses?: Readonly<Record<string, GuidedStepStatus>>;
  /** A step's date in words; the default shows the `YYYY-MM-DD` as is. */
  formatDate?: (date: string) => string;
  /** Shown under the summary, e.g. the "three ways out" when the plan is short. */
  notice?: ReactNode;
  /** Shown under the actions, e.g. a sign-in prompt or a kind error. */
  message?: ReactNode;
  onAccept: (steps: GuidedStep[]) => void;
  onReject: () => void;
  onUndo?: () => void;
  onStepStatus?: (id: string, status: GuidedStepStatus) => void;
  /** Every local edit, for hosts that keep the edited preview. */
  onStepsChange?: (steps: GuidedStep[]) => void;
  /** Open with the editor showing (gallery, tests). */
  initialEditing?: boolean;
};

const KIND_ICON: Record<GuidedStepKind, typeof BookOpen> = {
  learn: BookOpen,
  review: Repeat,
  practice: Target,
  rest: Leaf,
  task: CheckSquare,
};

const STATUS_ICON: Record<GuidedStepStatus, typeof Check> = {
  todo: Clock,
  doing: Play,
  done: Check,
};

/* ------------------------------------------------------------------ */
/* json-render: each step body is a catalog TaskBlock                  */
/* ------------------------------------------------------------------ */

const MinutesContext = createContext("{n} min");

function TaskStep({ element }: ComponentRenderProps<TaskBlockProps>) {
  const { title, durationMin, status } = element.props;
  const minutes = useContext(MinutesContext);
  return (
    <div className="tp-task-row__body" data-done={status === "done"}>
      <span className="tp-task-row__title" dir="auto">
        {title}
      </span>
      <span className="tp-task-row__meta">
        <span>{fillNodes(minutes, { n: durationMin })}</span>
      </span>
    </div>
  );
}

function BrokenStep({ element }: ComponentRenderProps<BrokenBlockCardProps>) {
  return (
    <p className="tp-muted" data-component="BrokenBlock" role="note">
      {element.props.message}
    </p>
  );
}

/** Only the two components a plan step can become. Anything else falls back to the calm card. */
const GUIDED_REGISTRY = { TaskBlock: TaskStep, BrokenBlockCard: BrokenStep };

function Fallback() {
  return (
    <p className="tp-muted" data-component="BrokenBlock" role="note">
      {BROKEN_BLOCK_MESSAGES.invalid_spec}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

export function GuidedPlanCard({
  title,
  steps: initialSteps,
  labels,
  status = "pending",
  busy = false,
  undoUntilMs,
  stepStatuses,
  formatDate = (date) => date,
  notice,
  message,
  onAccept,
  onReject,
  onUndo,
  onStepStatus,
  onStepsChange,
  initialEditing = false,
}: GuidedPlanCardProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const rootRef = useRef<HTMLElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const [steps, dispatch] = useReducer(guidedEditReducer, initialSteps, (s) =>
    guidedEditReducer(s, { type: "reset", steps: s })
  );
  const [editorOpen, setEditing] = useState(initialEditing);
  // The editor belongs to the proposal: once it is accepted, undone or set aside, it closes.
  const editing = editorOpen && status === "pending";
  const [focusAfterMove, setFocusAfterMove] = useState<string | null>(null);
  const left = useUndoCountdown(status === "accepted" ? undoUntilMs : undefined);

  const validation = useMemo(() => validateGuidedPlan(steps), [steps]);
  const summary = useMemo(() => summarizeGuidedPlan(steps), [steps]);
  const specs = useMemo(() => guidedStepSpecs(steps, stepStatuses), [steps, stepStatuses]);
  const groups = useMemo(() => groupSteps(steps), [steps]);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    onStepsChange?.(steps);
  }, [steps, onStepsChange]);

  // A moved step can land in another group's list; keep the keyboard on it.
  useEffect(() => {
    if (!focusAfterMove) return;
    const row = rootRef.current?.querySelector<HTMLElement>(
      `[data-step-id="${CSS.escape(focusAfterMove)}"] [data-field="title"]`
    );
    row?.focus();
    setFocusAfterMove(null);
  }, [focusAfterMove]);

  const move = (id: string, by: -1 | 1) => {
    dispatch({ type: "move", id, by });
    setFocusAfterMove(id);
  };

  const closeEditor = () => {
    setEditing(false);
    // Back to the button that opened it, once it is drawn again.
    window.setTimeout(() => editButtonRef.current?.focus(), 0);
  };

  const onRowKey = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      move(id, event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
    }
  };

  const indexOf = new Map(steps.map((s, i) => [s.id, i]));
  const showSteps = status === "pending" || status === "accepted";
  const errorText = (error: GuidedStepError) =>
    fillText(labels.errors[error], {
      min: GUIDED_LIMITS.minMinutes,
      max: GUIDED_LIMITS.maxMinutes,
    });

  const renderRow = (step: GuidedStep) => {
    const index = indexOf.get(step.id) ?? 0;
    const n = index + 1;
    const stepStatus = statusOf(stepStatuses, step.id);
    const KindIcon = KIND_ICON[step.kind];
    const StatusIcon = STATUS_ICON[stepStatus];
    const error = validation.errors[step.id];
    const errorId = `${baseId}-err-${step.id}`;
    const when =
      step.date !== undefined ? (
        <span className="tp-guided__when">
          <span className="tp-num">{formatDate(step.date)}</span>
          {step.startMinute !== undefined ? (
            <span className="tp-num tp-mono tp-ltr">{formatStepClock(step.startMinute)}</span>
          ) : null}
        </span>
      ) : null;
    const kind = (
      <span className="tp-guided__kind" data-kind={step.kind}>
        <KindIcon className="tp-icon" size={16} />
        <span>{labels.kinds[step.kind]}</span>
      </span>
    );

    if (editing) {
      return (
        <li
          className="tp-guided__step"
          data-step-id={step.id}
          data-kind={step.kind}
          data-editing="true"
          key={step.id}
          onKeyDown={(event) => onRowKey(event, step.id)}
        >
          <span className="tp-guided__n tp-num" aria-hidden="true">
            {n}
          </span>
          <div className="tp-guided__body">
            <div className="tp-guided__fields">
              <label className="tp-field tp-guided__name">
                <span className="tp-sr-only">{fillText(labels.nameField, { n })}</span>
                <input
                  className="tp-input"
                  data-field="title"
                  dir="auto"
                  maxLength={GUIDED_LIMITS.maxTitle + 20}
                  value={step.title}
                  aria-invalid={error === "titleEmpty" || error === "titleLong" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) =>
                    dispatch({ type: "rename", id: step.id, title: event.target.value })
                  }
                />
              </label>
              <label className="tp-field tp-guided__minutes">
                <span className="tp-sr-only">{fillText(labels.minutesField, { n })}</span>
                <input
                  className="tp-input tp-num"
                  data-field="minutes"
                  type="number"
                  inputMode="numeric"
                  min={GUIDED_LIMITS.minMinutes}
                  max={GUIDED_LIMITS.maxMinutes}
                  step={1}
                  value={Number.isFinite(step.minutes) ? step.minutes : ""}
                  aria-invalid={error === "minutesRange" || undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) =>
                    dispatch({
                      type: "setMinutes",
                      id: step.id,
                      minutes:
                        event.target.value.trim() === "" ? Number.NaN : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <span className="tp-guided__meta">
              {when}
              {kind}
            </span>
            {error ? (
              <span className="tp-error-text" id={errorId}>
                {errorText(error)}
              </span>
            ) : null}
          </div>
          <div className="tp-guided__tools">
            <button
              className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
              type="button"
              data-action="guided-move-up"
              aria-label={fillText(labels.moveUp, { title: step.title.trim() || n })}
              disabled={index === 0}
              onClick={() => move(step.id, -1)}
            >
              <ChevronDown className="tp-icon tp-guided__up" size={16} />
            </button>
            <button
              className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
              type="button"
              data-action="guided-move-down"
              aria-label={fillText(labels.moveDown, { title: step.title.trim() || n })}
              disabled={index === steps.length - 1}
              onClick={() => move(step.id, 1)}
            >
              <ChevronDown className="tp-icon" size={16} />
            </button>
            <button
              className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon"
              type="button"
              data-action="guided-remove"
              aria-label={fillText(labels.remove, { title: step.title.trim() || n })}
              disabled={steps.length <= GUIDED_LIMITS.minSteps}
              onClick={() => dispatch({ type: "remove", id: step.id })}
            >
              <Trash className="tp-icon" size={16} />
            </button>
          </div>
        </li>
      );
    }

    const spec = specs[index];
    return (
      <li
        className="tp-guided__step"
        data-step-id={step.id}
        data-kind={step.kind}
        data-status={stepStatus}
        key={step.id}
      >
        <span className="tp-guided__n tp-num" aria-hidden="true">
          {n}
        </span>
        <div className="tp-guided__body">
          {spec ? <Renderer spec={spec} registry={GUIDED_REGISTRY} fallback={Fallback} /> : null}
          <span className="tp-guided__meta">
            {when}
            {kind}
          </span>
        </div>
        {status === "accepted" && onStepStatus ? (
          <fieldset className="tp-guided__statuses" data-component="StepStatus">
            <legend className="tp-sr-only">
              {fillText(labels.statusGroup, { title: step.title })}
            </legend>
            {GUIDED_STEP_STATUSES.map((value) => {
              const Icon = STATUS_ICON[value];
              return (
                <button
                  key={value}
                  className="tp-btn tp-btn--ghost tp-btn--sm tp-guided__status-btn"
                  type="button"
                  data-action="guided-status"
                  data-value={value}
                  aria-pressed={stepStatus === value}
                  onClick={() => onStepStatus(step.id, value)}
                >
                  <Icon className="tp-icon" size={16} />
                  <span>{labels.statuses[value]}</span>
                </button>
              );
            })}
          </fieldset>
        ) : (
          <span className="tp-guided__status" data-status={stepStatus}>
            <StatusIcon className="tp-icon" size={16} />
            <span>{labels.statuses[stepStatus]}</span>
          </span>
        )}
      </li>
    );
  };

  return (
    <section
      ref={rootRef}
      className="tp-proposal tp-guided"
      data-component="GuidedPlanCard"
      data-kind="plan"
      data-state={status}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
    >
      <div className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <Calendar className="tp-icon" size={16} />
          <span>{labels.kind}</span>
        </span>
        <strong id={titleId} dir="auto">
          {title}
        </strong>
        {labels.target ? <span className="tp-proposal__target">{labels.target}</span> : null}
      </div>

      {showSteps ? (
        <>
          <p className="tp-guided__summary" aria-live="polite">
            {fillNodes(labels.summary, {
              steps: summary.steps,
              days: summary.days,
              hours: summary.hours,
              minutes: summary.minutes,
            })}
          </p>
          {notice ? <div className="tp-guided__notice">{notice}</div> : null}
          <MinutesContext.Provider value={labels.minutes}>
            <JSONUIProvider registry={GUIDED_REGISTRY}>
              <div className="tp-guided__groups">
                {groups.map((group) => {
                  const first = indexOf.get(group.steps[0]?.id ?? "") ?? 0;
                  const headingId = `${baseId}-g-${group.id || "all"}`;
                  return (
                    <section
                      className="tp-guided__group"
                      key={group.id || "all"}
                      data-group={group.id || undefined}
                      aria-labelledby={group.label ? headingId : undefined}
                    >
                      {group.label ? (
                        <h3 className="tp-guided__group-title" id={headingId}>
                          {group.label}
                        </h3>
                      ) : null}
                      <ol
                        className="tp-guided__steps"
                        start={first + 1}
                        aria-label={group.label ?? labels.list}
                      >
                        {group.steps.map(renderRow)}
                      </ol>
                    </section>
                  );
                })}
              </div>
            </JSONUIProvider>
          </MinutesContext.Provider>
          {editing ? (
            <p className="tp-help tp-guided__hint">
              {labels.editHint}
              {validation.tooFew ? <span role="alert"> {labels.tooFew}</span> : null}
            </p>
          ) : null}
        </>
      ) : null}

      {status === "pending" ? (
        <div className="tp-proposal__actions tp-guided__actions">
          <button
            className="tp-btn tp-btn--primary"
            type="button"
            data-action="guided-accept"
            disabled={busy || !validation.ok}
            aria-busy={busy || undefined}
            onClick={() => onAccept(cleanSteps(steps))}
          >
            <Check className="tp-icon" size={16} />
            <span>{busy ? labels.accepting : labels.accept}</span>
          </button>
          {editing ? (
            <button
              className="tp-btn tp-btn--secondary"
              type="button"
              data-action="guided-done-editing"
              disabled={busy}
              onClick={closeEditor}
            >
              <Check className="tp-icon" size={16} />
              <span>{labels.doneEditing}</span>
            </button>
          ) : (
            <button
              ref={editButtonRef}
              className="tp-btn tp-btn--secondary"
              type="button"
              data-action="guided-edit"
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              <Edit className="tp-icon" size={16} />
              <span>{labels.edit}</span>
            </button>
          )}
          <button
            className="tp-btn tp-btn--ghost"
            type="button"
            data-action="guided-reject"
            disabled={busy}
            onClick={onReject}
          >
            <span>{labels.reject}</span>
          </button>
        </div>
      ) : (
        // The words are the live region, so each state is read once. Undo and its ticking time sit
        // beside it, outside: inside, the whole note was read again every second for 5 minutes.
        <div className="tp-guided__noterow">
          <output className="tp-proposal__note tp-guided__note">
            {status === "accepted" ? (
              <Check className="tp-icon" size={16} />
            ) : (
              <Refresh className="tp-icon" size={16} />
            )}
            <span>
              {status === "accepted"
                ? left
                  ? labels.accepted
                  : labels.kept
                : status === "undone"
                  ? labels.undone
                  : labels.rejected}
            </span>
          </output>
          {left && onUndo ? (
            <button
              className="tp-btn tp-btn--secondary tp-btn--sm"
              type="button"
              data-action="guided-undo"
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={onUndo}
            >
              <Refresh className="tp-icon" size={16} />
              <span>{labels.undo}</span>
              <span className="tp-sr-only">{fillText(labels.undoLeft, { time: left })}</span>
              <span className="tp-num tp-mono" aria-hidden="true">
                {left}
              </span>
            </button>
          ) : null}
        </div>
      )}
      {message ? <div className="tp-guided__message">{message}</div> : null}
    </section>
  );
}
