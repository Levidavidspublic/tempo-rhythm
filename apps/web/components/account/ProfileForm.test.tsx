/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks.
 */
import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";

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

type Profile = { fullName?: string; email?: string; greetingName?: string } | null | undefined;

const updateMyProfile = mock(async (_args: { fullName: string }) => "user-1");
const deleteMyAccount = mock(async () => ({ success: true, deletedCount: 1 }));
const signOut = mock(async () => {});
const push = mock((_href: string) => {});

let profileResult: Profile = {
  fullName: "Sam",
  email: "sam@example.com",
  greetingName: "Sam",
};
let activeMutation: (...args: never[]) => Promise<unknown> = updateMyProfile;

mock.module("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

mock.module("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut }),
}));

mock.module("convex/react", () => ({
  useQuery: () => profileResult,
  useMutation: () => activeMutation,
}));

const { ProfileForm } = await import("./ProfileForm");
const { DeleteAccountCard } = await import("./DeleteAccountCard");
const { GreetingName } = await import("./GreetingName");

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

async function setInput(node: TestNode, value: string) {
  await act(async () => {
    const onChange = reactProps(node).onChange as (event: { target: { value: string } }) => void;
    onChange({ target: { value } });
  });
}

describe("account profile", () => {
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null;
    host = null;
    updateMyProfile.mockReset();
    deleteMyAccount.mockReset();
    signOut.mockReset();
    push.mockReset();
    updateMyProfile.mockImplementation(async () => "user-1");
    deleteMyAccount.mockImplementation(async () => ({ success: true, deletedCount: 1 }));
    signOut.mockImplementation(async () => {});
  });

  test("Save calls updateMyProfile with the trimmed name", async () => {
    profileResult = {
      fullName: "Sam",
      email: "sam@example.com",
      greetingName: "Sam",
    };
    activeMutation = updateMyProfile;
    const view = await render((<ProfileForm />) as ReactElement);
    const email = findById(view, "profile-email");
    expect(email.value).toBe("sam@example.com");
    expect(email.readOnly).toBe(true);
    expect(findById(view, "profile-name").value).toBe("Sam");

    await setInput(findById(view, "profile-name"), "  Ada Lovelace  ");
    await act(async () => {
      const onSubmit = reactProps(findByTag(view, "FORM")).onSubmit as (event: {
        preventDefault: () => void;
      }) => Promise<void>;
      await onSubmit({ preventDefault() {} });
    });

    expect(updateMyProfile).toHaveBeenCalledTimes(1);
    expect(updateMyProfile).toHaveBeenCalledWith({ fullName: "Ada Lovelace" });
    expect(view.textContent).toContain("Saved");
    expect(view.textContent).not.toContain("{");
  });

  test("Delete stays disabled until DELETE is typed", async () => {
    activeMutation = deleteMyAccount;
    const view = await render((<DeleteAccountCard />) as ReactElement);
    expect(view.textContent).toContain(
      "Deleting your account removes your tasks, notes, habits, templates and settings, and ends your subscription. Signing in again later does not bring them back.",
    );
    const button = findByTag(view, "BUTTON", "Delete account");
    expect(button.disabled).toBe(true);

    await act(async () => {
      button.click();
    });
    expect(deleteMyAccount).not.toHaveBeenCalled();

    await setInput(findById(view, "delete-account-confirm"), "DELET");
    expect(findByTag(view, "BUTTON", "Delete account").disabled).toBe(true);

    await setInput(findById(view, "delete-account-confirm"), "DELETE");
    const ready = findByTag(view, "BUTTON", "Delete account");
    expect(ready.disabled).toBe(false);

    await act(async () => {
      ready.click();
    });
    expect(deleteMyAccount).toHaveBeenCalledTimes(1);
    expect(deleteMyAccount).toHaveBeenCalledWith({});
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/sign-in");
    expect(view.textContent).not.toContain("{");
  });

  test('GreetingName never shows "User"', async () => {
    profileResult = { greetingName: "Ada", email: "ada@example.com", fullName: "Ada" };
    let view = await render((<GreetingName />) as ReactElement);
    expect(view.textContent).toBe("Hi, Ada");
    expect(view.textContent).not.toContain("User");

    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);

    profileResult = { greetingName: "User", email: "ada@example.com", fullName: "User" };
    view = await render((<GreetingName />) as ReactElement);
    expect(view.textContent).toBe("Hi, ada");
    expect(view.textContent).not.toContain("User");

    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);

    profileResult = { greetingName: "User", email: "User@example.com" };
    view = await render((<GreetingName />) as ReactElement);
    expect(view.textContent).toBe("Hi, there");
    expect(view.textContent).not.toContain("User");

    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);

    profileResult = null;
    view = await render((<GreetingName />) as ReactElement);
    expect(view.textContent).toBe("Hi, there");
    expect(view.textContent).not.toContain("User");
  });
});
