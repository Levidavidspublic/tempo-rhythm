/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
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
    if (name === "value") this.value = String(value);
  }

  getAttribute(name: string) {
    if (name === "href" && this.href) return this.href;
    return this.attributes[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
    if (name === "disabled") this.disabled = false;
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

const push = mock((_href: string) => {});
const replace = mock((_href: string) => {});
const completeOnboarding = mock(
  async (_args: { fullName?: string }) => ({ onboardedAt: 1 }) as { onboardedAt: number }
);
const setDial = mock(async (_args: { dial: number }) => ({ success: true }));
const createNote = mock(async (_args: { title: string; body: string }) => "note-1");
const updateNote = mock(async (_args: { noteId: string; body: string }) => "note-1");
const updatePreferences = mock(async (_args: { locale?: string }) => null);
const setLang = mock((_lang: string) => {});
const setDyslexia = mock((_on: boolean) => {});

type Profile = { fullName?: string; greetingName: string; onboardedAt?: number } | null;

let profileResult: Profile | undefined;
let coachResult: { dial: number } | undefined;

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "next/navigation": { ...(await import("next/navigation")) },
  "convex/react": { ...(await import("convex/react")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
  "@/components/providers/ThemeProvider": { ...(await import("@/components/providers/ThemeProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

const MUTATIONS: Record<string, unknown> = {
  "users:completeOnboarding": completeOnboarding,
  "coach:setDial": setDial,
  "notes:create": createNote,
  "notes:update": updateNote,
  "preferences:update": updatePreferences,
};

mock.module("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(ref) === "coach:getSettings" ? coachResult : profileResult;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => MUTATIONS[getFunctionName(ref)],
}));

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang, t: (key: MessageKey) => translate("en", key) }),
}));

mock.module("@/components/providers/ThemeProvider", () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme() {}, dyslexia: false, setDyslexia }),
}));

const { OnboardingFlow } = await import("./OnboardingFlow");

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

function reactProps(node: TestNode): Record<string, unknown> {
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error(`No react props on ${node.tagName}`);
  return (node as unknown as Record<string, Record<string, unknown>>)[key] ?? {};
}

let root: Root | null = null;
let host: TestNode | null = null;

async function renderFlow() {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render((<OnboardingFlow />) as ReactElement);
  });
  return host;
}

async function click(view: TestNode, label: string) {
  await act(async () => {
    findByTag(view, "BUTTON", label).click();
  });
}

async function change(node: TestNode, value: string) {
  await act(async () => {
    const onChange = reactProps(node).onChange as (event: { target: { value: string } }) => void;
    onChange({ target: { value } });
  });
}

