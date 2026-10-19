"use client";

import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { type FormEvent, type RefObject, useRef, useState } from "react";
import { canEnable } from "@/components/nags/nagRules";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";
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
import { type Kb67Lang, kb67t } from "@/lib/i18n-groups/kb-67";
import {
  checkNagLabel,
  checkPhrase,
  nagCounts,
  shownPhrases,
  undoTurnsBackOn,
  type WordsProblem,
} from "@/lib/you/nags";
import { deriveScreenState, fill, UNDO_WINDOW_MS } from "@/lib/you/screenState";
import "@/app/v3/kb-67.css";

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
type PhraseFeedback = { kind: "saving" | "saved" | "error"; revision: number };
export type NagSuggestionNote = { kind: "pending" | "needOwn" | "empty" | "error"; label?: string };

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
  const { t, lang } = useLocale();
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
  const [phraseDrafts, setPhraseDrafts] = useState<Record<string, string>>({});
  const [phraseProblems, setPhraseProblems] = useState<Record<string, WordsProblem | null>>({});
  const [phraseFeedback, setPhraseFeedback] = useState<Record<string, PhraseFeedback | null>>({});
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({});
  const [notesByNag, setNotesByNag] = useState<Record<string, NagSuggestionNote | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ nagId: string; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [live, setLive] = useState("");
  const keyRef = useRef(0);
  const busyRef = useRef(false);
  const phraseRevisions = useRef<Record<string, number>>({});
  const selectedIdRef = useRef<string | null>(null);
  const phraseRef = useRef<HTMLTextAreaElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  const list: Nag[] = nags ?? [];
  const chosen = list.find((nag) => nag._id === chosenId) ?? list[0] ?? null;
  selectedIdRef.current = chosen?._id ?? null;
  // The latest list, for an Undo that runs minutes after the render that offered it.
  const latest = useRef(list);
  latest.current = list;

  /** One action at a time; failures land next to the nag they belong to. */
  async function run(
    key: string,
    nagId: string | null,
    work: () => Promise<void>,
    onFailure?: (error: unknown) => void
  ) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(key);
    setRowError(null);
    try {
      await work();
    } catch (error) {
      if (onFailure) {
        onFailure(error);
        return;
      }
      const raw = error instanceof Error ? error.message : "";
      const text = raw.includes("Add a phrase you accept first.")
        ? t("ng.why")
        : t("you.saveError");
      if (nagId) setRowError({ nagId, text });
      else setLabelFailed(true);
    } finally {
      busyRef.current = false;
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
    const nag = chosen;
    const id = nag._id;
    if (busyRef.current) return;
    const check = checkPhrase(phraseDrafts[id] ?? "");
    if (!check.ok) {
      setPhraseProblems((all) => ({ ...all, [id]: check.problem }));
      phraseRef.current?.focus();
      return;
    }
    const submittedRevision = phraseRevisions.current[id] ?? 0;
    setPhraseProblems((all) => ({ ...all, [id]: null }));
    setPhraseFeedback((all) => ({ ...all, [id]: { kind: "saving", revision: submittedRevision } }));
    void run(
      "add",
      id,
      async () => {
        await addPhrase({ nagId: id, text: check.text, source: "user" });
        if ((phraseRevisions.current[id] ?? 0) === submittedRevision) {
          setPhraseDrafts((all) => ({ ...all, [id]: "" }));
          setPhraseFeedback((all) => ({
            ...all,
            [id]: { kind: "saved", revision: submittedRevision },
          }));
        } else {
          setPhraseFeedback((all) => ({ ...all, [id]: null }));
        }
        setLive(kb67t(lang as Kb67Lang, "phrase.addedTo", { label: nag.label }));
        announceIfNowOn(nag);
      },
      () => {
        if ((phraseRevisions.current[id] ?? 0) !== submittedRevision) {
          setPhraseFeedback((all) => ({ ...all, [id]: null }));
          return;
        }
        setPhraseFeedback((all) => ({
          ...all,
          [id]: { kind: "error", revision: submittedRevision },
        }));
        if (selectedIdRef.current === id) phraseRef.current?.focus();
      }
    );
  };

  const onSuggest = () => {
    if (!chosen || busyRef.current) return;
    const nag = chosen;
    const id = nag._id;
    const hasOwn = nag.phrases.some((p) => p.source === "user" && p.status === "accepted");
    if (!hasOwn) {
      setNotesByNag((all) => ({ ...all, [id]: { kind: "needOwn" } }));
      return;
    }
    setNotesByNag((all) => ({ ...all, [id]: { kind: "pending", label: nag.label } }));
    void run(
      "suggest",
      id,
      async () => {
        const result = await proposePhrases({ nagId: id });
        const next = result.proposals.map((text) => {
          keyRef.current += 1;
          return { key: `s${keyRef.current}`, text };
        });
        setSuggestions((all) => ({ ...all, [id]: next }));
        setNotesByNag((all) => ({ ...all, [id]: next.length === 0 ? { kind: "empty" } : null }));
      },
      () => setNotesByNag((all) => ({ ...all, [id]: { kind: "error" } }))
    );
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

  /**
   * Remove = reject an accepted phrase; Undo accepts it again, and turns the nag back on only if
   * the removal is what turned it off (a later Off by hand stands).
   */
  const removePhrase = (nag: Nag, phraseId: string) =>
    run(phraseId, nag._id, async () => {
      await decidePhrase({ nagId: nag._id, phraseId, decision: "reject" });
      const left = nag.phrases.filter((p) => p.status === "accepted" && p.id !== phraseId).length;
      if (left === 0) setLive(t("ng.lastOff"));
      setToast({
        title: t("ng.removed"),
        untilMs: Date.now() + UNDO_WINDOW_MS,
        onUndo: async () => {
          const now = latest.current.find((row) => row._id === nag._id);
          const turnOn = undoTurnsBackOn(nag, now, phraseId);
          await decidePhrase({ nagId: nag._id, phraseId, decision: "accept" });
          if (turnOn) await setEnabled({ nagId: nag._id, enabled: true });
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
  const onPhraseDraftChange = (id: Id<"nags">, text: string) => {
    phraseRevisions.current[id] = (phraseRevisions.current[id] ?? 0) + 1;
    setPhraseDrafts((all) => ({ ...all, [id]: text }));
    setPhraseProblems((all) => ({ ...all, [id]: null }));
    setPhraseFeedback((all) => ({ ...all, [id]: all[id]?.kind === "saving" ? all[id] : null }));
  };

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
            <SelectedNagPhraseForm
              nags={list}
              selectedNag={chosen}
              draft={phraseDrafts[chosen._id] ?? ""}
              problem={phraseProblems[chosen._id] ?? null}
              feedback={phraseFeedback[chosen._id] ?? null}
              revision={phraseRevisions.current[chosen._id] ?? 0}
              note={notesByNag[chosen._id] ?? null}
              busy={busy}
              phraseRef={phraseRef}
              onSelect={(id) => {
                selectedIdRef.current = id;
                setChosenId(id);
              }}
              onDraftChange={(text) => onPhraseDraftChange(chosen._id, text)}
              onSubmit={onAddPhrase}
              onSuggest={onSuggest}
            />
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

/** The selected nag's status stays beside Suggest even when another nag is opened. */
export function NagSuggestionNotice({
  note,
  id = "ng-suggest-note",
}: {
  note: NagSuggestionNote | null;
  id?: string;
}) {
  const { t, lang } = useLocale();
  if (!note) return null;
  const text =
    note.kind === "pending"
      ? kb67t(lang as Kb67Lang, "suggest.pending", { label: note.label ?? "" })
      : note.kind === "needOwn"
        ? t("ng.suggest.needOwn")
        : note.kind === "empty"
          ? t("ng.suggest.none")
          : t("ng.suggest.error");
  return note.kind === "error" ? (
    <p
      className="kb67-suggest-notice tp-error-text"
      id={id}
      role="alert"
      data-component="NagSuggestionNotice"
      data-kind={note.kind}
    >
      {text}
    </p>
  ) : (
    <output
      className="kb67-suggest-notice tp-help"
      id={id}
      data-component="NagSuggestionNotice"
      data-kind={note.kind}
    >
      {text}
    </output>
  );
}

/** The real selected-nag editor; drafts and revisions are owned by NagsContent. */
export function SelectedNagPhraseForm({
  nags,
  selectedNag,
  draft,
  problem,
  feedback,
  revision,
  note,
  busy,
  phraseRef,
  onSelect,
  onDraftChange,
  onSubmit,
  onSuggest,
}: {
  nags: readonly Nag[];
  selectedNag: Nag;
  draft: string;
  problem: WordsProblem | null;
  feedback: PhraseFeedback | null;
  revision: number;
  note: NagSuggestionNote | null;
  busy: string | null;
  phraseRef?: RefObject<HTMLTextAreaElement | null>;
  onSelect: (id: Id<"nags">) => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSuggest: () => void;
}) {
  const { t, lang } = useLocale();
  const activeFeedback =
    feedback?.revision === revision
      ? feedback.kind
      : feedback?.kind === "saving"
        ? "savingEarlier"
        : null;
  const phraseError = problem
    ? t(PHRASE_PROBLEM[problem])
    : activeFeedback === "error"
      ? kb67t(lang as Kb67Lang, "phrase.error")
      : null;
  const status =
    activeFeedback === "saving"
      ? kb67t(lang as Kb67Lang, "phrase.saving")
      : activeFeedback === "savingEarlier"
        ? kb67t(lang as Kb67Lang, "phrase.savingEarlier")
        : activeFeedback === "saved"
          ? kb67t(lang as Kb67Lang, "phrase.saved", { label: selectedNag.label })
          : null;
  return (
    <section
      className="tp-surface kb67-composer"
      aria-labelledby="ng-add-title"
      data-component="SelectedNagPhraseForm"
    >
      <h2 className="tp-section__title" id="ng-add-title">
        {t("ng.add.title")}
      </h2>
      <form className="tp-form" data-component="Form" noValidate onSubmit={onSubmit}>
        <div className="tp-field" data-component="Field">
          <label className="tp-label" htmlFor="ng-add-nag">
            {t("ng.add.for")}
          </label>
          <div className="tp-select" data-component="Select">
            <select
              className="tp-select__input tp-input"
              id="ng-add-nag"
              value={selectedNag._id}
              onChange={(event) => onSelect(event.target.value as Id<"nags">)}
            >
              {nags.map((nag) => (
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
            value={draft}
            aria-invalid={phraseError ? true : undefined}
            aria-describedby={
              phraseError
                ? "ng-add-help ng-add-error"
                : status
                  ? "ng-add-help ng-add-feedback"
                  : "ng-add-help"
            }
            data-component="Textarea"
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <p className="tp-help" id="ng-add-help">
            {t("ng.add.help")}
          </p>
          {phraseError ? (
            <p className="tp-error-text" id="ng-add-error" role="alert">
              {phraseError}
            </p>
          ) : null}
          {status ? (
            <output
              className="kb67-phrase-feedback tp-help"
              id="ng-add-feedback"
              data-kind={activeFeedback}
            >
              {status}
            </output>
          ) : null}
        </div>
        <div className="tp-form__actions">
          <button className="tp-btn tp-btn--primary" type="submit" disabled={busy !== null}>
            <TpIcon name="plus" size="sm" />
            <span>{t("ng.add.btn")}</span>
          </button>
          <button
            className="tp-btn tp-btn--secondary"
            type="button"
            disabled={busy !== null}
            aria-describedby={note ? "ng-suggest-note" : undefined}
            onClick={onSuggest}
          >
            <TpIcon name="sparkle" size="sm" />
            <span>{busy === "suggest" ? t("ng.suggesting") : t("ng.suggest")}</span>
          </button>
        </div>
        <NagSuggestionNotice note={note} />
      </form>
    </section>
  );
}

type Kb67GalleryState =
  | "default"
  | "empty"
  | "pending"
  | "success"
  | "error"
  | "disabled"
  | "overflow";
/** Fictional interactive states using the same form and notice as /settings/nags. */
export function Kb67Gallery() {
  const { lang, setLang } = useLocale();
  const [state, setState] = useState<Kb67GalleryState>("default");
  const [selectedId, setSelectedId] = useState<Id<"nags">>("gallery-maya" as Id<"nags">);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, PhraseFeedback | null>>({});
  const [notes, setNotes] = useState<Record<string, NagSuggestionNote | null>>({});
  const nags: Nag[] = [
    {
      _id: "gallery-maya" as Id<"nags">,
      label:
        state === "overflow"
          ? "Maya's very long fictional morning routine with extra words for a narrow phone"
          : "Maya's morning",
      enabled: true,
      phrases: [
        {
          id: "gallery-own",
          text: "Take a small stretch break",
          source: "user",
          status: "accepted",
        },
      ],
    },
    { _id: "gallery-dana" as Id<"nags">, label: "Dana's water break", enabled: false, phrases: [] },
    { _id: "gallery-yoni" as Id<"nags">, label: "Yoni's reading", enabled: false, phrases: [] },
  ];
  const selectedNag = nags.find((nag) => nag._id === selectedId) ?? nags[0];
  const choices: readonly Kb67GalleryState[] = [
    "default",
    "empty",
    "pending",
    "success",
    "error",
    "disabled",
    "overflow",
  ];
  const chooseState = (next: Kb67GalleryState) => {
    setState(next);
    const revision = revisions[selectedId] ?? 0;
    setFeedback((all) => ({
      ...all,
      [selectedId]:
        next === "pending"
          ? { kind: "saving", revision }
          : next === "success"
            ? { kind: "saved", revision }
            : next === "error"
              ? { kind: "error", revision }
              : null,
    }));
    setNotes((all) => ({
      ...all,
      [selectedId]:
        next === "empty"
          ? { kind: "empty" }
          : next === "pending"
            ? { kind: "pending", label: selectedNag.label }
            : next === "error"
              ? { kind: "error" }
              : null,
    }));
  };
  return (
    <main
      className="kb67-gallery"
      lang={lang}
      dir={lang === "he" ? "rtl" : "ltr"}
      data-component="Kb67Gallery"
    >
      <TpIconSprite />
      <h1>{kb67t(lang as Kb67Lang, "gallery.title")}</h1>
      <fieldset className="kb67-gallery__controls">
        <legend className="tp-sr-only">{kb67t(lang as Kb67Lang, "gallery.controls")}</legend>
        <button type="button" lang="en" aria-pressed={lang === "en"} onClick={() => setLang("en")}>
          English
        </button>
        <button type="button" lang="he" aria-pressed={lang === "he"} onClick={() => setLang("he")}>
          עברית
        </button>
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={state === choice}
            onClick={() => chooseState(choice)}
          >
            {kb67t(lang as Kb67Lang, `gallery.${choice}`)}
          </button>
        ))}
      </fieldset>
      <SelectedNagPhraseForm
        nags={nags}
        selectedNag={selectedNag}
        draft={drafts[selectedId] ?? ""}
        problem={null}
        feedback={feedback[selectedId] ?? null}
        revision={revisions[selectedId] ?? 0}
        note={notes[selectedId] ?? null}
        busy={state === "disabled" ? "gallery" : null}
        onSelect={setSelectedId}
        onDraftChange={(text) => {
          setDrafts((all) => ({ ...all, [selectedId]: text }));
          setRevisions((all) => ({ ...all, [selectedId]: (all[selectedId] ?? 0) + 1 }));
          setFeedback((all) => ({ ...all, [selectedId]: null }));
        }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!(drafts[selectedId] ?? "").trim()) return;
          setDrafts((all) => ({ ...all, [selectedId]: "" }));
          chooseState("success");
        }}
        onSuggest={() => chooseState("pending")}
      />
    </main>
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
