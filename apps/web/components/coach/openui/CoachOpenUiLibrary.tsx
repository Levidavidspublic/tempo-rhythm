"use client";

import { action, createLibrary, defineAction, defineComponent, useTriggerAction } from "@openuidev/react-lang";
import { DecisionSteps } from "@tempo/ui/blocks/decision-steps";
import Link from "next/link";
import { createContext, useContext, useId } from "react";
import { z } from "zod/v4";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { type MessageKey, translate } from "@/lib/i18n";
import { useCountdown } from "@/lib/useCountdown";

/**
 * Tempo's OpenUI component library for coach cards (flag `openui`, lib/openui/coach-flag.ts).
 * Each component draws the same Tempo markup as the direct cards in ../ChatProposal.tsx
 * (tp-proposal, tp-change, DecisionSteps, tp-btn), so the cards look and behave the same and the
 * alpha scripts' selectors still match. Programs come from lib/openui/coach-program.ts.
 * Buttons fire OpenUI actions; OpenUiProposal.tsx turns them into the Convex mutations.
 */

/**
 * What the wrapper (OpenUiProposal.tsx) hands the cards: a mutation in flight, the last one failed,
 * which card this is, and the page language's strings.
 */
export type CoachCardRuntime = { busy: boolean; failed: boolean; decision: boolean; t: (key: MessageKey) => string };
export const CoachCardRuntimeContext = createContext<CoachCardRuntime>({
  busy: false,
  failed: false,
  decision: false,
  t: (key) => translate("en", key),
});

const status = z.enum(["pending", "accepted", "rejected", "undone"]);

const Accept = defineAction({ name: "Accept", description: "Make the proposed change.", params: z.object({}) });
const Save = defineAction({ name: "Save", description: "Add the decision's steps to today's page.", params: z.object({}) });
const Edit = defineAction({ name: "Edit", description: "Change the proposal before accepting it.", params: z.object({}) });
const Reject = defineAction({ name: "Reject", description: "Leave everything as it was.", params: z.object({}) });
const Undo = defineAction({ name: "Undo", description: "Take an accepted change back.", params: z.object({}) });

const KIND_ICON: Record<"task" | "note" | "template", TpIconName> = { task: "task", note: "page", template: "template" };

const TaskChange = defineComponent({
  name: "TaskChange",
  description: "One new task the coach proposes.",
  props: z.object({ title: z.string(), minutes: z.number() }),
  component: ({ props }) => {
    const { t } = useContext(CoachCardRuntimeContext);
    return (
      <ul className="tp-proposal__changes">
        <li className="tp-change" data-op="add" data-component="ChangePreview">
          <span className="tp-change__sign">
            <TpIcon name="plus" size="sm" />
            <span>{t("proposal.add")}</span>
          </span>
          <span className="tp-change__body">
            <span className="tp-change__title" dir="auto">
              {props.title}
            </span>
            <span className="tp-change__detail">
              {t("proposal.kind.task")} · <span className="tp-num">{props.minutes}</span> {t("proposal.min")}
            </span>
          </span>
        </li>
      </ul>
    );
  },
});

const PageChange = defineComponent({
  name: "PageChange",
  description: "A new page or template: its name, how it starts, and what it is used for.",
  props: z.object({
    name: z.string(),
    startsWith: z.string(),
    period: z.enum(["daily", "weekly", "none"]).optional(),
  }),
  component: ({ props }) => {
    const { t } = useContext(CoachCardRuntimeContext);
    return (
      <dl className="tp-proposal__what">
        <div className="tp-what-row">
          <dt>{t("proposal.name")}</dt>
          <dd>
            <span className="tp-change__title" dir="auto">
              {props.name}
            </span>
          </dd>
        </div>
        <div className="tp-what-row">
          <dt>{t("proposal.startsWith")}</dt>
          <dd dir="auto">{props.startsWith}</dd>
        </div>
        {props.period ? (
          <div className="tp-what-row">
            <dt>{t("proposal.field.period")}</dt>
            <dd>{t(`proposal.period.${props.period}`)}</dd>
          </div>
        ) : null}
      </dl>
    );
  },
});

const BUTTON: Record<"accept" | "save" | "edit" | "reject", { label: "proposal.accept" | "proposal.decision.save" | "proposal.edit" | "proposal.reject"; icon?: TpIconName; primary: boolean }> = {
  accept: { label: "proposal.accept", icon: "check", primary: true },
  save: { label: "proposal.decision.save", icon: "check", primary: true },
  edit: { label: "proposal.edit", icon: "edit", primary: false },
  reject: { label: "proposal.reject", primary: false },
};

const Button = defineComponent({
  name: "Button",
  description: "A card button that runs one action.",
  props: z.object({ id: z.enum(["accept", "save", "edit", "reject"]), act: action() }),
  component: ({ props }) => {
    const { t, busy } = useContext(CoachCardRuntimeContext);
    const trigger = useTriggerAction();
    const b = BUTTON[props.id];
    return (
      <button
        className={`tp-btn ${b.primary ? "tp-btn--secondary" : "tp-btn--ghost"}`}
        type="button"
        disabled={busy}
        onClick={() => void trigger(t(b.label), undefined, props.act)}
      >
        {b.icon ? <TpIcon name={b.icon} size="sm" /> : null}
        <span>{t(b.label)}</span>
      </button>
    );
  },
});

