"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

type TodayGreetingProps = {
  greetingName?: string | null;
};

/**
 * Today's page head (PageHeader): eyebrow, a greeting in ink, and one calm line. The name used to
 * carry the old orange gradient, which DESIGN.md §12.4 retired and which read at under 3:1 in light
 * mode; it is plain ink now. A long name wraps (globals.css) instead of pushing the page sideways.
 */
export function TodayGreeting({ greetingName }: TodayGreetingProps) {
  const { t } = useLocale();
  const name = greetingName?.trim();

  return (
    <header className="tp-pagehead" data-component="PageHeader">
      <div className="tp-pagehead__text">
        <span className="tp-eyebrow">{t("today.eyebrow")}</span>
        <h1 aria-live="polite" className="tp-pagehead__title">
          {name ? (
            <>
              {t("today.hi")}{" "}
              {/* A name taken from an email is Latin text: keep it in its own direction. */}
              <bdi>{name}</bdi>
            </>
          ) : (
            t("today.hiThere")
          )}
        </h1>
        <p className="tp-pagehead__sub">{t("today.lede")}</p>
      </div>
    </header>
  );
}
