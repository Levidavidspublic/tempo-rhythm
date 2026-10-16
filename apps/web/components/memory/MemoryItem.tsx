"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { useMemoryCopy } from "./memoryCopy";
import { isLongFact } from "./memorySearch";

/**
 * One MemoryItem row (docs/design/v3/components.md §2.12): the fact in the person's own words,
 * where it came from and when (an icon and words, never colour alone), Edit and Forget.
 * Editing swaps the fact for a labelled text box with Save and Cancel; Escape cancels.
 */

export type MemoryEdit = {
  draft: string;
  /** A message under the box (too long, empty, or the save didn't go through). */
  error: string | null;
  saving: boolean;
};

export function MemoryItem({
  id,
  content,
  imported,
  sourceLabel,
  when,
  edit,
  rowError,
  forgetRef,
  editRef,
  onEdit,
  onDraft,
  onSave,
  onCancel,
  onForget,
}: {
  id: string;
  content: string;
  imported: boolean;
  sourceLabel: string;
  when: string;
  /** Set while this row is being edited. */
  edit: MemoryEdit | null;
  rowError: string | null;
  forgetRef: (el: HTMLButtonElement | null) => void;
  editRef: (el: HTMLButtonElement | null) => void;
  onEdit: () => void;
  onDraft: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onForget: () => void;
}) {
  const { t } = useLocale();
  const copy = useMemoryCopy();
  const [expanded, setExpanded] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const factId = `mm-${id}`;
  const editing = edit !== null;
  const long = isLongFact(content);

  // Focus moves into the box when editing starts.
  useEffect(() => {
    if (editing) boxRef.current?.focus();
  }, [editing]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  if (edit) {
    const boxId = `${factId}-edit`;
    const describedBy = edit.error ? `${boxId}-help ${boxId}-error` : `${boxId}-help`;
    return (
      <li data-editing="true">
        <form className="tp-form mm-edit" noValidate onSubmit={submit} data-component="Form">
          <div className="tp-field" data-component="Field">
            <label className="tp-label" htmlFor={boxId}>
              {copy("mem.edit.label")}
            </label>
            <textarea
              ref={boxRef}
              className="tp-textarea"
              id={boxId}
              dir="auto"
              rows={3}
              value={edit.draft}
              aria-invalid={edit.error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(event) => onDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <p className="tp-help" id={`${boxId}-help`}>
              {copy("mem.edit.help")}
            </p>
            {edit.error ? (
              <p className="tp-error-text" id={`${boxId}-error`} role="alert">
                {edit.error}
              </p>
            ) : null}
          </div>
          <div className="tp-form__actions mm-row-actions">
            <button className="tp-btn tp-btn--primary" type="submit" disabled={edit.saving}>
              <TpIcon name="check" size="sm" />
              <span>{edit.saving ? copy("mem.edit.saving") : copy("mem.edit.save")}</span>
            </button>
            <button className="tp-btn tp-btn--secondary" type="button" onClick={onCancel}>
              <span>{copy("mem.edit.cancel")}</span>
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li>
      <div className="tp-memory-row">
        <span className="tp-memory-row__fact mm-fact" dir="auto">
          <span
            className={long && !expanded ? "mm-fact__text mm-fact__text--clamped" : "mm-fact__text"}
            id={factId}
          >
            {content}
          </span>
          {long ? (
            <button
              className="tp-btn tp-btn--link mm-fact__more"
              type="button"
              aria-expanded={expanded}
              aria-controls={factId}
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? copy("mem.less") : copy("mem.more")}
            </button>
          ) : null}
        </span>
        <span className="tp-memory-row__source">
          <TpIcon name={imported ? "download" : "memory"} size="sm" />
          <span>{sourceLabel}</span> · <span>{when}</span>
        </span>
        <span className="tp-memory-row__action mm-row-actions">
          <button
            ref={editRef}
            className="tp-btn tp-btn--ghost tp-btn--sm"
            type="button"
            aria-describedby={factId}
            onClick={onEdit}
          >
            <TpIcon name="edit" size="sm" />
            <span>{copy("mem.edit")}</span>
          </button>
          <button
            ref={forgetRef}
            className="tp-btn tp-btn--danger-ghost tp-btn--sm"
            type="button"
            aria-describedby={factId}
            onClick={onForget}
          >
            <TpIcon name="x" size="sm" />
            <span>{t("mm.forget")}</span>
          </button>
        </span>
      </div>
      {rowError ? (
        <p className="tp-error-text" role="alert">
          {rowError}
        </p>
      ) : null}
    </li>
  );
}
