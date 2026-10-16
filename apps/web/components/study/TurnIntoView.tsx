"use client";

import { fillNodes } from "@tempo/ui";
import type { StudyBlockType } from "@tempo/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  makeToast,
  OfflineNotice,
  SignedOutState,
  StateEmpty,
  StateLoading,
  type ToastState,
  UndoToast,
} from "@/components/goals/shared";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { fillWith } from "./fill";
import { setHref } from "./hub";
import { countKey, KIND_ICON, KIND_KEY, type StudyT } from "./labels";
import {
  type Created,
  canAccept,
  canAskCoach,
  type Draft,
  type DraftItem,
  draftFrom,
  draftProblems,
  draftReducer,
  draftToData,
  type GenerateReason,
  initialProposal,
  outlinePreview,
  type ProposalPhase,
  proposalReducer,
  reasonKey,
  type StudyPreview,
  toPreview,
} from "./preview";

/** The S25 preview's markup and Accept / Edit / Reject state, with no data access (TurnIntoPreview.tsx saves). */
export type NotePreviewSource = { id: string; title: string; body: string };

export type GenerateResult =
  | { status: "ready"; data: unknown }
  | { status: "unavailable"; reason: "no_key" | "too_short" | "busy" | "failed" };

export function BackLink({ from, t }: { from?: string; t: StudyT }) {
  return from ? (
    <Link className="tp-btn tp-btn--ghost" href={`/notes/${encodeURIComponent(from)}`}>
      <span>{t("st.pv.backToPage")}</span>
    </Link>
  ) : (
    <Link className="tp-btn tp-btn--ghost" href="/study">
      <span>{t("st.review.back")}</span>
    </Link>
  );
}

export type TurnIntoViewProps = {
  /** undefined while loading; null when there's no page to read. */
  note: NotePreviewSource | null | undefined;
  hasFrom: boolean;
  signedOut?: boolean;
  kind: StudyBlockType;
  online: boolean;
  onGenerate: () => Promise<GenerateResult>;
  onCreate: (preview: StudyPreview, title: string) => Promise<Created>;
  onUndo: (setId: string) => Promise<void>;
};

const TITLE_KEY: Record<StudyBlockType, MessageKey> = {
  flashcards: "st.pv.title.flashcards",
  quiz: "st.pv.title.quiz",
  test: "st.pv.title.test",
};

