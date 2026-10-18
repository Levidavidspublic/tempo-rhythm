import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  escapeHtml,
  RESEND_EMAILS_URL,
  SIGN_IN_EMAIL_SUBJECT,
  sendSignInEmail,
  signInEmail,
} from "./signInEmail";

const URL_ = "https://preview.tempoflow.dev/today?code=EXAMPLE";
const HOST = "preview.tempoflow.dev";

const EN_INTRO = `This is your sign-in link for Tempo Flow on ${HOST}.`;
const EN_LIFETIME = "The link works for 30 minutes and only once.";
const EN_IGNORE =
  "If you didn't ask for this, you can ignore this email. Nobody can sign in without the link.";
const HE_LIFETIME = "הקישור עובד במשך 30 דקות ופעם אחת בלבד.";
const HE_IGNORE = "אם לא ביקשתם את זה, אפשר להתעלם מהמייל הזה. אף אחד לא יכול להיכנס בלי הקישור.";

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

type FetchCall = { input: string; init: RequestInit | undefined };

const originalFetch = globalThis.fetch;
let calls: FetchCall[] = [];

/** Replaces fetch for one test. No test ever reaches the network. */
function stubFetch(respond: () => Promise<Response>): void {
  const stub = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init });
    return respond();
  };
  globalThis.fetch = stub as unknown as typeof fetch;
}

beforeEach(() => {
  calls = [];
  stubFetch(() => Promise.reject(new Error("network is off in tests")));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("signInEmail (pure builder)", () => {
  test("the subject is short, in English, names Tempo Flow, and ends with the Hebrew", () => {
    const { subject } = signInEmail({ url: URL_, host: HOST });
    expect(subject).toBe(SIGN_IN_EMAIL_SUBJECT);
    expect(subject.startsWith("Your Tempo Flow sign-in link")).toBe(true);
    expect(subject).toContain("קישור הכניסה שלכם");
    expect(subject.length).toBeLessThanOrEqual(60);
  });

  test("both languages are present, English first, in the HTML and the text part", () => {
    const { html, text } = signInEmail({ url: URL_, host: HOST });
    for (const part of [html, text]) {
      expect(part).toContain(EN_LIFETIME);
      expect(part).toContain(EN_IGNORE);
      expect(part).toContain(HE_LIFETIME);
      expect(part).toContain(HE_IGNORE);
      expect(part.indexOf(EN_IGNORE)).toBeLessThan(part.indexOf(HE_LIFETIME));
    }
    expect(html).toContain(EN_INTRO);
    expect(text).toContain(EN_INTRO);
    expect(html).toContain("Sign in to Tempo Flow");
  });

  test("the link appears exactly once as a button and once as plain text", () => {
    const { html, text } = signInEmail({ url: URL_, host: HOST });
    expect(count(html, URL_)).toBe(2);
    expect(count(html, "<a ")).toBe(1);
    expect(count(html, `href="${URL_}"`)).toBe(1);
    expect(html).toMatch(/<a href="[^"]+"[^>]*>Sign in to Tempo Flow<\/a>/);
    expect(count(html, `>${URL_}</p>`)).toBe(1);
    expect(count(text, URL_)).toBe(1);
  });

  test("the HTML escapes the link and the host", () => {
    const hostile = `https://x.test/?code=a&b="><script>alert(1)</script>'`;
    const hostileHost = `x.test"><img src=x>`;
    const { html, text } = signInEmail({ url: hostile, host: hostileHost });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain(hostile);
    expect(html).not.toContain(hostileHost);
    expect(count(html, escapeHtml(hostile))).toBe(2);
    expect(count(html, escapeHtml(hostileHost))).toBe(2);
    expect(escapeHtml(hostile)).toBe(
      "https://x.test/?code=a&amp;b=&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&#39;"
    );
    // The text part is plain text: the link stays exactly as sent.
    expect(count(text, hostile)).toBe(1);
  });

  test("the Hebrew block is dir=rtl lang=he and comes after the English block", () => {
    const { html } = signInEmail({ url: URL_, host: HOST });
    const en = html.indexOf('<td dir="ltr" lang="en"');
    const he = html.indexOf('<td dir="rtl" lang="he"');
    expect(en).toBeGreaterThan(-1);
    expect(he).toBeGreaterThan(en);
    expect(html.indexOf(HE_LIFETIME)).toBeGreaterThan(he);
    expect(html.indexOf(EN_LIFETIME)).toBeGreaterThan(en);
    expect(html.indexOf(EN_LIFETIME)).toBeLessThan(he);
    // The Latin host inside the Hebrew sentence keeps its own direction.
    expect(html).toContain(`<span dir="ltr">${HOST}</span>`);
  });

  test("no images, no tracking, nothing loaded from outside", () => {
    const { html } = signInEmail({ url: URL_, host: HOST });
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link/i);
    expect(html).not.toMatch(/<style/i);
    expect(html).not.toMatch(/\ssrc=/i);
    expect(html).not.toMatch(/url\(/i);
    expect(html).not.toMatch(/background-image/i);
    // The only web addresses are the sign-in link itself (button + plain text).
    expect(count(html, "http")).toBe(2);
    expect(count(html, "href=")).toBe(1);
  });

  test("calm copy: no exclamation marks", () => {
    const { subject, html, text } = signInEmail({ url: URL_, host: HOST });
    expect(subject).not.toContain("!");
    expect(text).not.toContain("!");
    expect(html.replace("<!doctype html>", "")).not.toContain("!");
  });

  test("dark-mode safe: every element that sets a text colour also sets its background", () => {
    const { html } = signInEmail({ url: URL_, host: HOST });
    const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1] ?? "");
    const withTextColour = styles.filter((s) => /(^|;)color:/.test(s));
    expect(withTextColour.length).toBeGreaterThan(5);
    for (const style of withTextColour) {
      expect(style).toContain("background-color:");
    }
    expect(html).toMatch(/<body style="[^"]*background-color:/);
  });
});

