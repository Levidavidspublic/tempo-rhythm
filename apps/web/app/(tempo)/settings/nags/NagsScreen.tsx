"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { type FormEvent, useRef, useState } from "react";
import { canEnable } from "@/components/nags/nagRules";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { Switch } from "@/components/you/Controls";
import {
  LiveMessage,
  RetryRoot,
  StateEmpty,
  StateError,
  StateLoading,
  StateOffline,
  StateSignedOut,
  useLoadingTimeout,
} from "@/components/you/ScreenStates";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import {
  checkNagLabel,
  checkPhrase,
  nagCounts,
  shownPhrases,
  type WordsProblem,
} from "@/lib/you/nags";
import { deriveScreenState, fill, UNDO_WINDOW_MS } from "@/lib/you/screenState";

/**
 * Nags (docs/design/v3/screens/web/nags.html): nudges in the person's own words. A nag can
 * only turn on with at least one accepted phrase (the server refuses otherwise). Suggested
 * phrases come from the person's own words and are never used until accepted (AI accept /
 * reject); removing a phrase has a 5-minute Undo.
 *
 * Kept for the e2e specs: the "settings-nags" test id, the "Nags" heading, #nag-new-label with
 * "Add nag", the "<name> on" switch (disabled with "Add a phrase in your own words to switch
 * this on."), the "In your own words" field with "Add phrase", and "Suggest from my words".
 */

type Nag = {
  _id: Id<"nags">;
  label: string;
  enabled: boolean;
  phrases: Doc<"nags">["phrases"];
};
type Suggestion = { key: string; text: string };
type Toast = { title: string; untilMs: number; onUndo?: () => Promise<unknown> };

const LABEL_PROBLEM: Record<WordsProblem, MessageKey> = {
  empty: "ng.new.empty",
  long: "ng.new.long",
  emoji: "ng.new.emoji",
};
const PHRASE_PROBLEM: Record<WordsProblem, MessageKey> = {
  empty: "ng.add.empty",
  long: "ng.add.long",
  emoji: "ng.add.emoji",
};

function NagsHead() {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("ng.title")}</h1>
        <p className="tp-pagehead__sub">{t("ng.sub")}</p>
      </div>
    </header>
  );
}

export function NagsScreen() {
  const { t } = useLocale();
  return (
    <RetryRoot
      render={(retry) => <NagsContent onRetry={retry} />}
      fallback={(retry) => (
        <div
          className="tp-page tp-page--narrow"
          data-component="PageLayout"
          data-testid="settings-nags"
        >
          <NagsHead />
          <StateError
            className="ng-state"
            title={t("ng.error.t")}
            body={t("ng.error.b")}
            onRetry={retry}
          />
        </div>
      )}
    />
  );
}

