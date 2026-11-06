"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import "@/app/v3/kb-03.css";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { translate, type Lang, type MessageKey } from "@/lib/i18n";
import { kb03 } from "@/lib/i18n-groups/kb-03";
import { ResultGroup } from "./ResultGroup";

const DEBOUNCE_MS = 250;

const KINDS = ["all", "notes", "tasks", "habits", "goals"] as const;
type Kind = (typeof KINDS)[number];
type SearchResultSet = NonNullable<ReturnType<typeof useQuery<typeof api.search.all>>>;

function nextKind(index: number, key: string, rtl: boolean): Kind {
  const forward = key === "ArrowRight" || key === "ArrowDown";
  const horizontal = key === "ArrowRight" || key === "ArrowLeft";
  const step = (forward ? 1 : -1) * (horizontal && rtl ? -1 : 1);
  return KINDS[(index + step + KINDS.length) % KINDS.length] as Kind;
}

function SearchKindFilters({ kind, onChange, t }: { kind: Kind; onChange: (kind: Kind) => void; t: (key: MessageKey) => string }) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const next = nextKind(index, event.key, getComputedStyle(event.currentTarget).direction === "rtl");
    onChange(next);
    const group = event.currentTarget.parentElement;
    window.requestAnimationFrame(() => group?.querySelector<HTMLButtonElement>(`[data-kind="${next}"]`)?.focus());
  };
  return (
    <div className="tp-segmented" role="radiogroup" aria-label={t("search.show")} data-component="Segmented">
      {KINDS.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: one option of the v3 segmented control
        <button key={option} type="button" role="radio" data-kind={option} className="tp-seg__opt"
          aria-checked={kind === option} tabIndex={kind === option ? 0 : -1}
          onClick={() => onChange(option)} onKeyDown={(event) => onKey(event, index)}>
          {t(`search.${option}` as MessageKey)}
        </button>
      ))}
    </div>
  );
}

type SearchState = "initial" | "loading" | "no-match" | "filtered-empty" | "results" | "error" | "disabled";

/** One atomic announcement per settled result count; the result list itself is not live. */
export function SearchStatus({ lang, state, query = "", count = 0, kindLabel = "", hasPrevious = false }: {
  lang: Lang; state: SearchState; query?: string; count?: number; kindLabel?: string; hasPrevious?: boolean;
}) {
  let text: string;
  if (state === "loading") text = kb03(lang, hasPrevious ? "status.previous" : "status.loading");
  else if (state === "no-match") text = kb03(lang, "status.none");
  else if (state === "filtered-empty") text = kb03(lang, "status.noneHere", { kind: kindLabel });
  else if (state === "results") text = kb03(lang, count === 1 ? "status.one" : "status.many");
  else text = kb03(lang, `status.${state}`);
  return <output className="sr-status" aria-live="polite" aria-atomic="true" data-state={state}
    aria-label={state === "results" ? kb03(lang, count === 1 ? "status.one" : "status.many", { n: count }) : undefined}>
    <WithSlots text={text} query={query} count={count} />
  </output>;
}