describe("sendSignInEmail (the Resend provider's sendVerificationRequest)", () => {
  const ADDRESS = "someone@example.com";
  const KEY = "re_test_key_never_shown";
  const FROM = "Tempo Flow <hello@example.com>";

  test("POSTs once to Resend with the provider's key and sender, to the address, with our content", async () => {
    stubFetch(() => Promise.resolve(new Response('{"id":"e1"}', { status: 200 })));
    await sendSignInEmail({
      identifier: ADDRESS,
      url: URL_,
      provider: { apiKey: KEY, from: FROM },
    });

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.input).toBe(RESEND_EMAILS_URL);
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.headers).toEqual({
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    });
    const built = signInEmail({ url: URL_, host: HOST });
    expect(JSON.parse(String(call?.init?.body))).toEqual({
      from: FROM,
      to: ADDRESS,
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
  });

  test("a non-2xx response throws with the status only, never the address, link or key", async () => {
    // Resend's error body can echo the request; it must not reach the error.
    stubFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: `bad ${ADDRESS} ${URL_} ${KEY}` }), {
          status: 500,
        })
      )
    );
    let caught: unknown;
    try {
      await sendSignInEmail({
        identifier: ADDRESS,
        url: URL_,
        provider: { apiKey: KEY, from: FROM },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const error = caught as Error;
    expect(error.message).toBe("Resend: could not send the sign-in email (500)");
    expect(error.cause).toBeUndefined();
    const everything = `${String(error)} ${error.stack ?? ""} ${JSON.stringify(error)}`;
    for (const secret of [ADDRESS, URL_, "EXAMPLE", KEY, "bad "]) {
      expect(everything).not.toContain(secret);
    }
    expect(calls).toHaveLength(1);
  });

  test("a network failure throws without the address, link or key", async () => {
    stubFetch(() => Promise.reject(new Error(`connect failed for ${ADDRESS} ${URL_} ${KEY}`)));
    let caught: unknown;
    try {
      await sendSignInEmail({
        identifier: ADDRESS,
        url: URL_,
        provider: { apiKey: KEY, from: FROM },
      });
    } catch (error) {
      caught = error;
    }
    const error = caught as Error;
    expect(error.message).toBe("Resend: could not send the sign-in email (network error)");
    expect(error.cause).toBeUndefined();
    for (const secret of [ADDRESS, URL_, KEY]) {
      expect(`${String(error)} ${error.stack ?? ""}`).not.toContain(secret);
    }
  });

  test("an unparsable link throws without echoing it and sends nothing", async () => {
    const badLink = "not a link EXAMPLE";
    let caught: unknown;
    try {
      await sendSignInEmail({
        identifier: ADDRESS,
        url: badLink,
        provider: { apiKey: KEY, from: FROM },
      });
    } catch (error) {
      caught = error;
    }
    const error = caught as Error;
    expect(error.message).toBe("Resend: could not send the sign-in email (invalid link)");
    expect(`${String(error)} ${error.stack ?? ""}`).not.toContain("EXAMPLE");
    expect(calls).toHaveLength(0);
  });
});
