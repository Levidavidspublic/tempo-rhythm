"use client";

import { useState } from "react";
import { TpIcon } from "@/components/tempo/TpIcon";
import { formatClock } from "../../../../../packages/core/record";
import { acceptedTasks, parseMinutes, type Pin, type RecordCopy, type ReviewRow, type RowSource, type RowStatus } from "./recordFlow";

const STATUS_ICON = { pending: "clock", accepted: "check", rejected: "x" } as const;

function TaskRow({
  copy,
  row,
  onStatus,
  onEdit,
}: {
  copy: RecordCopy;
  row: ReviewRow;
  onStatus: (status: RowStatus) => void;
  onEdit: (patch: { title?: string; minutes?: number | null }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const titleId = `rec-row-${row.id}-title`;
  const minutesId = `rec-row-${row.id}-minutes`;
  return (
    <li className="tp-proposal tp-rec-row" data-component="ProposalCard" data-status={row.status} data-row={row.id}>
      <div className="tp-proposal__head">
        {editing ? (
          <div className="tp-rec-row__edit">
            <div className="tp-field">
              <label className="tp-label" htmlFor={titleId}>
                {copy("rec.rev.taskLabel")}
              </label>
              <input id={titleId} className="tp-input" dir="auto" value={row.title} onChange={(event) => onEdit({ title: event.target.value })} />
            </div>
            <div className="tp-field tp-rec-row__minutes">
              <label className="tp-label" htmlFor={minutesId}>
                {copy("rec.rev.minutes")}
              </label>
              <input
                id={minutesId}
                className="tp-input tp-num"
                inputMode="numeric"
                value={row.minutes === undefined ? "" : String(row.minutes)}
                onChange={(event) => onEdit({ minutes: parseMinutes(event.target.value) })}
              />
            </div>
          </div>
        ) : (
          <strong dir="auto">{row.title}</strong>
        )}
        {!editing && row.minutes !== undefined ? (
          <span className="tp-proposal__target tp-num">{copy("rec.rev.minutesShort", { n: row.minutes })}</span>
        ) : null}
        <span className="tp-badge" data-tone={row.status === "accepted" ? "done" : "neutral"} data-component="Badge">
          <TpIcon name={STATUS_ICON[row.status]} size="sm" />
          <span>{copy(`rec.rev.st.${row.status}`)}</span>
        </span>
      </div>
      {row.source ? (
        <p className="tp-proposal__note">
          <span>{copy("rec.rev.from")}</span>{" "}
          <q dir="auto">{row.source}</q>
        </p>
      ) : null}
      {row.status === "pending" || editing ? (
        <div className="tp-proposal__actions">
          {editing ? (
            <button type="button" className="tp-btn tp-btn--secondary tp-btn--sm" onClick={() => setEditing(false)}>
              <TpIcon name="check" size="sm" />
              <span>{copy("rec.rev.doneEdit")}</span>
            </button>
          ) : (
            <>
              <button type="button" className="tp-btn tp-btn--secondary tp-btn--sm" onClick={() => onStatus("accepted")}>
                <TpIcon name="check" size="sm" />
                <span>{copy("rec.rev.accept")}</span>
              </button>
              <button type="button" className="tp-btn tp-btn--ghost tp-btn--sm" onClick={() => setEditing(true)}>
                <TpIcon name="edit" size="sm" />
                <span>{copy("rec.rev.edit")}</span>
              </button>
              <button type="button" className="tp-btn tp-btn--ghost tp-btn--sm" onClick={() => onStatus("rejected")}>
                <TpIcon name="x" size="sm" />
                <span>{copy("rec.rev.reject")}</span>
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="tp-proposal__note">
          <button type="button" className="tp-btn tp-btn--ghost tp-btn--sm" onClick={() => onStatus("pending")}>
            <TpIcon name="undo" size="sm" />
            <span>{copy("rec.rev.change")}</span>
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Step 3: review. The title, the summary (when the assistant made one), the editable transcript,
 * the pins and the suggested tasks as Accept / Edit / Reject rows, labelled by where they came
 * from. Nothing is saved until the one primary button, "Save page and tasks".
 */
export function ReviewStep({
  copy,
  title,
  onTitle,
  summary,
  transcript,
  onTranscript,
  pins,
  rows,
  rowSource,
  proposing,
  onRowStatus,
  onRowEdit,
  saving,
  saveError,
  waiting = false,
  titleMissing = false,
  onSave,
  onBack,
}: {
  copy: RecordCopy;
  title: string;
  onTitle: (title: string) => void;
  summary: string;
  transcript: string;
  onTranscript: (text: string) => void;
  pins: readonly Pin[];
  rows: readonly ReviewRow[];
  rowSource: RowSource;
  proposing: boolean;
  onRowStatus: (id: string, status: RowStatus) => void;
  onRowEdit: (id: string, patch: { title?: string; minutes?: number | null }) => void;
  saving: boolean;
  saveError: boolean;
  /** Save was pressed offline (or the connection went while saving): it waits for the connection. */
  waiting?: boolean;
  /** The screen found no title when a waiting save went: flagged as a Save here would flag it. */
  titleMissing?: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  const [ownTitleError, setTitleError] = useState(false);
  const titleError = ownTitleError || titleMissing;
  const count = acceptedTasks(rows).length;
  const save = () => {
    if (title.trim().length === 0) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    onSave();
  };
  return (
    <section className="tp-surface tp-rec-step" aria-labelledby="rec-review-h" data-step="review">
      <div className="tp-section__head">
        <h2 className="tp-section__title" id="rec-review-h">
          {copy("rec.rev.h")}
        </h2>
      </div>
      <p className="tp-help">{copy("rec.rev.sub")}</p>

      <div className="tp-field">
        <label className="tp-label" htmlFor="rec-title">
          {copy("rec.rev.title")}
        </label>
        <input
          id="rec-title"
          className="tp-input"
          dir="auto"
          value={title}
          maxLength={200}
          aria-invalid={titleError || undefined}
          aria-describedby={titleError ? "rec-title-error" : undefined}
          onChange={(event) => onTitle(event.target.value)}
        />
        {titleError ? (
          <p className="tp-error-text" id="rec-title-error" role="alert">
            <TpIcon name="alert" size="sm" />
            <span>{copy("rec.rev.titleError")}</span>
          </p>
        ) : null}
      </div>

      {summary ? (
        <div className="tp-field">
          <h3 className="tp-label">{copy("rec.rev.summary")}</h3>
          <p dir="auto">{summary}</p>
        </div>
      ) : null}

      <div className="tp-rec-review">
        <div className="tp-section">
          <div className="tp-section__head">
            <h3 className="tp-section__title" id="rec-tasks-h">
              {copy("rec.rev.tasks")}
            </h3>
            <span className="tp-badge" data-tone="info" data-component="Badge" data-source={rowSource}>
              <TpIcon name={rowSource === "model" ? "sparkle" : "list"} size="sm" />
              <span>{rowSource === "model" ? copy("rec.rev.fromModel") : copy("rec.rev.fromLocal")}</span>
            </span>
          </div>
          {proposing ? (
            <output className="tp-help">{copy("rec.rev.loading")}</output>
          ) : null}
          {rows.length === 0 ? (
            <p className="tp-help">{copy("rec.rev.none")}</p>
          ) : (
            <ul className="tp-rec-rows" aria-labelledby="rec-tasks-h">
              {rows.map((row) => (
                <TaskRow
                  key={row.id}
                  copy={copy}
                  row={row}
                  onStatus={(status) => onRowStatus(row.id, status)}
                  onEdit={(patch) => onRowEdit(row.id, patch)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="tp-section">
          {pins.length > 0 ? (
            <div className="tp-field">
              <h3 className="tp-label">{copy("rec.rev.pins")}</h3>
              <ol className="tp-rec-pinlist">
                {pins.map((pin) => (
                  <li className="tp-rec-pin" key={pin.id}>
                    <span className="tp-num tp-mono tp-rec-pin__time" dir="ltr">
                      {formatClock(pin.atMs)}
                    </span>
                    <span dir="auto">{pin.note}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="tp-field">
            <label className="tp-label" htmlFor="rec-transcript">
              {copy("rec.rev.transcript")}
            </label>
            <textarea
              id="rec-transcript"
              className="tp-textarea tp-rec-notes"
              dir="auto"
              rows={12}
              value={transcript}
              aria-describedby="rec-transcript-help"
              onChange={(event) => onTranscript(event.target.value)}
            />
            <p className="tp-help" id="rec-transcript-help">
              {copy("rec.rev.transcriptHelp")}
            </p>
          </div>
        </div>
      </div>

      {saveError ? (
        <p className="tp-error-text" role="alert">
          <TpIcon name="alert" size="sm" />
          <span>{copy("rec.rev.saveError")}</span>
        </p>
      ) : null}
      <div className="tp-form__actions tp-rec-dock">
        <button type="button" className="tp-btn tp-btn--ghost" onClick={onBack} disabled={saving}>
          <TpIcon name="chevron" size="sm" className="tp-icon--back" />
          <span>{copy("rec.rev.back")}</span>
        </button>
        {/* A waiting Save uses aria-disabled, so it keeps focus; pressing it again changes nothing. */}
        <button
          type="button"
          className="tp-btn tp-btn--primary"
          onClick={save}
          disabled={saving && !waiting}
          aria-disabled={waiting || undefined}
          aria-busy={saving || undefined}
          aria-describedby="rec-save-note"
        >
          <TpIcon name={waiting ? "wifi-off" : "check"} size="sm" />
          <span>{waiting ? copy("rec.rev.waiting") : saving ? copy("rec.rev.saving") : copy("rec.rev.save")}</span>
        </button>
        <span className="tp-help" id="rec-save-note">
          {copy("rec.rev.saveNote", { n: count })}
        </span>
      </div>
    </section>
  );
}
