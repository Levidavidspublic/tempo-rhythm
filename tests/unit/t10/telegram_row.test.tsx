/**
 * Settings > Reminders, the Telegram row (S14, picked 2026-10-18), as static renders in English
 * like t10_components.test.tsx: each state's controls, names, live region and the one primary
 * button. The phrase picker's pure helpers are tested directly. All data is fictional.
 */
import { describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { createElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { translate } from "../../../apps/web/lib/i18n";

// Keep every other export real, so no later test file that imports the provider is affected.
const realLocale = await import("../../../apps/web/components/providers/LocaleProvider");
mock.module("../../../apps/web/components/providers/LocaleProvider", () => ({
  ...realLocale,
  useLocale: () => ({
    lang: "en",
    dir: "ltr",
    setLang: () => {},
    t: (key: Parameters<typeof translate>[1]) => translate("en", key),
  }),
}));

const { TelegramChannelRow, testPhrases, sendErrorKey } = await import(
  "../../../apps/web/components/settings-reminders/TelegramChannel"
);
const { RemindersChannelList } = await import("../../../apps/web/components/settings-reminders/RemindersSettings");
const { en, he } = await import("../../../apps/web/lib/i18n-groups/t10");

const noop = () => {};
const base = {
  waitingUrl: null,
  phrases: [] as Array<{ value: string; label: string }>,
  selected: "",
  busy: null,
  status: null,
  onConnect: noop,
  onSelect: noop,
  onTest: noop,
  onDisconnect: noop,
};
const tg = (extra: Record<string, unknown>) => ({ id: "telegram", label: "Telegram", connected: false, ...extra });
const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(TelegramChannelRow, { ...base, ...props } as never));
const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe("Telegram row states", () => {
  test("env missing: Not available yet, and no button at all", () => {
    const html = render({ channel: tg({ available: false }) });
    expect(html).toContain("Not available yet");
    expect(html).toContain("Telegram isn&#x27;t set up for Tempo yet.");
    expect(html).not.toContain("<button");
  });

  test("not connected: one primary Connect, described, and an empty live region", () => {
    const html = render({ channel: tg({ available: true }) });
    expect(html).toContain("Not connected yet");
    expect(count(html, /tp-btn--primary/g)).toBe(1);
    expect(html).toMatch(/<button[^>]*aria-describedby="rem-tg-connect-help"[^>]*>.*Connect Telegram/);
    expect(html).toMatch(/<output class="tp-help tp-rem-tg__status" aria-live="polite"><\/output>/);
    expect(html).not.toContain("Open Telegram again");
  });

  test("waiting for Start: says so in the live region and offers the link again in a new tab", () => {
    const url = "https://t.me/TempoSampleBot?start=MOCKEDcodeMOCKEDcodeMOCKEDcode00";
    const html = render({ channel: tg({ available: true }), waitingUrl: url });
    expect(html).toMatch(/<output[^>]*aria-live="polite">Waiting for you to press Start in Telegram\./);
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("blocked earlier: asks to connect again", () => {
    const html = render({ channel: tg({ available: true, needsReconnect: true }) });
    expect(html).toContain("Telegram stopped taking messages from Tempo");
  });

  test("connected: a labelled phrase picker, one primary Send a test, Disconnect", () => {
    const phrases = [
      { value: "nags:1::p1", label: "Plants: Water the plants" },
      { value: "nags:1::p2", label: "Plants: The basil is sulking" },
    ];
    const html = render({ channel: tg({ available: true, connected: true }), phrases, selected: "nags:1::p2" });
    expect(html).toContain("Connected");
    expect(html).toContain('<label class="tp-label" for="rem-tg-phrase">Phrase to send</label>');
    expect(html).toMatch(/<select[^>]*id="rem-tg-phrase"/);
    expect(html).toContain("Plants: The basil is sulking");
    expect(count(html, /tp-btn--primary/g)).toBe(1);
    expect(html).toContain("Send a test");
    expect(html).toContain("Disconnect");
    expect(html).not.toContain("Connect Telegram");
  });

  test("connected with no phrase to send says how to get one", () => {
    const html = render({ channel: tg({ available: true, connected: true }), phrases: [] });
    expect(html).toContain("No phrase to send yet.");
    expect(html).not.toContain("Send a test");
  });

  test("a result is spoken from the status line, an error in error style", () => {
    const ok = render({ channel: tg({ available: true, connected: true }), status: { tone: "ok", text: "rem.tg.sent" } });
    expect(ok).toMatch(/<output class="tp-help tp-rem-tg__status"[^>]*>Sent\. Check Telegram\./);
    const bad = render({
      channel: tg({ available: true, connected: true }),
      status: { tone: "error", text: sendErrorKey("blocked") },
    });
    expect(bad).toMatch(/<output class="tp-error-text tp-rem-tg__status"/);
    expect(bad).toContain("If you blocked the bot");
  });
});

describe("the list with a Telegram row", () => {
  test("the Telegram slot replaces only the Telegram row", () => {
    const channels = [
      { id: "whatsapp", label: "WhatsApp", connected: false, available: false },
      { id: "telegram", label: "Telegram", connected: false, available: true },
      { id: "sms", label: "SMS", connected: false, available: false },
    ];
    const html = renderToStaticMarkup(
      createElement(RemindersChannelList, {
        channels,
        telegram: createElement(TelegramChannelRow, { ...base, channel: channels[1] } as never),
      }),
    );
    expect(count(html, /data-channel="/g)).toBe(3);
    expect(count(html, /Not connected yet/g)).toBe(3);
    expect(html).toContain("Connect Telegram");
  });
});

describe("helpers", () => {
  test("only accepted phrases of switched-on nags can be sent", () => {
    const nags = [
      {
        _id: "nags:1",
        label: "Plants",
        enabled: true,
        phrases: [
          { id: "p1", text: " Water the plants ", status: "accepted" as const },
          { id: "p2", text: "Maybe later", status: "proposed" as const },
          { id: "p3", text: "   ", status: "accepted" as const },
        ],
      },
      { _id: "nags:2", label: "Keys", enabled: false, phrases: [{ id: "k1", text: "Keys!", status: "accepted" as const }] },
    ];
    expect(testPhrases(nags)).toEqual([{ value: "nags:1::p1", label: "Plants: Water the plants" }]);
  });

  test("every refusal has words; unknown ones fall back", () => {
    for (const reason of ["rate_limited", "blocked", "send_failed", "no_channel", "not_accepted", "nag_off", "not_found"]) {
      expect(sendErrorKey(reason)).toBe(`rem.tg.err.${reason}` as never);
    }
    expect(sendErrorKey("something_new")).toBe("rem.tg.err.generic");
  });

  test("Telegram copy is in English and Hebrew, with no em dash", () => {
    const keys = Object.keys(en).filter((key) => key.startsWith("rem.tg."));
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) {
      const k = key as keyof typeof en;
      expect(he[k].length).toBeGreaterThan(0);
      expect(en[k]).not.toContain("—");
      expect(he[k]).not.toContain("—");
    }
  });
});
