"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

/** Adapted from #1153 / PR #1160: a restored draft is acknowledged without another store. */
export function DraftRecoveryNotice({ onDismiss, disabled = false, withChoices = false }: {
  onDismiss: () => void;
  disabled?: boolean;
  withChoices?: boolean;
}) {
  const { t } = useLocale();
  return (
    <output className="tp-notice" data-component="DraftRecoveryNotice">
      <span className="tp-notice__text">{t(withChoices ? "mobile.recoveredPlan" : "mobile.recoveredDraft")}</span>
      <button type="button" className="tp-btn tp-btn--ghost tp-btn--sm" onClick={onDismiss} disabled={disabled}>
        {t("mobile.dismiss")}
      </button>
    </output>
  );
}