describe("OnboardingFlow", () => {
  beforeEach(() => {
    profileResult = { greetingName: "  Sam  " };
    coachResult = { dial: 4 };
    for (const fn of [push, replace, completeOnboarding, setDial, createNote, updateNote, updatePreferences, setLang, setDyslexia]) {
      fn.mockClear();
    }
    completeOnboarding.mockImplementation(async () => ({ onboardedAt: 1 }));
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null;
    host = null;
  });

  test("opens on step 1 of 5 with language and reading font, then the name step", async () => {
    const view = await renderFlow();
    expect(view.textContent).toContain("Welcome. Let's set Tempo up for you.");
    expect(view.textContent).toContain("Step 1 of 5");
    expect(view.textContent).not.toContain("Back");
    await click(view, "Continue");
    expect(view.textContent).toContain("Step 2 of 5");
    expect(view.textContent).toContain("What should the coach call you?");
    expect(view.textContent).toContain("Back");
    expect(view.textContent).not.toContain("{");
  });

  test("language and reading font drive the shell's own switches", async () => {
    const view = await renderFlow();
    const radios: TestNode[] = [];
    walk(view, (node) => {
      if (node.tagName === "INPUT") radios.push(node);
    });
    const hebrew = radios.find((node) => node.attributes.value === "he" || node.value === "he");
    const dyslexia = radios.find((node) => node.attributes.value === "dyslexia" || node.value === "dyslexia");
    if (!hebrew || !dyslexia) throw new Error("Missing radios");
    await act(async () => {
      (reactProps(hebrew).onChange as () => void)();
      (reactProps(dyslexia).onChange as () => void)();
    });
    expect(setLang).toHaveBeenCalledWith("he");
    expect(updatePreferences).toHaveBeenCalledWith({ locale: "he" });
    expect(setDyslexia).toHaveBeenCalledWith(true);
  });

  test("prefills the name from the profile", async () => {
    const view = await renderFlow();
    await click(view, "Continue");
    expect(findByTag(view, "INPUT").id).toBe("onboarding-name");
    expect(findByTag(view, "INPUT").value).toBe("  Sam  ");
    expect(replace).not.toHaveBeenCalled();
  });

  test('does not prefill the placeholder "there"', async () => {
    profileResult = { greetingName: "there" };
    const view = await renderFlow();
    await click(view, "Continue");
    expect(findByTag(view, "INPUT").value).toBe("");
  });

  test("Start using Tempo saves the trimmed name, a changed dial and the brain dump, then routes to /today", async () => {
    const view = await renderFlow();
    await click(view, "Continue");
    await change(findByTag(view, "INPUT"), "  Ada  ");
    await click(view, "Continue");
    await change(findByTag(view, "INPUT"), "7");
    expect(view.textContent).toContain("Steady");
    await click(view, "Continue");
    expect(setDial).toHaveBeenCalledWith({ dial: 7 });
    await change(findByTag(view, "TEXTAREA"), "Call the bank\nBuy milk");
    await click(view, "Continue");
    expect(createNote).toHaveBeenCalledWith({ title: "Brain dump", body: "Call the bank\nBuy milk" });
    expect(view.textContent).toContain("Your privacy");
    await click(view, "Start using Tempo");
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).toHaveBeenCalledWith({ fullName: "Ada" });
    expect(push).toHaveBeenCalledWith("/today");
  });

  test("an unchanged dial and an empty brain dump save nothing on the way", async () => {
    const view = await renderFlow();
    await click(view, "Continue");
    await click(view, "Continue");
    await click(view, "Continue");
    await click(view, "Continue");
    expect(setDial).not.toHaveBeenCalled();
    expect(createNote).not.toHaveBeenCalled();
    expect(view.textContent).toContain("Your privacy");
  });

  test("going back and changing the brain dump updates the same page", async () => {
    const view = await renderFlow();
    await click(view, "Continue");
    await click(view, "Continue");
    await click(view, "Continue");
    await change(findByTag(view, "TEXTAREA"), "First");
    await click(view, "Continue");
    await click(view, "Back");
    await change(findByTag(view, "TEXTAREA"), "Second");
    await click(view, "Continue");
    expect(createNote).toHaveBeenCalledTimes(1);
    expect(updateNote).toHaveBeenCalledWith({ noteId: "note-1", body: "Second" });
  });

  test("name-step Skip finishes without a name", async () => {
    const view = await renderFlow();
    await click(view, "Continue");
    await change(findByTag(view, "INPUT"), "Ada");
    await click(view, "Skip");
    await click(view, "Continue");
    await click(view, "Skip");
    await click(view, "Start using Tempo");
    expect(completeOnboarding).toHaveBeenCalledWith({});
    expect(push).toHaveBeenCalledWith("/today");
  });

  test("redirects an already-onboarded user to /today", async () => {
    profileResult = { greetingName: "Sam", onboardedAt: 123 };
    await renderFlow();
    expect(replace).toHaveBeenCalledWith("/today");
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  test("shows an inline error and stays when saving a step fails", async () => {
    setDial.mockImplementationOnce(async () => {
      throw new Error("network");
    });
    const view = await renderFlow();
    await click(view, "Continue");
    await click(view, "Continue");
    await change(findByTag(view, "INPUT"), "9");
    await click(view, "Continue");
    expect(view.textContent).toContain("Couldn't save this step.");
    expect(view.textContent).toContain("How much should the coach push?");
    expect(findByTag(view, "INPUT").value).toBe("9");
  });

  test("shows the save error when finishing fails", async () => {
    completeOnboarding.mockImplementation(async () => {
      throw new Error("network");
    });
    const view = await renderFlow();
    for (const label of ["Continue", "Continue", "Continue", "Continue", "Start using Tempo"]) {
      await click(view, label);
    }
    expect(view.textContent).toContain("Couldn't save this step.");
    expect(push).not.toHaveBeenCalled();
  });
});
