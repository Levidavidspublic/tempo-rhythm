/**
 * TEMPO-B07-38: closing the Ctrl K palette (Esc, a click outside, its close button) puts focus
 * back where it was, or on #main when that control is gone. No browser here: pickReturnFocus is
 * checked with stand-in elements, and the shared palette body is rendered to markup to show the
 * list itself did not change. The dialog mounts in a Radix portal, which only renders in a
 * browser, so the open-then-close wiring is checked by hand (see the ticket report).
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "next/navigation": { ...(await import("next/navigation")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
  "@/components/providers/ThemeProvider": { ...(await import("@/components/providers/ThemeProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useQuery: () => undefined,
  useMutation: () => async () => null,
}));

mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {} }),
}));

const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));
mock.module("@/components/providers/ThemeProvider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ resolvedTheme: "light", setTheme() {}, dyslexia: false, setDyslexia() {} }),
}));

const { DEFAULT_JUMP_SLUGS, SCREEN_LABEL } = await import("@/lib/command-palette");
const { CommandPanel, pickReturnFocus } = await import("./CommandPalette");

/** A stand-in for a DOM element: just what pickReturnFocus reads. */
type Stub = { tagName: string; isConnected: boolean; ownerDocument: StubDoc; focus?: () => void };
type StubDoc = { body: Stub | null; documentElement: Stub | null };

const doc: StubDoc = { body: null, documentElement: null };
function stub(tag: string, { connected = true, focusable = true } = {}): Element {
  const node: Stub = { tagName: tag.toUpperCase(), isConnected: connected, ownerDocument: doc };
  if (focusable) node.focus = () => {};
  return node as unknown as Element;
}
doc.body = stub("body") as unknown as Stub;
doc.documentElement = stub("html") as unknown as Stub;
const main = stub("main") as HTMLElement;

describe("pickReturnFocus", () => {
  test("a button still in the page gets focus back", () => {
    const button = stub("button");
    expect(pickReturnFocus(button, main)).toBe(button as HTMLElement);
  });

  test("a text field still in the page gets focus back", () => {
    const field = stub("input");
    expect(pickReturnFocus(field, main)).toBe(field as HTMLElement);
  });

  test("a control that left the page sends focus to the main content", () => {
    expect(pickReturnFocus(stub("button", { connected: false }), main)).toBe(main);
  });

  test("nothing focused before (null) sends focus to the main content", () => {
    expect(pickReturnFocus(null, main)).toBe(main);
  });

  test("<body> or <html> focused before sends focus to the main content", () => {
    expect(pickReturnFocus(doc.body as unknown as Element, main)).toBe(main);
    expect(pickReturnFocus(doc.documentElement as unknown as Element, main)).toBe(main);
  });

  test("an element that cannot take focus sends focus to the main content", () => {
    expect(pickReturnFocus(stub("div", { focusable: false }), main)).toBe(main);
  });

  test("with no #main on the page there is no target, so focus is left alone", () => {
    expect(pickReturnFocus(stub("button", { connected: false }), null)).toBeNull();
    expect(pickReturnFocus(null, null)).toBeNull();
  });
});

describe("the palette body (render check)", () => {
  const html = renderToStaticMarkup(createElement(CommandPanel));
  const en = (key: Parameters<typeof translate>[1]) => translate("en", key);
  const names = [...html.matchAll(/<span class="tp-slash-item__name"[^>]*>([^<]*)/g)].map((m) => m[1]);

  test("renders the combobox over the listbox", () => {
    expect(html).toContain('data-component="CommandPalette"');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('role="listbox"');
  });

  test("lists the same screens and actions as before, in the same order", () => {
    const screens = DEFAULT_JUMP_SLUGS.map((slug) => {
      const label = SCREEN_LABEL[slug];
      return label ? en(label) : slug;
    });
    const actions = [en("cmd.a.new"), en("cmd.a.task"), en("cmd.a.dump"), en("cmd.a.theme"), en("cmd.a.font"), en("cmd.all")];
    expect(names).toEqual([...screens, ...actions]);
    expect(html.match(/role="option"/g)?.length).toBe(DEFAULT_JUMP_SLUGS.length + actions.length);
  });
});
