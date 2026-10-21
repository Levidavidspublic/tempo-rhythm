/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks
 * (same minimal DOM as components/account/ProfileForm.test.tsx).
 */
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type MessageKey, translate } from "@/lib/i18n";

type Listener = (event: TestEvent) => void;

class TestEvent {
  bubbles = true;
  cancelable = true;
  defaultPrevented = false;
  cancelBubble = false;
  eventPhase = 3;
  timeStamp = Date.now();
  button = 0;
  buttons = 1;
  detail = 1;
  clientX = 0;
  clientY = 0;
  pageX = 0;
  pageY = 0;
  screenX = 0;
  screenY = 0;
  ctrlKey = false;
  shiftKey = false;
  altKey = false;
  metaKey = false;
  view: unknown = globalThis;
  relatedTarget: null = null;
  currentTarget: TestNode | null = null;
  srcElement: TestNode;
  constructor(
    public type: string,
    public target: TestNode
  ) {
    this.srcElement = target;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this.cancelBubble = true;
  }
  persist() {}
  isDefaultPrevented() {
    return this.defaultPrevented;
  }
  getModifierState() {
    return false;
  }
}

class TestNode {
  nodeType = 1;
  childNodes: TestNode[] = [];
  parentNode: TestNode | null = null;
  nextSibling: TestNode | null = null;
  previousSibling: TestNode | null = null;
  firstChild: TestNode | null = null;
  lastChild: TestNode | null = null;
  ownerDocument: TestNode;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  attributes: Record<string, string> = {};
  style = { setProperty() {}, getPropertyValue: () => "" };
  className = "";
  id = "";
  value = "";
  disabled = false;
  readOnly = false;
  href = "";
  type = "";
  nodeValue: string | null = null;
  defaultView: unknown = globalThis;
  activeElement: TestNode | null = null;
  body: TestNode | null = null;
  documentElement: TestNode | null = null;
  private listeners: Record<string, Listener[]> = {};

  constructor(
    public nodeName: string,
    owner: TestNode | null
  ) {
    this.tagName = nodeName;
    this.ownerDocument = owner ?? this;
  }

  tagName: string;

  get options(): TestNode[] {
    return this.childNodes.filter((child) => child.tagName === "OPTION");
  }

  selected = false;
  defaultSelected = false;

  get textContent(): string {
    if (this.nodeType === 3) return this.nodeValue ?? "";
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes = [];
    this.firstChild = null;
    this.lastChild = null;
    if (value) {
      const text = this.ownerDocument.createTextNode(value);
      this.appendChild(text);
    }
  }

