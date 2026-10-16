/**
 * Kitchen polish (settings, sign-in, approval): the waiting-for-approval card, the sign-in card and
 * the Hebrew copy of the settings screens. Static renders, no DOM; lives in tests/unit because
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

const { WaitingCard } = await import("../../apps/web/components/approval/WaitingForApproval");
const { AuthCardLoading, PageCard } = await import("../../apps/web/components/auth/SignInForm");

type WaitingProps = Parameters<typeof WaitingCard>[0];
type CardProps = Parameters<typeof PageCard>[0];

function waiting(props: Partial<WaitingProps> = {}): string {
  return renderToStaticMarkup(
    createElement(WaitingCard, {
      email: "maya.ronen@example.com",
      revoked: false,
      signingOut: false,
      signOutFailed: false,
      onSignOut: () => {},
      ...props,
    }),
  );
}

function card(props: Partial<CardProps> = {}): string {
  return renderToStaticMarkup(
    createElement(PageCard, {
      flow: "sign-in",
      email: "maya.ronen@example.com",
      setEmail: () => {},
      isLoading: false,
      error: "",
      sent: false,
      onSubmit: () => {},
      onReset: () => {},
      otherHref: "/sign-up",
      ...props,
    }),
  );
}

describe("waiting for approval", () => {
  test("pending: the v3 auth card and status panel, the email left to right, three next steps", () => {
    const html = waiting();
    expect(html).toContain('data-testid="approval-waiting"');
    expect(html).toContain('class="tp-auth-card"');
    expect(html).toContain('data-component="StatusPanel"');
    expect(html).toContain("Waiting for approval");
    expect(html).toMatch(/class="tp-status-panel__meta tp-ltr" dir="ltr">maya\.ronen@example\.com</);
    expect(html).toContain("What happens next");
    expect(html.match(/class="tp-step aw-step"/g)?.length).toBe(3);
    expect(html).toContain('class="tp-btn tp-btn--secondary"');
    expect(html).not.toContain('href="/contact"');
    expect(html).not.toContain('role="alert"');
  });

  test("a sign-out that didn't go through says so and the button stays", () => {
    const html = waiting({ signOutFailed: true });
    expect(html).toMatch(/<p class="tp-error-text" role="alert">.*Couldn&#x27;t sign out\. Try again in a moment\./);
    expect(html).toContain("Sign out");
  });

  test("paused: points to the Contact page instead of the sign-in email, no next steps", () => {
    const html = waiting({ revoked: true });
    expect(html).toContain("Your access is paused");
    expect(html).toContain("Contact page");
    expect(html).not.toContain("sign-in email");
    expect(html).toContain('href="/contact"');
    expect(html).not.toContain("What happens next");
  });
});

describe("sign-in card", () => {
  test("the form checks the email itself and keeps the names tests and scripts use", () => {
    const html = card();
    expect(/<form [^>]*novalidate=""/i.test(html)).toBe(true);
    expect(html).toContain('id="sign-in-email"');
    expect(html).toContain("Send magic link");
    expect(html).toContain('class="tp-btn tp-btn--link"');
    expect(html).not.toContain("tp-error-summary");
  });

  test("a link that couldn't be sent says nothing was lost, without blaming the email", () => {
    const html = card({ error: "send" });
    expect(html).toContain("Couldn&#x27;t send the link.");
    expect(html).toContain("Nothing was lost.");
    expect(html).not.toContain("check your email");
  });

  test("check your email: a long address is set left to right inside a lede that wraps", () => {
    const html = card({ sent: true, flow: "sign-up" });
    expect(html).toContain("Check your email");
    expect(html).toMatch(/<strong class="tp-ltr" dir="ltr">maya\.ronen@example\.com<\/strong>/);
  });

  test("while the session is checked: the auth card with skeleton lines, not a spinner", () => {
    const html = renderToStaticMarkup(createElement(AuthCardLoading));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('class="tp-auth-card__brand">Tempo<');
    expect(html).toContain("tp-skeleton");
    expect(html).not.toContain("animate-spin");
  });
});
