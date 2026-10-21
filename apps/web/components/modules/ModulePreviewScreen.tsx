"use client";

import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { StateEmpty } from "@/components/you/ScreenStates";

/**
 * Module preview (docs/design/v3/screens/web/module-preview.html). There are no module drafts
 * yet (no modules.getDraft / approve / discard), so every link lands on the design's real
 * "nothing to preview" state. Nothing here can approve or change anything.
 */
export function ModulePreviewScreen() {
  const { t } = useLocale();
  return (
    <div className="tp-page tp-page--wide" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("mp.title")}</h1>
        </div>
      </header>
      <StateEmpty
        className="mp-state"
        icon="module"
        title={t("mp.empty.t")}
        body={t("mp.empty.b")}
        action={
          <Link className="tp-btn tp-btn--secondary" href="/modules">
            <TpIcon name="module" size="sm" />
            <span>{t("mp.back")}</span>
          </Link>
        }
      />
    </div>
  );
}
