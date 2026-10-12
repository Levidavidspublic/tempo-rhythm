"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { filterByPeriod, type PeriodType, plainPreview } from "./filterNotes";
import { PeriodFilter } from "./PeriodFilter";

type RemovedNote = { noteId: Id<"notes">; undoUntilMs: number };

export function NotesList() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const rawType = params.get("type");
  const type =
    rawType === "daily" || rawType === "weekly" || rawType === "monthly" ? rawType : "all";
  const { isAuthenticated } = useConvexAuth();
  const [search, setSearch] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  // notes.list calls requireUser, which throws until the user row exists. getProfile returns null
  // instead, so subscribe only once it has resolved a user (until then: loading state, not an error).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const userId = isAuthenticated && profile ? profile._id : null;
  const notes = useQuery(api.notes.list, userId ? { search, pinnedOnly } : "skip");
  const create = useMutation(api.notes.create);
  const togglePin = useMutation(api.notes.togglePin);
  const remove = useMutation(api.notes.remove);
  const restore = useMutation(api.notes.restore);
  const [title, setTitle] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("none");
  const [removed, setRemoved] = useState<RemovedNote[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Id<"notes"> | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // Keep the last result on screen while a new search / pinned filter loads, so typing doesn't blank the list.
  // Keyed by user, so an account switch never shows the previous user's notes.
  const lastNotes = useRef<{ userId: string; value: NonNullable<typeof notes> } | null>(null);
  if (!userId) lastNotes.current = null;
  else if (notes !== undefined) lastNotes.current = { userId, value: notes };
  const shown = notes ?? (lastNotes.current?.userId === userId ? lastNotes.current?.value : undefined);
  const isLoading = isAuthenticated && shown === undefined;
  const visible = filterByPeriod(shown ?? [], type).sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );

  useEffect(() => {
    if (!removed.length) return;
    const timeout = setTimeout(
      () => {
        setRemoved((items) => items.filter((item) => item.undoUntilMs > Date.now()));
      },
      Math.max(0, Math.min(...removed.map((item) => item.undoUntilMs)) - Date.now())
    );
    return () => clearTimeout(timeout);
  }, [removed]);

  async function perform(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(t("notes.error"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const label = (note: { title: string }) => note.title || t("notes.untitled");
  const filtered = Boolean(search || pinnedOnly || type !== "all");

  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("notes.title")}</h1>
          <output className="tp-pagehead__sub">
            {isLoading
              ? t("notes.loading")
              : visible.length === 1
                ? t("notes.count.one")
                : t("notes.count.many").replace("{n}", String(visible.length))}
          </output>
        </div>
      </header>

      <form
        className="tp-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            const id = await create({
              title: title.trim() || t("notes.untitled"),
              body: "",
              periodType,
            });
            router.push(`/notes/${id}`);
          });
        }}
      >
        <div className="tp-field tp-toolbar__grow">
          <label className="tp-label" htmlFor="nt-new-title">
            {t("notes.newTitle")}
          </label>
          <input
            id="nt-new-title"
            className="tp-input"
            dir="auto"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("notes.untitled")}
          />
        </div>
        <div className="tp-field">
          <label className="tp-label" htmlFor="nt-new-type">
            {t("notes.newType")}
          </label>
          <select
            id="nt-new-type"
            className="tp-input"
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value as PeriodType)}
          >
            <option value="none">{t("notes.type.none")}</option>
            <option value="daily">{t("notes.type.daily")}</option>
            <option value="weekly">{t("notes.type.weekly")}</option>
            <option value="monthly">{t("notes.type.monthly")}</option>
          </select>
        </div>
        <button className="tp-btn tp-btn--primary" type="submit" disabled={busy || !isAuthenticated}>
          <TpIcon name="plus" size="sm" />
          <span>{t("notes.new")}</span>
        </button>
      </form>

      <div className="tp-toolbar" data-component="Toolbar">
        <div className="tp-search tp-toolbar__grow" data-component="SearchInput">
          <label className="tp-label" htmlFor="nt-search">
            {t("notes.search")}
          </label>
          <div className="tp-search__box">
            <span className="tp-search__icon">
              <TpIcon name="search" size="sm" />
            </span>
            <input
              id="nt-search"
              type="search"
              className="tp-input"
              dir="auto"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("notes.searchHint")}
            />
          </div>
        </div>
        <div className="tp-toolbar__end">
          <PeriodFilter value={type} />
          <button
            type="button"
            className="tp-btn tp-btn--secondary"
            aria-pressed={pinnedOnly}
            onClick={() => setPinnedOnly(!pinnedOnly)}
          >
            <TpIcon name="pin" size="sm" />
            <span>{t("notes.pinnedOnly")}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="tp-notice" data-tone="danger" role="alert">
          <span className="tp-notice__icon">
            <TpIcon name="alert" size="sm" />
          </span>
          <span className="tp-notice__text">{error}</span>
        </div>
      ) : null}
      {removed.map((item) => (
        <output key={item.noteId} className="tp-notice" data-tone="info">
          <span className="tp-notice__text">{t("notes.removed")}</span>
          <button
            type="button"
            className="tp-btn tp-btn--secondary tp-btn--sm tp-notice__action"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                if (Date.now() >= item.undoUntilMs) {
                  setRemoved((items) => items.filter((entry) => entry.noteId !== item.noteId));
                  setError(t("notes.undoEnded"));
                  return;
                }
                const result = await restore({ noteId: item.noteId });
                setRemoved((items) => items.filter((entry) => entry.noteId !== item.noteId));
                if (!result.success) setError(t("notes.undoEnded"));
              })
            }
          >
            {t("notes.undo")}
          </button>
        </output>
      ))}

      {!isLoading && visible.length === 0 ? (
        <div className="tp-empty" data-component="Empty">
          <TpIcon name="page" size="lg" />
          <p className="tp-h3">{filtered ? t("notes.noMatch") : t("notes.none")}</p>
          <p>{filtered ? t("notes.noMatchHint") : t("notes.noneHint")}</p>
        </div>
      ) : (
        <section className="tp-section tp-surface" aria-labelledby="nt-all-h" data-component="Section">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="nt-all-h">
              {t("notes.all")}
            </h2>
          </div>
          <ul className="tp-list" data-component="ListRow">
            {visible.map((note) => (
              <li key={note._id} className="flex items-center gap-2">
                <Link className="tp-list-row min-w-0 flex-1" href={`/notes/${note._id}`}>
                  <span className="tp-list-row__icon">
                    <TpIcon name={note.periodType === "daily" ? "today" : "page"} size="sm" />
                  </span>
                  <span className="tp-list-row__body">
                    <span className="tp-list-row__title" dir="auto">
                      {label(note)}
                    </span>
                    <span className="tp-list-row__meta" dir="auto">
                      {note.pinned ? <span className="tp-tag">{t("notes.pinned")}</span> : null}
                      <span>{plainPreview(note.body)}</span>
                    </span>
                  </span>
                </Link>
                <span className="tp-list-row__end">
                  <button
                    type="button"
                    className="tp-btn tp-btn--ghost tp-btn--sm"
                    disabled={busy}
                    aria-label={`${note.pinned ? t("notes.unpin") : t("notes.pin")} ${label(note)}`}
                    onClick={() =>
                      void perform(async () => {
                        await togglePin({ noteId: note._id });
                      })
                    }
                  >
                    {note.pinned ? t("notes.unpin") : t("notes.pin")}
                  </button>
                  {pendingDelete === note._id ? (
                    <>
                      <button
                        type="button"
                        className="tp-btn tp-btn--danger tp-btn--sm"
                        disabled={busy}
                        aria-label={`${t("notes.confirmDelete")} ${label(note)}`}
                        onClick={() =>
                          void perform(async () => {
                            const result = await remove({ noteId: note._id });
                            if (result.success) {
                              setRemoved((items) => [...items, { noteId: note._id, undoUntilMs: result.undoUntilMs }]);
                              setPendingDelete(null);
                            }
                          })
                        }
                      >
                        {t("notes.confirmDelete")}
                      </button>
                      <button
                        type="button"
                        className="tp-btn tp-btn--ghost tp-btn--sm"
                        disabled={busy}
                        onClick={() => setPendingDelete(null)}
                      >
                        {t("notes.cancel")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="tp-btn tp-btn--ghost tp-btn--sm"
                      disabled={busy}
                      aria-label={`${t("notes.delete")} ${label(note)}`}
                      onClick={() => setPendingDelete(note._id)}
                    >
                      {t("notes.delete")}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
