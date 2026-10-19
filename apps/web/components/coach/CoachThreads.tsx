"use client";

import { useQuery } from "convex/react";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  groupSearchHits,
  matchSnippet,
  SEARCH_DEBOUNCE_MS,
  searchQueryOf,
  threadDateLabel,
  threadTitle,
} from "@/lib/coach-threads";
import type { MessageKey } from "@/lib/i18n";
import { intlLocale } from "@/lib/you/screenState";

export type CoachThread = {
  _id: Id<"conversations">;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type Translate = (key: MessageKey) => string;

function countLabel(n: number, one: MessageKey, many: MessageKey, t: Translate): string {
  return n === 1 ? t(one) : t(many).replace("{n}", String(n));
}

/** A bin, drawn in the v3 icon family (24 grid, 1.5 px line); the sprite has no delete icon. */
function DeleteIcon() {
  return (
    <svg className="tp-icon tp-icon--sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

/** The value, once it has stayed the same for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * The chats column on /coach (Kitchen, owner-approved): New chat, a search across every chat
 * (`messages.searchMine`; a result is the chat's label and the matching line, no count, since the search
 * stops at a chat's first match), the list of chats newest first with the open one marked, and delete with
 * a confirm step (`conversations.remove`, no undo). The page owns which chat is open and makes and
 * deletes chats; this only asks.
 *
 * At 1024 px and up it is a column beside the chat. Below that it is a drawer the chat header's
 * Chats button opens: a modal dialog that keeps focus inside, and Escape or the backdrop close it.
 */
export function CoachThreads({
  threads,
  selectedId,
  searchReady,
  creating,
  newError,
  drawer,
  open,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: {
  /** Listed chats, newest first; undefined while loading. */
  threads: readonly CoachThread[] | undefined;
  selectedId: Id<"conversations"> | null;
  /** The signed-in person's users row exists, so the search query can run. */
  searchReady: boolean;
  creating: boolean;
  newError: string | null;
  /** Under 1024 px: a drawer. */
  drawer: boolean;
  open: boolean;
  onSelect: (id: Id<"conversations">) => void;
  onNew: () => void;
  /** Resolves once the chat is deleted; throws when it was not. */
  onDelete: (id: Id<"conversations">) => Promise<void>;
  onClose: () => void;
}) {
  const { lang, t } = useLocale();
  const locale = intlLocale(lang);
  const panelRef = useRef<HTMLElement | null>(null);
  const newRef = useRef<HTMLButtonElement | null>(null);
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const [raw, setRaw] = useState("");
  const [confirmingId, setConfirmingId] = useState<Id<"conversations"> | null>(null);
  const [deletingId, setDeletingId] = useState<Id<"conversations"> | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // A short date per chat; re-read each minute so "09:30" becomes "Yesterday" on a page left open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const typed = searchQueryOf(raw);
  const settledRaw = useSettled(raw, SEARCH_DEBOUNCE_MS);
  const query = searchQueryOf(settledRaw);
  const hits = useQuery(api.messages.searchMine, searchReady && query ? { query } : "skip");
  // An in-flight search is undefined: keep the last answered search so a keystroke never blanks the list.
  const [lastHits, setLastHits] = useState<{ query: string; hits: NonNullable<typeof hits> } | null>(null);
  if (query === null) {
    if (lastHits !== null) setLastHits(null);
  } else if (hits !== undefined && lastHits?.query !== query) {
    setLastHits({ query, hits });
  }
  const shown = query !== null && hits !== undefined ? { query, hits } : lastHits;
  const searching = typed !== null && (typed !== query || hits === undefined);
  const searchActive = typed !== null;
  const results = useMemo(() => (shown && threads ? groupSearchHits(shown.hits, threads) : null), [shown, threads]);
  const titleOf = useMemo(() => {
    const titles = new Map<string, CoachThread>();
    for (const thread of threads ?? []) titles.set(thread._id, thread);
    return titles;
  }, [threads]);

  // The drawer opens with focus on New chat; the page puts it back on the Chats button on close.
  useEffect(() => {
    if (drawer && open) newRef.current?.focus();
  }, [drawer, open]);

  // Escape closes the drawer (an open delete confirm takes it first). Document level, before the
  // shell's window handler, which then sees it was handled.
  useEffect(() => {
    if (!drawer || !open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, open, onClose]);

  useEffect(() => {
    if (confirmingId) keepRef.current?.focus();
  }, [confirmingId]);

  // "Chat deleted." clears after a moment, so the next delete is said again.
  useEffect(() => {
    if (!announce) return;
    const timer = window.setTimeout(() => setAnnounce(""), 4000);
    return () => window.clearTimeout(timer);
  }, [announce]);

  // A modal drawer keeps Tab inside itself.
  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    if (!drawer || !open || event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const cancelDelete = (id: Id<"conversations">) => {
    setConfirmingId(null);
    setDeleteError(null);
    window.requestAnimationFrame(() => document.getElementById(`coach-thread-delete-${id}`)?.focus());
  };

  // Escape on the confirm step keeps the chat (before the drawer's own Escape sees it).
  const escapeConfirm = (event: KeyboardEvent<HTMLElement>, id: Id<"conversations">) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelDelete(id);
  };

  const confirmDelete = async (id: Id<"conversations">) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      await onDelete(id);
      setConfirmingId(null);
      setAnnounce(t("cc.deleted"));
      newRef.current?.focus();
    } catch {
      setDeleteError(t("cc.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  const status = !searchActive
    ? raw.trim().length > 0
      ? t("cc.searchHint")
      : ""
    : searching && results === null
      ? t("cc.searching")
      : results && results.length > 0
        ? countLabel(results.length, "cc.results.one", "cc.results.many", t)
        : searching
          ? t("cc.searching")
          : t("cc.results.none");

  const modal = drawer && open;

  return (
    <>
      {modal ? <div className="tp-coach-threads-scrim" aria-hidden="true" onClick={onClose} /> : null}
      <section
        ref={panelRef}
        id="coach-threads"
        className="tp-coach-threads"
        data-component="CoachThreads"
        data-drawer={drawer ? "true" : "false"}
        data-open={open ? "true" : "false"}
        aria-labelledby="coach-threads-title"
        {...(modal ? { role: "dialog", "aria-modal": true } : {})}
        onKeyDown={trapTab}
      >
        <div className="tp-coach-threads__head">
          <h2 id="coach-threads-title" className="tp-coach-threads__title">
            {t("cc.chats")}
          </h2>
          {drawer ? (
            <button className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon" type="button" aria-label={t("cc.closeChats")} onClick={onClose}>
              <TpIcon name="x" size="sm" />
            </button>
          ) : null}
        </div>

        <button ref={newRef} className="tp-btn tp-btn--secondary tp-btn--sm tp-btn--block" type="button" onClick={onNew} disabled={creating}>
          <TpIcon name="plus" size="sm" />
          <span>{t("cc.newChat")}</span>
        </button>
        {newError ? <p className="tp-small tp-coach-threads__error">{newError}</p> : null}

        <div className="tp-search tp-coach-threads__search">
          <label className="tp-sr-only" htmlFor="coach-thread-search">
            {t("cc.search")}
          </label>
          <div className="tp-search__box">
            <TpIcon name="search" size="sm" className="tp-search__icon" />
            <input
              id="coach-thread-search"
              className="tp-input"
              type="search"
              value={raw}
              maxLength={200}
              placeholder={t("cc.searchPh")}
              onChange={(event) => setRaw(event.currentTarget.value)}
              onKeyDown={(event) => {
                // Escape in a filled box clears it; an empty box lets the drawer close.
                if (event.key === "Escape" && raw !== "") {
                  event.preventDefault();
                  setRaw("");
                }
              }}
              disabled={!searchReady}
            />
          </div>
        </div>
        <output className="tp-xs tp-muted tp-coach-threads__status" htmlFor="coach-thread-search">
          {status}
        </output>

        <div className="tp-coach-threads__scroll">
          {searchActive ? (
            results && results.length > 0 ? (
              <ul className="tp-chat-list" aria-label={t("cc.search")}>
                {results.map((result) => {
                  const thread = titleOf.get(result.conversationId);
                  if (!thread) return null;
                  const title = threadTitle(thread.title, t("cc.untitled"));
                  return (
                    <li key={result.conversationId}>
                      <button
                        className="tp-chat-row tp-coach-threads__row"
                        type="button"
                        aria-current={result.conversationId === selectedId ? "true" : undefined}
                        onClick={() => onSelect(result.conversationId)}
                      >
                        <span className="tp-chat-row__title" dir="auto">
                          {title}
                        </span>
                        <time className="tp-chat-row__time" dateTime={new Date(thread.updatedAt).toISOString()}>
                          {threadDateLabel(thread.updatedAt, now, locale, { yesterday: t("cc.yesterday") })}
                        </time>
                        <span className="tp-chat-row__last" dir="auto">
                          {matchSnippet(result.content, shown?.query ?? "")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null
          ) : threads === undefined ? (
            <p className="tp-small tp-muted tp-coach-threads__note">{t("cc.loadingChats")}</p>
          ) : threads.length === 0 ? (
            <p className="tp-small tp-muted tp-coach-threads__note">{t("cc.noChats")}</p>
          ) : (
            <ul className="tp-chat-list" aria-labelledby="coach-threads-title">
              {threads.map((thread) => {
                const title = threadTitle(thread.title, t("cc.untitled"));
                const date = threadDateLabel(thread.updatedAt, now, locale, { yesterday: t("cc.yesterday") });
                const confirming = confirmingId === thread._id;
                const deleting = deletingId === thread._id;
                return (
                  <li key={thread._id} className="tp-coach-threads__item" data-confirming={confirming ? "true" : undefined}>
                    <button
                      className="tp-chat-row tp-coach-threads__row"
                      type="button"
                      aria-current={thread._id === selectedId ? "true" : undefined}
                      onClick={() => onSelect(thread._id)}
                    >
                      <span className="tp-chat-row__title" dir="auto">
                        {title}
                      </span>
                      <time className="tp-chat-row__time" dateTime={new Date(thread.updatedAt).toISOString()}>
                        {date}
                      </time>
                    </button>
                    {confirming ? null : (
                      <button
                        id={`coach-thread-delete-${thread._id}`}
                        className="tp-btn tp-btn--ghost tp-btn--sm tp-btn--icon tp-coach-threads__delete"
                        type="button"
                        aria-label={t("cc.delete").replace("{title}", () => title).replace("{date}", () => date)}
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmingId(thread._id);
                        }}
                      >
                        <DeleteIcon />
                      </button>
                    )}
                    {confirming ? (
                      <div className="tp-coach-threads__confirm">
                        <p id={`coach-thread-confirm-${thread._id}`} className="tp-small">
                          {t("cc.confirm")}
                        </p>
                        {deleteError ? <p className="tp-small tp-coach-threads__error">{deleteError}</p> : null}
                        <div className="tp-coach-threads__confirm-actions">
                          <button
                            className="tp-btn tp-btn--danger tp-btn--sm"
                            type="button"
                            aria-describedby={`coach-thread-confirm-${thread._id}`}
                            onKeyDown={(event) => escapeConfirm(event, thread._id)}
                            disabled={deleting}
                            onClick={() => void confirmDelete(thread._id)}
                          >
                            {deleting ? t("cc.deleting") : t("cc.confirmYes")}
                          </button>
                          <button
                            ref={keepRef}
                            className="tp-btn tp-btn--ghost tp-btn--sm"
                            type="button"
                            aria-describedby={`coach-thread-confirm-${thread._id}`}
                            onKeyDown={(event) => escapeConfirm(event, thread._id)}
                            onClick={() => cancelDelete(thread._id)}
                          >
                            {t("cc.confirmNo")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="tp-sr-only" aria-live="polite">
          {announce}
        </p>
      </section>
    </>
  );
}
