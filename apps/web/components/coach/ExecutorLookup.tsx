"use client";

import { useAction, useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { Component, type ReactNode, useId, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  executorLookupOf,
  executorPhase,
  LOOKUP_QUERY_MAX,
  type LookupCard,
  type LookupOutcome,
  lookupAllowed,
  lookupErrorOutcome,
  lookupOutcome,
  toolCountKey,
} from "@/lib/executor-connection";

/**
 * The coach's first Executor flow, "Look in my apps" (TEMPO-B07-08; design
 * docs/research/EXECUTOR-IN-TEMPO.md §4.3 and §4.7). A chip under the thread, shown only while
 * `connections.status` says Executor is connected; it opens a short field, and Look runs
 * `coach.lookUpInExecutor`. The backend saves the person's words and a templated answer whose
 * `toolCalls.executorLookup` (app names and tool counts, nothing else) ExecutorLookupCard draws
 * under that answer. Every other outcome gets one calm line from §4.7, and the chat keeps working
 * without Executor in every case. If the backend isn't deployed yet, the chip simply isn't there.
 */

export type ExecutorLookupViewProps = {
  open: boolean;
  query: string;
  working?: boolean;
  /** The coach is answering or waiting for its page: the chip and Look wait too. */
  disabled?: boolean;
  outcome?: LookupOutcome | null;
  onOpen?: () => void;
  onClose?: () => void;
  onQueryChange?: (value: string) => void;
  onSubmit?: () => void;
  onRetry?: () => void;
};

/** The chip, the field and the outcome line, from plain props (also used by visual checks). */
export function ExecutorLookupView({
  open,
  query,
  working = false,
  disabled = false,
  outcome = null,
  onOpen,
  onClose,
  onQueryChange,
  onSubmit,
  onRetry,
}: ExecutorLookupViewProps) {
  const { t } = useLocale();
  const id = useId();
  const inputId = `${id}-query`;
  const helpId = `${id}-help`;
  const blocked = disabled || working;

  return (
    <div
      className="tp-composer"
      data-component="ExecutorLookup"
      style={{ display: "grid", gap: "var(--tp-space-2)", paddingBottom: 0 }}
    >
      {open ? (
        <form
          className="tp-field"
          onSubmit={(event) => {
            event.preventDefault();
            if (!blocked && query.trim()) onSubmit?.();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !working) {
              event.preventDefault();
              onClose?.();
            }
          }}
        >
          <label className="tp-label" htmlFor={inputId}>
            {t("exec.look.label")}
          </label>
          <div className="tp-composer__bar" style={{ flexWrap: "wrap", gap: "var(--tp-space-2)" }}>
            <input
              id={inputId}
              className="tp-input ig-grow"
              type="text"
              dir="auto"
              autoComplete="off"
              // biome-ignore lint/a11y/noAutofocus: the field opens because the person asked for it.
              autoFocus
              maxLength={LOOKUP_QUERY_MAX}
              placeholder={t("exec.look.placeholder")}
              aria-describedby={helpId}
              value={query}
              // Read-only, not disabled, while it looks: focus stays in the field.
              readOnly={working}
              onChange={(event) => onQueryChange?.(event.target.value)}
            />
            <button
              className="tp-btn tp-btn--primary tp-btn--sm"
              type="submit"
              aria-disabled={blocked || !query.trim() ? true : undefined}
            >
              <TpIcon name="search" size="sm" />
              <span>{working ? t("exec.look.working") : t("exec.look.submit")}</span>
            </button>
            <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" disabled={working} onClick={() => onClose?.()}>
              <span>{t("exec.look.close")}</span>
            </button>
          </div>
          <span className="tp-help" id={helpId}>
            {t("exec.look.help")}
          </span>
        </form>
      ) : (
        <div>
          <button
            className="tp-btn tp-btn--secondary tp-btn--sm"
            type="button"
            aria-disabled={disabled ? true : undefined}
            data-testid="executor-lookup-chip"
            onClick={() => {
              if (!disabled) onOpen?.();
            }}
          >
            <TpIcon name="search" size="sm" />
            <span>{t("exec.look.chip")}</span>
          </button>
        </div>
      )}
      <output className="tp-help" data-component="ExecutorLookupStatus">
        {working ? t("exec.look.working") : outcome ? t(outcome.text) : ""}
      </output>
      {outcome && !working && outcome.action ? (
        <div className="tp-msg__actions">
          {outcome.action === "retry" ? (
            <button className="tp-btn tp-btn--ghost tp-btn--sm" type="button" disabled={disabled} onClick={() => onRetry?.()}>
              <TpIcon name="refresh" size="sm" />
              <span>{t("exec.look.retry")}</span>
            </button>
          ) : (
            <Link className="tp-btn tp-btn--ghost tp-btn--sm" href="/settings/integrations">
              <span>{t("exec.look.settings")}</span>
              <TpIcon name="chevron" size="sm" flip />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The chip is extra: if `connections.status` throws (say #989 isn't deployed), the coach shows without it. */
class LookupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LiveExecutorLookup({ conversationId, disabled }: { conversationId: Id<"conversations">; disabled: boolean }) {
  const { isAuthenticated } = useConvexAuth();
  const status = useQuery(api.connections.status, isAuthenticated ? { provider: "executor" } : "skip");
  const lookUp = useAction(api.coach.lookUpInExecutor);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [working, setWorking] = useState(false);
  const [outcome, setOutcome] = useState<LookupOutcome | null>(null);
  const lastQuery = useRef("");
  const chipHolder = useRef<HTMLDivElement | null>(null);

  // Hidden unless connected (§4.3 step 1). A line already on screen stays, so its answer isn't lost.
  if (!lookupAllowed(executorPhase(status)) && !outcome && !working) return null;

  const focusChip = () => {
    window.requestAnimationFrame(() => chipHolder.current?.querySelector<HTMLButtonElement>("button")?.focus());
  };

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || working) return;
    lastQuery.current = trimmed;
    setWorking(true);
    setOutcome(null);
    try {
      const result = await lookUp({ conversationId, query: trimmed });
      const next = lookupOutcome(result.status);
      setOutcome(next);
      if (!next) {
        // Replied: the person's words and the answer card are in the thread now.
        setQuery("");
        setOpen(false);
        focusChip();
      }
    } catch (error) {
      setOutcome(lookupErrorOutcome(error));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div ref={chipHolder}>
      <ExecutorLookupView
        open={open}
        query={query}
        working={working}
        disabled={disabled}
        outcome={outcome}
        onOpen={() => {
          setOutcome(null);
          setOpen(true);
        }}
        onClose={() => {
          setOpen(false);
          setOutcome(null);
          focusChip();
        }}
        onQueryChange={(value) => {
          setQuery(value);
          if (outcome) setOutcome(null);
        }}
        onSubmit={() => void run(query)}
        onRetry={() => void run(lastQuery.current || query)}
      />
    </div>
  );
}

/** "Look in my apps" under the coach thread; renders nothing unless Executor is connected. */
export function ExecutorLookup({ conversationId, disabled = false }: { conversationId: Id<"conversations">; disabled?: boolean }) {
  return (
    <LookupBoundary>
      <LiveExecutorLookup conversationId={conversationId} disabled={disabled} />
    </LookupBoundary>
  );
}

/**
 * The answer card for a saved lookup: which apps Tempo can reach through Executor and how many
 * tools each has, then the total. Draws nothing for any other message. Only names and counts are
 * shown; the stored object itself (and never raw JSON) is not.
 */
export function ExecutorLookupCard({ toolCalls, card: given }: { toolCalls?: unknown; card?: LookupCard | null }) {
  const { t } = useLocale();
  const id = useId();
  const card = given ?? executorLookupOf(toolCalls);
  if (!card) return null;
  const titleId = `${id}-title`;
  const count = (n: number, kind: "row" | "total") => t(toolCountKey(n, kind)).replace("{n}", String(n));
  return (
    <section className="tp-proposal" data-component="ExecutorLookupCard" aria-labelledby={titleId}>
      <div className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <TpIcon name="link" size="sm" />
          <span>{t("exec.card.kind")}</span>
        </span>
        <strong id={titleId}>{t("exec.card.title")}</strong>
      </div>
      {card.apps.length > 0 ? (
        <ul className="tp-list">
          {card.apps.map((app, index) => (
            <li key={`${index}-${app.name}`}>
              <div className="tp-list-row" data-component="ListRow">
                <span className="tp-list-row__icon">
                  <TpIcon name="module" size="sm" />
                </span>
                <span className="tp-list-row__body">
                  <span className="tp-list-row__title" dir="auto">
                    {app.name}
                  </span>
                </span>
                <span className="tp-list-row__end">{count(app.toolCount, "row")}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="tp-proposal__note">
        <TpIcon name={card.total > 0 ? "hand" : "info"} size="sm" />
        <span>
          {card.total > 0 ? `${count(card.total, "total")} ${t("exec.card.ask")}` : t("exec.card.none")}
        </span>
      </p>
    </section>
  );
}
