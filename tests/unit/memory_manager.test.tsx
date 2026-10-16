/**
 * S31 MemoryManager parity (docs/design/v3/screens/web/memory.html): search, the source filter,
 * Edit with Undo, Forget with a 5-minute Undo, "Forget everything" asks first, and the empty and
 * error states. Same dependency-free TestNode DOM harness as releaseOnboardingGate.test.tsx
 * (happy-dom and Testing Library aren't installed in this repo). Lives in tests/unit because
 * `bun run test` does not include apps/web/components.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../apps/web/lib/i18n";

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
  globals.navigator = { userAgent: "bun-test", onLine: true };
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

type Memory = {
  _id: string;
  content: string;
  createdAt: number;
  importedFrom?: "chatgpt" | "claude" | "grok" | "other";
};

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const LONG = `${"Mondays are slow and that is fine. ".repeat(12)}Start them small.`;

let memories: Memory[] | undefined;
let profile: { greetingName: string } | null | undefined;
let throwOnList = false;
const calls: { name: string; args: Record<string, unknown> }[] = [];
const failing = new Set<string>();

function mutationFor(name: string) {
  return async (args: Record<string, unknown>) => {
    calls.push({ name, args });
    if (failing.has(name)) throw new Error("offline");
    if (name === "memory:update") {
      const row = memories?.find((m) => m._id === args.memoryId);
      const previous = row?.content ?? "";
      if (row) row.content = String(args.content);
      return { success: true, previous };
    }
    if (name === "memory:forgetAll") return { count: memories?.length ?? 0, forgottenAt: 42 };
    if (name === "memory:restore") return { success: true };
    if (name === "memory:restoreAll") return { restored: 1 };
    return { success: true };
  };
}

const webDir = `${process.cwd()}/apps/web`;
// Only this file mocks the screen's own data hook, so no other test's mocks can collide with it.
const backend = Bun.resolveSync("@/components/memory/useMemoryBackend", webDir);
const nextLink = Bun.resolveSync("next/link", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const MOCKED = [backend, nextLink, localeProvider];
let previous: Record<string, Record<string, unknown>> = {};

function installModuleMocks() {
  mock.module(backend, () => ({
    useMemoryBackend: () => {
      if (throwOnList) throw new Error("load");
      return {
        isAuthLoading: false,
        isAuthenticated: true,
        profile,
        memories,
        remember: mutationFor("memory:remember"),
        update: mutationFor("memory:update"),
        forget: mutationFor("memory:forget"),
        restore: mutationFor("memory:restore"),
        forgetAll: mutationFor("memory:forgetAll"),
        restoreAll: mutationFor("memory:restoreAll"),
        exportAll: async () => ({ markdown: "", filename: "m.md" }),
      };
    },
  }));
  mock.module(nextLink, () => ({
    default: ({ href, children, className }: { href: string; children: unknown; className?: string }) =>
      createElement("a", { href, className }, children as never),
  }));
  mock.module(localeProvider, () => ({
    useLocale: () => ({
      lang: "en",
      dir: "ltr",
      setLang() {},
      t: (key: MessageKey) => translate("en", key),
    }),
  }));
}

installModuleMocks();
let MemoryManager: () => ReturnType<typeof createElement>;

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function findAll(root: TestNode, tag: string, label?: string): TestNode[] {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (node.tagName === tag && (label === undefined || node.textContent.includes(label))) found.push(node);
  });
  return found;
}

function find(root: TestNode, tag: string, label?: string): TestNode {
  const match = findAll(root, tag, label)[0];
  if (!match) throw new Error(`Missing ${tag}: ${label ?? ""}`);
  return match;
}

function byId(root: TestNode, id: string): TestNode {
  let match: TestNode | null = null;
  walk(root, (node) => {
    if (!match && node.id === id) match = node;
  });
  if (!match) throw new Error(`Missing #${id}`);
  return match;
}

async function fire(node: TestNode, type: string) {
  await act(async () => {
    node.dispatchEvent(new TestEvent(type, node));
  });
}

async function click(view: TestNode, label: string, index = 0) {
  const button = findAll(view, "BUTTON", label)[index];
  if (!button) throw new Error(`Missing button: ${label}`);
  await act(async () => {
    button.click();
  });
}

/** The props React rendered on a host node (its controlled value, its handlers). */
function reactProps(node: TestNode): Record<string, unknown> {
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  if (!key) throw new Error(`No React props on ${node.tagName}`);
  return (node as unknown as Record<string, Record<string, unknown>>)[key] ?? {};
}

