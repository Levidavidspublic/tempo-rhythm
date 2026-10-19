"use client";

import "@/app/v3/kb-04.css";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { type Ref, useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { journalDate, promptFor } from "@/lib/journal";
import { kb04t } from "@/lib/i18n-groups/kb-04";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

const CHUNK = 10;
type JournalLang = "en" | "he";
type JournalDisplayRow = Readonly<{ _id: string; date: string; title?: string | null; tags: readonly string[] }>;

/** A date stays isolated even when the surrounding page is RTL. */
export function JournalDayHeading({ date, title, lang, headingRef }: Readonly<{
  date: string; title?: string | null; lang: JournalLang; headingRef?: Ref<HTMLHeadingElement>;
}>) {
  return <h2 className="kb04-day-heading" ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
    {title ? <bdi dir="auto">{title}</bdi> : <time dateTime={date} dir="ltr">{journalDate(date, lang)}</time>}
  </h2>;
}

/** The live pagination control also serves the gallery's controlled states. */
export function JournalLoadMore({ lang, onLoad, disabled = false, loading = false, buttonRef }: Readonly<{
  lang: JournalLang; onLoad: () => void; disabled?: boolean; loading?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}>) {
  return <button className="tp-btn tp-btn--secondary kb04-more" type="button" ref={buttonRef}
    disabled={disabled} aria-disabled={disabled || loading} aria-busy={loading}
    onClick={() => { if (!disabled && !loading) onLoad(); }}>
    {kb04t(lang, loading ? "kb04.loading" : "kb04.more")}
  </button>;
}

function JournalRows({ rows, lang, firstHeadingRef }: Readonly<{
  rows: readonly JournalDisplayRow[]; lang: JournalLang; firstHeadingRef?: Ref<HTMLHeadingElement>;
}>) {
  return <ul className="tp-list kb04-list" data-component="ListRow">
    {rows.map((row, index) => <li className="kb04-day" key={row._id}>
      <Link className="kb04-day-link" href={`/notes/${row._id}`}>
        <span className="kb04-day-body">
          <JournalDayHeading date={row.date} title={row.title} lang={lang}
            headingRef={index === 0 ? firstHeadingRef : undefined} />
          <span className="kb04-day-meta">
            <time dateTime={row.date} dir="ltr">{journalDate(row.date, lang)}</time>
            {row.tags.map((tag) => <span className="tp-tag" key={tag} dir="auto">{tag}</span>)}
          </span>
        </span>
        <TpIcon name="chevron" size="sm" flip />
      </Link>
    </li>)}
  </ul>;
}

/** Journal (journal.html, decision 6). The shell supplies the only main landmark. */
export function JournalScreen() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  const bounds = useLocalDayBounds();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = mounted ? localIsoDate(new Date(bounds.startMs)) : null;
  const [picked, setPicked] = useState<{ day: string | null; shift: number }>({ day: null, shift: 0 });
  const shift = picked.day === today ? picked.shift : 0;
  return <div className="tp-page kb04-journal" data-component="PageLayout">
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <h1 className="tp-pagehead__title">{t("journal.title")}</h1>
        <p className="tp-pagehead__sub">{t("journal.sub")}</p>
      </div>
    </header>
    <section className="tp-surface" aria-labelledby="jr-prompt-h" data-component="Surface">
      <span className="tp-eyebrow" id="jr-prompt-h">{t("journal.prompt")}</span>
      <p className="tp-nextup__title" dir="auto">{today ? t(promptFor(today, shift)) : " "}</p>
      <p className="tp-muted tp-small">{t("journal.optional")}</p>
      <div className="tp-nextup__actions">
        <Link className="tp-btn tp-btn--primary" href="/today">
          <TpIcon name="edit" size="sm" /><span>{t("journal.write")}</span>
        </Link>
        <button className="tp-btn tp-btn--secondary" type="button"
          onClick={() => setPicked({ day: today, shift: shift + 1 })}>{t("journal.another")}</button>
      </div>
    </section>
    <section className="tp-section" aria-labelledby="jr-past-h" data-component="Section">
      <div className="tp-section__head"><h2 className="tp-section__title" id="jr-past-h">{t("journal.past")}</h2></div>
      {!isLoading && !isAuthenticated ? <p className="tp-muted">{t("journal.signIn")}</p>
        : profile && today ? <JournalChunk before={today} first />
        : <output className="kb04-state" aria-busy="true">{t("journal.loading")}</output>}
    </section>
  </div>;
}

