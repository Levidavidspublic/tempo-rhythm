/**
 * The live Telegram row (Settings > Reminders, S14) mounted in the small TestNode DOM
 * (tests/unit/record/testDom; there is no Testing Library here). telegram_row.test.tsx covers each
 * state's markup; this covers the wiring the static renders can't: where focus goes when the live
 * query flips Waiting to Connected and after Undo, and the waiting state ending at the code's
 * `expiresAt`.
 *
 * The row's Convex calls (settings-reminders/telegramApi) and the locale are faithful stand-ins,
 * put back after this file. The Undo
 * toast is the real one. Every global is put back after this file. All data is fictional.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import { findAll, installTestDom, type TestNode, useTestDom } from "../record/testDom";

const webDir = `${process.cwd()}/apps/web`;
const telegramApi = Bun.resolveSync("./components/settings-reminders/telegramApi", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const MOCKED = [telegramApi, localeProvider];

const GLOBALS = [
  "window",
  "document",
  "HTMLElement",
  "Element",
  "Node",
  "HTMLIFrameElement",
  "navigator",
  "location",
  "getComputedStyle",
  "MutationObserver",
  "IS_REACT_ACT_ENVIRONMENT",
  "open",
] as const;
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
let previous: Record<string, Record<string, unknown>> = {};

const URL_SAMPLE = "https://t.me/TempoSampleBot?start=MOCKEDcodeMOCKEDcodeMOCKEDcode00";
const NAG = {
  _id: "nags:1",
  label: "Plants",
  enabled: true,
  phrases: [{ id: "p1", text: "Water the plants", status: "accepted" as const }],
};

/** What `nags.list` answers right now (undefined while loading). */
let nags: unknown;
/** How long the next link code lives, from the moment Connect is pressed. */
let codeLifeMs = 10 * 60_000;
const calls = {
  startLink: async () => ({ ok: true, url: URL_SAMPLE, expiresAt: Date.now() + codeLifeMs }),
  unlink: async () => ({ ok: true, linkId: "reminderChannelLinks:1", undoUntil: Date.now() + 300_000 }),
  undoUnlink: async () => ({ ok: true }),
  sendTest: async () => ({ ok: true }),
};

function installModuleMocks() {
  // The same shape as the real hook: the nags only once connected, and the four writes.
  mock.module(telegramApi, () => ({
    ...previous[telegramApi],
    useTelegramApi: (connected: boolean) => ({ nags: connected ? nags : undefined, ...calls }),
  }));
  mock.module(localeProvider, () => ({
    ...previous[localeProvider],
    useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
  }));
}

for (const key of MOCKED) previous[key] = { ...(await import(key)) };
installModuleMocks();
// The query suffix gives this file its own instance of the row.
const { TelegramChannel } = await import(
  "../../../apps/web/components/settings-reminders/TelegramChannel?telegram-focus-test"
);

let documentNode: TestNode;
let root: Root | null = null;
let host: TestNode | null = null;

beforeAll(() => {
  for (const key of GLOBALS) savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  documentNode = installTestDom();
  // The phrase picker is a <select>: React sets its value through `options`, which TestNode lacks.
  const make = documentNode.createElement.bind(documentNode);
  documentNode.createElement = (tag: string) => {
    const node = make(tag);
    if (node.tagName === "SELECT") {
      Object.defineProperty(node, "options", {
        get: () => node.childNodes.filter((child) => child.tagName === "OPTION"),
      });
    }
    return node;
  };
});
beforeEach(() => {
  installModuleMocks();
  useTestDom(documentNode);
  // A popup blocker's answer: no tab, so the row keeps only its own link.
  (globalThis as Record<string, unknown>).open = () => null;
  nags = undefined;
  codeLifeMs = 10 * 60_000;
});
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});
afterAll(() => {
  for (const key of MOCKED) mock.module(key, () => previous[key]);
  for (const key of GLOBALS) {
    const descriptor = savedGlobals.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete (globalThis as Record<string, unknown>)[key];
  }
});

/**
 * Focus in the TestNode DOM: `focus()` records the node, and `document.activeElement` falls back
 * to the body once that node leaves the document, as browsers do.
 */
function trackFocus() {
  const proto = Object.getPrototypeOf(documentNode) as { focus: (this: TestNode) => void };
  const plainFocus = proto.focus;
  let focused: TestNode | null = null;
  proto.focus = function (this: TestNode) {
    focused = this;
  };
  Object.defineProperty(documentNode, "activeElement", {
    configurable: true,
    get: () => (focused && documentNode.contains(focused) ? focused : documentNode.body),
  });
  return {
    get active() {
      return documentNode.activeElement;
    },
    restore() {
      proto.focus = plainFocus;
      Object.defineProperty(documentNode, "activeElement", { configurable: true, writable: true, value: documentNode.body });
    },
  };
}

