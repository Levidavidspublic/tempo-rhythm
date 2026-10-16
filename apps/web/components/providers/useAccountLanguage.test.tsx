/**
 * useAccountLanguage: a browser with no language of its own takes the account's, and dated pages
 * (usePeriodPage) are made only once that language is known. bun:test + react-dom with a bare
 * fake DOM; the probes render nothing. The Convex hooks are faked, LocaleProvider is the real one.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { act, createElement, type ReactNode, useSyncExternalStore } from "react";
import type { Root } from "react-dom/client";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";

/* ---------- Fake Convex: auth, queries and the page mutation ---------- */

type Server = {
  auth: "loading" | "in" | "out";
  profile: { _id: string } | null | undefined;
  preferences: { locale: Lang } | undefined;
  page: { _id: string } | null | undefined;
  template: { body: string } | null | undefined;
};
let server: Server;
const listeners = new Set<() => void>();
let version = 0;
function serve(patch: Partial<Server>) {
  server = { ...server, ...patch };
  version += 1;
  for (const listener of listeners) listener();
}
function useServer(): Server {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return server;
}
const ensured: { title: string; pageType: string; date: string }[] = [];

/* ---------- Fake browser: storage, URL, document ---------- */

const saved = new Map<string, string>();
let storageThrows = false;
const fakeStorage = {
  getItem(key: string) {
    if (storageThrows) throw new Error("storage blocked");
    return saved.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    if (storageThrows) throw new Error("storage blocked");
    saved.set(key, value);
  },
  removeItem(key: string) {
    saved.delete(key);
  },
};
const fakeDocument = {
  documentElement: { lang: "en", dir: "ltr" },
  activeElement: null,
  addEventListener() {},
  removeEventListener() {},
};
const fakeLocation = { search: "" };

const g = globalThis as Record<string, unknown>;
const GLOBALS = ["window", "document", "localStorage", "location", "HTMLIFrameElement", "IS_REACT_ACT_ENVIRONMENT"];
let previousGlobals = new Map<string, PropertyDescriptor | undefined>();
function installGlobals() {
  for (const [key, value] of Object.entries({
    window: g,
    document: fakeDocument,
    localStorage: fakeStorage,
    location: fakeLocation,
    HTMLIFrameElement: class HTMLIFrameElement {},
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(g, key, { configurable: true, writable: true, value });
  }
  (fakeDocument as Record<string, unknown>).defaultView = g;
}

/* ---------- Module mocks ---------- */

// bun's mock.module is process-wide, and other test files mock the same modules. Ours go in
// before the imports below (so they link), again before this file's tests, and what was
// registered before them is put back afterwards, as tests/unit/releaseOnboardingGate does.
const convexReact = "convex/react";
const localeProvider = "@/components/providers/LocaleProvider";
// The real provider, even when another file mocked it: a fresh instance, registered under the
// path every importer resolves to, so the hook and the provider share one context.
// (A plain string: the type checker does not resolve the query suffix.)
const freshLocaleProvider: string = "./LocaleProvider?account-language";
const realLocale: Record<string, unknown> = await import(freshLocaleProvider);
let previousModules: Record<string, Record<string, unknown>> = {};

function installModuleMocks() {
  mock.module(convexReact, () => ({
    useConvexAuth: () => {
      const s = useServer();
      return { isLoading: s.auth === "loading", isAuthenticated: s.auth === "in" };
    },
    useQuery: (ref: unknown, args: unknown) => {
      const s = useServer();
      if (args === "skip") return undefined;
      const name = getFunctionName(ref as never);
      if (name === "users:getProfile") return s.profile;
      if (name === "preferences:get") return s.preferences;
      if (name === "notes:getPeriodPage") return s.page;
      if (name === "templates:get") return s.template;
      throw new Error(`Unexpected query ${name}`);
    },
    useMutation: () => async (args: { title: string; pageType: string; date: string }) => {
      ensured.push({ title: args.title, pageType: args.pageType, date: args.date });
      return "note1";
    },
  }));
  mock.module(localeProvider, () => realLocale);
}

installGlobals();
installModuleMocks();

const { LocaleProvider, useLocale } = await import("@/components/providers/LocaleProvider");
const { useAccountLanguage } = await import("./useAccountLanguage");
const { usePeriodPage } = await import("@/components/today/usePeriodPage");
const { createRoot } = await import("react-dom/client");

beforeAll(async () => {
  previousGlobals = new Map(GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(g, key)]));
  previousModules = {};
  for (const key of [convexReact, localeProvider]) previousModules[key] = { ...(await import(key)) };
  installGlobals();
  installModuleMocks();
});

afterAll(() => {
  for (const key of [convexReact, localeProvider]) mock.module(key, () => previousModules[key]);
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(g, key, descriptor);
    else delete g[key];
  }
});

/* ---------- Rendering ---------- */

type Seen = { lang: Lang; settled: boolean };
let seen: Seen[] = [];
let switchLanguage: ((next: Lang) => void) | null = null;

function LanguageProbe() {
  const { lang, setLang } = useLocale();
  const { settled } = useAccountLanguage();
  switchLanguage = setLang;
  seen.push({ lang, settled });
  return null;
}

function PageProbe() {
  usePeriodPage("weekly", "2026-10-12");
  return null;
}

let root: Root | null = null;