function NagsContent({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  // nags.list calls requireUser: wait for the users row.
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const nags = useQuery(api.nags.list, isAuthenticated && profile ? {} : "skip");
  const create = useMutation(api.nags.create);
  const addPhrase = useMutation(api.nags.addPhrase);
  const decidePhrase = useMutation(api.nags.decidePhrase);
  const setEnabled = useMutation(api.nags.setEnabled);
  const removeNag = useMutation(api.nags.remove);
  const proposePhrases = useAction(api.nags.proposePhrases);
  const input = { isAuthLoading, isAuthenticated, profile, data: nags };
  const timedOut = useLoadingTimeout(deriveScreenState({ ...input, failed: false }) === "loading");
  const state = deriveScreenState({ ...input, failed: timedOut });

  const [label, setLabel] = useState("");
  const [labelProblem, setLabelProblem] = useState<WordsProblem | null>(null);
  const [labelFailed, setLabelFailed] = useState(false);
  const [chosenId, setChosenId] = useState<Id<"nags"> | null>(null);
  const [phrase, setPhrase] = useState("");
  const [phraseProblem, setPhraseProblem] = useState<WordsProblem | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [note, setNote] = useState<{ text: string; alert: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ nagId: string; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [live, setLive] = useState("");
  const keyRef = useRef(0);
  const phraseRef = useRef<HTMLTextAreaElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const list: Nag[] = nags ?? [];
  const chosen = list.find((nag) => nag._id === chosenId) ?? list[0] ?? null;

  /** One action at a time; failures land next to the nag they belong to. */
  async function run(key: string, nagId: string | null, work: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setRowError(null);
    try {
      await work();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";
      const text = raw.includes("Add a phrase you accept first.")
        ? t("ng.why")
        : t("you.saveError");
      if (nagId) setRowError({ nagId, text });
      else setNote({ text, alert: true });
    } finally {
      setBusy(null);
    }
  }

  const announceIfNowOn = (nag: Nag) => {
    if (!canEnable(nag)) setLive(t("ng.nowOn"));
  };

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const check = checkNagLabel(label);
    if (!check.ok) {
      setLabelProblem(check.problem);
      labelRef.current?.focus();
      return;
    }
    setLabelProblem(null);
    setLabelFailed(false);
    void run("create", null, async () => {
      try {
        const id = await create({ label: check.text });
        setLabel("");
        setChosenId(id);
        setLive(t("ng.nagAdded"));
      } catch {
        setLabelFailed(true);
      }
    });
  };

  const onAddPhrase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chosen) return;
    const check = checkPhrase(phrase);
    if (!check.ok) {
      setPhraseProblem(check.problem);
      phraseRef.current?.focus();
      return;
    }
    setPhraseProblem(null);
    setNote(null);
    const nag = chosen;
    void run("add", nag._id, async () => {
      await addPhrase({ nagId: nag._id, text: check.text, source: "user" });
      setPhrase("");
      setLive(t("ng.added"));
      announceIfNowOn(nag);
    });
  };

  const onSuggest = () => {
    if (!chosen || busy) return;
    const nag = chosen;
    const hasOwn = nag.phrases.some((p) => p.source === "user" && p.status === "accepted");
    if (!hasOwn) {
      setNote({ text: t("ng.suggest.needOwn"), alert: false });
      return;
    }
    setNote(null);
    setBusy("suggest");
    proposePhrases({ nagId: nag._id })
      .then((result) => {
        const next = result.proposals.map((text) => {
          keyRef.current += 1;
          return { key: `s${keyRef.current}`, text };
        });
        setSuggestions((all) => ({ ...all, [nag._id]: next }));
        setNote(next.length === 0 ? { text: t("ng.suggest.none"), alert: false } : null);
      })
      .catch(() => setNote({ text: t("ng.suggest.error"), alert: true }))
      .finally(() => setBusy(null));
  };

  const dropSuggestion = (nagId: string, key: string) =>
    setSuggestions((all) => ({ ...all, [nagId]: (all[nagId] ?? []).filter((s) => s.key !== key) }));

  const acceptSuggestion = (nag: Nag, suggestion: Suggestion) =>
    run(suggestion.key, nag._id, async () => {
      const { phraseId } = await addPhrase({
        nagId: nag._id,
        text: suggestion.text,
        source: "derived",
      });
      dropSuggestion(nag._id, suggestion.key);
      await decidePhrase({ nagId: nag._id, phraseId, decision: "accept" });
      setLive(t("ng.acceptedMsg"));
      announceIfNowOn(nag);
    });

  const rejectSuggestion = (nag: Nag, suggestion: Suggestion) => {
    dropSuggestion(nag._id, suggestion.key);
    setLive(t("ng.rejected"));
  };

  const decideSaved = (nag: Nag, phraseId: string, decision: "accept" | "reject") =>
    run(phraseId, nag._id, async () => {
      await decidePhrase({ nagId: nag._id, phraseId, decision });
      setLive(t(decision === "accept" ? "ng.acceptedMsg" : "ng.rejected"));
      if (decision === "accept") announceIfNowOn(nag);
    });

  /** Remove = reject an accepted phrase; Undo accepts it again and turns the nag back on. */
  const removePhrase = (nag: Nag, phraseId: string) =>
    run(phraseId, nag._id, async () => {
      const wasOn = nag.enabled;
      await decidePhrase({ nagId: nag._id, phraseId, decision: "reject" });
      const left = nag.phrases.filter((p) => p.status === "accepted" && p.id !== phraseId).length;
      if (left === 0) setLive(t("ng.lastOff"));
      setToast({
        title: t("ng.removed"),
        untilMs: Date.now() + UNDO_WINDOW_MS,
        onUndo: async () => {
          await decidePhrase({ nagId: nag._id, phraseId, decision: "accept" });
          if (wasOn) await setEnabled({ nagId: nag._id, enabled: true });
        },
      });
    });

  const toggle = (nag: Nag) =>
    run(`switch-${nag._id}`, nag._id, async () => {
      await setEnabled({ nagId: nag._id, enabled: !nag.enabled });
    });

  const deleteNag = (nag: Nag) =>
    run(`delete-${nag._id}`, nag._id, async () => {
      await removeNag({ nagId: nag._id });
      setConfirmDeleteId(null);
      setLive(t("ng.deleted"));
    });

  const counts = nagCounts(list);
  const labelError = labelProblem
    ? t(LABEL_PROBLEM[labelProblem])
    : labelFailed
      ? t("you.saveError")
      : null;
  const phraseError = phraseProblem ? t(PHRASE_PROBLEM[phraseProblem]) : null;

  return (
    <div
      className="tp-page tp-page--narrow"
      data-component="PageLayout"
      data-testid="settings-nags"
    >
      <NagsHead />
      <StateOffline />
      <LiveMessage text={live} />
      {state === "loading" ? (
        <div className="ng-state">
          <StateLoading label={t("ng.loading")} rows={4} />
        </div>
      ) : null}
      {state === "error" ? (
        <StateError
          className="ng-state"
          title={t("ng.error.t")}
          body={t("ng.error.b")}
          onRetry={onRetry}
        />
      ) : null}
      {state === "signed-out" ? <StateSignedOut /> : null}
      {state === "ready" ? (
        <div className="ng-body">
          <section className="tp-surface" aria-labelledby="ng-new-title">
            <h2 className="tp-section__title" id="ng-new-title">
              {t("ng.new.title")}
            </h2>
            <form className="tp-form" data-component="Form" noValidate onSubmit={onCreate}>
              <div className="tp-field" data-component="Field">
                <label className="tp-label" htmlFor="nag-new-label">
                  {t("ng.new.label")}
                </label>
                <input
                  ref={labelRef}
                  className="tp-input"
                  id="nag-new-label"
                  dir="auto"
                  autoComplete="off"
                  value={label}
                  aria-invalid={labelError ? true : undefined}
                  aria-describedby={labelError ? "nag-new-help nag-new-error" : "nag-new-help"}
                  onChange={(event) => {
                    setLabel(event.target.value);
                    setLabelProblem(null);
                    setLabelFailed(false);
                  }}
                />
                <p className="tp-help" id="nag-new-help">
                  {t("ng.new.help")}
                </p>
                {labelError ? (
                  <p className="tp-error-text" id="nag-new-error" role="alert">
                    {labelError}
                  </p>
                ) : null}
              </div>
              <div className="tp-form__actions">
                <button
                  className="tp-btn tp-btn--secondary"
                  type="submit"
                  disabled={busy === "create"}
                >
                  <TpIcon name="plus" size="sm" />
                  <span>{t("ng.new.btn")}</span>
                </button>
              </div>
            </form>
          </section>

          {chosen ? (
            <section className="tp-surface" aria-labelledby="ng-add-title">
              <h2 className="tp-section__title" id="ng-add-title">
                {t("ng.add.title")}
              </h2>
              <form className="tp-form" data-component="Form" noValidate onSubmit={onAddPhrase}>
                <div className="tp-field" data-component="Field">
                  <label className="tp-label" htmlFor="ng-add-nag">
                    {t("ng.add.for")}
                  </label>
                  <div className="tp-select" data-component="Select">
                    <select
                      className="tp-select__input tp-input"
                      id="ng-add-nag"
                      value={chosen._id}
                      onChange={(event) => {
                        setChosenId(event.target.value as Id<"nags">);
                        setNote(null);
                      }}
                    >
                      {list.map((nag) => (
                        // The label attribute keeps the name out of the page text, so the name
                        // shows once (on its card) for finders and screen readers alike.
                        <option key={nag._id} value={nag._id} label={nag.label} />
                      ))}
                    </select>
                    <TpIcon name="down" size="sm" className="tp-select__icon" />
                  </div>
                </div>
                <div className="tp-field" data-component="Field">
                  <label className="tp-label" htmlFor="ng-add-text">
                    {t("ng.add.label")}
                  </label>
                  <textarea
                    ref={phraseRef}
                    className="tp-textarea"
                    id="ng-add-text"
                    rows={2}
                    dir="auto"
                    placeholder={t("ng.add.ph")}
                    value={phrase}
                    aria-invalid={phraseError ? true : undefined}
                    aria-describedby={phraseError ? "ng-add-help ng-add-error" : "ng-add-help"}
                    data-component="Textarea"
                    onChange={(event) => {
                      setPhrase(event.target.value);
                      setPhraseProblem(null);
                    }}
                  />
                  <p className="tp-help" id="ng-add-help">
                    {t("ng.add.help")}
                  </p>
                  {phraseError ? (
                    <p className="tp-error-text" id="ng-add-error" role="alert">
                      {phraseError}
                    </p>
                  ) : null}
                </div>
                <div className="tp-form__actions">
                  <button
                    className="tp-btn tp-btn--primary"
                    type="submit"
                    disabled={busy === "add"}
                  >
                    <TpIcon name="plus" size="sm" />
                    <span>{t("ng.add.btn")}</span>
                  </button>
                  <button
                    className="tp-btn tp-btn--secondary"
                    type="button"
                    disabled={busy === "suggest"}
                    aria-describedby={note ? "ng-suggest-note" : undefined}
                    onClick={onSuggest}
                  >
                    <TpIcon name="sparkle" size="sm" />
                    <span>{busy === "suggest" ? t("ng.suggesting") : t("ng.suggest")}</span>
                  </button>
                </div>
                {note ? (
                  <p
                    className={note.alert ? "tp-error-text" : "tp-help"}
                    id="ng-suggest-note"
                    role={note.alert ? "alert" : "status"}
                  >
                    {note.text}
                  </p>
                ) : null}
              </form>
            </section>
          ) : null}

          <section className="tp-section" aria-labelledby="ng-list-title" data-component="Section">
            <div className="tp-section__head">
              <h2 className="tp-section__title" id="ng-list-title">
                {t("ng.list.title")}
              </h2>
              {list.length > 0 ? (
                <span className="tp-section__count">
                  {fill(t("ng.list.count"), { n: counts.total, on: counts.on })}
                </span>
              ) : null}
            </div>
            {list.length === 0 ? (
              <StateEmpty
                className="ng-state"
                icon="nag"
                title={t("ng.empty.t")}
                body={t("ng.empty.b")}
              />
            ) : (
              list.map((nag) => (
                <NagCard
                  key={nag._id}
                  nag={nag}
                  suggestions={suggestions[nag._id] ?? []}
                  busy={busy}
                  error={rowError?.nagId === nag._id ? rowError.text : null}
                  confirmingDelete={confirmDeleteId === nag._id}
                  onToggle={() => void toggle(nag)}
                  onAcceptSuggestion={(s) => void acceptSuggestion(nag, s)}
                  onRejectSuggestion={(s) => rejectSuggestion(nag, s)}
                  onDecide={(id, decision) => void decideSaved(nag, id, decision)}
                  onRemove={(id) => void removePhrase(nag, id)}
                  onAskDelete={() => setConfirmDeleteId(nag._id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onDelete={() => void deleteNag(nag)}
                />
              ))
            )}
          </section>
        </div>
      ) : null}
      {toast ? (
        <UndoToast
          key={toast.untilMs}
          title={toast.title}
          untilMs={toast.untilMs}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

function NagCard({
  nag,
  suggestions,
  busy,
  error,
  confirmingDelete,
  onToggle,
  onAcceptSuggestion,
  onRejectSuggestion,
  onDecide,
  onRemove,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  nag: Nag;
  suggestions: readonly Suggestion[];
  busy: string | null;
  error: string | null;
  confirmingDelete: boolean;
  onToggle: () => void;
  onAcceptSuggestion: (s: Suggestion) => void;
  onRejectSuggestion: (s: Suggestion) => void;
  onDecide: (phraseId: string, decision: "accept" | "reject") => void;
  onRemove: (phraseId: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const allowed = canEnable(nag);
  const accepted = nag.phrases.filter((p) => p.status === "accepted").length;
  const phrases = shownPhrases(nag.phrases);
  const base = `ng-${nag._id}`;
  const countText =
    accepted === 0
      ? t("ng.accepted.none")
      : accepted === 1
        ? t("ng.accepted.one")
        : fill(t("ng.accepted.many"), { n: accepted });

  return (
    <article
      className="tp-settings-section tp-surface ng-nag"
      aria-labelledby={`${base}-title`}
      data-component="SettingsSection"
    >
      <div className="tp-setting-row" data-component="SettingRow">
        <div className="tp-setting-row__text">
          <h3 className="tp-setting-row__label" id={`${base}-title`} dir="auto">
            {nag.label}
          </h3>
          <span className="tp-help">{countText}</span>
        </div>
        <div className="tp-setting-row__control">
          <Switch
            on={nag.enabled}
            label={fill(t("ng.switch"), { label: nag.label })}
            describedBy={allowed ? undefined : `${base}-why`}
            disabled={busy === `switch-${nag._id}` || (!allowed && !nag.enabled)}
            onToggle={onToggle}
          />
        </div>
      </div>
      {allowed ? null : (
        <p className="tp-help" id={`${base}-why`}>
          <TpIcon name="info" size="sm" /> <span>{t("ng.why")}</span>
        </p>
      )}
      {error ? (
        <p className="tp-error-text" role="alert">
          {error}
        </p>
      ) : null}
      {phrases.length === 0 && suggestions.length === 0 ? (
        <p className="tp-help">{t("ng.noPhrases")}</p>
      ) : (
        <ul className="tp-list">
          {phrases.map((phrase) => {
            const id = `${base}-${phrase.id}`;
            const suggested = phrase.status === "proposed";
            return (
              <li
                className="tp-list-row"
                key={phrase.id}
                data-component="ListRow"
                data-status={suggested ? "suggested" : "accepted"}
              >
                <span className="tp-list-row__icon">
                  <TpIcon name={phrase.source === "user" ? "user" : "sparkle"} size="sm" />
                </span>
                <span className="tp-list-row__body">
                  <span className="tp-list-row__title" dir="auto" id={id}>
                    {phrase.text}
                  </span>
                  <span className="tp-list-row__meta">
                    {suggested ? (
                      <>
                        <span className="tp-badge" data-component="Badge">
                          {t("ng.suggested")}
                        </span>{" "}
                        <span>{t("ng.madeFrom")}</span>
                      </>
                    ) : (
                      t(phrase.source === "user" ? "ng.yourWords" : "ng.madeFrom")
                    )}
                  </span>
                </span>
                {suggested ? (
                  <span className="tp-list-row__end ng-row-actions">
                    <button
                      className="tp-btn tp-btn--secondary tp-btn--sm"
                      type="button"
                      aria-describedby={id}
                      disabled={busy === phrase.id}
                      onClick={() => onDecide(phrase.id, "accept")}
                    >
                      <TpIcon name="check" size="sm" />
                      <span>{t("ng.accept")}</span>
                    </button>
                    <button
                      className="tp-btn tp-btn--ghost tp-btn--sm"
                      type="button"
                      aria-describedby={id}
                      disabled={busy === phrase.id}
                      onClick={() => onDecide(phrase.id, "reject")}
                    >
                      {t("ng.reject")}
                    </button>
                  </span>
                ) : (
                  <span className="tp-list-row__end">
                    <button
                      className="tp-btn tp-btn--danger-ghost tp-btn--sm"
                      type="button"
                      aria-describedby={id}
                      disabled={busy === phrase.id}
                      onClick={() => onRemove(phrase.id)}
                    >
                      <TpIcon name="x" size="sm" />
                      <span>{t("ng.remove")}</span>
                    </button>
                  </span>
                )}
              </li>
            );
          })}
          {suggestions.map((suggestion) => {
            const id = `${base}-${suggestion.key}`;
            return (
              <li
                className="tp-list-row"
                key={suggestion.key}
                data-component="ListRow"
                data-status="suggested"
              >
                <span className="tp-list-row__icon">
                  <TpIcon name="sparkle" size="sm" />
                </span>
                <span className="tp-list-row__body">
                  <span className="tp-list-row__title" dir="auto" id={id}>
                    {suggestion.text}
                  </span>
                  <span className="tp-list-row__meta">
                    <span className="tp-badge" data-component="Badge">
                      {t("ng.suggested")}
                    </span>{" "}
                    <span>{t("ng.madeFrom")}</span>
                  </span>
                </span>
                <span className="tp-list-row__end ng-row-actions">
                  <button
                    className="tp-btn tp-btn--secondary tp-btn--sm"
                    type="button"
                    aria-describedby={id}
                    disabled={busy === suggestion.key}
                    onClick={() => onAcceptSuggestion(suggestion)}
                  >
                    <TpIcon name="check" size="sm" />
                    <span>{t("ng.accept")}</span>
                  </button>
                  <button
                    className="tp-btn tp-btn--ghost tp-btn--sm"
                    type="button"
                    aria-describedby={id}
                    onClick={() => onRejectSuggestion(suggestion)}
                  >
                    {t("ng.reject")}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="ng-row-actions ng-delete">
        {confirmingDelete ? (
          <>
            <span className="tp-small">{t("ng.deleteAsk")}</span>
            <button
              className="tp-btn tp-btn--danger tp-btn--sm"
              type="button"
              disabled={busy === `delete-${nag._id}`}
              onClick={onDelete}
            >
              {t("ng.deleteYes")}
            </button>
            <button
              className="tp-btn tp-btn--ghost tp-btn--sm"
              type="button"
              onClick={onCancelDelete}
            >
              {t("ng.deleteKeep")}
            </button>
          </>
        ) : (
          <button
            className="tp-btn tp-btn--danger-ghost tp-btn--sm"
            type="button"
            aria-describedby={`${base}-title`}
            onClick={onAskDelete}
          >
            {t("ng.delete")}
          </button>
        )}
      </div>
    </article>
  );
}
