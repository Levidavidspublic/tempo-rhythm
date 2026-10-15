import { describe, expect, test } from "bun:test";
import { VOICE_LIMITS, laneFor, leaseExpired, leaseMs, localDateKey, speechSentences, utcDateKey } from "./voicePolicy";

describe("laneFor", () => {
  test("English (and no preference) streams to Flux on /v2/listen", () => {
    expect(laneFor("en")).toEqual({ language: "en", url: "wss://api.deepgram.com/v2/listen?model=flux-general-en" });
    expect(laneFor(undefined)?.language).toBe("en");
  });

  test("Hebrew stays off until a Hebrew crisis list is approved; anything else is off", () => {
    expect(laneFor("he")).toBeNull();
    expect(laneFor("fr")).toBeNull();
  });
});

describe("speechSentences", () => {
  test("splits after sentence marks and at line breaks, in order", () => {
    expect(speechSentences("Start with Dana. Then the report!\nLaundry can wait?")).toEqual([
      "Start with Dana.",
      "Then the report!",
      "Laundry can wait?",
    ]);
  });

  test("drops Markdown marks, code and links but keeps their words", () => {
    expect(speechSentences("## Plan\n- [ ] **Call** the [bank](https://x.y)\n```js\nx()\n```\nDone.")).toEqual([
      "Plan",
      "Call the bank",
      "Done.",
    ]);
  });

  test("keeps Hebrew and closing quotes with their sentence; skips lines with no words", () => {
    expect(speechSentences("קודם דנה. אחר כך הדוח.\n---\nShe said \"go.\" Then stop.")).toEqual([
      "קודם דנה.",
      "אחר כך הדוח.",
      'She said "go."',
      "Then stop.",
    ]);
  });

  test("a sentence over the limit is cut at a space, never over the limit", () => {
    const long = `${"word ".repeat(200)}end.`;
    const parts = speechSentences(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(VOICE_LIMITS.maxSentenceChars);
    expect(parts.join(" ")).toBe(long.replace(/\s+/g, " ").trim());
  });

  test("the same reply always gives the same sentences", () => {
    const reply = "One. Two? Three!";
    expect(speechSentences(reply)).toEqual(speechSentences(reply));
    expect(speechSentences("")).toEqual([]);
  });
});

describe("lease time", () => {
  const start = 1_000_000;

  test("a closed lease counts from start to end", () => {
    expect(leaseMs({ startedAt: start, lastRenewalAt: start, endedAt: start + 90_000 }, start + 999_999)).toBe(90_000);
  });

  test("a live lease counts up to now", () => {
    expect(leaseMs({ startedAt: start, lastRenewalAt: start + 50_000 }, start + 60_000)).toBe(60_000);
  });

  test("an abandoned lease counts to its last renewal plus one interval, never to now", () => {
    expect(leaseMs({ startedAt: start, lastRenewalAt: start + 30_000 }, start + 600_000)).toBe(
      30_000 + VOICE_LIMITS.renewEveryMs,
    );
  });

  test("expires after missed renewals or past the session limit", () => {
    expect(leaseExpired({ startedAt: start, lastRenewalAt: start }, start + VOICE_LIMITS.leaseExpiresAfterMs)).toBe(false);
    expect(leaseExpired({ startedAt: start, lastRenewalAt: start }, start + VOICE_LIMITS.leaseExpiresAfterMs + 1)).toBe(true);
    const now = start + VOICE_LIMITS.maxSessionMs + 1;
    expect(leaseExpired({ startedAt: start, lastRenewalAt: now - 1_000 }, now)).toBe(true);
  });
});

describe("day keys", () => {
  test("the local day follows the time zone; a bad zone falls back to UTC", () => {
    const t = Date.UTC(2026, 9, 15, 22, 30);
    expect(localDateKey(t, "Asia/Jerusalem")).toBe("2026-10-16");
    expect(localDateKey(t, "America/Los_Angeles")).toBe("2026-10-15");
    expect(localDateKey(t, "Not/AZone")).toBe("2026-10-15");
    expect(localDateKey(t, undefined)).toBe("2026-10-15");
    expect(utcDateKey(t)).toBe("2026-10-15");
  });
});
