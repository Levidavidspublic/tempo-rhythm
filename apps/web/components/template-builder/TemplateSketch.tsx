"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import { parseSketch, SKETCH_MAX_CHARS, type SketchDraft } from "@/lib/template-sketch";
import { useOnline } from "@/lib/useOnline";

/** Undo lasts five minutes (HARD_RULES: every accepted change has a 5-minute Undo). */
const UNDO_MS = 5 * 60_000;

type Proposal = {
  draft: SketchDraft;
  /** The outline this proposal was made from (Edit in the builder starts from it). */
  outline: string;
  status: "pending" | "accepted" | "rejected";
  /** The template Accept saved; its Undo lives in `undos`, not here. */
  savedId: Id<"templates"> | null;
  /** Back to pending because its template was taken back with Undo. */
  undone?: boolean;
};

/**
 * One accepted template's Undo, with its own five minutes. Kept apart from the proposal on
 * screen, so a new sketch submitted inside the window never drops an earlier template's Undo.
 */
type SavedUndo = { templateId: Id<"templates">; name: string; untilMs: number };

function countText(t: (key: MessageKey) => string, n: number, one: MessageKey, many: MessageKey): string {
  return n === 1 ? t(one) : t(many).replace("{n}", String(n));
}

/**
 * Template sketch (docs/design/v3/screens/web/template-sketch.html). A rough outline becomes a
 * proposal card that shows exactly what the template will hold. The coach's draft here is code
 * (lib/template-sketch), not a model call; nothing is saved until Accept (templates.create),
 * which has a 5-minute Undo (templates.remove) in its own toast. Edit opens the builder; Reject
 * keeps the outline.
 */
