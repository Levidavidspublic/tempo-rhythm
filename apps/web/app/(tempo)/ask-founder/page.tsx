"use client";

/**
 * @screen: ask-founder (docs/design/v3/screens/web/ask-founder.html)
 * @summary: Who reads messages here, and one real way to reach Amit: the email address the
 *   landing page shows. The design's form needs a feedback backend that doesn't exist yet, so
 *   there is no form and nothing here pretends to send.
 * @auth: required
 */
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";

/** The founder's address, the same one the landing page footer shows. */
const FOUNDER_EMAIL = "amit@tempoflow.app";

export default function Page() {
  const { t } = useLocale();
  return (
    <div data-testid="ask-founder-page" className="tp-page tp-page--narrow" data-component="PageLayout">
      <header className="tp-pagehead" data-component="PageHeader">
        <div className="tp-pagehead__text">
          <h1 className="tp-pagehead__title">{t("set.founder.title")}</h1>
          <p className="tp-pagehead__sub">{t("set.founder.sub")}</p>
        </div>
      </header>

      <section className="tp-settings-section" aria-labelledby="founder-mail-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="founder-mail-title">
            {t("set.founder.mail")}
          </h2>
          <p className="tp-settings-section__desc">{t("set.founder.mailHelp")}</p>
        </div>
        <div className="tp-setting-row" data-component="SettingRow">
          <a className="tp-btn tp-btn--secondary" href={`mailto:${FOUNDER_EMAIL}`}>
            <TpIcon name="mail" size="sm" />
            <span dir="ltr">{FOUNDER_EMAIL}</span>
          </a>
        </div>
      </section>
    </div>
  );
}
