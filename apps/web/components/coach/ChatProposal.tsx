"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

export type ChatProposalData =
  | { kind: "task"; title: string; minutes: number; when: "today" | "later" }
  | { kind: "note"; title: string; body: string }
  | { kind: "template"; name: string; body: string; period: "daily" | "weekly" | "none" };

export type ChatProposalState = ChatProposalData & {
  status: "pending" | "accepted" | "rejected" | "undone";
  createdId?: string;
  undoUntilMs?: number;
};

/** The proposal stored on a coach reply (`toolCalls.coachProposal`), or null. */
export function proposalOf(toolCalls: unknown): ChatProposalState | null {
  if (!toolCalls || typeof toolCalls !== "object") return null;
  const raw = (toolCalls as { coachProposal?: unknown }).coachProposal;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as ChatProposalState;
  const known = p.kind === "task" || p.kind === "note" || p.kind === "template";
  return known && typeof p.status === "string" ? p : null;
}

const KIND_ICON: Record<ChatProposalData["kind"], TpIconName> = { task: "task", note: "page", template: "template" };

/** The first line of a body, as plain words. */
function firstLine(body: string): string {
  const line = body.split("\n").find((l) => l.trim()) ?? "";
  return line.replace(/^\s*(#{1,6}\s|[-*+]\s(\[[ xX]\]\s)?|\d+[.)]\s|>\s?)/, "").trim().slice(0, 120);
}

/** m:ss until `untilMs`, counting down each second while it lasts. */
function useCountdown(untilMs: number | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  const live = untilMs !== undefined && now < untilMs;
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);
  if (!live || untilMs === undefined) return null;
  const s = Math.ceil((untilMs - now) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * ProposalCard (coach-thread.html): the exact change the coach proposes. Nothing changes until
 * Accept; after Accept, Undo stays for 5 minutes (HARD_RULES §1, §6.2).
 */
export function ChatProposal({ messageId, proposal }: { messageId: Id<"messages">; proposal: ChatProposalState }) {
  const { t } = useLocale();
  const bounds = useLocalDayBounds();
  const accept = useMutation(api.coach.acceptProposal);
  const reject = useMutation(api.coach.rejectProposal);
  const undo = useMutation(api.coach.undoProposal);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const left = useCountdown(proposal.status === "accepted" ? proposal.undoUntilMs : undefined);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(false);
    try {
      await fn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const titleId = `proposal-${messageId}`;
  const href =
    proposal.status === "accepted" && proposal.createdId
      ? proposal.kind === "note"
        ? `/notes/${proposal.createdId}`
        : proposal.kind === "template"
          ? "/templates"
          : proposal.when === "today"
            ? "/today"
            : "/tasks"
      : null;
  const target =
    proposal.kind === "task"
      ? proposal.when === "today"
        ? t("proposal.target.today")
        : t("nav.tasks")
      : proposal.kind === "note"
        ? t("nav.notes")
        : t("nav.templates");

  return (
    <section
      className="tp-proposal"
      data-component="ProposalCard"
      data-kind={proposal.kind}
      data-status={proposal.status}
      aria-labelledby={titleId}
    >
      <div className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <TpIcon name={KIND_ICON[proposal.kind]} size="sm" />
          <span>{t(`proposal.kind.${proposal.kind}`)}</span>
        </span>
        <strong id={titleId}>{t(`proposal.title.${proposal.kind}`)}</strong>
        <span className="tp-proposal__target">{target}</span>
      </div>
      {proposal.kind === "task" ? (
        <ul className="tp-proposal__changes">
          <li className="tp-change" data-op="add" data-component="ChangePreview">
            <span className="tp-change__sign">
              <TpIcon name="plus" size="sm" />
              <span>{t("proposal.add")}</span>
            </span>
            <span className="tp-change__body">
              <span className="tp-change__title" dir="auto">
                {proposal.title}
              </span>
              <span className="tp-change__detail">
                {t("proposal.kind.task")} · <span className="tp-num">{proposal.minutes}</span> {t("proposal.min")}
              </span>
            </span>
          </li>
        </ul>
      ) : (
        <dl className="tp-proposal__what">
          <div className="tp-what-row">
            <dt>{t("proposal.name")}</dt>
            <dd>
              <span className="tp-change__title" dir="auto">
                {proposal.kind === "note" ? proposal.title : proposal.name}
              </span>
            </dd>
          </div>
          <div className="tp-what-row">
            <dt>{t("proposal.startsWith")}</dt>
            <dd dir="auto">{firstLine(proposal.body)}</dd>
          </div>
        </dl>
      )}
      {proposal.status === "pending" ? (
        <div className="tp-proposal__actions">
          <button
            className="tp-btn tp-btn--secondary"
            type="button"
            disabled={busy}
            onClick={() => void act(() => accept({ messageId, dueTodayAt: bounds.endMs - 1 }))}
          >
            <TpIcon name="check" size="sm" />
            <span>{t("proposal.accept")}</span>
          </button>
          <button className="tp-btn tp-btn--ghost" type="button" disabled={busy} onClick={() => void act(() => reject({ messageId }))}>
            <span>{t("proposal.reject")}</span>
          </button>
        </div>
      ) : (
        <p className="tp-proposal__note">
          <TpIcon name={proposal.status === "accepted" ? "check" : "undo"} size="sm" />
          <span>
            {proposal.status === "accepted"
              ? left
                ? t("proposal.accepted")
                : t("proposal.kept")
              : proposal.status === "undone"
                ? t("proposal.undone")
                : t("proposal.rejected")}
          </span>
          {href ? (
            <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={href}>
              {t("proposal.open")}
            </Link>
          ) : null}
          {left ? (
            <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" disabled={busy} onClick={() => void act(() => undo({ messageId }))}>
              <TpIcon name="undo" size="sm" />
              <span>{t("proposal.undo")}</span>
              <span className="tp-num tp-mono">{left}</span>
            </button>
          ) : null}
        </p>
      )}
      {failed ? (
        <p className="tp-proposal__note" role="alert">
          {t("proposal.error")}
        </p>
      ) : null}
    </section>
  );
}
