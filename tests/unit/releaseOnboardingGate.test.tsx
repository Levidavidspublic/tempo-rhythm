/**
 * Regression tests for the release gate: ApprovalGate must not mount protected
 * children while approval is loading, and the onboarding templates-step Skip keeps
 * the entered name. Same dependency-free TestNode DOM harness as
 * apps/web/components/onboarding/OnboardingFlow.test.tsx (no Testing Library here).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement, type ReactElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../apps/web/node_modules/react-dom/client";

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
const signOut = mock(async () => {});
const completeOnboarding = mock(
  async (_args: { fullName?: string }) => ({ onboardedAt: 1 }) as { onboardedAt: number }
);

type Profile = { fullName?: string; greetingName: string; onboardedAt?: number } | null;
type Approval = { status: "pending" | "approved" | "revoked"; email: string } | null | undefined;

let profileResult: Profile | undefined;
let startersResult: { templateId: string; name: string }[] | undefined;
let approvalResult: Approval;

// bun's mock.module is process-global and bun loads every test file before running any, so
// OnboardingFlow.test.tsx's mocks of the same modules are registered by the time these tests
// start. Snapshot whatever is registered then, install ours for this file only, and put the
// snapshot back afterwards so neither file sees the other's router/query mocks.
// These packages are installed under apps/web only, so key the mocks by the path they
// resolve to from there (the same key OnboardingFlow.test.tsx's bare specifiers get).
const webDir = `${process.cwd()}/apps/web`;
const navigation = Bun.resolveSync("next/navigation", webDir);
const authReact = Bun.resolveSync("@convex-dev/auth/react", webDir);
const convexReact = Bun.resolveSync("convex/react", webDir);
const MOCKED = [navigation, authReact, convexReact];
let previous: Record<string, Record<string, unknown>> = {};

async function snapshotModuleMocks() {
  previous = {};
  for (const key of MOCKED) previous[key] = { ...(await import(key)) };
}

function restoreModuleMocks() {
  for (const key of MOCKED) mock.module(key, () => previous[key]);
}

function installModuleMocks() {
  mock.module(navigation, () => ({
    useRouter: () => ({ push, replace }),
  }));

  mock.module(authReact, () => ({
    useAuthActions: () => ({ signOut }),
  }));

  mock.module(convexReact, () => ({
    useQuery: (_ref: unknown, args: unknown) => {
      if (args === undefined) return approvalResult;
      if (args && typeof args === "object" && "scope" in args) return startersResult;
      return profileResult;
    },
    useMutation: () => completeOnboarding,
  }));
}

installModuleMocks();

// The query suffix gives this file its own module instances, so it never shares (or
// rebinds) the OnboardingFlow instance that OnboardingFlow.test.tsx imported.
const { ApprovalGate } = await import("../../apps/web/components/approval/ApprovalGate?release-gate");
const { OnboardingFlow } = await import(
  "../../apps/web/components/onboarding/OnboardingFlow?release-gate"
);


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

let root: Root | null = null;
let host: TestNode | null = null;
let mounts = 0;

function ProtectedChild() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return createElement("p", null, "protected content");
}

type Build = ReactElement | (() => ReactElement);
const build = (element: Build) => (typeof element === "function" ? element() : element);

async function renderUi(element: Build) {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(build(element));
  });
  return host;
}

async function rerender(element: Build) {
  await act(async () => {
    root?.render(build(element));
  });
}

beforeAll(async () => {
  await snapshotModuleMocks();
  installModuleMocks();
});
afterAll(restoreModuleMocks);

beforeEach(() => {
  mounts = 0;
  approvalResult = undefined;
  profileResult = { greetingName: "  Sam  " };
  startersResult = [{ templateId: "starter:daily-page", name: "Daily page" }];
  push.mockReset();
  replace.mockReset();
  completeOnboarding.mockReset();
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

describe("ApprovalGate", () => {
  // A fresh element each call so React re-renders after the mocked query result changes.
  const gate = () => createElement(ApprovalGate, null, createElement(ProtectedChild));

  test("does not mount protected children while approval is loading", async () => {
    const view = await renderUi(gate);
    expect(view.textContent).not.toContain("protected content");
    expect(mounts).toBe(0);
  });

  test("mounts children only after a delayed approval", async () => {
    const view = await renderUi(gate);
    expect(mounts).toBe(0);
    approvalResult = { status: "approved", email: "a@b.co" };
    await rerender(gate);
    expect(view.textContent).toContain("protected content");
    expect(mounts).toBe(1);
  });

  test("delayed pending shows the waiting screen and never mounts children", async () => {
    const view = await renderUi(gate);
    approvalResult = { status: "pending", email: "a@b.co" };
    await rerender(gate);
    expect(view.textContent).not.toContain("protected content");
    expect(findByTag(view, "MAIN").getAttribute("data-testid")).toBe("approval-waiting");
    expect(mounts).toBe(0);
  });

  test("delayed revoked shows the waiting screen and never mounts children", async () => {
    const view = await renderUi(gate);
    approvalResult = { status: "revoked", email: "a@b.co" };
    await rerender(gate);
    expect(view.textContent).not.toContain("protected content");
    expect(findByTag(view, "MAIN").getAttribute("data-testid")).toBe("approval-waiting");
    expect(mounts).toBe(0);
  });

  test("signed-out (null) still passes children through", async () => {
    approvalResult = null;
    const view = await renderUi(gate);
    expect(view.textContent).toContain("protected content");
  });
});

describe("OnboardingFlow skip paths", () => {
  async function goToTemplates(view: TestNode) {
    await act(async () => {
      findByTag(view, "BUTTON", "Next").click();
    });
  }

  test("templates-step Skip keeps the trimmed entered name", async () => {
    const view = await renderUi(createElement(OnboardingFlow));
    await goToTemplates(view);
    await act(async () => {
      findByTag(view, "BUTTON", "Skip").click();
    });
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(completeOnboarding).toHaveBeenCalledWith({ fullName: "Sam" });
    expect(push).toHaveBeenCalledWith("/today");
  });

  test("templates-step Skip with an empty name sends no name", async () => {
    profileResult = { greetingName: "there" };
    const view = await renderUi(createElement(OnboardingFlow));
    await goToTemplates(view);
    await act(async () => {
      findByTag(view, "BUTTON", "Skip").click();
    });
    expect(completeOnboarding).toHaveBeenCalledWith({});
  });

  test("templates-step Skip with a whitespace-only name sends no name", async () => {
    profileResult = { greetingName: "   " };
    const view = await renderUi(createElement(OnboardingFlow));
    await goToTemplates(view);
    await act(async () => {
      findByTag(view, "BUTTON", "Skip").click();
    });
    expect(completeOnboarding).toHaveBeenCalledWith({});
  });

  test("name-step Skip still finishes without a name", async () => {
    const view = await renderUi(createElement(OnboardingFlow));
    await act(async () => {
      findByTag(view, "BUTTON", "Skip").click();
    });
    expect(completeOnboarding).toHaveBeenCalledWith({});
    expect(push).toHaveBeenCalledWith("/today");
  });

  test("failed templates Skip stays on the step and retry keeps the name", async () => {
    completeOnboarding.mockImplementationOnce(async () => {
      throw new Error("network");
    });
    const view = await renderUi(createElement(OnboardingFlow));
    await goToTemplates(view);
    await act(async () => {
      findByTag(view, "BUTTON", "Skip").click();
    });
    expect(view.textContent).toContain("Could not save that. You can try again.");
    expect(view.textContent).toContain("Starter templates");
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      findByTag(view, "BUTTON", "Skip").click();
    });
    expect(completeOnboarding).toHaveBeenCalledTimes(2);
    expect(completeOnboarding).toHaveBeenLastCalledWith({ fullName: "Sam" });
    expect(push).toHaveBeenCalledTimes(1);
  });

  test("does not double-submit while a save is in flight", async () => {
    let release: () => void = () => {};
    completeOnboarding.mockImplementationOnce(
      () =>
        new Promise<{ onboardedAt: number }>((resolve) => {
          release = () => resolve({ onboardedAt: 1 });
        })
    );
    const view = await renderUi(createElement(OnboardingFlow));
    await goToTemplates(view);
    const skip = findByTag(view, "BUTTON", "Skip");
    await act(async () => {
      skip.click();
      skip.click();
    });
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
    expect(push).toHaveBeenCalledTimes(1);
  });
});
