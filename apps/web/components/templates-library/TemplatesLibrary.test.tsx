import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks.
 */

type ClickEvent = {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  target: TestNode | null;
  currentTarget: TestNode | null;
  defaultPrevented: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
  button: number;
  buttons: number;
  timeStamp: number;
  isTrusted: boolean;
};

class TestNode {
  nodeType = 1;
  nodeName = "DIV";
  childNodes: TestNode[] = [];
  parentNode: TestNode | null = null;
  ownerDocument: TestDocument | null = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  textData = "";
  attrs: Record<string, string> = {};
  listeners: Record<string, Array<(event: ClickEvent) => void>> = {};
  style: Record<string, string> = {};
  className = "";
  scrollLeft = 0;
  scrollTop = 0;

  constructor(name: string, nodeType = 1) {
    this.nodeName = name;
    this.nodeType = nodeType;
  }

  get tagName() {
    return this.nodeName;
  }

  get data() {
    return this.textData;
  }

  set data(value: string) {
    this.textData = value;
  }

  get nodeValue() {
    return this.nodeType === 3 || this.nodeType === 8 ? this.textData : null;
  }

  set nodeValue(value: string | null) {
    this.textData = value ?? "";
  }

  appendChild(child: TestNode) {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child: TestNode, ref: TestNode | null) {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    const index = ref ? this.childNodes.indexOf(ref) : -1;
    if (index === -1) this.childNodes.push(child);
    else this.childNodes.splice(index, 0, child);
    return child;
  }

  removeChild(child: TestNode) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  setAttribute(name: string, value: string) {
    this.attrs[name] = String(value);
    if (name === "class") this.className = String(value);
  }

  getAttribute(name: string) {
    return this.attrs[name] ?? null;
  }

  removeAttribute(name: string) {
    delete this.attrs[name];
  }

  hasAttribute(name: string) {
    return Object.hasOwn(this.attrs, name);
  }

  setAttributeNS(_ns: string, name: string, value: string) {
    this.setAttribute(name, value);
  }

  getAttributeNS(_ns: string, name: string) {
    return this.getAttribute(name);
  }

  removeAttributeNS(_ns: string, name: string) {
    this.removeAttribute(name);
  }

  hasAttributeNS(_ns: string, name: string) {
    return this.hasAttribute(name);
  }

  addEventListener(type: string, fn: (event: ClickEvent) => void) {
    const list = this.listeners[type] ?? [];
    list.push(fn);
    this.listeners[type] = list;
  }

  removeEventListener(type: string, fn: (event: ClickEvent) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((item) => item !== fn);
  }

  dispatchEvent(event: ClickEvent) {
    event.target ??= this;
    event.currentTarget = this;
    for (const fn of this.listeners[event.type] ?? []) fn(event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return true;
  }

  click() {
    this.dispatchEvent({
      type: "click",
      bubbles: true,
      cancelable: true,
      target: this,
      currentTarget: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.bubbles = false;
      },
      button: 0,
      buttons: 0,
      timeStamp: 0,
      isTrusted: true,
    });
  }

  get firstChild() {
    return this.childNodes[0] ?? null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }

  get nextSibling(): TestNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index + 1] ?? null;
  }

  get previousSibling(): TestNode | null {
    if (!this.parentNode) return null;
    const index = this.parentNode.childNodes.indexOf(this);
    return this.parentNode.childNodes[index - 1] ?? null;
  }

  get parentElement(): TestNode | null {
    return this.parentNode?.nodeType === 1 ? this.parentNode : null;
  }

  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this.textData;
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes = [];
    if (!value) return;
    const text = this.ownerDocument?.createTextNode(value) ?? new TestNode("#text", 3);
    text.textData = value;
    text.parentNode = this;
    this.childNodes = [text];
  }

  get innerHTML() {
    return this.textContent;
  }

  set innerHTML(_value: string) {
    this.textContent = "";
  }

  contains(other: TestNode | null) {
    let current: TestNode | null = other;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  getRootNode() {
    return this.ownerDocument;
  }

  get isConnected() {
    return this.ownerDocument !== null;
  }

  focus() {}

  blur() {}

  compareDocumentPosition() {
    return 0;
  }

  cloneNode() {
    return this;
  }

  get classList() {
    const node = this;
    return {
      add(...names: string[]) {
        const set = new Set(node.className.split(/\s+/).filter(Boolean));
        for (const name of names) set.add(name);
        node.className = [...set].join(" ");
        node.attrs.class = node.className;
      },
      remove(...names: string[]) {
        const drop = new Set(names);
        node.className = node.className
          .split(/\s+/)
          .filter((name) => name && !drop.has(name))
          .join(" ");
        node.attrs.class = node.className;
      },
      contains(name: string) {
        return node.className.split(/\s+/).includes(name);
      },
      toggle(name: string) {
        if (this.contains(name)) this.remove(name);
        else this.add(name);
      },
    };
  }

  get dataset() {
    return {};
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
  }
}

