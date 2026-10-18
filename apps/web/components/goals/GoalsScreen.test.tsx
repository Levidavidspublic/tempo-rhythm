/**
 * Goals list: "New goal" asks for a name first, and the count reads "Showing 1 goal".
 * Vitest and Testing Library are not dependencies in this repo, so this follows the other
 * component tests: bun:test, react-dom on a small test DOM, and mocked convex/react, next/* and
 * the locale provider. Each case runs in English and in Hebrew.
 */
import { afterEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { act, createElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import type { Lang, MessageKey } from "@/lib/i18n";

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

  get textContent(): string {
    if (this.nodeType === 3) return this.nodeValue ?? "";
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes = [];
    this.firstChild = null;
    this.lastChild = null;
    if (value) this.appendChild(this.ownerDocument.createTextNode(value));
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

  /** Focus is tracked on the document, so a test can ask where it went. */
  focus() {
    this.ownerDocument.activeElement = this;
  }
  blur() {
    if (this.ownerDocument.activeElement === this)
      this.ownerDocument.activeElement = this.ownerDocument.body;
  }
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
  /** The screen moves focus by id, so the document finds elements by id. */
  getElementById(id: string): TestNode | null {
    let match: TestNode | null = null;
    walk(this, (node) => {
      if (!match && node.nodeType === 1 && node.id === id) match = node;
    });
    return match;
  }
}

class TestElement extends TestNode {}

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

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
  // React feature-detects the input event with `"oninput" in document` when react-dom loads.
  (documentNode as unknown as Record<string, unknown>).oninput = null;
  const globals = globalThis as Record<string, unknown>;
  globals.window = globalThis;
  globals.document = documentNode;
  globals.HTMLElement = TestElement;
  globals.Element = TestElement;
  globals.Node = TestNode;
  globals.HTMLIFrameElement = class HTMLIFrameElement extends TestElement {};
  globals.navigator = { userAgent: "bun-test", onLine: true };
  globals.location = { protocol: "http:", href: "http://localhost/goals", search: "" };
  globals.history = { state: null, replaceState() {} };
  globals.getComputedStyle = () => ({ getPropertyValue: () => "", direction: "ltr" });
  globals.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  return documentNode;
}

const documentNode = installTestDom();
// react-dom reads the DOM when it loads, so it is imported after the test DOM exists.
const { createRoot } = await import("react-dom/client");

type GoalRow = { _id: string; _creationTime: number; title: string; status?: string };

let goalsResult: GoalRow[] | undefined = [];
let resolveCreate: ((id: string) => void) | null = null;
const createGoal = mock(
  (_args: { title: string }) =>
    new Promise<string>((resolve) => {
      resolveCreate = resolve;
    })
);
const removeGoal = mock(async (_args: { goalId: string }) => null);

const MUTATIONS: Record<string, unknown> = {
  "goals:create": createGoal,
  "goals:remove": removeGoal,
};

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    const name = getFunctionName(ref);
    if (name === "users:getProfile") return { _id: "users_1" };
    if (name === "goals:list") return goalsResult;
    return undefined;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => MUTATIONS[getFunctionName(ref)],
}));
mock.module("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {} }),
  usePathname: () => "/goals",
  useSearchParams: () => new URLSearchParams(""),
}));
mock.module("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

// The screen reads its copy from the locale context; each case sets the language first.
const { translate } = await import("@/lib/i18n");
let lang: Lang = "en";
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { GoalsScreen } = await import("./GoalsScreen");

/** The copy each case expects, written out so a wrong key or form shows up as a failure. */
const COPY = {
  en: {
    newGoal: "New goal",
    firstGoal: "Write a first goal",
    cancel: "Cancel",
    hint: "Give it a name first. A few words is enough.",
    one: "Showing 1 goal",
    three: "Showing 3 goals",
    name: "  Read more books  ",
    trimmed: "Read more books",
  },
  he: {
    newGoal: "מטרה חדשה",
    firstGoal: "לכתוב מטרה ראשונה",
    cancel: "ביטול",
    hint: "קודם צריך לתת למטרה שם. כמה מילים מספיקות.",
    one: "מוצגת מטרה אחת",
    three: "מוצגות 3 מטרות",
    name: "  לקרוא יותר ספרים  ",
    trimmed: "לקרוא יותר ספרים",
  },
} as const;

function goals(count: number): GoalRow[] {
  return Array.from({ length: count }, (_, index) => ({
    _id: `goals_${index + 1}`,
    _creationTime: index + 1,
    title: `Goal number ${index + 1}`,
    status: "active",
  }));
}

function findAll(root: TestNode, match: (node: TestNode) => boolean): TestNode[] {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (match(node)) found.push(node);
  });
  return found;
}