  appendChild(child: TestNode) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const prev = this.lastChild;
    if (prev) {
      prev.nextSibling = child;
      child.previousSibling = prev;
    } else {
      this.firstChild = child;
    }
    child.nextSibling = null;
    this.lastChild = child;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child: TestNode, ref: TestNode | null) {
    if (!ref) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child);
    const index = this.childNodes.indexOf(ref);
    if (index < 0) return this.appendChild(child);
    child.parentNode = this;
    this.childNodes.splice(index, 0, child);
    const prev = ref.previousSibling;
    child.previousSibling = prev;
    child.nextSibling = ref;
    ref.previousSibling = child;
    if (prev) prev.nextSibling = child;
    else this.firstChild = child;
    return child;
  }

  removeChild(child: TestNode) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    if (child.previousSibling) child.previousSibling.nextSibling = child.nextSibling;
    if (child.nextSibling) child.nextSibling.previousSibling = child.previousSibling;
    if (this.firstChild === child) this.firstChild = child.nextSibling;
    if (this.lastChild === child) this.lastChild = child.previousSibling;
    child.parentNode = null;
    child.nextSibling = null;
    child.previousSibling = null;
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = String(value);
    if (name === "id") this.id = String(value);
    if (name === "href") this.href = String(value);
    if (name === "disabled") this.disabled = true;
    if (name === "readonly" || name === "readOnly") this.readOnly = true;
    if (name === "value") this.value = String(value);
  }

  getAttribute(name: string) {
    if (name === "href" && this.href) return this.href;
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
    if (name === "disabled") this.disabled = false;
    if (name === "readonly" || name === "readOnly") this.readOnly = false;
  }

  hasAttribute(name: string) {
    return Object.hasOwn(this.attributes, name);
  }

  addEventListener(type: string, fn: Listener, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const key = capture ? `${type}:capture` : type;
    let bucket = this.listeners[key];
    if (!bucket) {
      bucket = [];
      this.listeners[key] = bucket;
    }
    bucket.push(fn);
  }

  removeEventListener(type: string, fn: Listener, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
    const key = capture ? `${type}:capture` : type;
    this.listeners[key] = (this.listeners[key] ?? []).filter((item) => item !== fn);
  }

  dispatchEvent(event: TestEvent) {
    const path: TestNode[] = [];
    let node: TestNode | null = event.target;
    while (node) {
      path.push(node);
      node = node.parentNode;
    }
    for (const current of path) {
      event.currentTarget = current;
      for (const fn of [...(current.listeners[event.type] ?? [])]) fn(event);
      if (event.cancelBubble) break;
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new TestEvent("click", this));
  }

  focus() {}
  blur() {}
  contains(other: TestNode) {
    let node: TestNode | null = other;
    while (node) {
      if (node === this) return true;
      node = node.parentNode;
    }
    return false;
  }
  getRootNode() {
    return this.ownerDocument;
  }
  cloneNode() {
    return new TestNode(this.nodeName, this.ownerDocument);
  }
  compareDocumentPosition() {
    return 0;
  }
  createElement(tag: string) {
    return new TestNode(tag.toUpperCase(), this.ownerDocument);
  }
  createElementNS(_ns: string, tag: string) {
    return this.createElement(tag);
  }
  createTextNode(text: string) {
    const node = new TestNode("#text", this.ownerDocument);
    node.nodeType = 3;
    node.nodeValue = text;
    return node;
  }
  createComment(text: string) {
    const node = new TestNode("#comment", this.ownerDocument);
    node.nodeType = 8;
    node.nodeValue = text;
    return node;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getElementById() {
    return null;
  }
}

class TestElement extends TestNode {}

function installTestDom() {
  const documentNode = new TestNode("#document", null);
  documentNode.nodeType = 9;
  documentNode.ownerDocument = documentNode;
  const documentElement = new TestElement("HTML", documentNode);
  const body = new TestElement("BODY", documentNode);
  documentNode.appendChild(documentElement);
  documentElement.appendChild(body);
  documentNode.documentElement = documentElement;
  documentNode.body = body;
  documentNode.activeElement = body;
  const globals = globalThis as Record<string, unknown>;
  globals.window = globalThis;
  globals.document = documentNode;
  globals.HTMLElement = TestElement;
  globals.Element = TestElement;
  globals.Node = TestNode;
  globals.HTMLIFrameElement = class HTMLIFrameElement extends TestElement {};
  globals.navigator = { userAgent: "bun-test" };
  globals.location = { protocol: "http:", href: "http://localhost/" };
  globals.getComputedStyle = () => ({ getPropertyValue: () => "" });
  globals.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  return documentNode;
}

const documentNode = installTestDom();

type Prefs = {
  theme: "system" | "light" | "dark";
  locale: "en" | "he";
  weekStartsOn: 0 | 1 | 6;
  timeZone: string;
  emailReminders: boolean;
  inAppNotifications: boolean;
};
type Item = { _id: string; title: string; body: string; kind: string; readAt?: number; createdAt: number };

const updatePreferences = mock(async (_args: Partial<Prefs>) => null);
const markRead = mock(async (_args: { notificationId: string }) => null);
const markAllRead = mock(async (_args: Record<string, never>) => ({ updated: 1 }));
const setTheme = mock((_theme: string) => {});
const setDial = mock(async (_args: { dial: number }) => ({ success: true }));
const setLang = mock((_lang: string) => {});
const setDyslexia = mock((_on: boolean) => {});