const channel = (connected: boolean) => ({ id: "telegram", label: "Telegram", available: true, connected });

async function show(connected: boolean) {
  useTestDom(documentNode);
  if (!host) {
    host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  }
  await act(async () => {
    root?.render(createElement(TelegramChannel, { channel: channel(connected) }));
  });
  return host as TestNode;
}

/** The control whose text is `text` (a button or a link). */
const control = (view: TestNode, text: string) =>
  findAll(view, (n) => (n.tagName === "BUTTON" || n.tagName === "A") && n.textContent === text)[0] ?? null;
const named = (node: TestNode | null | undefined) => (node ? `${node.tagName} ${node.textContent}` : "none");

async function press(node: TestNode | null) {
  if (!node) throw new Error("no such control");
  node.focus();
  await act(async () => {
    node.click();
  });
}

const status = (view: TestNode) =>
  findAll(view, (n) => n.tagName === "OUTPUT" && n.getAttribute("aria-live") === "polite")[0]?.textContent ?? "";

describe("focus when the live query flips Waiting to Connected", () => {
  test("focus on Connect moves to Send a test once the phrases load", async () => {
    const focus = trackFocus();
    try {
      let view = await show(false);
      await press(control(view, "Connect Telegram"));
      expect(control(view, "Open Telegram again")).not.toBeNull();
      // Telegram linked: the row flips, the Connect button goes, the phrases are still loading.
      view = await show(true);
      expect(control(view, "Connect Telegram")).toBeNull();
      nags = [NAG];
      view = await show(true);
      expect(named(focus.active)).toBe("BUTTON Send a test");
      expect(status(view)).toBe("Telegram is connected.");
    } finally {
      focus.restore();
    }
  });

  test("focus on Open Telegram again moves to Disconnect when there's no phrase to send", async () => {
    const focus = trackFocus();
    try {
      let view = await show(false);
      await press(control(view, "Connect Telegram"));
      control(view, "Open Telegram again")?.focus();
      view = await show(true);
      nags = [];
      view = await show(true);
      expect(named(focus.active)).toBe("BUTTON Disconnect");
    } finally {
      focus.restore();
    }
  });

  test("focus somewhere else stays where it is", async () => {
    const focus = trackFocus();
    try {
      let view = await show(false);
      await press(control(view, "Connect Telegram"));
      const elsewhere = documentNode.createElement("button");
      documentNode.body?.appendChild(elsewhere);
      elsewhere.focus();
      view = await show(true);
      nags = [NAG];
      await show(true);
      expect(focus.active === elsewhere).toBe(true);
      documentNode.body?.removeChild(elsewhere);
    } finally {
      focus.restore();
    }
  });
});

describe("focus after Undo", () => {
  test("with no phrase to send, Undo puts focus on Disconnect", async () => {
    const focus = trackFocus();
    nags = [];
    try {
      let view = await show(true);
      await press(control(view, "Disconnect"));
      view = await show(false);
      expect(named(focus.active)).toBe("BUTTON Connect Telegram");
      await press(control(view, "Undo"));
      view = await show(true);
      expect(named(focus.active)).toBe("BUTTON Disconnect");
    } finally {
      focus.restore();
    }
  });

  test("with a phrase to send, Undo still puts focus on Send a test", async () => {
    const focus = trackFocus();
    nags = [NAG];
    try {
      let view = await show(true);
      await press(control(view, "Disconnect"));
      view = await show(false);
      await press(control(view, "Undo"));
      view = await show(true);
      expect(named(focus.active)).toBe("BUTTON Send a test");
    } finally {
      focus.restore();
    }
  });
});

describe("the waiting state ends with the code", () => {
  test("at expiresAt the link to Telegram goes, Connect is offered again and focus moves to it", async () => {
    const focus = trackFocus();
    codeLifeMs = 40;
    try {
      const view = await show(false);
      await press(control(view, "Connect Telegram"));
      control(view, "Open Telegram again")?.focus();
      expect(status(view)).toContain("Waiting for you to press Start");
      await act(async () => {
        await Bun.sleep(80);
      });
      expect(control(view, "Open Telegram again")).toBeNull();
      expect(control(view, "Connect Telegram")).not.toBeNull();
      expect(status(view)).not.toContain("Waiting for you to press Start");
      expect(status(view)).toBe(translate("en", "rem.tg.expired" as MessageKey));
      expect(named(focus.active)).toBe("BUTTON Connect Telegram");
    } finally {
      focus.restore();
    }
  });
});
