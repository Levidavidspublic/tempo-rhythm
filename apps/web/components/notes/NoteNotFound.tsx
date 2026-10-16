"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";

/** A page that is gone (deleted, or a stale link): the shared empty state with a way back. */
export function NoteNotFound() {
  const { t } = useLocale();
  return (
    <div className="tp-paper" data-component="PageEditor">
      <div className="tp-page__body">
        <div className="tp-state tp-state--empty" data-component="StateEmpty">
          <span className="tp-state__icon">
            <TpIcon name="page" size="lg" />
          </span>
          <h1 className="tp-state__title">{t("page.notFound")}</h1>
          <p className="tp-state__body">{t("page.notFoundBody")}</p>
          <div className="tp-state__actions">
            <Link href="/notes" className="tp-btn tp-btn--secondary">
              {t("page.backToNotes")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