/** Names the active subset and gives the person one clear way back to every result. */
export function SearchFilterSummary({ lang, kindLabel, count, total, onClear, disabled = false }: {
  lang: Lang; kindLabel: string; count: number; total: number; onClear: () => void; disabled?: boolean;
}) {
  return <div className="sr-filter-summary" data-component="SearchFilterSummary">
    <span className="sr-filter-summary__text"><WithSlots text={kb03(lang, "filter.summary", { kind: kindLabel })} count={count} total={total} /></span>
    <button type="button" className="sr-filter-summary__clear" onClick={onClear} disabled={disabled}>{kb03(lang, "filter.clear")}</button>
  </div>;
}

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
  const { t, lang } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams?.get("q") ?? "";
  const [draft, setDraft] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery.trim());
  const [kind, setKind] = useState<Kind>("all");
  const [settled, setSettled] = useState<{ query: string; data: SearchResultSet } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (query && results !== undefined) setSettled({ query, data: results });
  }, [query, results]);

  // Keep the last settled list visible while a new query waits, without labelling it as new results.
  const visibleResults = query ? (results ?? settled?.data) : undefined;
  const isLoading = Boolean(query && results === undefined);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    listRef.current?.querySelector<HTMLElement>("[data-search-result]")?.focus();
  };

  const clearFilter = () => {
    setKind("all");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const show = (k: Exclude<Kind, "all">) => kind === "all" || kind === k;
  const counts = visibleResults
    ? { notes: visibleResults.notes.length, tasks: visibleResults.tasks.length, habits: visibleResults.habits.length, goals: visibleResults.goals.length }
    : { notes: 0, tasks: 0, habits: 0, goals: 0 };
  const total = counts.notes + counts.tasks + counts.habits + counts.goals;
  // The count and the empty state follow the Show filter, not just the whole result set.
  const shown = kind === "all" ? total : counts[kind];
  const state: SearchState = !query ? "initial" : isLoading ? "loading" : total === 0 ? "no-match" : shown === 0 ? "filtered-empty" : "results";

  return (
    <div className="sr-screen">
      <div className="tp-toolbar" data-component="Toolbar">
        <div className="tp-search tp-toolbar__grow" data-component="SearchInput">
          <div className="tp-search__box">
            <span className="tp-search__icon">
              <TpIcon name="search" size="sm" />
            </span>
            <input
              ref={inputRef}
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
        {query && visibleResults && total > 0 ? <SearchKindFilters kind={kind} onChange={setKind} t={t} /> : null}
      </div>
      <SearchStatus lang={lang} state={state} query={query} count={shown} kindLabel={kind === "all" ? "" : t(`search.${kind}` as MessageKey)} hasPrevious={Boolean(visibleResults)} />
      {query && kind !== "all" && visibleResults ? <SearchFilterSummary lang={lang} kindLabel={t(`search.${kind}` as MessageKey)} count={shown} total={total} onClear={clearFilter} /> : null}
      <div ref={listRef} className="sr-results" aria-busy={isLoading}>
        {query && visibleResults && total > 0 ? (
          <>
            {show("notes") ? (
              <ResultGroup
                kind="notes"
                icon="page"
                title={t("search.notes")}
                rows={visibleResults.notes.map((n) => ({
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
                rows={visibleResults.tasks.map((task) => ({
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
                rows={visibleResults.habits.map((h) => ({ id: h._id, label: h.name, href: "/habits" }))}
              />
            ) : null}
            {show("goals") ? (
              <ResultGroup
                kind="goals"
                icon="flag"
                title={t("search.goals")}
                rows={visibleResults.goals.map((g) => ({ id: g._id, label: g.title, href: "/goals" }))}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

const GALLERY_STATES = ["initial", "default", "empty", "loading", "error", "disabled", "overflow"] as const;
type GalleryState = (typeof GALLERY_STATES)[number];

/** Hydrated, fictional state gallery for the real search status and filter views. */
export function Kb03Gallery({ initialLang = "en" }: { initialLang?: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [scenario, setScenario] = useState<GalleryState>("default");
  const [kind, setKind] = useState<Kind>("all");
  const [query, setQuery] = useState("moving");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const t = (key: MessageKey) => translate(lang, key);
  const base = {
    notes: [{ id: "maya", label: "Maya's moving note", detail: "Ask Yoni about the van", href: "/notes/maya" }],
    tasks: [{ id: "yoni", label: "Book van with Yoni", detail: "To do", href: "/tasks" }],
    habits: [],
    goals: [{ id: "dana", label: "Dana's new flat", href: "/goals" }],
  };
  const rows = scenario === "overflow" ? {
    ...base,
    notes: Array.from({ length: 8 }, (_, index) => ({
      id: `maya-${index}`,
      label: `Maya's moving note ${index + 1} with a very long remembered title about boxes and plans`,
      detail: "Ask Yoni about the van and Dana about the new flat",
      href: "/notes/maya",
    })),
  } : base;
  const hasResults = !["initial", "empty", "error", "disabled"].includes(scenario) && Boolean(query);
  const counts = { notes: rows.notes.length, tasks: rows.tasks.length, habits: rows.habits.length, goals: rows.goals.length };
  const total = hasResults ? counts.notes + counts.tasks + counts.habits + counts.goals : 0;
  const shown = kind === "all" ? total : hasResults ? counts[kind] : 0;
  const state: SearchState = scenario === "initial" || !query ? "initial" : scenario === "empty" ? "no-match"
    : scenario === "loading" ? "loading" : scenario === "error" ? "error"
    : scenario === "disabled" ? "disabled" : shown === 0 ? "filtered-empty" : "results";
  const changeScenario = (next: GalleryState) => {
    setScenario(next);
    setKind("all");
    setQuery(next === "initial" ? "" : next === "empty" ? "zebra" : "moving");
  };
  const focusInput = () => window.requestAnimationFrame(() => inputRef.current?.focus());
  return <main className="sr-screen sr-gallery" dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
    <h1>{kb03(lang, "gallery.title")}</h1>
    <div className="sr-gallery__bar">
      <button type="button" className="sr-gallery__control" onClick={() => setLang(lang === "en" ? "he" : "en")}>{kb03(lang, "gallery.language")}</button>
      {GALLERY_STATES.map((item) => <button key={item} type="button" className="sr-gallery__control"
        data-scenario={item} aria-pressed={scenario === item} onClick={() => changeScenario(item)}>
        {kb03(lang, `gallery.${item}`)}
      </button>)}
    </div>
    <div className="tp-search tp-toolbar__grow" data-component="SearchInput">
      <div className="tp-search__box">
        <span className="tp-search__icon"><TpIcon name="search" size="sm" /></span>
        <input ref={inputRef} className="tp-input sr-gallery__input" type="search" dir="auto"
          aria-label={t("search.label")} placeholder={t("search.label")} value={query}
          disabled={scenario === "disabled"}
          onChange={(event) => { setQuery(event.target.value); setScenario(event.target.value ? "default" : "initial"); }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            listRef.current?.querySelector<HTMLElement>("[data-search-result]")?.focus();
          }} />
      </div>
    </div>
    {hasResults && total > 0 ? <SearchKindFilters kind={kind} onChange={setKind} t={t} /> : null}
    <SearchStatus lang={lang} state={state} query={query} count={shown}
      kindLabel={kind === "all" ? "" : t(`search.${kind}` as MessageKey)} hasPrevious={scenario === "loading"} />
    {hasResults && kind !== "all" ? <SearchFilterSummary lang={lang} kindLabel={t(`search.${kind}` as MessageKey)}
      count={shown} total={total} onClear={() => { setKind("all"); focusInput(); }} /> : null}
    {scenario === "error" ? <button className="sr-gallery__retry" type="button"
      onClick={() => { changeScenario("default"); focusInput(); }}>{kb03(lang, "gallery.retry")}</button> : null}
    <div ref={listRef} className="sr-results" aria-busy={scenario === "loading"}>
      {hasResults && total > 0 ? <>
        {(kind === "all" || kind === "notes") ? <ResultGroup kind="notes" icon="page" title={t("search.notes")} rows={rows.notes} /> : null}
        {(kind === "all" || kind === "tasks") ? <ResultGroup kind="tasks" icon="task" title={t("search.tasks")} rows={rows.tasks} /> : null}
        {(kind === "all" || kind === "habits") ? <ResultGroup kind="habits" icon="habit" title={t("search.habits")} rows={rows.habits} /> : null}
        {(kind === "all" || kind === "goals") ? <ResultGroup kind="goals" icon="flag" title={t("search.goals")} rows={rows.goals} /> : null}
      </> : null}
    </div>
  </main>;
}

/** Isolate dynamic query text and numeric counts without changing the surrounding RTL sentence. */
function WithSlots({ text, query = "", count = 0, total = 0 }: { text: string; query?: string; count?: number; total?: number }) {
  return <>{text.split(/(\{q\}|\{n\}|\{total\})/g).map((part, index) => {
    if (part === "{q}") return <bdi key={index} dir="auto">{query}</bdi>;
    if (part === "{n}") return <bdi key={index} dir="ltr">{count}</bdi>;
    if (part === "{total}") return <bdi key={index} dir="ltr">{total}</bdi>;
    return part;
  })}</>;
}
