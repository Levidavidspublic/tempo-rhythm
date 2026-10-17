/**
 * useToastRoom mounted with React in the small TestNode DOM (tests/unit/record/testDom; there is
 * no Testing Library here). study_toast_room.test.ts covers the pure `toastRoom()` and the CSS;
 * this covers the hook's wiring: the mark on <html> and the measured room while a toast is open,
 * shared between screens, and measured again when the toast, the window or the region changes.
 *
 * The few browser pieces the hook reads are faithful stand-ins kept in this file: <html>'s
 * attributes and style properties, the `.tp-toast-region` elements with their `.tp-toast` and
 * height, `getComputedStyle(region).bottom`, the window's resize listeners and ResizeObserver.
 * Every global is put back after this file.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { TOAST_ROOM_ATTR, TOAST_ROOM_VAR, useToastRoom } from "../../../apps/web/components/study/useToastRoom";
import { installTestDom, type TestNode, useTestDom } from "../record/testDom";

/** One `.tp-toast-region` as the hook sees it: its toast (or none), height and computed bottom. */
type Region = { offsetHeight: number; bottom: string; hasToast: boolean };

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
  "ResizeObserver",
  "addEventListener",
  "removeEventListener",
] as const;
const saved = new Map<string, PropertyDescriptor | undefined>();

let documentNode: TestNode;
let regions: Region[] = [];
/** <html>'s style properties, as `style.setProperty/removeProperty/getPropertyValue` keep them. */
let htmlStyle = new Map<string, string>();
/** The window's listeners, by event type. */
let windowListeners = new Map<string, Set<() => void>>();
/** Every ResizeObserver made, with what it watches and whether it was disconnected. */
let observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
  targets: unknown[] = [];
  disconnected = false;
  constructor(public callback: () => void) {
    observers.push(this);
  }
  observe(target: unknown) {
    this.targets.push(target);
  }
  unobserve(target: unknown) {
    this.targets = this.targets.filter((t) => t !== target);
  }
  disconnect() {
    this.disconnected = true;
    this.targets = [];
  }
}

function regionNode(region: Region) {
  return {
    get offsetHeight() {
      return region.offsetHeight;
    },
    querySelector: (selector: string) => (selector === ".tp-toast" && region.hasToast ? {} : null),
    region,
  };
}

function installStandIns() {
  useTestDom(documentNode);
  const html = documentNode.documentElement as TestNode;
  html.style = {
    setProperty: (name: string, value: string) => void htmlStyle.set(name, String(value)),
    removeProperty: (name: string) => {
      const before = htmlStyle.get(name) ?? "";
      htmlStyle.delete(name);
      return before;
    },
    getPropertyValue: (name: string) => htmlStyle.get(name) ?? "",
  } as unknown as TestNode["style"];
  (documentNode as unknown as { querySelectorAll: (s: string) => unknown[] }).querySelectorAll = (selector: string) =>
    selector === ".tp-toast-region" ? regions.map(regionNode) : [];
  const globals = globalThis as Record<string, unknown>;
  globals.getComputedStyle = (node: { region?: Region }) => ({
    bottom: node.region?.bottom ?? "",
    getPropertyValue: (name: string) => (name === "bottom" ? (node.region?.bottom ?? "") : ""),
  });
  globals.addEventListener = (type: string, fn: () => void) => {
    let bucket = windowListeners.get(type);
    if (!bucket) {
      bucket = new Set();
      windowListeners.set(type, bucket);
    }
    bucket.add(fn);
  };
  globals.removeEventListener = (type: string, fn: () => void) => {
    windowListeners.get(type)?.delete(fn);
  };
  globals.ResizeObserver = FakeResizeObserver;
}

beforeAll(() => {
  for (const key of GLOBALS) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  documentNode = installTestDom();
});

afterAll(() => {
  for (const key of GLOBALS) {
    const descriptor = saved.get(key);
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete (globalThis as Record<string, unknown>)[key];
  }
});

const html = () => documentNode.documentElement as TestNode;
const marked = () => html().hasAttribute(TOAST_ROOM_ATTR);
const room = () => (html().style as unknown as CSSStyleDeclaration).getPropertyValue(TOAST_ROOM_VAR);