/**
 * Types into a field. react-dom decides at load time whether this "DOM" supports the input
 * event (it doesn't), so call the field's onChange the way React would, with the new value.
 */
async function type(node: TestNode, text: string) {
  node.value = text;
  const onChange = reactProps(node).onChange as (event: unknown) => void;
  await act(async () => {
    onChange({ target: node, currentTarget: node });
  });
}

function fieldValue(node: TestNode): unknown {
  return reactProps(node).value;
}

/** Visible fact text of every row, in order. */
function facts(view: TestNode): string[] {
  const out: string[] = [];
  walk(view, (node) => {
    if (node.className.includes("mm-fact__text")) out.push(node.textContent);
  });
  return out;
}

let root: Root | null = null;
let host: TestNode | null = null;

async function renderUi() {
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(MemoryManager));
  });
  return host;
}

beforeAll(async () => {
  previous = {};
  for (const key of MOCKED) previous[key] = { ...(await import(key)) };
  installModuleMocks();
  // The query suffix gives this file its own instance of the screen, linked to these mocks.
  ({ MemoryManager } = await import("../../apps/web/components/memory/MemoryManager?memory-manager"));
});
afterAll(() => {
  for (const key of MOCKED) mock.module(key, () => previous[key]);
});

beforeEach(() => {
  profile = { greetingName: "Maya" };
  throwOnList = false;
  calls.length = 0;
  failing.clear();
  memories = [
    { _id: "m1", content: "Phone calls feel easier before noon.", createdAt: NOW - DAY },
    { _id: "m2", content: "Dana is my manager. Yoni is my brother.", createdAt: NOW - 2 * DAY },
    {
      _id: "m3",
      content: "Works as a product designer, mostly from home.",
      createdAt: NOW - 3 * DAY,
      importedFrom: "chatgpt",
    },
    { _id: "m4", content: "Prefers Hebrew for voice, English for writing.", createdAt: NOW - 4 * DAY, importedFrom: "claude" },
  ];
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});

