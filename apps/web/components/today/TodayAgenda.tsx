"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import type { TodayAgendaEvent } from "@/lib/todayAgenda";

type TodayAgendaProps = {
  events?: TodayAgendaEvent[];
};

/** Today's calendar events (EventBlock, DESIGN.md §9), or a kind line and a way to Calendar. */
export function TodayAgenda({ events = [] }: TodayAgendaProps) {
  const { t } = useLocale();
  return (
    <section className="tp-surface" data-component="TodayAgenda" aria-labelledby="today-agenda-heading">
      <header className="tp-section__head">
        <h2 id="today-agenda-heading" className="tp-section__title">
          {t("tag.title")}
        </h2>
      </header>
      {events.length > 0 ? (
        <ol className="tp-list tag-list">
          {events.map((event) => (
            <li key={event.id} className="tp-event" data-component="EventBlock">
              <span className="tp-event__time">{event.timeLabel}</span>
              <span className="tp-event__body">
                <span className="tp-event__title" dir="auto">
                  {event.title}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="tag-empty">
          <p className="tp-help">{t("tag.empty")}</p>
          <Link className="tp-btn tp-btn--secondary tp-btn--sm" href="/calendar">
            <TpIcon name="today" size="sm" />
            <span>{t("tag.open")}</span>
          </Link>
        </div>
      )}
    </section>
  );
}
