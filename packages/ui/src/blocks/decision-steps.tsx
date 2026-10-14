import { type ComponentRenderProps, JSONUIProvider, Renderer } from "@json-render/react";
import { createContext, type ReactNode, useContext } from "react";
import { BROKEN_BLOCK_MESSAGES, type TempoBlockSpec, tempoBlockToSpec } from "./block-spec";
import type { BrokenBlockCardProps, TaskBlockProps } from "./catalog";

/**
 * The coach's decision card (weekend alpha run, L5): "what order should I do these in?" answered
 * as an ordered list of steps. Each step is drawn as the catalog's existing `TaskBlock` through
 * json-render, so the card shows exactly what saving it would add to today's page.
 *
 * Display only. Steps go through `tempoBlockToSpec` (the codec-checked bridge) with
 * `interactive: false`, so no checkbox is bound and no action can fire from the card. Anything
 * the bridge can't prove valid draws as the calm `BrokenBlockCard`. This module never writes:
 * saving belongs to the host, through the coach's Accept and its 5-minute Undo.
 *
 * The shared block registry is ticket TEMPO-B06-03 (#789). This is a narrow, read-only registry
 * for the decision card only; it can move onto #789's registry once that lands.
 */

/** One step of a decision, as the coach proposes it. */
export type DecisionStep = {
  title: string;
  minutes: number;
  reason?: string;
};

/** A decision orders at least 2 and at most 7 steps. */
export const DECISION_LIMITS = { minSteps: 2, maxSteps: 7 } as const;

/** Never rendered and never stored: the bridge needs a valid envelope id to check a block. */
const DISPLAY_ONLY_BLOCK_ID = "blk_00000000000000000000000000";

/** The task block a step becomes: the first step is "now", the rest "later", in order. */
export function decisionStepBlock(step: DecisionStep, index: number) {
  return {
    type: "task" as const,
    id: DISPLAY_ONLY_BLOCK_ID,
    v: 1 as const,
    data: {
      title: step.title,
      durationMin: step.minutes,
      status: index === 0 ? ("now" as const) : ("later" as const),
      order: index,
      inelastic: false,
      ...(step.reason ? { reason: step.reason } : {}),
    },
  };
}

/** One display-only json-render spec per step, at most `DECISION_LIMITS.maxSteps`. */
export function decisionStepSpecs(steps: readonly DecisionStep[]): TempoBlockSpec[] {
  return steps
    .slice(0, DECISION_LIMITS.maxSteps)
    .map((step, index) => tempoBlockToSpec(decisionStepBlock(step, index), { interactive: false }));
}

/** True when every step passes the task block checks and the count is in range. */
export function isValidDecision(steps: readonly DecisionStep[]): boolean {
  if (steps.length < DECISION_LIMITS.minSteps || steps.length > DECISION_LIMITS.maxSteps)
    return false;
  return decisionStepSpecs(steps).every((spec) => {
    const element = spec.elements[spec.root];
    return element?.type === "TaskBlock";
  });
}

export type DecisionStepsLabels = {
  /** Accessible name of the ordered list, e.g. "Suggested order". */
  list: string;
  /** Unit after the minutes, e.g. "min". */
  minutes: string;
};

const LabelsContext = createContext<DecisionStepsLabels>({ list: "", minutes: "min" });

function TaskStep({ element }: ComponentRenderProps<TaskBlockProps>) {
  const { title, durationMin, reason } = element.props;
  const labels = useContext(LabelsContext);
  return (
    <div className="tp-task-row__body">
      <span className="tp-task-row__title" dir="auto">
        {title}
      </span>
      <span className="tp-task-row__meta">
        <span>
          <span className="tp-num">{durationMin}</span> {labels.minutes}
        </span>
        {reason ? <span dir="auto">{reason}</span> : null}
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

/** Only the two components a decision step can become. Anything else falls back to the calm card. */
const DECISION_REGISTRY = { TaskBlock: TaskStep, BrokenBlockCard: BrokenStep };

function Fallback() {
  return (
    <p className="tp-muted" data-component="BrokenBlock" role="note">
      {BROKEN_BLOCK_MESSAGES.invalid_spec}
    </p>
  );
}

/**
 * The ordered steps of a decision, each drawn as a catalog `TaskBlock` through json-render.
 * Steps past `DECISION_LIMITS.maxSteps` are not drawn.
 */
export function DecisionSteps({
  steps,
  labels,
}: {
  steps: readonly DecisionStep[];
  labels: DecisionStepsLabels;
}): ReactNode {
  const specs = decisionStepSpecs(steps);
  return (
    <LabelsContext.Provider value={labels}>
      <JSONUIProvider registry={DECISION_REGISTRY}>
        <ol className="tp-block-task" data-component="DecisionSteps" aria-label={labels.list}>
          {specs.map((spec, index) => (
            // Steps have no ids of their own; their order is the identity.
            // Each <li> is the row, so only the last step drops its divider (.tp-task-row:last-child).
            <li key={index} className="tp-task-row" data-component="TaskRow" data-done="false">
              <span className="tp-num tp-muted" aria-hidden="true">
                {index + 1}
              </span>
              <Renderer spec={spec} registry={DECISION_REGISTRY} fallback={Fallback} />
              <span />
            </li>
          ))}
        </ol>
      </JSONUIProvider>
    </LabelsContext.Provider>
  );
}
