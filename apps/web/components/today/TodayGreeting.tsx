"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { cn } from "@/lib/utils";

type TodayGreetingProps = {
  greetingName: string | undefined;
};

export function TodayGreeting({ greetingName }: TodayGreetingProps) {
  const { t } = useLocale();
  const name = greetingName?.trim();

  return (
    <header className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">{t("today.eyebrow")}</p>
      <h1
        aria-live="polite"
        className={cn(
          // A name taken from a long email handle has no spaces: it wraps instead of pushing the page sideways.
          "font-heading text-4xl font-semibold tracking-tight text-foreground wrap-anywhere md:text-5xl",
        )}
      >
        {name ? (
          <>
            {t("today.hi")}{" "}
            {/* A name taken from an email is Latin text: keep it in its own direction. */}
            <bdi className="text-gradient-primary">{name}</bdi>
          </>
        ) : (
          t("today.hiThere")
        )}
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">{t("today.lede")}</p>
    </header>
  );
}
