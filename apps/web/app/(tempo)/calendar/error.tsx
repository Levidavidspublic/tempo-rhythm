"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { StateError } from "@/components/you/ScreenStates";

/** A calendar view that throws: the shared error state, inside the shell (DESIGN.md §13). */
export default function CalendarError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <StateError title={t("screen.calendarError")} body={t("you.safe")} onRetry={reset} />
    </div>
  );
}
