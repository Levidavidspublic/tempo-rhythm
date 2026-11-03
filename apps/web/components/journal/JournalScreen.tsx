"use client";

import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import { journalDate, promptFor } from "@/lib/journal";
import { localIsoDate } from "@/lib/period-pages";
import { useLocalDayBounds } from "@/lib/useLocalDayBounds";

const CHUNK = 10;

/**
 * Journal (journal.html, decision 6): the run of daily Markdown pages, newest first, with one
 * gentle optional prompt. Writing happens in today's page, so there is one place for the day.
 */
export function JournalScreen() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth();
  // notes.* call requireUser: wait until the users row exists (getProfile is null until then).
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");
  // The local date is only known in the browser, and it rolls over at midnight (and when the tab
  // comes back) through the same day bounds Today uses.
  const bounds = useLocalDayBounds();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = mounted ? localIsoDate(new Date(bounds.startMs)) : null;
  // "Another prompt" counts per day: a new local day opens on its own first prompt.
  const [picked, setPicked] = useState<{ day: string | null; shift: number }>({
    day: null,
    shift: 0,
  });
  const shift = picked.day === today ? picked.shift : 0;

  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("journal.title")}</h1>
          <p className="tp-pagehead__sub">{t("journal.sub")}</p>
        </div>
      </header>

      <section className="tp-surface" aria-labelledby="jr-prompt-h" data-component="Surface">
        <span className="tp-eyebrow" id="jr-prompt-h">
          {t("journal.prompt")}
        </span>
        <p className="tp-nextup__title" dir="auto">
          {today ? t(promptFor(today, shift)) : " "}
        </p>
        <p className="tp-muted tp-small">{t("journal.optional")}</p>
        <div className="tp-nextup__actions">
          <Link className="tp-btn tp-btn--primary" href="/today">
            <TpIcon name="edit" size="sm" />
            <span>{t("journal.write")}</span>
          </Link>
          <button
            className="tp-btn tp-btn--secondary"
            type="button"
            onClick={() => setPicked({ day: today, shift: shift + 1 })}
          >
            {t("journal.another")}
          </button>
        </div>
      </section>

      <section className="tp-section" aria-labelledby="jr-past-h" data-component="Section">
        <div className="tp-section__head">
          <h2 className="tp-section__title" id="jr-past-h">
            {t("journal.past")}
          </h2>
        </div>
        {!isLoading && !isAuthenticated ? (
          <p className="tp-muted">{t("journal.signIn")}</p>
        ) : profile && today ? (
          // Past days only: today's page is the one "Write in today's page" opens.
          <JournalChunk before={today} first />
        ) : (
          <p className="tp-muted" aria-busy="true">
            {t("journal.loading")}
          </p>
        )}
      </section>
    </div>
  );
}

/** Ten days at a time (bounded reads); "Show more" mounts the next ten after the last date. */
function JournalChunk({ before, first = false }: { before: string; first?: boolean }) {
  const { t, lang } = useLocale();
  const rows = useQuery(api.notes.listPeriodPages, { pageType: "daily", before, limit: CHUNK });
  const [more, setMore] = useState(false);

  if (rows === undefined) {
    return (
      <p className="tp-muted" aria-busy="true">
        {t("journal.loading")}
      </p>
    );
  }
  if (rows.length === 0 && first) {
    return (
      <div className="tp-empty" data-component="Empty">
        <TpIcon name="today" size="lg" />
        <p>{t("journal.empty")}</p>
      </div>
    );
  }
  const last = rows[rows.length - 1];
  return (
    <>
      <ul className="tp-list" data-component="ListRow">
        {rows.map((row) => (
          <li key={row._id}>
            <Link className="tp-list-row" href={`/notes/${row._id}`}>
              <span className="tp-list-row__icon">
                <TpIcon name="today" size="sm" />
              </span>
              <span className="tp-list-row__body">
                <span className="tp-list-row__title" dir="auto">
                  {row.title || journalDate(row.date, lang)}
                </span>
                <span className="tp-list-row__meta">
                  <span>{journalDate(row.date, lang)}</span>
                  {row.tags.map((tag) => (
                    <span className="tp-tag" key={tag} dir="auto">
                      {tag}
                    </span>
                  ))}
                </span>
              </span>
              <span className="tp-list-row__end">
                <TpIcon name="chevron" size="sm" flip />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === CHUNK && last ? (
        more ? (
          <JournalChunk before={last.date} />
        ) : (
          <div>
            <button className="tp-btn tp-btn--secondary" type="button" onClick={() => setMore(true)}>
              {t("journal.more")}
            </button>
          </div>
        )
      ) : null}
    </>
  );
}