const prefs: Prefs | undefined = {
  theme: "system",
  locale: "en",
  weekStartsOn: 1,
  timeZone: "UTC",
  emailReminders: true,
  inAppNotifications: true,
};
let items: Item[] | undefined = [];

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "convex/react": { ...(await import("convex/react")) },
  "@/components/providers/ThemeProvider": { ...(await import("@/components/providers/ThemeProvider")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("@/convex/_generated/api", () => ({
  api: {
    preferences: { get: "preferences.get", update: "preferences.update" },
    coach: { getSettings: "coach.getSettings", setDial: "coach.setDial" },
    notifications: {
      list: "notifications.list",
      markRead: "notifications.markRead",
      markAllRead: "notifications.markAllRead",
    },
  },
}));

mock.module("convex/react", () => ({
  useQuery: (ref: string) => {
    if (ref === "preferences.get") return prefs;
    if (ref === "coach.getSettings") return { dial: 4, taskLoad: 1, panicUntil: null, acceptedStreak: 0 };
    return items;
  },
  useMutation: (ref: string) =>
    ({
      "preferences.update": updatePreferences,
      "coach.setDial": setDial,
      "notifications.markRead": markRead,
      "notifications.markAllRead": markAllRead,
    })[ref],
}));

mock.module("@/components/providers/ThemeProvider", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme, dyslexia: false, setDyslexia }),
}));

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang, t: (key: MessageKey) => translate("en", key) }),
}));

const { PreferencesForm } = await import("./PreferencesForm");
const { NotificationsList } = await import("./NotificationsList");

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function findByTag(root: TestNode, tag: string, label?: string): TestNode {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (node.tagName === tag && (label === undefined || node.textContent.includes(label))) {
      found.push(node);
    }
  });
  const match = found[0];
  if (!match) throw new Error(`Missing ${tag}: ${label ?? ""}`);
  return match;
}

function findById(root: TestNode, id: string): TestNode {
  let match: TestNode | null = null;
  walk(root, (node) => {
    if (node.id === id) match = node;
  });
  if (!match) throw new Error(`Missing #${id}`);
  return match;
}

function reactProps(node: TestNode): Record<string, unknown> {
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error(`No react props on ${node.tagName}#${node.id}`);
  return (node as unknown as Record<string, Record<string, unknown>>)[key] ?? {};
}

let root: Root | null = null;
let host: TestNode | null = null;

async function render(element: ReactElement) {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(element);
  });
  return host;
}

async function change(node: TestNode, target: { value?: string; checked?: boolean }) {
  await act(async () => {
    const onChange = reactProps(node).onChange as (event: { target: typeof target }) => void;
    onChange({ target });
  });
}

