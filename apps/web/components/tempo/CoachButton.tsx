"use client";

import { forwardRef } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "./TpIcon";

/**
 * CoachButton: the glass coach FAB, bottom trailing corner (F-81). Opens the coach panel (Ctrl J).
 * On a phone, main ends above it (tempo.css "COACH BUTTON CLEARANCE"), so keep the two in step.
 */
export const CoachButton = forwardRef<HTMLButtonElement, { expanded: boolean; onOpen: () => void }>(
  function CoachButton({ expanded, onOpen }, ref) {
    const { t } = useLocale();
    return (
      <button
        ref={ref}
        type="button"
        className="tp-coach-fab tp-glass"
        data-component="CoachButton"
        aria-label={t("coach.open")}
        aria-expanded={expanded}
        aria-controls="coach-panel"
        onClick={onOpen}
      >
        <TpIcon name="coach" />
        <span className="tp-coach-fab__label">{t("coach.name")}</span>
      </button>
    );
  },
);