async function mount(children: ReactNode) {
  const container = {
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    namespaceURI: "http://www.w3.org/1999/xhtml",
    ownerDocument: fakeDocument,
    childNodes: [],
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    removeChild() {},
  };
  root = createRoot(container as never);
  await act(async () => {
    root?.render(createElement(LocaleProvider, null, children));
  });
}

async function rerender(children: ReactNode) {
  await act(async () => {
    root?.render(createElement(LocaleProvider, null, children));
  });
}

async function step(patch: Partial<Server>) {
  await act(async () => serve(patch));
}

/** Signs in and loads the users row; the account's preferences are still on their way. */
async function signIn() {
  await step({ auth: "in" });
  await step({ profile: { _id: "user1" } });
}

const last = () => seen[seen.length - 1];

beforeEach(() => {
  server = { auth: "loading", profile: undefined, preferences: undefined, page: undefined, template: undefined };
  saved.clear();
  storageThrows = false;
  fakeLocation.search = "";
  fakeDocument.documentElement.lang = "en";
  fakeDocument.documentElement.dir = "ltr";
  ensured.length = 0;
  seen = [];
  switchLanguage = null;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe("useAccountLanguage", () => {
  test("a language saved on this device wins over the account's", async () => {
    saved.set(LANG_STORAGE_KEY, "en");
    await mount(createElement(LanguageProbe));
    expect(last()).toEqual({ lang: "en", settled: true });
    await signIn();
    await step({ preferences: { locale: "he" } });
    expect(last()).toEqual({ lang: "en", settled: true });
    expect(saved.get(LANG_STORAGE_KEY)).toBe("en");
    expect(fakeDocument.documentElement.lang).toBe("en");
  });

  test("nothing saved: the account's Hebrew is applied and saved, and only then settled", async () => {
    await mount(createElement(LanguageProbe));
    await signIn();
    expect(last()).toEqual({ lang: "en", settled: false });
    await step({ preferences: { locale: "he" } });
    expect(last()).toEqual({ lang: "he", settled: true });
    expect(seen.filter((s) => s.settled).every((s) => s.lang === "he")).toBe(true);
    expect(saved.get(LANG_STORAGE_KEY)).toBe("he");
    expect(fakeDocument.documentElement.dir).toBe("rtl");
  });

  test("nothing saved and the account is English: settled, nothing changed or saved", async () => {
    await mount(createElement(LanguageProbe));
    await signIn();
    await step({ preferences: { locale: "en" } });
    expect(last()).toEqual({ lang: "en", settled: true });
    expect(saved.has(LANG_STORAGE_KEY)).toBe(false);
  });

  test("signed out: waits while auth loads, then settles with no change", async () => {
    await mount(createElement(LanguageProbe));
    expect(last()).toEqual({ lang: "en", settled: false });
    await step({ auth: "out" });
    expect(last()).toEqual({ lang: "en", settled: true });
    expect(saved.has(LANG_STORAGE_KEY)).toBe(false);
  });

  test("storage that throws counts as nothing saved: Hebrew is applied in memory", async () => {
    storageThrows = true;
    await mount(createElement(LanguageProbe));
    await signIn();
    expect(last()).toEqual({ lang: "en", settled: false });
    await step({ preferences: { locale: "he" } });
    expect(last()).toEqual({ lang: "he", settled: true });
    expect(saved.size).toBe(0);
  });

  test("with storage blocked, a later screen does not undo a switch made after the account's language", async () => {
    storageThrows = true;
    await mount(createElement(LanguageProbe));
    await signIn();
    await step({ preferences: { locale: "he" } });
    await act(async () => switchLanguage?.("en"));
    // A second screen mounts (as Today does) with the same account answer already loaded.
    await rerender([createElement(LanguageProbe, { key: "a" }), createElement(LanguageProbe, { key: "b" })]);
    expect(last()).toEqual({ lang: "en", settled: true });
  });

  test("?lang chose this load's language: the account's is not applied", async () => {
    fakeLocation.search = "?lang=en";
    await mount(createElement(LanguageProbe));
    await signIn();
    await step({ preferences: { locale: "he" } });
    expect(last()).toEqual({ lang: "en", settled: true });
    expect(saved.has(LANG_STORAGE_KEY)).toBe(false);
  });
});

describe("usePeriodPage waits for the language", () => {
  test("nothing saved, Hebrew account: no page while the language is unknown, then one titled in Hebrew", async () => {
    await mount(createElement(PageProbe));
    await signIn();
    await step({ page: null });
    await step({ template: { body: "# This week\n\n{{range}}\n" } });
    expect(ensured).toEqual([]);
    await step({ preferences: { locale: "he" } });
    expect(ensured.map((e) => e.title)).toEqual(["שבוע 42"]);
    expect(ensured[0]).toMatchObject({ pageType: "weekly", date: "2026-10-12" });
  });

  test("English account: one page titled in English", async () => {
    await mount(createElement(PageProbe));
    await signIn();
    await step({ page: null });
    await step({ template: { body: "" } });
    await step({ preferences: { locale: "en" } });
    expect(ensured.map((e) => e.title)).toEqual(["Week 42"]);
  });

  test("a saved Hebrew device makes the page in Hebrew without waiting for the account", async () => {
    saved.set(LANG_STORAGE_KEY, "he");
    await mount(createElement(PageProbe));
    await signIn();
    await step({ page: null });
    await step({ template: { body: "" } });
    expect(ensured.map((e) => e.title)).toEqual(["שבוע 42"]);
  });
});
