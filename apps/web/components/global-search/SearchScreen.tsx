"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { MessageKey } from "@/lib/i18n";
import { ResultGroup } from "./ResultGroup";

const DEBOUNCE_MS = 250;

const KINDS = ["all", "notes", "tasks", "habits", "goals"] as const;
type Kind = (typeof KINDS)[number];

/** The page head (search.html PageHeader). Outside ProfileReady, so it shows at once. */
export function SearchHeader() {
  const { t } = useLocale();
  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("search.title")}</h1>
        <p className="tp-pagehead__sub">{t("search.sub")}</p>
      </div>
    </header>
  );
}

/**
 * Search (docs/design/v3/screens/web/search.html): one box, results grouped by kind.
 * This screen hydrates inside a Suspense boundary, after the language may already have switched
 * from the server's English; its text renders once mounted so the two never differ.
 */
export function SearchScreen() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <SearchScreenBody /> : <div className="sr-screen" />;
}

/** The screen itself, once mounted (exported for its render tests). */
export function SearchScreenBody() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams?.get("q") ?? "";
  const [draft, setDraft] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery.trim());
  const [kind, setKind] = useState<Kind>("all");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const next = draft.trim();
    if (next === query) return;
    const timer = setTimeout(() => {
      setQuery(next);
      router.replace(next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, query, router, pathname]);

  const results = useQuery(api.search.all, query ? { query } : "skip");

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    listRef.current?.querySelector<HTMLElement>("[data-search-result]")?.focus();
  };

  // Radio group keys: one tab stop (the checked option); arrows move and choose, wrapping.
  const onKindKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const horizontal = event.key === "ArrowRight" || event.key === "ArrowLeft";
    const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
    const next = KINDS[(index + step + KINDS.length) % KINDS.length] as Kind;
    setKind(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>(`[data-kind="${next}"]`)?.focus());
  };

  const show = (k: Exclude<Kind, "all">) => kind === "all" || kind === k;
  const counts = results
    ? { notes: results.notes.length, tasks: results.tasks.length, habits: results.habits.length, goals: results.goals.length }
    : { notes: 0, tasks: 0, habits: 0, goals: 0 };
  const total = counts.notes + counts.tasks + counts.habits + counts.goals;
  // The count and the empty state follow the Show filter, not just the whole result set.
  const shown = kind === "all" ? total : counts[kind];
  const noMatches = results !== undefined && total === 0;

  return (
    <div className="sr-screen">
      <div className="tp-toolbar" data-component="Toolbar">
        <div className="tp-search tp-toolbar__grow" data-component="SearchInput">
          <div className="tp-search__box">
            <span className="tp-search__icon">
              <TpIcon name="search" size="sm" />
            </span>
            <input
              className="tp-input"
              type="search"
              dir="auto"
              autoComplete="off"
              aria-label={t("search.label")}
              placeholder={t("search.label")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        </div>
        {query && results && total > 0 ? (
          <div className="tp-segmented" role="radiogroup" aria-label={t("search.show")} data-component="Segmented">
            {KINDS.map((option, index) => (
              // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
              <button
                key={option}
                type="button"
                role="radio"
                data-kind={option}
                className="tp-seg__opt"
                aria-checked={kind === option}
                tabIndex={kind === option ? 0 : -1}
                onClick={() => setKind(option)}
                onKeyDown={(event) => onKindKey(event, index)}
              >
                {t(`search.${option}` as MessageKey)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div ref={listRef} aria-live="polite" className="sr-results">
        {!query ? (
          <p className="tp-muted tp-small">{t("search.hint")}</p>
        ) : results === undefined ? (
          <p className="tp-muted tp-small">{t("search.searching")}</p>
        ) : noMatches ? (
          <p className="tp-muted">{t("search.none").replace("{q}", query)}</p>
        ) : (
          <>
            {shown === 0 ? (
              <p className="tp-muted">{t("search.noneHere").replace("{q}", query)}</p>
            ) : (
              <p className="tp-muted tp-small">
                {shown === 1 ? t("search.result") : t("search.results").replace("{n}", String(shown))}
              </p>
            )}
            {show("notes") ? (
              <ResultGroup
                kind="notes"
                icon="page"
                title={t("search.notes")}
                rows={results.notes.map((n) => ({
                  id: n._id,
                  label: n.title,
                  detail: n.snippet,
                  href: `/notes/${n._id}`,
                }))}
              />
            ) : null}
            {show("tasks") ? (
              <ResultGroup
                kind="tasks"
                icon="task"
                title={t("search.tasks")}
                rows={results.tasks.map((task) => ({
                  id: task._id,
                  label: task.title,
                  detail: t(`search.status.${task.status}` as MessageKey) || task.status,
                  href: "/tasks",
                }))}
              />
            ) : null}
            {show("habits") ? (
              <ResultGroup
                kind="habits"
                icon="habit"
                title={t("search.habits")}
                rows={results.habits.map((h) => ({ id: h._id, label: h.name, href: "/habits" }))}
              />
            ) : null}
            {show("goals") ? (
              <ResultGroup
                kind="goals"
                icon="flag"
                title={t("search.goals")}
                rows={results.goals.map((g) => ({ id: g._id, label: g.title, href: "/goals" }))}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
