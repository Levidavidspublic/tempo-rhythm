"use client";

import * as convexReact from "convex/react";
import { useMutation, useQuery } from "convex/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useToastRoom } from "@/components/study/useToastRoom";
import { TpIcon } from "@/components/tempo/TpIcon";
import { UndoToast } from "@/components/you/UndoToast";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MessageKey } from "@/lib/i18n";
import type { ReminderChannelRow } from "./RemindersSettings";

/** One accepted phrase of an enabled nag, as the "Send a test" picker shows it. */
export type TestPhrase = { value: string; label: string };

export type TelegramStatus = { tone: "ok" | "error"; text: MessageKey } | null;

export type TelegramBusy = "connect" | "test" | "disconnect" | null;

type Nag = {
  _id: string;
  label: string;
  enabled: boolean;
  phrases: ReadonlyArray<{ id: string; text: string; status: "proposed" | "accepted" | "rejected" }>;
};

const SEP = "::";

/** The accepted phrases of the person's switched-on nags: the only words a test can send (F-60). */
export function testPhrases(nags: readonly Nag[]): TestPhrase[] {
  return nags.flatMap((nag) =>
    nag.enabled
      ? nag.phrases
          .filter((phrase) => phrase.status === "accepted" && phrase.text.trim())
          .map((phrase) => ({ value: `${nag._id}${SEP}${phrase.id}`, label: `${nag.label}: ${phrase.text.trim()}` }))
      : [],
  );
}

function splitPhrase(value: string): { nagId: string; phraseId: string } | null {
  const at = value.indexOf(SEP);
  return at > 0 ? { nagId: value.slice(0, at), phraseId: value.slice(at + SEP.length) } : null;
}

const SEND_ERRORS: Record<string, MessageKey> = {
  rate_limited: "rem.tg.err.rate_limited",
  blocked: "rem.tg.err.blocked",
  send_failed: "rem.tg.err.send_failed",
  no_channel: "rem.tg.err.no_channel",
  not_accepted: "rem.tg.err.not_accepted",
  nag_off: "rem.tg.err.nag_off",
  not_found: "rem.tg.err.not_found",
};

export const sendErrorKey = (reason: string): MessageKey => SEND_ERRORS[reason] ?? "rem.tg.err.generic";

/**
 * The Telegram row of Settings > Reminders as it is drawn, with no data of its own (the gallery
 * renders each state from here). Three states: not available yet (env missing), not connected
 * (Connect, then "waiting for Start" with a way to open Telegram again) and connected (pick a
 * phrase, Send a test, Disconnect). One primary button at a time. Async results are spoken from
 * the row's status line.
 */