class TestDocument extends TestNode {
  body: TestNode;
  documentElement: TestNode;
  defaultView: typeof globalThis;
  activeElement: TestNode | null = null;

  constructor() {
    super("#document", 9);
    this.ownerDocument = this;
    this.defaultView = globalThis;
    this.documentElement = new TestNode("HTML");
    this.documentElement.ownerDocument = this;
    this.body = new TestNode("BODY");
    this.body.ownerDocument = this;
    this.activeElement = this.body;
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag: string) {
    const node = new TestNode(tag.toUpperCase());
    node.ownerDocument = this;
    return node;
  }

  createElementNS(_ns: string, tag: string) {
    return this.createElement(tag);
  }

  createTextNode(text: string) {
    const node = new TestNode("#text", 3);
    node.textData = text;
    node.ownerDocument = this;
    return node;
  }

  createComment(text: string) {
    const node = new TestNode("#comment", 8);
    node.textData = text;
    node.ownerDocument = this;
    return node;
  }

  createDocumentFragment() {
    const node = new TestNode("#fragment", 11);
    node.ownerDocument = this;
    return node;
  }
}

function installTestDom() {
  const documentNode = new TestDocument();
  const target = globalThis as Record<string, unknown>;
  target.Node = TestNode;
  target.Element = TestNode;
  target.HTMLElement = TestNode;
  target.HTMLIFrameElement = class HTMLIFrameElement {};
  target.SVGElement = TestNode;
  target.Text = TestNode;
  target.Comment = TestNode;
  target.DocumentFragment = TestNode;
  target.document = documentNode;
  target.window = globalThis;
  target.navigator = { userAgent: "bun-test" };
  target.getComputedStyle = () => new Proxy({}, { get: () => "" });
  target.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0);
  target.cancelAnimationFrame = (id: number) => clearTimeout(id);
  target.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  target.IS_REACT_ACT_ENVIRONMENT = true;
  return documentNode;
}

const documentNode = installTestDom();

type ListedTemplate = {
  templateId: string;
  source: "starter" | "user";
  name: string;
  description?: string;
  periodType: "daily" | "weekly" | "monthly" | "none";
  sections: string[];
  body: string;
};

const starter: ListedTemplate = {
  templateId: "starter:daily-page",
  source: "starter",
  name: "Daily page",
  description: "A short outline for one day.",
  periodType: "daily",
  sections: ["Intention", "Schedule", "Notes"],
  body: "SHOULD_NOT_RENDER_BODY",
};

const own: ListedTemplate = {
  templateId: "jd72usertemplate01",
  source: "user",
  name: "Shipping day",
  description: "A short close-down.",
  periodType: "none",
  sections: ["Close the loops"],
  body: "SHOULD_NOT_RENDER_BODY",
};