/** Ten days per unchanged bounded query. A loaded child takes focus after its button disappears. */
function JournalChunk({ before, first = false, focusNew = false, onReady, mayFocus }: Readonly<{
  before: string; first?: boolean; focusNew?: boolean; onReady?: () => void; mayFocus?: () => boolean;
}>) {
  const { lang } = useLocale();
  const rows = useQuery(api.notes.listPeriodPages, { pageType: "daily", before, limit: CHUNK });
  const [more, setMore] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const firstHeadingRef = useRef<HTMLHeadingElement>(null);
  const endRef = useRef<HTMLOutputElement>(null);
  const didFocus = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const handleReady = useCallback(() => setAdvanced(true), []);
  const shouldFocusChild = useCallback(() => document.activeElement === buttonRef.current, []);
  useEffect(() => {
    if (!focusNew || rows === undefined || didFocus.current) return;
    const frame = requestAnimationFrame(() => {
      if (mayFocus?.() ?? true) (rows.length ? firstHeadingRef.current : endRef.current)?.focus();
      didFocus.current = true;
      onReady?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusNew, mayFocus, onReady, rows]);
  if (rows === undefined) return <output className="kb04-state" aria-busy="true">{kb04t(lang, "kb04.loading")}</output>;
  if (rows.length === 0 && first) return <div className="tp-empty" data-component="Empty">
    <TpIcon name="today" size="lg" /><p>{kb04t(lang, "kb04.empty")}</p>
  </div>;
  if (rows.length === 0) return <output className="kb04-state" ref={endRef} tabIndex={-1}>{kb04t(lang, "kb04.end")}</output>;
  const last = rows[rows.length - 1];
  return <>
    <JournalRows rows={rows} lang={lang} firstHeadingRef={focusNew ? firstHeadingRef : undefined} />
    {rows.length === CHUNK && last ? <div className="kb04-more-wrap">
      {!advanced && <JournalLoadMore lang={lang} onLoad={() => setMore(true)} loading={more} buttonRef={buttonRef} />}
      {more && <JournalChunk before={last.date} focusNew onReady={handleReady} mayFocus={shouldFocusChild} />}
    </div> : <output className="kb04-state">{kb04t(lang, "kb04.end")}</output>}
  </>;
}

type GalleryState = "default" | "empty" | "loading" | "error" | "disabled" | "overflow";
const galleryStates: readonly GalleryState[] = ["default", "empty", "loading", "error", "disabled", "overflow"];
const galleryLabels: Record<GalleryState, Parameters<typeof kb04t>[1]> = {
  default: "kb04.default", empty: "kb04.emptyState", loading: "kb04.loadingState",
  error: "kb04.errorState", disabled: "kb04.disabledState", overflow: "kb04.overflowState",
};
const galleryRows: readonly JournalDisplayRow[] = Array.from({ length: CHUNK }, (_, index) => ({
  _id: `fictional-${index}`,
  date: `2026-10-${String(18 - index).padStart(2, "0")}`,
  title: index === 0 ? "Maya's quiet morning" : index === 1 ? "Dana's walk" : index === 2 ? "Yoni's idea" : null,
  tags: index === 0 ? ["Reflection"] : [],
}));

/** Standalone, hydrated gallery; production rows above use the same views and callbacks. */
export function Kb04Gallery({ lang = "en" }: Readonly<{ lang?: JournalLang }>) {
  const [state, setState] = useState<GalleryState>("default");
  const [added, setAdded] = useState(false);
  const addedRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (added) addedRef.current?.focus(); }, [added]);
  const rows = state === "overflow"
    ? [{ ...galleryRows[0], title: "Maya and Dana wrote a very long title about a thoughtful day with many small things worth remembering ".repeat(3), tags: ["A very long tag with many letters that should wrap without breaking the page width"] }]
    : galleryRows;
  return <main className="kb04-gallery kb04-journal" dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
    <h1 className="tp-pagehead__title">{kb04t(lang, "kb04.galleryTitle")}</h1>
    <nav className="kb04-gallery-controls" aria-label={kb04t(lang, "kb04.galleryTitle")}>
      {galleryStates.map((item) => <button key={item} type="button" aria-pressed={state === item}
        onClick={() => { setState(item); setAdded(false); }}>{kb04t(lang, galleryLabels[item])}</button>)}
    </nav>
    {state === "empty" && <output className="kb04-state">{kb04t(lang, "kb04.empty")}</output>}
    {state === "loading" && <output className="kb04-state" aria-busy="true">{kb04t(lang, "kb04.loading")}</output>}
    {state === "error" && <div role="alert"><p className="kb04-state">{kb04t(lang, "kb04.error")}</p>
      <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setState("default")}>{kb04t(lang, "kb04.retry")}</button></div>}
    {(state === "default" || state === "disabled" || state === "overflow") && <>
      <JournalRows rows={rows} lang={lang} />
      {added ? <><JournalRows rows={[{ _id: "fictional-extra", date: "2026-10-01", title: "One more day", tags: [] }]}
        lang={lang} firstHeadingRef={addedRef} />
        <output className="kb04-state">{kb04t(lang, "kb04.end")}</output></>
        : <div className="kb04-more-wrap"><JournalLoadMore lang={lang} disabled={state === "disabled"} onLoad={() => setAdded(true)} /></div>}
    </>}
  </main>;
}
