"use client";

import Link from "next/link";
import { McpTokensCard } from "@/components/mcp/McpTokensCard";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import type { MessageKey } from "@/lib/i18n";

/** Planned connectors (settings-integrations.html). Every one is "coming later" today. */
const CONNECTORS: readonly { name: string; icon: TpIconName; what: MessageKey }[] = [
  { name: "Google Calendar", icon: "calendar-grid", what: "set.integ.c1" },
  { name: "Gmail", icon: "mail", what: "set.integ.c2" },
  { name: "WhatsApp", icon: "phone", what: "set.integ.c3" },
  { name: "Telegram", icon: "send", what: "set.integ.c4" },
  { name: "Obsidian", icon: "page", what: "set.integ.c5" },
  { name: "Apple Notes", icon: "text", what: "set.integ.c6" },
];

const PROMISES: readonly { icon: TpIconName; text: MessageKey }[] = [
  { icon: "lock", text: "set.integ.p1" },
  { icon: "hand", text: "set.integ.p2" },
  { icon: "shield", text: "set.integ.p3" },
];

/**
 * Settings · Integrations body (docs/design/v3/screens/web/settings-integrations.html): the
 * planned connectors with a "Coming later" badge (no Connect buttons, no fake toggles), the
 * promise for when they arrive, and what works today: the one-time memory import and personal
 * MCP tokens (McpTokensCard). The list is fixed, so there is no query and no loading state.
 */
export function IntegrationsList() {
  const { t } = useLocale();
  return (
    <>
      <section className="tp-settings-section" aria-labelledby="soon-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="soon-title">
            {t("set.later")}
          </h2>
          <p className="tp-settings-section__desc">{t("set.integ.soonDesc")}</p>
        </div>
        {CONNECTORS.map((connector) => (
          <div className="tp-setting-row od-row" data-component="SettingRow" key={connector.name}>
            <div className="tp-setting-row__text">
              <span className="tp-setting-row__label ig-name">
                <TpIcon name={connector.icon} size="sm" />
                <span>{connector.name}</span>
              </span>
              <span className="tp-help">{t(connector.what)}</span>
            </div>
            <div className="tp-setting-row__control">
              <span className="tp-badge" data-component="Badge">
                <TpIcon name="clock" size="sm" />
                <span>{t("set.later")}</span>
              </span>
            </div>
          </div>
        ))}
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.integ.askLabel")}</span>
            <span className="tp-help">{t("set.integ.askHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--ghost" href="/ask-founder">
              <span>{t("set.integ.askBtn")}</span>
              <TpIcon name="chevron" size="sm" flip />
            </Link>
          </div>
        </div>
      </section>

      <section className="tp-settings-section" aria-labelledby="promise-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="promise-title">
            {t("set.integ.promise")}
          </h2>
        </div>
        <ul className="tp-list" data-component="ListRow">
          {PROMISES.map((promise) => (
            <li key={promise.text}>
              <div className="tp-list-row tp-setting-row">
                <span className="tp-list-row__icon">
                  <TpIcon name={promise.icon} size="sm" />
                </span>
                <span className="tp-list-row__body">
                  <span>{t(promise.text)}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="tp-settings-section" aria-labelledby="now-title" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="now-title">
            {t("set.integ.now")}
          </h2>
        </div>
        <div className="tp-setting-row od-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("set.integ.memLabel")}</span>
            <span className="tp-help">{t("set.integ.memHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--secondary" href="/settings/memory/import">
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