let listed: ListedTemplate[] | undefined = [starter, own];
let queryArgs: unknown;
const remove = mock(async () => null);

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "convex/react": { ...(await import("convex/react")) },
  "next/link": { ...(await import("next/link")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module("convex/react", () => ({
  useQuery: (_query: unknown, args: unknown) => {
    queryArgs = args;
    return listed;
  },
  useMutation: () => remove,
}));

mock.module("next/link", () => ({
  default: ({
    href,
    children,
    ref: _ref,
    ...props
  }: {
    href: string;
    children?: ReactNode;
    ref?: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

// The screen reads its copy from the locale context; English, as the app's default.
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));

const { TemplatesLibrary } = await import("./TemplatesLibrary");

function within(root: TestNode): TestNode[] {
  const all: TestNode[] = [];
  const walk = (node: TestNode) => {
    for (const child of node.childNodes) {
      all.push(child);
      walk(child);
    }
  };
  walk(root);
  return all;
}

function article(host: TestNode, templateId: string): TestNode {
  const found = within(host).find(
    (node) => node.nodeName === "ARTICLE" && node.getAttribute("data-template-id") === templateId
  );
  if (!found) throw new Error(`Missing template card ${templateId}`);
  return found;
}

function labeled(root: TestNode, label: string): TestNode | undefined {
  return within(root).find((node) => node.getAttribute("aria-label") === label);
}

function hrefOf(node: TestNode | undefined): string | null {
  if (!node) return null;
  return node.getAttribute("href") ?? (node as TestNode & { href?: string }).href ?? null;
}

async function renderLibrary(): Promise<{ host: TestNode; root: Root }> {
  const host = documentNode.createElement("div");
  documentNode.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  await act(async () => {
    root.render(createElement(TemplatesLibrary));
  });
  return { host, root };
}

async function click(node: TestNode | undefined) {
  if (!node) throw new Error("Missing click target");
  await act(async () => {
    node.click();
  });
}

describe("TemplatesLibrary", () => {
  beforeEach(() => {
    listed = [starter, own];
    queryArgs = undefined;
    remove.mockClear();
    documentNode.body.childNodes = [];
  });

  test("shows starter cards without Delete, and soft-deletes a user template after confirm", async () => {
    const { host, root } = await renderLibrary();

    expect(queryArgs).toEqual({ scope: "all" });
    expect(host.textContent).not.toContain("SHOULD_NOT_RENDER_BODY");

    const starterCard = article(host, "starter:daily-page");
    expect(starterCard.textContent).toContain("Daily page");
    expect(starterCard.textContent).toContain("A short outline for one day.");
    expect(starterCard.textContent).toContain("Daily");
    expect(starterCard.textContent).toContain("Intention");
    expect(starterCard.textContent).toContain("Schedule");
    expect(labeled(starterCard, "Delete Daily page")).toBeUndefined();
    expect(labeled(starterCard, "Edit Daily page")).toBeUndefined();
    expect(hrefOf(labeled(starterCard, "Use Daily page"))).toBe(
      "/templates/run/starter%3Adaily-page"
    );

    const ownCard = article(host, "jd72usertemplate01");
    expect(ownCard.textContent).toContain("Anytime");
    expect(ownCard.textContent).toContain("Close the loops");
    expect(hrefOf(labeled(ownCard, "Use Shipping day"))).toBe("/templates/run/jd72usertemplate01");
    expect(hrefOf(labeled(ownCard, "Edit Shipping day"))).toBe(
      "/templates/editor/jd72usertemplate01"
    );
    expect(
      hrefOf(within(host).find((node) => node.nodeName === "A" && node.textContent.includes("New template")))
    ).toBe("/templates/builder");

    await click(labeled(ownCard, "Delete Shipping day"));
    expect(remove).not.toHaveBeenCalled();
    await click(labeled(ownCard, "Confirm delete Shipping day"));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith({ templateId: "jd72usertemplate01" });

    await act(async () => {
      root.unmount();
    });
  });

  test("shows a loading state, empty sections, and filters built-in versus yours", async () => {
    listed = undefined;
    const loading = await renderLibrary();
    expect(loading.host.textContent).toContain("Loading templates.");
    expect(within(loading.host).some((node) => node.nodeName === "ARTICLE")).toBe(false);
    await act(async () => {
      loading.root.unmount();
    });

    listed = [];
    const empty = await renderLibrary();
    expect(empty.host.textContent).toContain("No built-in templates to show.");
    expect(empty.host.textContent).toContain("No templates of your own yet.");
    await act(async () => {
      empty.root.unmount();
    });

    listed = [starter, own];
    const { host, root } = await renderLibrary();
    await click(
      within(host).find(
        (node) => node.getAttribute("role") === "radio" && node.textContent === "Yours"
      )
    );
    expect(
      within(host).some((node) => node.getAttribute("data-template-id") === "starter:daily-page")
    ).toBe(false);
    expect(article(host, "jd72usertemplate01").textContent).toContain("Shipping day");

    await click(
      within(host).find(
        (node) => node.getAttribute("role") === "radio" && node.textContent === "Built-in"
      )
    );
    expect(article(host, "starter:daily-page").textContent).toContain("Daily page");
    expect(
      within(host).some((node) => node.getAttribute("data-template-id") === "jd72usertemplate01")
    ).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});