export function TelegramChannelRow({
  channel,
  waitingUrl,
  phrases,
  selected,
  busy,
  status,
  onConnect,
  onSelect,
  onTest,
  onDisconnect,
  connectRef,
  testRef,
}: {
  channel: ReminderChannelRow;
  /** The t.me link while waiting for Start; null otherwise. */
  waitingUrl: string | null;
  /** Undefined while the nags load. */
  phrases: readonly TestPhrase[] | undefined;
  selected: string;
  busy: TelegramBusy;
  status: TelegramStatus;
  onConnect: () => void;
  onSelect: (value: string) => void;
  onTest: () => void;
  onDisconnect: () => void;
  connectRef?: RefObject<HTMLButtonElement | null>;
  testRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useLocale();
  const available = channel.available === true;
  const connected = available && channel.connected;
  // Which Telegram account pressed Start, so a leaked link code shows up as someone else's name.
  const [asBefore, asAfter = ""] = t("rem.tg.connectedAs").split("{name}");
  const firstName = connected ? channel.telegramFirstName : undefined;
  const statusText = status ? t(status.text) : waitingUrl && !connected ? t("rem.tg.waiting") : "";
  return (
    <div className="tp-setting-row tp-rem-tg" data-component="SettingRow" data-channel="telegram">
      <div className="tp-setting-row__text">
        <span className="tp-setting-row__label tp-rem-name">
          <TpIcon name="send" size="sm" />
          <span>{channel.label}</span>
        </span>
        <span className="tp-help" id="rem-tg-help">
          {!available ? (
            t("rem.tg.unavailableHelp")
          ) : firstName ? (
            <>
              {asBefore}
              <bdi className="tp-rem-tg__who">{firstName}</bdi>
              {asAfter}
            </>
          ) : connected ? (
            t("rem.tg.connectedHelp")
          ) : (
            t("rem.ch.telegram")
          )}
        </span>
        {firstName ? <span className="tp-help">{t("rem.tg.notYou")}</span> : null}
        {available && !connected && channel.needsReconnect ? (
          <span className="tp-help tp-rem-tg__note">
            <TpIcon name="alert" size="sm" />
            <span>{t("rem.tg.reconnect")}</span>
          </span>
        ) : null}

        {available && !connected ? (
          <div className="tp-rem-tg__actions">
            <button
              ref={connectRef}
              className="tp-btn tp-btn--primary"
              type="button"
              disabled={busy === "connect"}
              aria-describedby="rem-tg-connect-help"
              onClick={onConnect}
            >
              <TpIcon name="send" size="sm" />
              <span>{t("rem.tg.connect")}</span>
            </button>
            {waitingUrl ? (
              <a className="tp-btn tp-btn--ghost" href={waitingUrl} target="_blank" rel="noopener noreferrer">
                <TpIcon name="link" size="sm" />
                <span>{t("rem.tg.openAgain")}</span>
              </a>
            ) : null}
            <span className="tp-help" id="rem-tg-connect-help">
              {t("rem.tg.connectHelp")}
            </span>
          </div>
        ) : null}

        {connected ? (
          phrases === undefined ? (
            <output className="tp-help tp-rem-tg__status">{t("rem.tg.loadingPhrases")}</output>
          ) : phrases.length === 0 ? (
            <span className="tp-help tp-rem-tg__note">
              <TpIcon name="info" size="sm" />
              <span>{t("rem.tg.noPhrases")}</span>
            </span>
          ) : (
            <div className="tp-rem-tg__test">
              <div className="tp-field" data-component="Field">
                <label className="tp-label" htmlFor="rem-tg-phrase">
                  {t("rem.tg.testLabel")}
                </label>
                <div className="tp-select" data-component="Select">
                  <select
                    className="tp-select__input"
                    id="rem-tg-phrase"
                    value={selected}
                    aria-describedby="rem-tg-test-help"
                    onChange={(event) => onSelect(event.target.value)}
                  >
                    {phrases.map((phrase) => (
                      <option key={phrase.value} value={phrase.value}>
                        {phrase.label}
                      </option>
                    ))}
                  </select>
                  <span className="tp-select__icon">
                    <TpIcon name="down" size="sm" />
                  </span>
                </div>
                <span className="tp-help" id="rem-tg-test-help">
                  {t("rem.tg.testHelp")}
                </span>
              </div>
              <div className="tp-rem-tg__actions">
                <button
                  ref={testRef}
                  className="tp-btn tp-btn--primary"
                  type="button"
                  disabled={busy === "test" || !selected}
                  onClick={onTest}
                >
                  <TpIcon name="send" size="sm" />
                  <span>{t("rem.tg.test")}</span>
                </button>
              </div>
            </div>
          )
        ) : null}

        <output
          className={status?.tone === "error" ? "tp-error-text tp-rem-tg__status" : "tp-help tp-rem-tg__status"}
          aria-live="polite"
        >
          {statusText}
        </output>
      </div>
      <div className="tp-setting-row__control">
        {!available ? (
          <span className="tp-badge" data-component="Badge">
            <TpIcon name="clock" size="sm" />
            <span>{t("rem.tg.unavailable")}</span>
          </span>
        ) : connected ? (
          <>
            <span className="tp-badge" data-component="Badge" data-tone="done">
              <TpIcon name="check" size="sm" />
              <span>{t("rem.tg.connected")}</span>
            </span>
            <button
              className="tp-btn tp-btn--secondary tp-btn--sm"
              type="button"
              disabled={busy === "disconnect"}
              onClick={onDisconnect}
            >
              <TpIcon name="x" size="sm" />
              <span>{t("rem.tg.disconnect")}</span>
            </button>
          </>
        ) : (
          <span className="tp-badge" data-component="Badge">
            <TpIcon name="clock" size="sm" />
            <span>{t("rem.notConnected")}</span>
          </span>
        )}
      </div>
    </div>
  );
}

type UndoState = { id: number; linkId: Id<"reminderChannelLinks">; untilMs: number };

/**
 * The live Telegram row: `reminders.channels` flips it to Connected on its own once the person
 * presses Start, so Connect only opens the link and waits. Disconnect is a soft delete with a
 * 5:00 Undo toast.
 */
export function TelegramChannel({ channel }: { channel: ReminderChannelRow }) {
  const { t } = useLocale();
  const connected = channel.available === true && channel.connected;
  const nags = useQuery(api.nags.list, connected ? {} : "skip");
  const startLink = useMutation(api.reminders.startTelegramLink);
  const unlink = useMutation(api.reminders.unlinkTelegram);
  const undoUnlink = useMutation(api.reminders.undoUnlinkTelegram);
  // Through the namespace: several test files stand in for convex/react without `useAction`, and a
  // named import of a missing export fails when this module loads (bun's process-wide mocks).
  const sendTest = convexReact.useAction(api.reminders.sendTest);

  const [waitingUrl, setWaitingUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<TelegramBusy>(null);
  const [status, setStatus] = useState<TelegramStatus>(null);
  const [selected, setSelected] = useState("");
  const [toast, setToast] = useState<UndoState | null>(null);
  useToastRoom(toast);
  const connectRef = useRef<HTMLButtonElement>(null);
  const testRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"connect" | "test" | null>(null);

  const phrases = nags === undefined ? undefined : testPhrases(nags);
  const firstPhrase = phrases?.[0]?.value ?? "";
  useEffect(() => {
    if (!phrases) return;
    if (!phrases.some((phrase) => phrase.value === selected)) setSelected(firstPhrase);
  }, [phrases, selected, firstPhrase]);

  // The live query flips the row; say so, and move focus to what is there now.
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected === wasConnected.current) return;
    wasConnected.current = connected;
    if (connected && waitingUrl) {
      setWaitingUrl(null);
      setStatus({ tone: "ok", text: "rem.tg.linked" });
    }
    const target = focusNext.current;
    focusNext.current = null;
    if (target === "connect" && !connected) connectRef.current?.focus();
    if (target === "test" && connected) testRef.current?.focus();
  }, [connected, waitingUrl]);

  const connect = async () => {
    if (busy) return;
    setBusy("connect");
    setStatus(null);
    // Opened inside the click so a popup blocker lets it through; filled once the link is made.
    const tab = typeof window === "undefined" ? null : window.open("", "_blank");
    try {
      const started = await startLink({});
      if (!started.ok) {
        tab?.close();
        setStatus({
          tone: "error",
          text: started.reason === "rate_limited" ? "rem.tg.err.connectLimit" : "rem.tg.err.no_channel",
        });
        return;
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = started.url;
      }
      setWaitingUrl(started.url);
    } catch {
      tab?.close();
      setStatus({ tone: "error", text: "rem.tg.err.generic" });
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    const picked = splitPhrase(selected);
    if (!picked || busy) return;
    setBusy("test");
    setStatus(null);
    try {
      const result = await sendTest({ nagId: picked.nagId as Id<"nags">, phraseId: picked.phraseId });
      setStatus(result.ok ? { tone: "ok", text: "rem.tg.sent" } : { tone: "error", text: sendErrorKey(result.reason) });
    } catch {
      setStatus({ tone: "error", text: "rem.tg.err.generic" });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy("disconnect");
    setStatus(null);
    try {
      const result = await unlink({});
      if (result.ok) {
        focusNext.current = "connect";
        setToast({ id: Date.now(), linkId: result.linkId, untilMs: result.undoUntil });
      } else {
        setStatus({ tone: "error", text: "rem.tg.err.no_channel" });
      }
    } catch {
      setStatus({ tone: "error", text: "rem.tg.err.generic" });
    } finally {
      setBusy(null);
    }
  };

  const undo = async (linkId: Id<"reminderChannelLinks">) => {
    const result = await undoUnlink({ linkId });
    if (!result.ok) throw new Error(result.reason);
    focusNext.current = "test";
  };

  return (
    <>
      <TelegramChannelRow
        channel={channel}
        waitingUrl={waitingUrl}
        phrases={phrases}
        selected={selected}
        busy={busy}
        status={status}
        onConnect={() => void connect()}
        onSelect={setSelected}
        onTest={() => void test()}
        onDisconnect={() => void disconnect()}
        connectRef={connectRef}
        testRef={testRef}
      />
      {toast ? (
        <UndoToast
          key={toast.id}
          title={t("rem.tg.disconnected")}
          untilMs={toast.untilMs}
          onUndo={() => undo(toast.linkId)}
          onClose={() => setToast(null)}
          labels={{ action: t("you.toast.undo"), sub: t("you.toast.sub"), error: t("rem.tg.err.undo") }}
        />
      ) : null}
    </>
  );
}
