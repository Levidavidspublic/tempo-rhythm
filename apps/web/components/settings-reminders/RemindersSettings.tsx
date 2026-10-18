"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { StateLoading } from "@/components/settings/states";
import { TpIcon, type TpIconName } from "@/components/tempo/TpIcon";
import { api } from "@/convex/_generated/api";
import type { MessageKey } from "@/lib/i18n";
import { TelegramChannel } from "./TelegramChannel";

export type ReminderChannelRow = {
  id: string;
  label: string;
  connected: boolean;
  /** False when the channel can't be connected (Telegram's env missing; WhatsApp and SMS). */
  available?: boolean;
  linkedAt?: number;
  /** Telegram stopped taking messages (the bot was blocked); connect again. */
  needsReconnect?: boolean;
};

const ABOUT: Record<string, { icon: TpIconName; what: MessageKey }> = {
  whatsapp: { icon: "phone", what: "rem.ch.whatsapp" },
  telegram: { icon: "send", what: "rem.ch.telegram" },
  sms: { icon: "mail", what: "rem.ch.sms" },
};

/**
 * Settings > Reminders body (S14, PRD F-61): the messaging channels from `reminders.channels`, each
 * with a badge (an icon and the words, never colour alone), and a way to the nags whose own words a
 * channel sends. Telegram (picked 2026-10-18) has its own row with Connect, Send a test and
 * Disconnect (`TelegramChannel`); WhatsApp and SMS stay "Not connected yet" placeholders.
 */
export function RemindersSettings() {
  const channels = useQuery(api.reminders.channels, {});
  if (channels === undefined) return <StateLoading label="rem.loading" rows={3} />;
  const telegram = channels.find((channel) => channel.id === "telegram");
  return (
    <RemindersChannelList channels={channels} telegram={telegram ? <TelegramChannel channel={telegram} /> : undefined} />
  );
}

/**
 * The list as drawn. `telegram`, when given, takes the Telegram row's place (the live row or a
 * gallery state); without it every channel shows its "Not connected yet" badge.
 */
export function RemindersChannelList({
  channels,
  telegram,
}: {
  channels: readonly ReminderChannelRow[];
  telegram?: ReactNode;
}) {
  const { t } = useLocale();
  return (
    <>
      <section className="tp-settings-section" aria-labelledby="rem-channels" data-component="SettingsSection">
        <div className="tp-settings-section__head">
          <h2 className="tp-settings-section__title" id="rem-channels">
            {t("rem.channels")}
          </h2>
          <p className="tp-settings-section__desc">{t("rem.channelsDesc")}</p>
        </div>
        {channels.length === 0 ? (
          <p className="tp-help">{t("rem.empty")}</p>
        ) : (
          channels.map((channel) => {
            if (channel.id === "telegram" && telegram) return <Fragment key={channel.id}>{telegram}</Fragment>;
            const about = ABOUT[channel.id] ?? { icon: "bell" as TpIconName, what: "rem.ch.other" as MessageKey };
            return (
              <div className="tp-setting-row" data-component="SettingRow" data-channel={channel.id} key={channel.id}>
                <div className="tp-setting-row__text">
                  <span className="tp-setting-row__label tp-rem-name">
                    <TpIcon name={about.icon} size="sm" />
                    <span>{channel.label}</span>
                  </span>
                  <span className="tp-help">{t(about.what)}</span>
                </div>
                <div className="tp-setting-row__control">
                  {/* A placeholder channel: nothing to connect. */}
                  <span className="tp-badge" data-component="Badge">
                    <TpIcon name="clock" size="sm" />
                    <span>{t("rem.notConnected")}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="tp-settings-section" aria-label={t("rem.nagsLabel")} data-component="SettingsSection">
        <div className="tp-setting-row" data-component="SettingRow">
          <div className="tp-setting-row__text">
            <span className="tp-setting-row__label">{t("rem.nagsLabel")}</span>
            <span className="tp-help">{t("rem.nagsHelp")}</span>
          </div>
          <div className="tp-setting-row__control">
            <Link className="tp-btn tp-btn--secondary" href="/settings/nags">
              <TpIcon name="nag" size="sm" />
              <span>{t("rem.nagsBtn")}</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