const Actions = defineComponent({
  name: "Actions",
  description: "The buttons of a pending card.",
  props: z.object({ buttons: z.array(Button.ref) }),
  component: ({ props, renderNode }) => <div className="tp-proposal__actions">{renderNode(props.buttons)}</div>,
});

const Outcome = defineComponent({
  name: "Outcome",
  description: "What happened to the card, a link to the result, and Undo while it lasts.",
  props: z.object({
    status: z.enum(["accepted", "rejected", "undone"]),
    undoUntilMs: z.number().optional(),
    href: z.string().optional(),
    undo: action(),
  }),
  component: ({ props }) => {
    const { t, busy, decision } = useContext(CoachCardRuntimeContext);
    const trigger = useTriggerAction();
    const left = useCountdown(props.status === "accepted" ? props.undoUntilMs : undefined);
    const note =
      props.status === "accepted"
        ? decision
          ? left
            ? t("proposal.decision.saved")
            : t("proposal.decision.kept")
          : left
            ? t("proposal.accepted")
            : t("proposal.kept")
        : props.status === "undone"
          ? t("proposal.undone")
          : t("proposal.rejected");
    return (
      <p className="tp-proposal__note">
        <TpIcon name={props.status === "accepted" ? "check" : "undo"} size="sm" />
        <span>{note}</span>
        {props.href ? (
          <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={props.href}>
            {t("proposal.open")}
          </Link>
        ) : null}
        {left ? (
          <button
            className="tp-btn tp-btn--ghost tp-btn--sm"
            type="button"
            disabled={busy}
            onClick={() => void trigger(t("proposal.undo"), undefined, props.undo)}
          >
            <TpIcon name="undo" size="sm" />
            <span>{t("proposal.undo")}</span>
            {/* The thread is a live region: the ticking time is visual only. */}
            <span className="tp-num tp-mono" aria-hidden="true">
              {left}
            </span>
          </button>
        ) : null}
      </p>
    );
  },
});

function FailedNote({ decision }: { decision: boolean }) {
  const { t, failed } = useContext(CoachCardRuntimeContext);
  return failed ? (
    <p className="tp-proposal__note" role="alert">
      {t(decision ? "proposal.decision.error" : "proposal.error")}
    </p>
  ) : null;
}

const ProposalCard = defineComponent({
  name: "ProposalCard",
  description: "A change the coach proposes: one task, page or template. Nothing changes until Accept.",
  props: z.object({
    kind: z.enum(["task", "note", "template"]),
    status,
    target: z.enum(["today", "tasks", "notes", "templates"]),
    change: z.union([TaskChange.ref, PageChange.ref]),
    footer: z.union([Actions.ref, Outcome.ref]),
  }),
  component: ({ props, renderNode }) => {
    const { t } = useContext(CoachCardRuntimeContext);
    const titleId = useId();
    const target =
      props.target === "today" ? t("proposal.target.today") : t(props.target === "tasks" ? "nav.tasks" : props.target === "notes" ? "nav.notes" : "nav.templates");
    return (
      <section
        className="tp-proposal"
        data-component="ProposalCard"
        data-kind={props.kind}
        data-status={props.status}
        data-renderer="openui"
        aria-labelledby={titleId}
      >
        <div className="tp-proposal__head">
          <span className="tp-proposal__kind">
            <TpIcon name={KIND_ICON[props.kind]} size="sm" />
            <span>{t(`proposal.kind.${props.kind}`)}</span>
          </span>
          <strong id={titleId}>{t(`proposal.title.${props.kind}`)}</strong>
          <span className="tp-proposal__target">{target}</span>
        </div>
        {renderNode(props.change)}
        {renderNode(props.footer)}
        <FailedNote decision={false} />
      </section>
    );
  },
});

const DecisionCard = defineComponent({
  name: "DecisionCard",
  description: "An order for things the person already has to do. Save adds the steps to today's page.",
  props: z.object({
    title: z.string().optional(),
    status,
    steps: z.array(z.object({ title: z.string(), minutes: z.number(), reason: z.string().optional() })),
    footer: z.union([Actions.ref, Outcome.ref]),
  }),
  component: ({ props, renderNode }) => {
    const { t } = useContext(CoachCardRuntimeContext);
    const titleId = useId();
    return (
      <section
        className="tp-proposal"
        data-component="DecisionCard"
        data-kind="decision"
        data-status={props.status}
        data-renderer="openui"
        aria-labelledby={titleId}
      >
        <div className="tp-proposal__head">
          <span className="tp-proposal__kind">
            <TpIcon name="sort" size="sm" />
            <span>{t("proposal.kind.decision")}</span>
          </span>
          <strong id={titleId} dir="auto">
            {props.title ?? t("proposal.title.decision")}
          </strong>
          <span className="tp-proposal__target">{t("proposal.target.today")}</span>
        </div>
        <DecisionSteps steps={props.steps} labels={{ list: t("proposal.decision.list"), minutes: t("proposal.min") }} />
        {renderNode(props.footer)}
        <FailedNote decision={true} />
      </section>
    );
  },
});

export const coachOpenUiLibrary = createLibrary({
  components: [ProposalCard, DecisionCard, TaskChange, PageChange, Actions, Button, Outcome],
  actions: [Accept, Save, Edit, Reject, Undo],
  root: "ProposalCard",
});

export type CoachCardAction = "Accept" | "Save" | "Edit" | "Reject" | "Undo";