describe("MemoryManager", () => {
  test("lists every memory with where it came from, in words", async () => {
    const view = await renderUi();
    expect(facts(view)).toHaveLength(4);
    expect(view.textContent).toContain("Saved in Tempo");
    expect(view.textContent).toContain("Imported from ChatGPT");
    expect(view.textContent).toContain("Imported from Claude");
    expect(find(view, "A", "Import from ChatGPT or Claude").href).toBe("/settings/memory/import");
  });

  test("search narrows the list, says how many match, and Clear search brings them back", async () => {
    const view = await renderUi();
    const box = byId(view, "memory-search");
    expect(box.attributes.dir).toBe("auto");
    await type(box, "DANA brother");
    expect(facts(view)).toEqual(["Dana is my manager. Yoni is my brother."]);
    expect(view.textContent).toContain("1 of 4 shown");

    await type(box, "pizza");
    expect(facts(view)).toEqual([]);
    expect(view.textContent).toContain('No memories match "pizza".');
    await click(view, "Clear search");
    expect(facts(view)).toHaveLength(4);
  });

  test("the source filter shows only imported, or only your own", async () => {
    const view = await renderUi();
    await click(view, "Imported");
    expect(facts(view)).toEqual([
      "Works as a product designer, mostly from home.",
      "Prefers Hebrew for voice, English for writing.",
    ]);
    await click(view, "From you");
    expect(facts(view)).toEqual([
      "Phone calls feel easier before noon.",
      "Dana is my manager. Yoni is my brother.",
    ]);
  });

  test("edit changes the words through memory.update, and Undo puts the old words back", async () => {
    const view = await renderUi();
    await click(view, "Edit");
    const box = find(view, "TEXTAREA");
    expect(fieldValue(box)).toBe("Phone calls feel easier before noon.");
    expect(box.attributes.dir).toBe("auto");
    await type(box, "  Phone calls are easier before 11.  ");
    await fire(find(view, "FORM", "Change the words"), "submit");

    expect(calls.at(-1)).toEqual({
      name: "memory:update",
      args: { memoryId: "m1", content: "Phone calls are easier before 11." },
    });
    expect(findAll(view, "TEXTAREA")).toHaveLength(0);
    expect(view.textContent).toContain("Memory updated");
    expect(view.textContent).toContain("You can undo for");

    await click(view, "Undo");
    expect(calls.at(-1)).toEqual({
      name: "memory:update",
      args: { memoryId: "m1", content: "Phone calls feel easier before noon." },
    });
  });

  test("edit refuses an empty memory, Escape cancels, and a failed save keeps the box with a kind note", async () => {
    const view = await renderUi();
    await click(view, "Edit");
    let box = find(view, "TEXTAREA");
    await type(box, "   ");
    await fire(find(view, "FORM", "Change the words"), "submit");
    expect(view.textContent).toContain("Write something to remember first.");
    expect(box.attributes["aria-invalid"]).toBe("true");
    expect(calls).toHaveLength(0);

    await type(box, "x".repeat(2001));
    await fire(find(view, "FORM", "Change the words"), "submit");
    expect(view.textContent).toContain("Keep a memory to 2,000 characters or fewer.");
    expect(calls).toHaveLength(0);

    // Same reason as type(): react-dom's keydown path expects a real focused field here.
    const onKeyDown = reactProps(box).onKeyDown as (event: unknown) => void;
    await act(async () => {
      onKeyDown({ key: "Escape", preventDefault() {} });
    });
    expect(findAll(view, "TEXTAREA")).toHaveLength(0);

    failing.add("memory:update");
    await click(view, "Edit");
    box = find(view, "TEXTAREA");
    await type(box, "New words");
    await fire(find(view, "FORM", "Change the words"), "submit");
    expect(fieldValue(find(view, "TEXTAREA"))).toBe("New words");
    expect(view.textContent).toContain("That change didn't save. Your memory is as it was.");
  });

  test("forget hides the row at once and Undo for 5 minutes restores it", async () => {
    const view = await renderUi();
    await click(view, "Forget", 1);
    expect(calls.at(-1)).toEqual({ name: "memory:forget", args: { memoryId: "m2" } });
    expect(facts(view)).not.toContain("Dana is my manager. Yoni is my brother.");
    expect(view.textContent).toContain("Forgotten");
    expect(view.textContent).toContain("5:00");

    await click(view, "Undo");
    expect(calls.at(-1)).toEqual({ name: "memory:restore", args: { memoryId: "m2" } });
    expect(facts(view)).toContain("Dana is my manager. Yoni is my brother.");
  });

  test("forget everything asks first; Keep my memories changes nothing, confirming forgets with Undo", async () => {
    const view = await renderUi();
    await click(view, "Forget everything");
    const sheet = find(view, "SECTION", "Forget everything Tempo remembers?");
    expect(sheet.attributes.role).toBe("alertdialog");
    await click(view, "Keep my memories");
    expect(calls).toHaveLength(0);
    expect(findAll(view, "SECTION", "Forget everything Tempo remembers?")).toHaveLength(0);

    await click(view, "Forget everything");
    const confirm = findAll(find(view, "SECTION", "Forget everything Tempo remembers?"), "BUTTON", "Forget everything");
    await act(async () => {
      confirm.at(-1)?.click();
    });
    expect(calls.at(-1)).toEqual({ name: "memory:forgetAll", args: {} });
    expect(view.textContent).toContain("Everything is forgotten");
    await click(view, "Undo");
    expect(calls.at(-1)).toEqual({ name: "memory:restoreAll", args: { forgottenAt: 42 } });
  });

  test("a long memory shows its first lines and a Show all button", async () => {
    memories = [{ _id: "long", content: LONG, createdAt: NOW }];
    const view = await renderUi();
    const more = find(view, "BUTTON", "Show all");
    expect(more.attributes["aria-expanded"]).toBe("false");
    expect(findAll(view, "SPAN").some((n) => n.className.includes("mm-fact__text--clamped"))).toBe(true);
    await click(view, "Show all");
    expect(find(view, "BUTTON", "Show less").attributes["aria-expanded"]).toBe("true");
  });

  test("empty: a kind sentence and the import link, no list", async () => {
    memories = [];
    const view = await renderUi();
    expect(view.textContent).toContain("Tempo doesn't remember anything yet.");
    expect(find(view, "A", "Import from ChatGPT or Claude").href).toBe("/settings/memory/import");
    expect(findAll(view, "UL")).toHaveLength(0);
    expect(view.textContent).not.toContain("Forget everything");
  });

  test("error: says nothing was forgotten and offers Retry", async () => {
    throwOnList = true;
    const origError = console.error;
    console.error = () => {};
    try {
      const view = await renderUi();
      expect(view.textContent).toContain("Couldn't load your memories.");
      expect(view.textContent).toContain("Nothing was forgotten.");
      expect(find(view, "BUTTON", "Retry")).toBeTruthy();
    } finally {
      console.error = origError;
    }
  });

  test("loading: skeleton rows with a label for screen readers", async () => {
    memories = undefined;
    const view = await renderUi();
    expect(view.textContent).toContain("Loading your memories");
    expect(facts(view)).toHaveLength(0);
  });
});
