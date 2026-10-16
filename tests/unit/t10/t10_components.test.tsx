/**
 * Kitchen T10 components as static renders: Settings > Reminders, the ShareSheet and the
 * MiniAppFrame. `bun run test` has no DOM library in this repo, so like
 * tests/unit/coach_message.test.tsx these render to markup in English and check structure and copy.
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

const { RemindersChannelList } = await import("../../../apps/web/components/settings-reminders/RemindersSettings");
const { ShareSheet } = await import("../../../apps/web/components/share/ShareSheet");
const { MiniAppFrame } = await import("../../../apps/web/components/mini-app/MiniAppFrame");
const { en, he } = await import("../../../apps/web/lib/i18n-groups/t10");

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe("Settings > Reminders", () => {
  const channels = [
    { id: "whatsapp", label: "WhatsApp", connected: false },
    { id: "telegram", label: "Telegram", connected: false },
    { id: "sms", label: "SMS", connected: false },
  ];

  test("every channel says Not connected yet, with an icon and words, and no Connect button", () => {
    const html = renderToStaticMarkup(createElement(RemindersChannelList, { channels }));
    expect(count(html, /data-channel="/g)).toBe(3);
    expect(count(html, /Not connected yet/g)).toBe(3);
    expect(html).toContain("WhatsApp");
    expect(html).toContain("Your nags as text messages to your phone.");
    expect(html).not.toMatch(/>Connect</);
    expect(html).not.toContain("tp-btn--primary");
    expect(html).toContain('href="/settings/nags"');
  });

  test("an empty list says reminders stay in the app", () => {
    const html = renderToStaticMarkup(createElement(RemindersChannelList, { channels: [] }));
    expect(html).toContain("Your reminders stay in the app.");
  });
});

describe("ShareSheet", () => {
  const target = {
    kind: "page" as const,
    title: "Cell biology",
    markdown: "# Cells",
    url: "https://tempo.example.test/notes/n1",
  };

  test("a MobileSheet dialog with Close, Copy link and Download Markdown", () => {
    const html = renderToStaticMarkup(
      createElement(ShareSheet, { id: "sh", target, onClose: () => {}, systemShare: false }),
    );
    expect(html).toContain('class="tp-sheet tp-glass"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/<h2 class="tp-sheet__title" id="sh-title">Share this page<\/h2>/);
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('data-share="copy"');
    expect(html).toContain('data-share="md"');
    expect(html).not.toContain('data-share="system"');
    expect(html).not.toContain('data-share="anki"');
    expect(html).toContain("Nothing is uploaded or published.");
    expect(html).toContain('<output class="tp-share-status"');
  });

  test("the system share row comes first when the browser has one", () => {
    const html = renderToStaticMarkup(
      createElement(ShareSheet, { id: "sh", target, onClose: () => {}, systemShare: true }),
    );
    expect(html.indexOf('data-share="system"')).toBeLessThan(html.indexOf('data-share="copy"'));
    expect(html).toMatch(/data-share="system" data-share-first=""/);
  });

  test("a study set with cards offers the Anki file", () => {
    const html = renderToStaticMarkup(
      createElement(ShareSheet, {
        id: "sh",
        target: { ...target, kind: "set" as const, cards: [{ front: "A", back: "B" }] },
        onClose: () => {},
        systemShare: false,
      }),
    );
    expect(html).toContain("Share this study set");
    expect(html).toContain('data-share="anki"');
    expect(html).toContain("Download for Anki");
  });
});

describe("MiniAppFrame", () => {
  const html = "<p>Hello</p><script>parent.postMessage({type:'tempo:done'},'*')</script>";

  test("before approval: a card that explains the widget and a Run button, no iframe", () => {
    const out = renderToStaticMarkup(
      createElement(MiniAppFrame, { html, title: "Timer", approved: false, onApprove: () => {} }),
    );
    expect(out).not.toContain("<iframe");
    expect(out).toContain('data-state="ask"');
    expect(out).toContain("Run this widget");
    expect(out).toContain("walled off from Tempo");
    expect(out).toContain(">Timer<");
  });

  test("after approval: a sandboxed srcdoc iframe with the CSP first", () => {
    const out = renderToStaticMarkup(
      createElement(MiniAppFrame, { html, title: "Timer", approved: true, onApprove: () => {} }),
    );
    expect(out).toContain('sandbox="allow-scripts"');
    expect(out).not.toMatch(/allow-same-origin|allow-top-navigation|allow-forms|allow-popups/);
    expect(out).toMatch(/referrerPolicy="no-referrer"/i);
    expect(out).toContain('title="Timer"');
    const srcdoc = out.match(/srcDoc="([^"]*)"/i)?.[1] ?? "";
    expect(srcdoc).toContain("Content-Security-Policy");
    expect(srcdoc.indexOf("Content-Security-Policy")).toBeLessThan(srcdoc.indexOf("&lt;p&gt;Hello"));
    expect(out).not.toContain("src=\"http");
  });

  test("over 64 KB never runs, even when approved", () => {
    const out = renderToStaticMarkup(
      createElement(MiniAppFrame, { html: "a".repeat(64 * 1024 + 1), title: "Big", approved: true, onApprove: () => {} }),
    );
    expect(out).not.toContain("<iframe");
    expect(out).toContain('data-state="too-large"');
    expect(out).not.toContain("Run this widget");
  });
});

describe("T10 copy", () => {
  test("Hebrew covers every key; no emoji, no em dash", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const text of [...Object.values(en), ...Object.values(he)]) {
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(text).not.toContain("—");
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });
});
