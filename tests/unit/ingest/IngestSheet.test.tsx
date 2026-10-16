/**
 * IngestSheet (T8-T10 spec, S2): static renders of the sheet's states. `bun run test` has no DOM
 * library in this repo (no happy-dom / Testing Library installed), so like
 * tests/unit/coach_message.test.tsx these render to markup in English and check the structure,
 * copy and links. IngestSheetView takes `onSave` and `online` as props, so convex/react needs no
 * mock here.
 */
import { describe, expect, mock, test } from "bun:test";
import type { IngestSheetViewProps } from "../../../apps/web/components/ingest/IngestSheet";
// react is only installed under apps/web (not the repo root), so import it from there.
import { createElement, type ReactElement } from "../../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";

// Other test files mock the provider too (bun's mock.module is process-global); keep every
// other export real and answer in English, as tests/unit/coach_message.test.tsx does.
const realLocale = await import("../../../apps/web/components/providers/LocaleProvider");
mock.module("../../../apps/web/components/providers/LocaleProvider", () => ({
  ...realLocale,
  useLocale: () => ({ lang: "en", dir: "ltr", setLang: () => {}, t: (key: string) => key }),
}));

const { ingestCopy } = await import("../../../apps/web/components/ingest/copy");
const { IngestButton } = await import("../../../apps/web/components/ingest/IngestButton");
const { IngestDone, IngestSheetView, studyHref } = await import(
  "../../../apps/web/components/ingest/IngestSheet"
);