describe("preferences and notifications", () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null;
    host = null;
    updatePreferences.mockClear();
    markRead.mockClear();
    markAllRead.mockClear();
    setTheme.mockClear();
    setDial.mockClear();
    setLang.mockClear();
    setDyslexia.mockClear();
  });

  test("each stored control calls preferences.update with only its key", async () => {
    const view = await render((<PreferencesForm />) as ReactElement);
    const option = (value: string) => {
      let match: TestNode | null = null;
      walk(view, (node) => {
        if (node.tagName === "BUTTON" && node.getAttribute("data-value") === value) match = node;
      });
      if (!match) throw new Error(`Missing option ${value}`);
      return match as TestNode;
    };
    const press = async (node: TestNode) => {
      await act(async () => {
        node.click();
      });
    };

    await press(option("dark"));
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(updatePreferences).toHaveBeenLastCalledWith({ theme: "dark" });

    await press(option("he"));
    expect(setLang).toHaveBeenCalledWith("he");
    expect(updatePreferences).toHaveBeenLastCalledWith({ locale: "he" });

    await change(findById(view, "pref-week-start"), { value: "0" });
    expect(updatePreferences).toHaveBeenLastCalledWith({ weekStartsOn: 0 });

    await change(findById(view, "pref-time-zone"), { value: "Asia/Jerusalem" });
    expect(updatePreferences).toHaveBeenLastCalledWith({ timeZone: "Asia/Jerusalem" });

    expect(findById(view, "pref-email-reminders").getAttribute("aria-checked")).toBe("true");
    await press(findById(view, "pref-email-reminders"));
    expect(updatePreferences).toHaveBeenLastCalledWith({ emailReminders: false });

    await press(findById(view, "pref-in-app"));
    expect(updatePreferences).toHaveBeenLastCalledWith({ inAppNotifications: false });

    expect(updatePreferences).toHaveBeenCalledTimes(6);
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(view.textContent).not.toContain("{");
  });

  test("the account's language applies when the browser has none of its own; Saturday is always offered", async () => {
    const stored = prefs as Prefs;
    stored.locale = "he";
    try {
      const view = await render((<PreferencesForm />) as ReactElement);
      expect(setLang).toHaveBeenCalledWith("he");
      expect(updatePreferences).not.toHaveBeenCalled();
      const values: string[] = [];
      walk(findById(view, "pref-week-start"), (node) => {
        if (node.tagName === "OPTION") values.push(node.getAttribute("value") ?? "");
      });
      expect(values).toEqual(["0", "1", "6"]);
    } finally {
      stored.locale = "en";
    }
  });

  test("a language stored on this device wins over the account's", async () => {
    const stored = prefs as Prefs;
    const globals = globalThis as Record<string, unknown>;
    stored.locale = "he";
    globals.localStorage = { getItem: () => "en", setItem: () => {}, removeItem: () => {} };
    try {
      await render((<PreferencesForm />) as ReactElement);
      expect(setLang).not.toHaveBeenCalled();
    } finally {
      stored.locale = "en";
      delete globals.localStorage;
    }
  });

  test("device-only controls never touch preferences.update; billing notices stay on", async () => {
    const view = await render((<PreferencesForm />) as ReactElement);
    await act(async () => {
      findByTag(view, "BUTTON", "Off").click();
    });
    expect(setDyslexia).toHaveBeenCalledWith(true);

    const locked: TestNode[] = [];
    walk(view, (node) => {
      if (node.getAttribute("role") === "switch" && node.getAttribute("aria-disabled") === "true") locked.push(node);
    });
    expect(locked).toHaveLength(1);
    expect(locked[0]?.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      locked[0]?.click();
    });
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(view.textContent).toContain("Follows device");
  });

  test("the coach dial saves 400 ms after it stops moving", async () => {
    const view = await render((<PreferencesForm />) as ReactElement);
    expect(findById(view, "dial").value).toBe("4");
    await change(findById(view, "dial"), { value: "8" });
    await change(findById(view, "dial"), { value: "9" });
    expect(view.textContent).toContain("Push");
    expect(setDial).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    expect(setDial).toHaveBeenCalledTimes(1);
    expect(setDial).toHaveBeenCalledWith({ dial: 9 });
  });

  test("Mark all read calls notifications.markAllRead and Mark read targets one item", async () => {
    items = [
      { _id: "n-old", title: "Old", body: "Seen", kind: "system", readAt: 5, createdAt: 1 },
      { _id: "n-new", title: "New", body: "Fresh", kind: "reminder", createdAt: 2 },
    ];
    const view = await render((<NotificationsList />) as ReactElement);
    expect(view.textContent.indexOf("New")).toBeLessThan(view.textContent.indexOf("Old"));

    await act(async () => {
      findByTag(view, "BUTTON", "Mark read").click();
    });
    expect(markRead).toHaveBeenCalledWith({ notificationId: "n-new" });

    await act(async () => {
      findByTag(view, "BUTTON", "Mark all read").click();
    });
    expect(markAllRead).toHaveBeenCalledTimes(1);
    expect(markAllRead).toHaveBeenCalledWith({});
  });

  test("empty state and disabled Mark all read when nothing is unread", async () => {
    items = [];
    const view = await render((<NotificationsList />) as ReactElement);
    expect(view.textContent).toContain("Nothing new");
    expect(findByTag(view, "BUTTON", "Mark all read").disabled).toBe(true);
  });
});
