"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "./TpIcon";

/** CoachButton: the glass coach FAB, bottom trailing corner (F-81). Opens the coach (Ctrl J). */
export function CoachButton() {
  const { t } = useLocale();
  return (
    <Link className="tp-coach-fab tp-glass" href="/coach" data-component="CoachButton" aria-label={t("coach.open")}>
      <TpIcon name="coach" />
      <span className="tp-coach-fab__label">{t("coach.name")}</span>
    </Link>
  );
}
