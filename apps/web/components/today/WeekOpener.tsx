"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { localIsoDate, mondayOf, mondayOfWeekKey } from "@/lib/period-pages";
import { usePeriodPage } from "./usePeriodPage";

/**
 * The weekly page (weekly-page.html) lives at /notes/[id] like every page (decision 6). This
 * opener resolves an ISO week key to its Monday, makes the page from the Weekly template on
 * first open, and replaces the URL with the page's own.
 */
export function WeekOpener({ weekKey }: { weekKey: string | null }) {
  const { t } = useLocale();
  const router = useRouter();
  // The local date is only known in the browser.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localIsoDate(new Date())), []);
  const monday = weekKey === null ? (today ? mondayOf(today) : null) : mondayOfWeekKey(weekKey);
  const state = usePeriodPage("weekly", monday);

  useEffect(() => {
    if (state.status === "ready") router.replace(`/notes/${state.noteId}`);
  }, [state, router]);

  let message: string;
  if (weekKey !== null && monday === null) message = t("week.bad");
  else if (state.status === "signed-out") message = t("week.signIn");
  else if (state.status === "error") message = t("week.error");
  else if (state.status === "gone") message = t("week.gone");
  else message = t("week.loading");

  return (
    <div className="tp-paper" data-component="Page" aria-busy={state.status === "loading"}>
      <div className="tp-page__body">
        <p className={state.status === "error" ? undefined : "tp-muted"} role={state.status === "error" ? "alert" : undefined}>
          {message}
        </p>
        {state.status === "error" ? (
          <button className="tp-btn tp-btn--secondary" type="button" onClick={state.retry}>
            {t("today.retry")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
