"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useLocale } from "@/components/providers/LocaleProvider";

export type ResearchChoice = { useWeb: boolean; thinkHard: boolean };
export type ResearchKey = { conversationId: Id<"conversations">; requestId: string; replyTo: Id<"messages"> };
type PreparedReply = { status: "ready"; requestId: string; replyTo: Id<"messages"> } |
  { status: "busy" | "idle" } | { status: "unsupported"; control: "web" | "thinkHard" };
type ReplyOutcome = { status: "replied" | "cancelled" | "unavailable" | "superseded" | "busy" };

/** One immutable identity covers preparation, execution and any cancellation retry. */
export function createResearchReply({
  conversationId, requestId, begin, reply, cancel,
}: {
  conversationId: Id<"conversations">;
  requestId: string;
  begin: () => Promise<PreparedReply>;
  reply: (key: ResearchKey) => Promise<ReplyOutcome>;
  cancel: (key: ResearchKey) => Promise<{ status: "cancelled" | "idle" }>;
}) {
  let key: ResearchKey | null = null;
  let cancelled = false;
  let cancellation: Promise<void> | null = null;
  let cancellationConfirmed = false;
  let execution: Promise<PreparedReply | ReplyOutcome> | null = null;

  const stop = async () => {
    cancelled = true;
    if (!key || cancellationConfirmed) return;
    if (!cancellation) {
      const ownedKey = key;
      cancellation = cancel(ownedKey).then(() => { cancellationConfirmed = true; }).finally(() => { cancellation = null; });
    }
    await cancellation;
  };
  return {
    get cancelled() { return cancelled; },
    get key() { return key; },
    stop,
    run(): Promise<PreparedReply | ReplyOutcome> {
      // Repeated clicks/retries cannot prepare or execute another request for this message.
      if (execution) return execution;
      execution = (async () => {
        if (cancelled) return { status: "cancelled" as const };
        const prepared = await begin();
        if (prepared.status !== "ready") return prepared;
        // Ignore neither a mismatched response identity nor a queued cancellation.
        if (prepared.requestId !== requestId) throw new Error("Reply identity did not match");
        key = { conversationId, requestId, replyTo: prepared.replyTo };
        if (cancelled) { await stop(); return { status: "cancelled" as const }; }
        const result = await reply(key);
        if (cancelled) { await stop(); return { status: "cancelled" as const }; }
        return result;
      })();
      return execution;
    },
  };
}

/** Mounted directly in the existing composer; native buttons provide keyboard/RTL behavior. */
export function CoachResearchControls({
  value, capabilities, disabled, active, stopping, onChange, onCancel, id,
}: {
  value: ResearchChoice;
  capabilities: ResearchChoice | undefined;
  disabled: boolean;
  active: boolean;
  stopping: boolean;
  onChange: (value: ResearchChoice) => void;
  onCancel: () => void;
  id: string;
}) {
  const { t } = useLocale();
  const unavailable = capabilities !== undefined && (!capabilities.useWeb || !capabilities.thinkHard);
  const description = capabilities === undefined ? t("cc.researchLoading") : unavailable ? t("cc.researchUnavailable") : null;
  return (
    <div data-component="CoachResearchControls">
      <div role="group" aria-label={t("cc.researchLabel")} aria-describedby={description ? `${id}-research-status` : undefined}
        className="tp-composer__bar" style={{ flexWrap: "wrap", gap: "var(--tp-space-2)" }}>
        <button type="button" className="tp-btn tp-btn--secondary" aria-pressed={value.useWeb}
          style={{ minHeight: "var(--tp-touch)", minWidth: "var(--tp-touch)" }}
          disabled={disabled || (!capabilities?.useWeb && !value.useWeb)}
          onClick={() => onChange({ ...value, useWeb: !value.useWeb })}>
          {t("cc.useWeb")}
        </button>
        <button type="button" className="tp-btn tp-btn--secondary" aria-pressed={value.thinkHard}
          style={{ minHeight: "var(--tp-touch)", minWidth: "var(--tp-touch)" }}
          disabled={disabled || (!capabilities?.thinkHard && !value.thinkHard)}
          onClick={() => onChange({ ...value, thinkHard: !value.thinkHard })}>
          {t("cc.thinkHard")}
        </button>
        {active ? <button type="button" className="tp-btn tp-btn--ghost"
          style={{ minHeight: "var(--tp-touch)", minWidth: "var(--tp-touch)" }}
          disabled={stopping} onClick={onCancel}>
          {t(stopping ? "cc.stopping" : "cc.cancelReply")}
        </button> : null}
      </div>
      {description ? <p id={`${id}-research-status`} className="tp-muted tp-small" role="status">{description}</p> : null}
    </div>
  );
}
