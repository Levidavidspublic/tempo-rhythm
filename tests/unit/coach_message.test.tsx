/**
 * Kitchen polish: one coach-thread message. The coach's words render as Markdown (lists, bold,
 * code) with no raw HTML and no remote images; what the person typed stays plain text with its
 * own line breaks. Every message has a Copy action and its time. Lives in tests/unit because
 * `bun run test` does not include apps/web/components.
 */
import { describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { translate } from "../../apps/web/lib/i18n";

// Keep every other export real, so no later test file that imports the provider is affected.
const realLocale = await import("../../apps/web/components/providers/LocaleProvider");
mock.module("../../apps/web/components/providers/LocaleProvider", () => ({
  ...realLocale,
  useLocale: () => ({
    lang: "en",
    dir: "ltr",
    setLang: () => {},
    t: (key: Parameters<typeof translate>[1]) => translate("en", key),
  }),
}));

const { CoachMessage } = await import("../../apps/web/components/coach/CoachMessage");

const at = new Date(2026, 9, 16, 14, 5).getTime();

function render(role: "user" | "assistant", content: string): string {
  return renderToStaticMarkup(createElement(CoachMessage, { role, content, createdAt: at }));
}

describe("coach message", () => {
  test("a coach reply renders Markdown lists and emphasis", () => {
    const html = render("assistant", "Two small steps:\n\n- **Reply** to Dana\n- Draft the report");
    expect(html).toContain('data-role="assistant"');
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>Reply</strong>");
    expect(html).toContain("Draft the report");
  });

  test("a coach reply never renders raw HTML or loads a remote image", () => {
    const html = render("assistant", 'Hi <script>alert(1)</script> ![chart](https://example.com/x.png)');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("chart");
  });

  test("a link in a reply opens in a new tab without the opener", () => {
    const html = render("assistant", "See [the guide](https://example.com/guide).");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  test("what the person typed stays plain text, line breaks included", () => {
    const html = render("user", "**not bold**\nsecond line");
    expect(html).toContain('data-role="user"');
    expect(html).toContain("**not bold**\nsecond line");
    expect(html).not.toContain("<strong>");
  });

  test("every message shows its time and a Copy action", () => {
    const html = render("assistant", "Done.");
    expect(html).toContain("14:05");
    expect(html).toContain(">Copy<");
  });
});
