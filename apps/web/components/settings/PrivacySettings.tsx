"use client";

import Link from "next/link";
import { DeleteAccountCard } from "@/components/account/DeleteAccountCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon } from "@/components/tempo/TpIcon";
import { SettingsSwitch } from "./controls";

/**
 * Settings · Privacy (docs/design/v3/screens/web/settings-privacy.html): usage data, your data
 * (export + policy) and Leave Tempo. Only account deletion has a backend today
 * (users.deleteMyAccount). Tempo collects no usage analytics, so the switch stays off and locked
 * and says why; the export row says it is not available yet instead of offering a button.
 */
export function PrivacySettings() {
  const { t } = useLocale();
  return (
    <>
      <section className="tp-settings-section" aria-labelledby="an-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="an-title">
            {t("set.privacy.usage")}
          </h2>
        </div>
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label" id="an-l">
              {t("set.privacy.anLabel")}
            </span>
            <span className="tp-help" id="an-h">
              {t("set.privacy.anHelp")} {t("set.privacy.anLocked")}
            </span>
          </div>
          <div className="tp-setting-row__control">
            <SettingsSwitch checked={false} locked labelledBy="an-l" describedBy="an-h" />
          </div>
        </div>
      </section>

      <section className="tp-settings-section" aria-labelledby="data-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="data-title">
            {t("set.privacy.data")}
          </h2>
        </div>
        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.privacy.exLabel")}</span>
            <span className="tp-help">{t("set.privacy.exHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <span className="tp-badge" data-component="Badge">
              <TpIcon name="clock" size="sm" />
              <span>{t("set.notYet")}</span>
            </span>
          </div>
        </div>
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.privacy.polLabel")}</span>
            <span className="tp-help">{t("set.privacy.polHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--ghost" href="/privacy">
              <span>{t("set.privacy.polBtn")}</span>
              <TpIcon name="chevron" size="sm" flip />
            </Link>
          </div>
        </div>
      </section>

      <DeleteAccountCard />
    </>
  );
}