/** A screen with a toast slot: `open` is its toast's state, null when none is open. */
function Screen({ open }: { open: unknown }) {
  useToastRoom(open);
  return null;
}

let root: Root | null = null;

async function render(...opens: unknown[]) {
  if (!root) {
    const host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  }
  await act(async () => {
    root?.render(
      createElement(
        "div",
        null,
        opens.map((open, index) => createElement(Screen, { key: index, open })),
      ),
    );
  });
}

function fireResize() {
  for (const fn of [...(windowListeners.get("resize") ?? [])]) fn();
}

beforeEach(() => {
  regions = [{ offsetHeight: 63.2, bottom: "24px", hasToast: true }];
  htmlStyle = new Map();
  windowListeners = new Map();
  observers = [];
  installStandIns();
});

afterEach(async () => {
  // Every screen closes, so the hook's count of open toasts starts at 0 in the next test.
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("useToastRoom, mounted", () => {
  test("nothing is marked while no toast is open", async () => {
    await render(null);
    expect(marked()).toBe(false);
    expect(room()).toBe("");
  });

  test("open: <html> is marked and the room is the toast's height plus its bottom, rounded up", async () => {
    await render({ title: "Card deleted" });
    expect(marked()).toBe(true);
    expect(room()).toBe("88px");
  });

  test("a region with no toast in it takes no room", async () => {
    regions = [
      { offsetHeight: 300, bottom: "24px", hasToast: false },
      { offsetHeight: 56, bottom: "84px", hasToast: true },
    ];
    await render({ title: "Card deleted" });
    expect(room()).toBe("140px");
  });

  test("close: the mark and the room both go", async () => {
    await render({ title: "Card deleted" });
    await render(null);
    expect(marked()).toBe(false);
    expect(room()).toBe("");
    expect(windowListeners.get("resize")?.size ?? 0).toBe(0);
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  test("two screens open, one closes: the mark stays and is measured again; the second close removes it", async () => {
    // The same state objects across renders, as a screen's toast state is until it changes.
    const hubToast = { title: "Set deleted" };
    const setToast = { title: "Card deleted" };
    await render(hubToast, setToast);
    expect(marked()).toBe(true);
    expect(room()).toBe("88px");

    // The hub's toast goes and the set view's, a shorter one, is the one left.
    regions = [{ offsetHeight: 40, bottom: "24px", hasToast: true }];
    await render(null, setToast);
    expect(marked()).toBe(true);
    expect(room()).toBe("64px");

    await render(null, null);
    expect(marked()).toBe(false);
    expect(room()).toBe("");
  });

  test("a new toast in the same slot (Undo giving way to Bring it back) is measured again", async () => {
    await render({ title: "Taken back", action: "undo" });
    expect(room()).toBe("88px");
    // Bring it back's words wrap onto more lines.
    regions = [{ offsetHeight: 120, bottom: "24px", hasToast: true }];
    await render({ title: "Taken back", action: "bringBack" });
    expect(marked()).toBe(true);
    expect(room()).toBe("144px");
  });

  test("a window resize measures again", async () => {
    await render({ title: "Card deleted" });
    // A phone turned sideways: the toast sits above the tab bar and its words wrap.
    regions = [{ offsetHeight: 204, bottom: "84px", hasToast: true }];
    fireResize();
    expect(room()).toBe("288px");
  });

  test("the region changing size (ResizeObserver) measures again", async () => {
    await render({ title: "Card deleted" });
    expect(observers.at(-1)?.targets).toHaveLength(1);
    regions[0] = { offsetHeight: 100, bottom: "24px", hasToast: true };
    observers.at(-1)?.callback();
    expect(room()).toBe("124px");
  });

  test("with no ResizeObserver in the browser it still marks, measures on resize and clears", async () => {
    delete (globalThis as Record<string, unknown>).ResizeObserver;
    await render({ title: "Card deleted" });
    expect(marked()).toBe(true);
    expect(room()).toBe("88px");
    regions = [{ offsetHeight: 100, bottom: "24px", hasToast: true }];
    fireResize();
    expect(room()).toBe("124px");
    await render(null);
    expect(marked()).toBe(false);
    expect(room()).toBe("");
  });
});
