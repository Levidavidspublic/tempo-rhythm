"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { StateError } from "@/components/you/ScreenStates";

/**
 * Any screen in the app shell that throws (a failed query, a deleted page, a dropped connection)
 * lands here instead of Next's default crash page: the shell stays, the screen says so kindly,
 * and Try again re-renders it (DESIGN.md §13: every error says "Your data is safe.").
 */
export default function TempoScreenError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <StateError title={t("screen.error")} body={t("you.safe")} onRetry={reset} />
    </div>
  );
}
