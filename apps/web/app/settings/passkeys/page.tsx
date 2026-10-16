"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useLocale } from "@/components/providers/LocaleProvider";
import { StateLoading } from "@/components/settings/states";
import { TpIcon, TpIconSprite } from "@/components/tempo/TpIcon";

import { passkeysView } from "./passkeys-view";

const PASSKEYS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PASSKEYS === "true";

/**
 * Settings · Passkeys. This route sits outside the app shell, so the page brings its own main,
 * gutter and icon sprite, and is laid out like the other settings pages (PageLayout, PageHeader,
 * SettingsSection, SettingRow). Adding a passkey isn't built yet, with or without the flag, so the
 * row says so with a "Not available yet" badge instead of a button that does nothing.
 */
export default function PasskeysSettingsPage() {
  const { t } = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const view = passkeysView({ isLoading, isAuthenticated, passkeysEnabled: PASSKEYS_ENABLED });

  return (
    <>
      <a className="tp-skip" href="#main">
        {t("skip")}
      </a>
      <main className="pk-main" id="main" tabIndex={-1} data-testid="settings-passkeys">
        <TpIconSprite />
        <div className="tp-page tp-page--narrow" data-component="PageLayout">
          <header className="tp-pagehead" data-component="PageHeader">
            <div className="tp-pagehead__text">
              <h1 className="tp-pagehead__title">{t("set.pk.title")}</h1>
              <p className="tp-pagehead__sub">{t("set.pk.sub")}</p>
            </div>
          </header>

          <div className="pk-body">
            {view === "loading" ? <StateLoading label="set.pk.loading" rows={2} /> : null}

            {view === "signed-out" ? (
              // The server proxy already redirects signed-out visitors. Reaching here means the
              // client lost its session while the cookie is valid: offer a way back.
              <div className="tp-state" data-component="StateSignedOut">
                <span className="tp-state__icon">
                  <TpIcon name="lock" size="lg" />
                </span>
                <p className="tp-state__body">{t("set.pk.lost")}</p>
                <div className="tp-state__actions">
                  <Link className="tp-btn tp-btn--secondary" href="/sign-in?next=%2Fsettings%2Fpasskeys">
                    {t("set.pk.signInAgain")}
                  </Link>
                </div>
              </div>
            ) : null}

            {view === "coming-soon" || view === "enabled" ? (
              <section className="tp-settings-section" aria-labelledby="pk-title" data-component="SettingsSection">
                <div className="tp-settings-section__head">
                  <h2 className="tp-settings-section__title" id="pk-title">
                    {t("set.pk.section")}
                  </h2>
                </div>
                <div className="tp-setting-row od-row" data-component="SettingRow">
                  <div className="tp-setting-row__text">
                    <span className="tp-setting-row__label">{t("set.pk.addLabel")}</span>
                    <span className="tp-help">{t("set.pk.addHelp")}</span>
                  </div>
                  <div className="tp-setting-row__control">
                    <span className="tp-badge" data-component="Badge">
                      <TpIcon name="clock" size="sm" />
                      <span>{t("set.notYet")}</span>
                    </span>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