function findButton(root: TestNode, label: string): TestNode {
  const button = findAll(
    root,
    (node) => node.tagName === "BUTTON" && node.textContent.trim() === label
  )[0];
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

function queryById(root: TestNode, id: string): TestNode | null {
  return findAll(root, (node) => node.id === id)[0] ?? null;
}

function findForm(root: TestNode): TestNode {
  const form = findAll(root, (node) => node.tagName === "FORM")[0];
  if (!form) throw new Error("Missing form");
  return form;
}

function countText(root: TestNode): string {
  const live = findAll(root, (node) => node.getAttribute("aria-live") === "polite")[0];
  if (!live) throw new Error("Missing goal count");
  return live.textContent.replace(/\s+/g, " ").trim();
}

function reactProps(node: TestNode): Record<string, unknown> {
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error(`No react props on ${node.tagName}#${node.id}`);
  return (node as unknown as Record<string, Record<string, unknown>>)[key] ?? {};
}

/** The name field, which must be open and hold focus. */
function nameField(view: TestNode): TestNode {
  const input = queryById(view, "gl-name");
  if (!input) throw new Error("Missing the name field (#gl-name)");
  return input;
}

let root: Root | null = null;
let host: TestNode | null = null;

async function render() {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(GoalsScreen));
  });
  return host;
}

async function click(node: TestNode) {
  await act(async () => {
    node.click();
  });
}

async function type(input: TestNode, value: string) {
  await act(async () => {
    const onChange = reactProps(input).onChange as (event: { target: { value: string } }) => void;
    onChange({ target: { value } });
  });
}

/** Enter in the field submits its form; the test calls the form's submit handler directly. */
function pressEnter(view: TestNode) {
  const onSubmit = reactProps(findForm(view)).onSubmit as (event: {
    preventDefault: () => void;
  }) => void;
  onSubmit({ preventDefault() {} });
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
  documentNode.activeElement = documentNode.body;
  goalsResult = [];
  resolveCreate = null;
  createGoal.mockClear();
  removeGoal.mockClear();
});

for (const language of ["en", "he"] as const) {
  const copy = COPY[language];

  describe(`Goals list (${language})`, () => {
    test("New goal opens a focused name field and creates nothing yet", async () => {
      lang = language;
      goalsResult = goals(2);
      const view = await render();
      await click(findButton(view, copy.newGoal));
      const input = nameField(view);
      expect(documentNode.activeElement).toBe(input);
      expect(createGoal).not.toHaveBeenCalled();
    });

    test("Write a first goal opens the same focused field when there are no goals", async () => {
      lang = language;
      goalsResult = [];
      const view = await render();
      await click(findButton(view, copy.firstGoal));
      const input = nameField(view);
      expect(documentNode.activeElement).toBe(input);
      expect(createGoal).not.toHaveBeenCalled();
    });

    test("Escape closes the field, creates nothing and returns focus to New goal", async () => {
      lang = language;
      goalsResult = goals(2);
      const view = await render();
      await click(findButton(view, copy.newGoal));
      const input = nameField(view);
      await type(input, copy.name);
      await act(async () => {
        const onKeyDown = reactProps(input).onKeyDown as (event: {
          key: string;
          preventDefault: () => void;
        }) => void;
        onKeyDown({ key: "Escape", preventDefault() {} });
      });
      expect(queryById(view, "gl-name")).toBeNull();
      expect(createGoal).not.toHaveBeenCalled();
      expect(documentNode.activeElement).toBe(findButton(view, copy.newGoal));
    });

    test("Cancel closes the field without creating", async () => {
      lang = language;
      goalsResult = [];
      const view = await render();
      await click(findButton(view, copy.firstGoal));
      await type(nameField(view), copy.name);
      await click(findButton(view, copy.cancel));
      expect(queryById(view, "gl-name")).toBeNull();
      expect(createGoal).not.toHaveBeenCalled();
      expect(documentNode.activeElement).toBe(findButton(view, copy.firstGoal));
    });

    test("Enter with a name creates one goal with that name, even when pressed twice", async () => {
      lang = language;
      goalsResult = goals(2);
      const view = await render();
      await click(findButton(view, copy.newGoal));
      await type(nameField(view), copy.name);
      // Two presses before React re-renders, then one more while the first is still saving.
      await act(async () => {
        pressEnter(view);
        pressEnter(view);
      });
      await act(async () => {
        pressEnter(view);
      });
      await act(async () => {
        resolveCreate?.("goals_new");
      });
      expect(createGoal).toHaveBeenCalledTimes(1);
      expect(createGoal).toHaveBeenCalledWith({ title: copy.trimmed });
      expect(queryById(view, "gl-name")).toBeNull();
    });

    test("an empty name shows a short hint and creates nothing", async () => {
      lang = language;
      goalsResult = goals(2);
      const view = await render();
      await click(findButton(view, copy.newGoal));
      await type(nameField(view), "   ");
      await act(async () => {
        pressEnter(view);
      });
      expect(createGoal).not.toHaveBeenCalled();
      expect(view.textContent).toContain(copy.hint);
      expect(nameField(view).getAttribute("aria-invalid")).toBe("true");
    });

    test("the count is singular for 1 goal and plural for 3", async () => {
      lang = language;
      goalsResult = goals(1);
      let view = await render();
      expect(countText(view)).toBe(copy.one);
      await act(async () => {
        root?.unmount();
      });
      if (host?.parentNode) host.parentNode.removeChild(host);

      goalsResult = goals(3);
      view = await render();
      expect(countText(view)).toBe(copy.three);
    });
  });
}
