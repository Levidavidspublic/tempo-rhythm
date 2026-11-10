"use client";

import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { StateEmpty } from "@/components/you/ScreenStates";
import type { MessageKey } from "@/lib/i18n";

/**
 * Modules (docs/design/v3/screens/web/modules.html), as an honest layout: there is no modules
 * backend yet (no modules.list, Plain mode or scheduled jobs), so "Your modules" shows its real
 * empty state and the built-in page types are listed without switches that could not save.
 */

const BUILT_INS: readonly { id: string; icon: TpIconName; name: MessageKey; does: MessageKey }[] = [
  { id: "daily", icon: "today", name: "md.b.daily", does: "md.b.dailyDoes" },
  { id: "weekly", icon: "calendar-grid", name: "md.b.weekly", does: "md.b.weeklyDoes" },
  { id: "project", icon: "folder", name: "md.b.project", does: "md.b.projectDoes" },
];

export function ModulesScreen() {
  const { t } = useLocale();
  return (
    <div className="tp-page" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("md.title")}</h1>
          <p className="tp-pagehead__sub">{t("md.sub")}</p>
        </div>
      </header>
      <div className="md-body">
        <section className="tp-section" aria-labelledby="md-yours-title" data-component="Section">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="md-yours-title">
              {t("md.yours.title")}
            </h2>
          </div>
          <StateEmpty icon="module" title={t("md.empty.t")} body={t("md.empty.b")} titleLevel={3} />
        </section>
        <section className="tp-section" aria-labelledby="md-builtin-title" data-component="Section">
          <div className="tp-section__head">
            <h2 className="tp-section__title" id="md-builtin-title">
              {t("md.bi.title")}
            </h2>
            <span className="tp-section__count">{t("md.bi.sub")}</span>
          </div>
          <div className="tp-cards" data-component="CardGrid">
            {BUILT_INS.map((module) => (
              <article
                className="tp-module-card"
                key={module.id}
                data-on="true"
                data-builtin="true"
                data-component="ModuleCard"
              >
                <span className="tp-module-card__icon">
                  <TpIcon name={module.icon} />
                </span>
                <h3 className="tp-module-card__name">{t(module.name)}</h3>
                <p className="tp-module-card__does">{t(module.does)}</p>
                <div className="tp-module-card__meta">
                  <span className="tp-badge" data-component="Badge">
                    <TpIcon name="lock" size="sm" />
                    <span>{t("md.badge.builtin")}</span>
                  </span>
                  <span className="tp-badge" data-tone="done" data-component="Badge">
                    <TpIcon name="check" size="sm" />
                    <span>{t("md.alwaysOn")}</span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
