"use client";

import { useEffect, useReducer, useRef } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import { fillWith } from "./fill";
import { KIND_KEY, type StudyT } from "./labels";
import { draftFrom, draftProblems, draftReducer, draftToData, type StudyPreview } from "./preview";
import { canSave, draftUnchanged, isStale, type SetEditState } from "./set-edit";
import { DraftEditor } from "./TurnIntoView";

/**
 * Edit a saved set (StudyFetch parity): the Turn-into preview's edit list, drafted from the block
 * as the page holds it, with Save changes (this screen's one primary while it shows) and Cancel.
 * Markup and the draft only: StudySetView runs the save and its 5-minute Undo. When the page's
 * block changed since the edit started, it says so in words and offers Reload instead of a save
 * that would write over newer words. The parent remounts it (a `key`) to start from a new version.
 */
export type SetEditorProps = {
  /** The block as the edit started; the draft is made from it once, on mount. */
  base: StudyPreview;
  pageTitle: string;
  state: SetEditState;
  /** The block version the page holds now (`getSet`'s `blockVersion`). */
  currentVersion: string;
  t: StudyT;
  /** `before` is the block the edit started from, for Undo. */
  onSave: (next: StudyPreview, before: StudyPreview) => void;
  onCancel: () => void;
  onReload: () => void;
};

const TITLE_ID = "st-setedit-title";

export function SetEditor({
  base,
  pageTitle,
  state,
  currentVersion,
  t,
  onSave,
  onCancel,
  onReload,
}: SetEditorProps) {
  const [draft, edit] = useReducer(draftReducer, base, draftFrom);
  const kind = draft.preview.kind;
  const problems = draftProblems(draft);
  const stale = isStale(state, currentVersion);
  const saving = state.phase === "saving";
  const ready = canSave(state, draft, currentVersion);
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus moves to the edit list's heading when it opens (and after Reload, which remounts it).
  useEffect(() => heading.current?.focus(), []);

  const save = () => {
    if (!ready) return;
    // Nothing changed: close without writing to the page.
    if (draftUnchanged(draft)) {
      onCancel();
      return;
    }
    const next = draftToData(draft);
    if (next) onSave(next, draft.preview);
  };

  return (
    <section
      className="tp-proposal tp-study-setedit"
      data-component="SetEditor"
      data-kind={kind}
      data-status={stale ? "stale" : state.phase}
      aria-labelledby={TITLE_ID}
    >
      <header className="tp-proposal__head">
        <span className="tp-proposal__kind">
          <TpIcon name="edit" size="sm" />
          <span>{t(KIND_KEY[kind])}</span>
        </span>
        <h2 className="tp-study-setedit__title" id={TITLE_ID} ref={heading} tabIndex={-1}>
          {t("st.se.title")}
        </h2>
      </header>
      <div className="tp-proposal__what">
        <p className="tp-study-what">
          {fillWith(t("st.se.intro"), { page: <span dir="auto">{pageTitle}</span> })}
        </p>
        {kind === "flashcards" ? (
          <p className="tp-study-what tp-muted">{t("st.se.schedule")}</p>
        ) : null}
      </div>
      {stale ? (
        <div className="tp-study-setedit__notes">
          <div className="tp-notice" data-tone="caution" role="alert" data-reason="changed">
            <span className="tp-notice__icon">
              <TpIcon name="alert" size="sm" />
            </span>
            <span className="tp-notice__text">{t("st.se.changed")}</span>
            <button
              className="tp-btn tp-btn--secondary tp-btn--sm tp-notice__action"
              type="button"
              data-action="reload-edit"
              onClick={onReload}
            >
              <TpIcon name="undo" size="sm" />
              <span>{t("st.se.reload")}</span>
            </button>
          </div>
        </div>
      ) : null}
      <DraftEditor draft={draft} kind={kind} t={t} onEdit={edit} problems={problems} />
      {state.error === "save" ? (
        <p className="tp-proposal__note" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{t("st.se.saveError")}</span>
        </p>
      ) : null}
      <footer className="tp-proposal__actions">
        <button
          className="tp-btn tp-btn--primary"
          type="button"
          data-action="save-edit"
          disabled={!ready}
          aria-busy={saving}
          onClick={save}
        >
          <TpIcon name="check" size="sm" />
          <span>{saving ? t("st.pv.saving") : t("st.se.save")}</span>
        </button>
        <button
          className="tp-btn tp-btn--ghost"
          type="button"
          data-action="cancel-edit"
          disabled={saving}
          onClick={onCancel}
        >
          <TpIcon name="x" size="sm" />
          <span>{t("st.se.cancel")}</span>
        </button>
      </footer>
    </section>
  );
}