export function TurnIntoView({
  note,
  hasFrom,
  signedOut,
  kind,
  online,
  onGenerate,
  onCreate,
  onUndo,
}: TurnIntoViewProps) {
  const { t } = useLocale();
  const outline = useMemo(
    () => (note ? outlinePreview(kind, note.body, note.title) : null),
    [note, kind]
  );
  const [coach, setCoach] = useState<StudyPreview | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<GenerateReason | null>(null);
  // The card's phase, so "Ask the coach" never replaces an edit list or an accepted set.
  const [phase, setPhase] = useState<ProposalPhase>("preview");
  const preview = coach ?? outline;
  const showAsk = canAskCoach(phase, coach !== null);

  const ask = () => {
    if (asking || !canAskCoach(phase, coach !== null)) return;
    if (!online) {
      setReason("offline");
      return;
    }
    setAsking(true);
    setReason(null);
    onGenerate()
      .then((result) => {
        if (result.status === "ready") {
          const next = toPreview(kind, result.data);
          if (next) setCoach(next);
          else setReason("failed");
        } else {
          setReason(result.reason);
        }
      })
      .catch(() => setReason("failed"))
      .finally(() => setAsking(false));
  };

  return (
    <div
      className="tp-page tp-page--narrow tp-study-stack"
      data-component="PageLayout"
      data-screen="TurnIntoPreview"
      data-kind={kind}
    >
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t(TITLE_KEY[kind])}</h1>
          {note ? (
            <p className="tp-pagehead__sub">
              {fillWith(t("st.pv.from"), { title: <span dir="auto">{note.title}</span> })}
            </p>
          ) : null}
        </div>
        {note ? (
          <div className="tp-pagehead__actions">
            <Link className="tp-btn tp-btn--ghost" href={`/notes/${encodeURIComponent(note.id)}`}>
              <span>{t("st.pv.backToPage")}</span>
            </Link>
          </div>
        ) : null}
      </header>
      {online ? null : <OfflineNotice text={t("gx.offline")} />}
      {signedOut ? (
        <SignedOutState />
      ) : !hasFrom ? (
        <StateEmpty
          icon="page"
          title={t("st.pv.noFrom.title")}
          body={t("st.pv.noFrom.body")}
          action={<OpenPages t={t} />}
        />
      ) : note === undefined ? (
        <StateLoading label={t("st.pv.loading")} lead="block" rows={2} />
      ) : note === null ? (
        <StateEmpty
          icon="page"
          title={t("st.pv.missing.title")}
          body={t("st.pv.missing.body")}
          action={<OpenPages t={t} />}
        />
      ) : (
        <>
          <p
            className="tp-small tp-muted tp-study-source"
            data-source={coach ? "coach" : "outline"}
          >
            <TpIcon name={coach ? "coach" : "list"} size="sm" />
            <span>
              {coach ? t("st.pv.byCoach") : outline ? t("st.pv.byOutline") : t("st.pv.noOutline")}
            </span>
          </p>
          {reason ? (
            <output className="tp-notice tp-study-reason" data-tone="info" data-reason={reason}>
              <span className="tp-notice__icon">
                <TpIcon name="info" size="sm" />
              </span>
              <span className="tp-notice__text">{t(reasonKey(reason))}</span>
            </output>
          ) : null}
          {showAsk ? (
            <div className="tp-study-actions">
              <button
                className="tp-btn tp-btn--secondary"
                type="button"
                data-action="ask-coach"
                disabled={asking}
                aria-busy={asking}
                onClick={ask}
              >
                <TpIcon name="sparkle" size="sm" />
                <span>{asking ? t("st.pv.asking") : t("st.pv.ask")}</span>
              </button>
            </div>
          ) : null}
          {preview ? (
            <PreviewCard
              key={coach ? "coach" : "outline"}
              preview={preview}
              note={note}
              t={t}
              onCreate={onCreate}
              onUndo={onUndo}
              onPhase={setPhase}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function OpenPages({ t }: { t: StudyT }) {
  return (
    <Link className="tp-btn tp-btn--secondary" href="/notes">
      <TpIcon name="page" size="sm" />
      <span>{t("st.empty.pages")}</span>
    </Link>
  );
}

/** The words under a preview item's first line. */
function itemDetail(preview: StudyPreview, item: DraftItem, t: StudyT): string {
  if (preview.kind === "flashcards") return item.secondary ?? "";
  if (item.secondary === null) return t("st.pv.written");
  return t("st.pv.answer").replace("{answer}", item.secondary);
}

function PreviewCard({
  preview,
  note,
  t,
  onCreate,
  onUndo,
  onPhase,
}: {
  preview: StudyPreview;
  note: NotePreviewSource;
  t: StudyT;
  onCreate: TurnIntoViewProps["onCreate"];
  onUndo: TurnIntoViewProps["onUndo"];
  onPhase: (phase: ProposalPhase) => void;
}) {
  const [draft, edit] = useReducer(draftReducer, preview, draftFrom);
  const [state, dispatch] = useReducer(proposalReducer, initialProposal);
  useEffect(() => onPhase(state.phase), [state.phase, onPhase]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const saving = useRef(false);
  const kind = preview.kind;
  const problems = draftProblems(draft);
  const ready = canAccept(state, draft);
  const titleId = "st-proposal-title";

  const accept = () => {
    const data = draftToData(draft);
    if (!data || !ready || saving.current) return;
    saving.current = true;
    dispatch({ type: "accept" });
    onCreate(data, draft.title.trim())
      .then((created) => {
        dispatch({ type: "saved", created });
        setToast(
          makeToast(t("st.pv.toast"), async () => {
            await onUndo(created.setId);
            dispatch({ type: "undone" });
          })
        );
      })
      .catch(() => dispatch({ type: "saveError" }))
      .finally(() => {
        saving.current = false;
      });
  };

  const count = draft.items.length;
  const what = fillNodes(
    t(countKey(kind === "flashcards" ? "st.row.cards" : "st.row.questions", count)),
    { n: count }
  );
  const editing = state.phase === "editing";
  const open = state.phase === "preview" || state.phase === "editing" || state.phase === "saving";

  return (
    <>
      <article
        className="tp-proposal st-proposal"
        data-component="ProposalCard"
        data-kind={kind}
        data-status={state.phase}
        aria-labelledby={titleId}
      >
        <header className="tp-proposal__head">
          <span className="tp-proposal__kind">
            <TpIcon name={KIND_ICON[kind]} size="sm" />
            <span>{t(KIND_KEY[kind])}</span>
          </span>
          <strong id={titleId} dir="auto">
            {draft.title}
          </strong>
        </header>
        {open ? (
          <div className="tp-proposal__what" data-component="ProposalWhat">
            <p className="tp-study-what">
              {fillWith(t("st.pv.adds"), { title: <span dir="auto">{draft.title}</span>, what })}
            </p>
            <p className="tp-study-what tp-muted">
              {fillWith(t("st.pv.linksBack"), { source: <span dir="auto">{note.title}</span> })}
            </p>
          </div>
        ) : null}
        {open && editing ? (
          <DraftEditor draft={draft} kind={kind} t={t} onEdit={edit} problems={problems} />
        ) : open ? (
          <ol className="tp-proposal__changes tp-study-changes" aria-label={t("st.pv.items")}>
            {draft.items.map((item) => (
              <li className="tp-change" data-op="add" key={item.id}>
                <span className="tp-change__sign">
                  <TpIcon name="plus" size="sm" />
                  <span>{t("st.pv.addSign")}</span>
                </span>
                <span className="tp-change__body">
                  <span className="tp-change__title" dir="auto">
                    {item.primary}
                  </span>
                  <span className="tp-change__detail" dir="auto">
                    {itemDetail(preview, item, t)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        {state.phase === "accepted" && state.created ? (
          <output className="tp-proposal__note">
            <TpIcon name="check" size="sm" />
            <span>{t("st.pv.accepted")}</span>
            <Link className="tp-btn tp-btn--link" href={setHref(state.created.setId)}>
              {t("st.pv.studyNow")}
            </Link>
            <Link
              className="tp-btn tp-btn--link"
              href={`/notes/${encodeURIComponent(state.created.noteId)}`}
            >
              {t("st.set.openPage")}
            </Link>
          </output>
        ) : null}
        {state.phase === "rejected" ? (
          <output className="tp-proposal__note">
            <TpIcon name="x" size="sm" />
            <span>{t("st.pv.rejected")}</span>
            <button
              className="tp-btn tp-btn--link"
              type="button"
              onClick={() => dispatch({ type: "reopen" })}
            >
              {t("st.pv.showAgain")}
            </button>
            <Link className="tp-btn tp-btn--link" href={`/notes/${encodeURIComponent(note.id)}`}>
              {t("st.pv.backToPage")}
            </Link>
          </output>
        ) : null}
        {state.undone ? (
          <output className="tp-proposal__note">
            <TpIcon name="undo" size="sm" />
            <span>{t("st.pv.undone")}</span>
          </output>
        ) : null}
        {state.error === "save" ? (
          <p className="tp-proposal__note" role="alert">
            <TpIcon name="alert" size="sm" />
            <span>{t("st.pv.saveError")}</span>
          </p>
        ) : null}
        {open ? (
          <footer className="tp-proposal__actions">
            <button
              className="tp-btn tp-btn--primary"
              type="button"
              data-action="accept"
              disabled={!ready}
              aria-busy={state.phase === "saving"}
              onClick={accept}
            >
              <TpIcon name="check" size="sm" />
              <span>{state.phase === "saving" ? t("st.pv.saving") : t("st.pv.accept")}</span>
            </button>
            <button
              className="tp-btn tp-btn--secondary"
              type="button"
              data-action="edit"
              aria-pressed={editing}
              disabled={state.phase === "saving"}
              onClick={() => dispatch({ type: editing ? "doneEditing" : "edit" })}
            >
              <TpIcon name="edit" size="sm" />
              <span>{editing ? t("st.pv.doneEditing") : t("st.pv.edit")}</span>
            </button>
            <button
              className="tp-btn tp-btn--ghost"
              type="button"
              data-action="reject"
              disabled={state.phase === "saving"}
              onClick={() => dispatch({ type: "reject" })}
            >
              <TpIcon name="x" size="sm" />
              <span>{t("st.pv.reject")}</span>
            </button>
          </footer>
        ) : null}
      </article>
      {toast ? <UndoToast key={toast.id} toast={toast} onClose={closeToast} /> : null}
    </>
  );
}

const LINE_LABELS: Record<StudyBlockType, [MessageKey, MessageKey]> = {
  flashcards: ["st.ed.front", "st.ed.back"],
  quiz: ["st.ed.question", "st.ed.answer"],
  test: ["st.ed.question", "st.ed.answer"],
};

const ADD_KEY: Record<StudyBlockType, MessageKey> = {
  flashcards: "st.ed.add.flashcards",
  quiz: "st.ed.add.quiz",
  test: "st.ed.add.test",
};

function DraftEditor({
  draft,
  kind,
  t,
  onEdit,
  problems,
}: {
  draft: Draft;
  kind: StudyBlockType;
  t: StudyT;
  onEdit: (action: Parameters<typeof draftReducer>[1]) => void;
  problems: MessageKey[];
}) {
  const [first, second] = LINE_LABELS[kind];
  // The reducer stops at the codec's limits (100 items, 20 questions in a test section).
  const roomToAdd = draftReducer(draft, { type: "add" }) !== draft;
  const lastAdded = useRef<string | null>(null);
  // After "Add", focus moves to the new item's first field.
  useEffect(() => {
    const id = lastAdded.current;
    if (!id) return;
    lastAdded.current = null;
    document.getElementById(`st-ed-${id}-a`)?.focus();
  });
  return (
    <div className="tp-study-edit" data-component="DraftEditor">
      <div className="tp-field">
        <label className="tp-label" htmlFor="st-ed-title">
          {t("st.ed.title")}
        </label>
        <input
          id="st-ed-title"
          className="tp-input"
          dir="auto"
          maxLength={200}
          value={draft.title}
          aria-invalid={problems.includes("st.ed.titleInvalid") || undefined}
          onChange={(event) => onEdit({ type: "title", value: event.target.value })}
        />
      </div>
      <ol className="tp-study-edit__list">
        {draft.items.map((item, index) => (
          <li className="tp-study-edit__item" key={item.id}>
            <fieldset className="tp-study-edit__set">
              <legend className="tp-label">
                {t("st.ed.item").replace("{n}", String(index + 1))}
              </legend>
              <div className="tp-field">
                <label className="tp-label" htmlFor={`st-ed-${item.id}-a`}>
                  {t(first)}
                </label>
                <input
                  id={`st-ed-${item.id}-a`}
                  className="tp-input"
                  dir="auto"
                  maxLength={500}
                  value={item.primary}
                  aria-invalid={item.primary.trim() === "" || undefined}
                  onChange={(event) =>
                    onEdit({
                      type: "change",
                      id: item.id,
                      field: "primary",
                      value: event.target.value,
                    })
                  }
                />
              </div>
              {item.secondary === null ? (
                <p className="tp-small tp-muted">{t("st.pv.written")}</p>
              ) : (
                <div className="tp-field">
                  <label className="tp-label" htmlFor={`st-ed-${item.id}-b`}>
                    {t(second)}
                  </label>
                  <input
                    id={`st-ed-${item.id}-b`}
                    className="tp-input"
                    dir="auto"
                    maxLength={500}
                    value={item.secondary}
                    aria-invalid={item.secondary.trim() === "" || undefined}
                    onChange={(event) =>
                      onEdit({
                        type: "change",
                        id: item.id,
                        field: "secondary",
                        value: event.target.value,
                      })
                    }
                  />
                </div>
              )}
              <button
                className="tp-btn tp-btn--ghost tp-btn--sm"
                type="button"
                data-action="remove-item"
                onClick={() => onEdit({ type: "remove", id: item.id })}
              >
                <TpIcon name="minus" size="sm" />
                <span>{t("st.ed.remove")}</span>
              </button>
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="tp-study-actions">
        <button
          className="tp-btn tp-btn--secondary"
          type="button"
          data-action="add-item"
          disabled={!roomToAdd}
          onClick={() => {
            onEdit({ type: "add" });
            lastAdded.current = nextIdHint(draft);
          }}
        >
          <TpIcon name="plus" size="sm" />
          <span>{t(ADD_KEY[kind])}</span>
        </button>
      </div>
      {problems.length > 0 ? (
        <output className="tp-notice" data-tone="caution">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">
            {problems.map((key) => (
              <span key={key} className="tp-study-problem">
                {t(key)}
              </span>
            ))}
          </span>
        </output>
      ) : null}
    </div>
  );
}

/** The id `draftReducer` gives the next added item (so focus can follow it). */
function nextIdHint(draft: Draft): string {
  return draftReducer(draft, { type: "add" }).items.at(-1)?.id ?? "";
}
