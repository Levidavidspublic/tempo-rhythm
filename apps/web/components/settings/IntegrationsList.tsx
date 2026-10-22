"use client";

import Link from "next/link";
import { McpTokensCard } from "@/components/mcp/McpTokensCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";
import { ExecutorConnection } from "./ExecutorConnection";

const ACCESS_NOTES: readonly { icon: TpIconName; text: MessageKey }[] = [
  { icon: "lock", text: "exec.hub.permissions" },
  { icon: "hand", text: "exec.hub.limits" },
  { icon: "shield", text: "exec.hub.disconnect" },
];

/** The mounted tool hub uses the person's real Executor connection and existing import paths. */
export function IntegrationsList() {
  const { t } = useLocale();
  return (
    <>
      <ExecutorConnection />
      <section
        className="tp-settings-section"
        aria-labelledby="access-title"
        data-component="SettingsSection"
      >
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="access-title">
            {t("exec.hub.controlTitle")}
          </h2>
        </div>
        <ul className="tp-list" data-component="ListRow">
          {ACCESS_NOTES.map((note) => (
            <li key={note.text}>
              <div className="tp-list-row tp-setting-row">
                <span className="tp-list-row__icon">
                  <TpIcon name={note.icon} size="sm" />
                </span>
                <span className="tp-list-row__body">{t(note.text)}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("exec.hub.askTitle")}</span>
            <span className="tp-help">{t("exec.hub.askBody")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--ghost" href="/ask-founder">
              <span>{t("set.integ.askBtn")}</span>
              <TpIcon name="chevron" size="sm" flip />
            </Link>
          </div>
        </div>
      </section>
      <section
        className="tp-settings-section"
        aria-labelledby="now-title"
        data-component="SettingsSection"
      >
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="now-title">
            {t("exec.hub.otherTitle")}
          </h2>
        </div>
        <div className="tp-setting-row tp-setting-row--stack od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.integ.memLabel")}</span>
            <span className="tp-help">{t("set.integ.memHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--secondary" href="/settings/memory">
              <TpIcon name="upload" size="sm" />
              <span>{t("set.integ.memBtn")}</span>
            </Link>
          </div>
        </div>
      </section>
      <McpTokensCard />
    </>
  );
}
