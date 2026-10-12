"use client";

import Link from "next/link";
import { NotePage } from "@/components/notes/NotesScreen";
import { useLocale } from "@/components/providers/LocaleProvider";
import { localIsoDate, weekKey } from "@/lib/period-pages";
import type { NextUpTask } from "@/lib/next-up";
import { NextUpCard } from "./NextUpCard";
import { usePeriodPage } from "./usePeriodPage";

/**
 * Today's page (today.html, decision 6): the Markdown daily page for the local date, made from
 * the Daily template on first open, with Next up on the paper above the body.
 */
export function DailyPage({ dayStartMs, tasks }: { dayStartMs: number; tasks: readonly NextUpTask[] }) {
  const { t } = useLocale();
  const date = localIsoDate(new Date(dayStartMs));
  const state = usePeriodPage("daily", date);

  const thisWeek = (
    <Link className="tp-btn tp-btn--ghost tp-btn--sm" href={`/week/${weekKey(date)}`}>
      {t("today.thisWeek")}
    </Link>
  );

  if (state.status === "signed-out") return null;
  if (state.status === "error") {
    return (
      <div className="tp-paper" data-component="Page" role="alert">
        <div className="tp-page__body">
          <p>{t("today.pageError")}</p>
          <button className="tp-btn tp-btn--secondary" type="button" onClick={state.retry}>
            {t("today.retry")}
          </button>
        </div>
      </div>
    );
  }
  if (state.status === "gone") {
    return (
      <div className="tp-paper" data-component="Page">
        <div className="tp-page__body">
          <output>{t("today.pageGone")}</output>
          <button className="tp-btn tp-btn--secondary" type="button" onClick={state.makeNew}>
            {t("today.pageNew")}
          </button>
        </div>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div className="tp-paper" data-component="Page" aria-busy="true">
        <div className="tp-page__body">
          <p className="tp-muted">{t("today.pageLoading")}</p>
        </div>
      </div>
    );
  }
  return (
    <div data-testid="today-daily-page">
      <NotePage
        noteId={state.noteId}
        backHref={null}
        canDelete={false}
        lead={
          <section className="tp-page-content" aria-labelledby="nextup-eyebrow">
            <NextUpCard tasks={tasks} />
            <div className="tp-page-meta">{thisWeek}</div>
          </section>
        }
      />
    </div>
  );
}