export function TemplateSketch() {
  const { t } = useLocale();
  const online = useOnline();
  const create = useMutation(api.templates.create);
  const remove = useMutation(api.templates.remove);
  const [outline, setOutline] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [needName, setNeedName] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"save" | "undo" | null>(null);
  const [undos, setUndos] = useState<SavedUndo[]>([]);
  const acceptButton = useRef<HTMLButtonElement | null>(null);
  const focusAccept = useRef(false);

  useEffect(() => {
    if (!focusAccept.current) return;
    focusAccept.current = false;
    acceptButton.current?.focus();
  });

  // Each accepted template's Undo leaves when its own five minutes end.
  useEffect(() => {
    if (undos.length === 0) return;
    const soonest = Math.min(...undos.map((undo) => undo.untilMs));
    const timer = setTimeout(
      () => {
        const now = Date.now();
        setUndos((current) => current.filter((undo) => undo.untilMs > now));
      },
      Math.max(0, soonest - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undos]);

  const stale = proposal !== null && proposal.status === "pending" && proposal.outline !== outline;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = parseSketch(outline);
    if (!draft) {
      setNeedName(true);
      return;
    }
    setNeedName(false);
    setError(null);
    setProposal({ draft, outline, status: "pending", savedId: null });
    focusAccept.current = true;
  };

  const onAccept = async () => {
    if (!proposal || pending || proposal.status !== "pending") return;
    setPending(true);
    setError(null);
    try {
      const savedId = await create({ name: proposal.draft.name, periodType: "none", body: proposal.draft.body });
      setProposal({ ...proposal, status: "accepted", savedId, undone: false });
      setUndos((current) => [...current, { templateId: savedId, name: proposal.draft.name, untilMs: Date.now() + UNDO_MS }]);
    } catch {
      setError("save");
    } finally {
      setPending(false);
    }
  };

  const dropUndo = (templateId: Id<"templates">) =>
    setUndos((current) => current.filter((undo) => undo.templateId !== templateId));

  const onUndo = async (undo: SavedUndo) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await remove({ templateId: undo.templateId });
      dropUndo(undo.templateId);
      // The proposal on screen goes back to pending only when it is the one taken back.
      setProposal((current) =>
        current?.savedId === undo.templateId ? { ...current, status: "pending", savedId: null, undone: true } : current,
      );
    } catch {
      setError("undo");
    } finally {
      setPending(false);
    }
  };

  const onReject = () => {
    if (!proposal || proposal.status !== "pending") return;
    setProposal({ ...proposal, status: "rejected" });
  };

  const counts = proposal?.draft.counts;
  const adds = counts
    ? [
        counts.question ? countText(t, counts.question, "ts.adds.q1", "ts.adds.qn") : "",
        counts.task ? countText(t, counts.task, "ts.adds.t1", "ts.adds.tn") : "",
        counts.section ? countText(t, counts.section, "ts.adds.s1", "ts.adds.sn") : "",
      ]
        .filter(Boolean)
        .join(", ") || t("ts.adds.none")
    : "";

  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      {online ? null : (
        <output className="tp-notice tp-offline" data-tone="caution" data-component="StateOffline">
          <span className="tp-notice__icon">
            <TpIcon name="wifi-off" size="sm" />
          </span>
          <span className="tp-notice__text">{t("ts.offline")}</span>
        </output>
      )}

      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("ts.h1")}</h1>
          <p className="tp-pagehead__sub">{t("ts.sub")}</p>
        </div>
        <div className="tp-pagehead__actions">
          <Link className="tp-btn tp-btn--ghost" href="/templates/builder">
            <TpIcon name="template" size="sm" />
            <span>{t("ts.self")}</span>
          </Link>
        </div>
      </header>

      <div className="tp-split tp-split--even" data-component="Split">
        <div className="sk-col">
          <form className="tp-form tp-surface" id="sk-form" data-component="Form" noValidate onSubmit={onSubmit}>
            <div className="tp-field" data-component="Field">
              <label className="tp-label" htmlFor="sk-outline">
                {t("ts.label")}
              </label>
              <textarea
                className="tp-textarea sk-outline"
                id="sk-outline"
                rows={9}
                dir="auto"
                maxLength={SKETCH_MAX_CHARS}
                aria-describedby={needName ? "sk-help sk-error" : "sk-help"}
                aria-invalid={needName || undefined}
                placeholder={t("ts.ph")}
                value={outline}
                onChange={(event) => {
                  setOutline(event.target.value);
                  if (needName) setNeedName(false);
                }}
              />
              <p className="tp-help" id="sk-help">
                {t("ts.help")}
              </p>
              {needName ? (
                <p className="tp-error-text" id="sk-error">
                  {t("ts.needName")}
                </p>
              ) : null}
            </div>
            <div className="tp-form__actions">
              <button className="tp-btn tp-btn--primary" type="submit">
                <TpIcon name="sparkle" size="sm" />
                <span>{t("ts.go")}</span>
              </button>
            </div>
          </form>

          <section className="tp-card" data-component="Card" aria-labelledby="tips-h">
            <h2 className="tp-card__title" id="tips-h">
              {t("ts.tips.h")}
            </h2>
            <ul className="sk-tips">
              <li>
                <span className="tp-mono">{t("ts.tips.w1")}</span> <span>{t("ts.tips.1")}</span>
              </li>
              <li>
                <span className="tp-mono">{t("ts.tips.w2")}</span> <span>{t("ts.tips.2")}</span>
              </li>
              <li>{t("ts.tips.3")}</li>
            </ul>
          </section>
        </div>

        <div className="sk-col" aria-live="polite">
          {proposal === null ? (
            <div className="tp-state tp-state--empty" data-component="StateEmpty">
              <span className="tp-state__icon">
                <TpIcon name="list" size="lg" />
              </span>
              <h2 className="tp-state__title">{t("ts.empty.title")}</h2>
              <p className="tp-state__body">{t("ts.empty.body")}</p>
            </div>
          ) : (
            <>
              <div className="tp-msg" data-component="CoachMessage">
                <span className="tp-msg__who">{t("ts.coach")}</span>
                <p className="tp-msg__text" dir="auto">
                  {t("ts.coach.text")}
                </p>
              </div>

              <section
                className="tp-proposal"
                data-kind="template"
                data-component="ProposalCard"
                data-status={proposal.status}
                aria-labelledby="sk-p-title"
              >
                <div className="tp-proposal__head">
                  <span className="tp-proposal__kind">
                    <TpIcon name="template" size="sm" />
                    <span>{t("ts.kind")}</span>
                  </span>
                  <strong id="sk-p-title" dir="auto">
                    {proposal.draft.name}
                  </strong>
                  <span className="tp-proposal__target">{t("ts.target")}</span>
                </div>
                <dl className="tp-proposal__what">
                  <div className="tp-what-row">
                    <dt>{t("ts.what.name")}</dt>
                    <dd>
                      <span className="tp-change__title" dir="auto">
                        {proposal.draft.name}
                      </span>
                    </dd>
                  </div>
                  <div className="tp-what-row">
                    <dt>{t("ts.what.adds")}</dt>
                    <dd>{adds}</dd>
                  </div>
                  <div className="tp-what-row">
                    <dt>{t("ts.what.changes")}</dt>
                    <dd>{t("ts.changes")}</dd>
                  </div>
                </dl>
                <div className="tp-proposal__actions">
                  <button
                    className="tp-btn tp-btn--secondary"
                    type="button"
                    ref={acceptButton}
                    disabled={pending}
                    onClick={() => void onAccept()}
                  >
                    <TpIcon name="check" size="sm" />
                    <span>{pending ? t("tx.saving") : t("ts.accept")}</span>
                  </button>
                  <Link
                    className="tp-btn tp-btn--secondary"
                    href={`/templates/builder?outline=${encodeURIComponent(proposal.outline)}`}
                  >
                    <TpIcon name="edit" size="sm" />
                    <span>{t("ts.edit")}</span>
                  </Link>
                  <button className="tp-btn tp-btn--ghost" type="button" disabled={pending} onClick={onReject}>
                    <span>{t("ts.reject")}</span>
                  </button>
                </div>
                {proposal.status === "accepted" ? (
                  <p className="tp-proposal__note">
                    <TpIcon name="check" size="sm" />
                    <span>{t("ts.accepted")}</span>
                    <Link className="tp-btn tp-btn--link" href="/templates">
                      {t("ts.openTemplates")}
                    </Link>
                  </p>
                ) : null}
                {proposal.status === "rejected" ? (
                  <p className="tp-proposal__note">
                    <span>{t("ts.rejected")}</span>
                  </p>
                ) : null}
                {proposal.status === "pending" && proposal.undone ? (
                  <p className="tp-proposal__note">
                    <span>{t("ts.undone")}</span>
                  </p>
                ) : null}
              </section>

              {stale ? (
                <div className="tp-notice" data-tone="info" data-component="Notice">
                  <span className="tp-notice__icon">
                    <TpIcon name="info" size="sm" />
                  </span>
                  <span className="tp-notice__text">
                    <span className="tp-notice__title">{t("ts.stale.t")}</span> <span>{t("ts.stale.b")}</span>
                  </span>
                </div>
              ) : null}

              {error === "save" ? (
                <div className="tp-state tp-state--error" role="alert" data-component="StateError">
                  <span className="tp-state__icon">
                    <TpIcon name="refresh" size="lg" />
                  </span>
                  <h2 className="tp-state__title">{t("ts.error.title")}</h2>
                  <p className="tp-state__body">{t("ts.error.body")}</p>
                  <div className="tp-state__actions">
                    <button className="tp-btn tp-btn--secondary" type="button" disabled={pending} onClick={() => void onAccept()}>
                      <TpIcon name="refresh" size="sm" />
                      <span>{t("tx.retry")}</span>
                    </button>
                  </div>
                </div>
              ) : null}
              {error === "undo" ? (
                <p className="tp-notice" data-tone="caution" role="alert">
                  <span className="tp-notice__text">{t("ts.undoError")}</span>
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      {undos.length > 0 ? (
        <div className="tp-toast-region">
          {undos.map((undo) => (
            <output className="tp-toast tp-glass" key={undo.templateId} data-component="UndoToast">
              <span className="tp-toast__icon">
                <TpIcon name="check" size="sm" />
              </span>
              <span className="tp-toast__text">
                <span className="tp-toast__title">{t("ts.accepted")}</span>
                <span className="tp-toast__sub" dir="auto">
                  {undo.name}
                </span>
              </span>
              <button
                className="tp-btn tp-btn--secondary tp-btn--sm"
                type="button"
                aria-label={`${t("tx.undo")}: ${undo.name}`}
                disabled={pending}
                onClick={() => void onUndo(undo)}
              >
                <TpIcon name="undo" size="sm" />
                <span>{t("tx.undo")}</span>
              </button>
              <button
                className="tp-btn tp-btn--ghost tp-btn--icon tp-btn--sm"
                type="button"
                aria-label={`${t("tx.dismiss")}: ${undo.name}`}
                onClick={() => dropUndo(undo.templateId)}
              >
                <TpIcon name="x" size="sm" />
              </button>
            </output>
          ))}
        </div>
      ) : null}
    </div>
  );
}
