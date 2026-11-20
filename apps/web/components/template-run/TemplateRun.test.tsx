/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
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
const createNote = mock(async (_args: { title: string; body: string; periodType?: string }) => "note_1");

type TemplateFixture = {
  templateId: string;
  source: "starter";
  name: string;
  description?: string;
  periodType: "daily" | "weekly" | "monthly" | "none";
  sections: string[];
  body: string;
};

let templateResult: TemplateFixture | null | undefined;
let proposalResult: { templateId: string; name: string; reason: string } | null | undefined;
let proposalPending = false;

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "next/navigation": { ...(await import("next/navigation")) },
  "convex/react": { ...(await import("convex/react")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

mock.module("convex/react", () => ({
  useQuery: (_ref: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    if (args && typeof args === "object" && "templateId" in args) return templateResult;
    if (proposalPending) return undefined;
    return proposalResult;
  },
  useMutation: () => createNote,
}));

// The screens read their copy from the locale context; English, as the app's default.
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));

const { TemplateRun } = await import("./TemplateRun");
const { ProposalBanner } = await import("./ProposalBanner");

const dailyTemplate: TemplateFixture = {
  templateId: "starter:daily-page",
  source: "starter",
  name: "Daily page",
  description: "A short outline for one day.",
  periodType: "daily",
  sections: ["Intention", "Schedule", "Notes"],
  body: "# Today\n\n## Intention\nOne line for what would make today feel complete.\n\n- [ ] Morning\n",
};

const dailyProposal = {
  templateId: "starter:daily-page",
  name: "Daily page",
  reason: "A daily page gives this day a short outline you can fill in.",
};

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function findButton(root: TestNode, label: string): TestNode {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (node.tagName === "BUTTON" && node.textContent.includes(label)) found.push(node);
  });
  const button = found[0];
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

let root: Root | null = null;
let host: TestNode | null = null;

async function renderNode(node: ReactElement) {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(node);
  });
  return host;
}

async function renderRun(templateId = "starter:daily-page") {
  return renderNode((<TemplateRun templateId={templateId} />) as ReactElement);
}

describe("TemplateRun", () => {
  beforeEach(() => {
    templateResult = dailyTemplate;
    proposalResult = dailyProposal;
    proposalPending = false;
    push.mockReset();
    createNote.mockReset();
    createNote.mockImplementation(async () => "note_1");
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null;
    host = null;
  });

  test("shows a calm not-found state for a null template", async () => {
    templateResult = null;
    const view = await renderRun("missing");
    expect(view.textContent).toContain("This template was not found");
    expect(view.textContent).not.toContain("{");
    const links: string[] = [];
    walk(view, (node) => {
      if (node.tagName === "A") {
        const value = node.getAttribute("href");
        if (value) links.push(value);
      }
    });
    expect(links[0]).toBe("/templates");
  });

  test("previews markdown and the proposal reason, then Make the page creates it", async () => {
    const view = await renderRun();
    expect(view.textContent).toContain("Daily page");
    expect(view.textContent).toContain(dailyProposal.reason);
    expect(view.textContent).toContain("Intention");
    expect(view.textContent).toContain("Morning");
    expect(view.textContent).not.toContain("# Today");
    expect(view.textContent).not.toContain('"templateId"');

    await act(async () => {
      findButton(view, "Make the page").click();
    });

    expect(createNote).toHaveBeenCalledTimes(1);
    const made = createNote.mock.calls[0]?.[0];
    expect(made?.periodType).toBe("daily");
    expect(made?.body).toContain("## Intention");
    expect(push).toHaveBeenCalledWith("/notes/note_1");
  });

  test("Not now goes back to templates", async () => {
    const view = await renderRun();
    await act(async () => {
      findButton(view, "Not now").click();
    });
    expect(createNote).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/templates");
  });

  test("keeps the proposal reason while a new title is still loading", async () => {
    const view = await renderNode((<ProposalBanner periodType="daily" title="" />) as ReactElement);
    expect(view.textContent).toContain(dailyProposal.reason);

    proposalPending = true;
    await act(async () => {
      root?.render((<ProposalBanner periodType="daily" title="Monday" />) as ReactElement);
    });
    expect(view.textContent).toContain(dailyProposal.reason);
    expect(view.textContent).not.toContain("Checking which outline fits");

    proposalPending = false;
    proposalResult = {
      ...dailyProposal,
      reason: `${dailyProposal.reason} It fits "Monday".`,
    };
    await act(async () => {
      root?.render((<ProposalBanner periodType="daily" title="Monday" />) as ReactElement);
    });
    expect(view.textContent).toContain('It fits "Monday".');
  });

  test("disables Not now while the page is being made", async () => {
    let resolveCreate: (id: string) => void = () => {};
    createNote.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const view = await renderRun();
    await act(async () => {
      findButton(view, "Make the page").click();
    });
    expect(findButton(view, "Not now").disabled).toBe(true);
    expect(findButton(view, "Making the page").disabled).toBe(true);
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      resolveCreate("note_1");
    });
    expect(push).toHaveBeenCalledWith("/notes/note_1");
  });

  test("Not now during an in-flight create does not open the new page", async () => {
    const view = await renderRun();
    createNote.mockImplementation(async () => {
      findButton(view, "Not now").click();
      return "note_1";
    });
    await act(async () => {
      findButton(view, "Make the page").click();
    });
    expect(push).toHaveBeenCalledWith("/templates");
    expect(push).not.toHaveBeenCalledWith("/notes/note_1");
  });

  test("shows an inline error and leaves Make the page usable when create fails", async () => {
    createNote.mockImplementation(async () => {
      throw new Error("network");
    });
    const view = await renderRun();
    await act(async () => {
      findButton(view, "Make the page").click();
    });
    expect(view.textContent).toContain("Could not make the page. You can try again.");
    expect(push).not.toHaveBeenCalled();
    expect(findButton(view, "Make the page").disabled).toBe(false);
  });
});