function inLocale(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function sheet(props: Partial<IngestSheetViewProps> = {}): string {
  return inLocale(
    createElement(IngestSheetView, {
      id: "ig",
      onClose: () => {},
      onSave: async () => "n1",
      online: true,
      photoSupported: false,
      ...props,
    })
  );
}

const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe("IngestSheet", () => {
  test("a v3 MobileSheet dialog with a title, Close, and three sources in a segmented control", () => {
    const html = sheet();
    expect(html).toContain('class="tp-sheet tp-glass"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="ig-title"');
    expect(html).toMatch(/<h2 class="tp-sheet__title" id="ig-title">Bring in text<\/h2>/);
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain('role="radiogroup" aria-label="Where the text comes from"');
    expect(count(html, /role="radio"/g)).toBe(3);
    expect(html).toMatch(/aria-checked="true"[^>]*><span>File<\/span>/);
    expect(html).toContain("<span>Paste</span>");
    expect(html).toContain("<span>Photo</span>");
  });

  test("exactly one primary button: Save as a page", () => {
    const html = sheet();
    expect(count(html, /tp-btn--primary/g)).toBe(1);
    expect(html).toMatch(
      /class="tp-btn tp-btn--primary" type="submit" form="ig-form"[^>]*>.*<span>Save as a page<\/span>/
    );
  });

  test("File: the accepted types, a label and help, and nothing uploaded", () => {
    const html = sheet();
    expect(html).toContain('<label class="tp-label" for="ig-file">Choose a file</label>');
    expect(html).toContain('type="file"');
    expect(html).toContain(
      'accept=".txt,.md,.markdown,.csv,.html,.htm,text/plain,text/markdown,text/csv,text/html"'
    );
    expect(html).toContain("Up to 200 KB of text.");
    expect(html).not.toContain("<textarea");
  });

  test("Paste: a textarea with dir=auto and a character count in .tp-num", () => {
    const html = sheet({ initialTab: "paste", initialText: "Mitosis\nCells split in two." });
    expect(html).toMatch(/<textarea class="tp-textarea" id="ig-text" dir="auto"/);
    expect(html).toContain('aria-describedby="ig-text-help ig-count"');
    expect(html).toContain('<span class="tp-num">27</span> characters');
    // The title is prefilled from the first line.
    expect(html).toMatch(/id="ig-page-title"[^>]*dir="auto"[^>]*value="Mitosis"/);
  });

  test("Paste: the count is read with the field, not announced on every key press", () => {
    const html = sheet({ initialTab: "paste", initialText: "Mitosis\nCells split in two." });
    expect(html).toContain('aria-describedby="ig-text-help ig-count"');
    expect(html).toContain('<p class="tp-help" id="ig-count"><span class="tp-num">27</span>');
    expect(count(html, /aria-live/g)).toBe(0);
  });

  test("Paste: more than 200 KB says so in words and Save waits", () => {
    const html = sheet({ initialTab: "paste", initialText: "a".repeat(204801) });
    expect(html).toContain("That&#x27;s more than 200 KB of text.");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/tp-btn--primary" type="submit" form="ig-form" disabled=""/);
  });

  test("the character count doesn't walk the whole text on each render", () => {
    const big = "a".repeat(300_000);
    const realFrom = Array.from;
    let walked = 0;
    Array.from = ((items: unknown, ...rest: unknown[]) => {
      if (typeof items === "string" && items.length >= big.length) walked += 1;
      return (realFrom as (...args: unknown[]) => unknown[])(items, ...rest);
    }) as typeof Array.from;
    try {
      const html = sheet({ initialTab: "paste", initialText: big });
      expect(html).toContain('<span class="tp-num">300,000</span> characters');
    } finally {
      Array.from = realFrom;
    }
    expect(walked).toBe(0);
  });

  test("Photo without a text detector: says so plainly and offers Paste", () => {
    const html = sheet({ initialTab: "photo" });
    expect(html).toContain("Reading photos isn&#x27;t available in this browser yet.");
    expect(html).toContain("<span>Paste text instead</span>");
    expect(html).not.toContain('accept="image/*"');
  });

  test("Photo with a text detector: a camera input that stays on the device", () => {
    const html = sheet({ initialTab: "photo", photoSupported: true });
    expect(html).toContain('accept="image/*" capture="environment"');
    expect(html).toContain("never uploaded or saved");
  });

  test("Photo: the size limit is said in words up front", () => {
    const html = sheet({ initialTab: "photo", photoSupported: true });
    expect(html).toContain("Photos up to 15 MB.");
    const t = ingestCopy("en");
    expect(t("ig.photo.tooLarge")).toContain("larger than 15 MB");
    expect(ingestCopy("he")("ig.photo.tooLarge")).toContain("15 MB");
  });

  test("offline: a notice with an icon and words, and the text stays", () => {
    const html = sheet({ online: false, initialTab: "paste", initialText: "Notes" });
    expect(html).toContain('data-component="StateOffline"');
    expect(html).toContain(
      "You&#x27;re offline. Your text stays here, and saving waits until you&#x27;re back."
    );
    expect(html).toContain(">Notes</textarea>");
  });
});

describe("after saving", () => {
  const t = ingestCopy("en");

  test("Open the page is the one primary action, and three study links point at /study/new", () => {
    const html = inLocale(createElement(IngestDone, { noteId: "abc123", t }));
    // The primary link opens the page. Attribute order depends on which next/link renders it.
    const primary = html.match(/<a [^>]*tp-btn--primary[^>]*>.*?<\/a>/)?.[0] ?? "";
    expect(primary).toContain('href="/notes/abc123"');
    expect(primary).toContain("Open the page");
    expect(count(html, /tp-btn--primary/g)).toBe(1);
    expect(html).toContain('href="/study/new?from=abc123&amp;kind=flashcards"');
    expect(html).toContain('href="/study/new?from=abc123&amp;kind=quiz"');
    expect(html).toContain('href="/study/new?from=abc123&amp;kind=test"');
    expect(html).toContain("Turn into flashcards");
    expect(html).toContain("Turn into a quiz");
    expect(html).toContain("Turn into a practice test");
  });

  test("studyHref encodes the id", () => {
    expect(studyHref("a b", "quiz")).toBe("/study/new?from=a%20b&kind=quiz");
  });
});

describe("IngestButton", () => {
  test("a secondary button that opens a dialog; the sheet is not mounted until then", () => {
    const html = inLocale(createElement(IngestButton, {}));
    expect(html).toContain('class="tp-btn tp-btn--secondary"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("<span>Bring in text</span>");
    expect(html).not.toContain("tp-sheet");
  });
});
