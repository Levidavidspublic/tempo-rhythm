/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks.
 */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { getFunctionName } from "convex/server";
import { act, createElement, forwardRef, type ReactElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";

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

  get options(): TestNode[] {
    const opts: TestNode[] = [];
    const visit = (node: TestNode) => {
      if (node.tagName === "OPTION") opts.push(node);
      for (const child of node.childNodes) visit(child);
    };
    for (const child of this.childNodes) visit(child);
    return opts;
  }

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
    if (name === "value") this.value = String(value);
    if (name === "disabled") this.disabled = true;
    if (name === "type") this.type = String(value);
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
  // React feature-detects the input event with `"oninput" in document` when react-dom loads.
  (documentNode as unknown as Record<string, unknown>).oninput = null;
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
  globals.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
  return documentNode;
}

const documentNode = installTestDom();
// react-dom reads the DOM when it loads, so it is imported after the test DOM exists.
const { createRoot } = await import("react-dom/client");

const push = mock((_href: string) => {});

type Draft = {
  name: string;
  description?: string;
  periodType: "daily" | "weekly" | "monthly" | "none";
  body: string;
};

const createTemplate = mock(async (_args: Draft) => "templates_new");
const updateTemplate = mock(async (_args: Draft & { templateId: string }) => "templates_1");
const removeTemplate = mock(async (_args: { templateId: string }) => null);

type TemplateFixture = {
  templateId: string;
  source: "starter" | "user";
  name: string;
  description?: string;
  periodType: "daily" | "weekly" | "monthly" | "none";
  sections: string[];
  body: string;
};

let templateResult: TemplateFixture | null | undefined;

mock.module("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

mock.module("next/link", () => ({
  default: ({ href, children, ref: _ref, ...props }: { href: string; children?: ReactNode; ref?: unknown }) =>
    createElement("a", { href, ...props }, children),
}));

const MUTATIONS: Record<string, unknown> = {
  "templates:create": createTemplate,
  "templates:update": updateTemplate,
  "templates:remove": removeTemplate,
};

mock.module("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(ref) === "templates:get" ? templateResult : undefined;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => MUTATIONS[getFunctionName(ref)],
}));

// CodeMirror needs a real DOM; the body editor stands in as a textarea with the same props.
mock.module("@/components/editor/LivePreviewEditor", () => ({
  LivePreviewEditor: forwardRef(function FakeEditor(
    props: { initialValue: string; ariaLabel: string; onChange: (body: string) => void },
    _ref,
  ) {
    return createElement("textarea", {
      id: "fake-editor",
      "aria-label": props.ariaLabel,
      defaultValue: props.initialValue,
      onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
    });
  }),
}));
mock.module("@/components/editor/live-preview", () => ({ focusTaskTitleWhenDrawn: () => undefined }));

// The screens read their copy from the locale context; English, as the app's default.
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));
mock.module("@/components/providers/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme() {}, dyslexia: false, setDyslexia() {} }),
}));

const { TemplateBuilderScreen } = await import("./TemplateBuilder");
const { TemplateEditorScreen } = await import("./TemplateEditor");
const { TemplateSketch } = await import("./TemplateSketch");

const dailyTemplate: TemplateFixture = {
  templateId: "starter:daily-page",
  source: "starter",
  name: "Daily page",
  description: "A short outline for one day.",
  periodType: "daily",
  sections: ["Intention", "Schedule", "Notes"],
  body: "# Today\n\n## Intention\nOne line for what would make today feel complete.\n\n- [ ] Morning\n",
};

const userTemplate: TemplateFixture = {
  templateId: "jd7userdaily",
  source: "user",
  name: "My daily",
  description: "Personal",
  periodType: "weekly",
  sections: ["Focus", "Later"],
  body: "## Focus\nOne thing.\n## Later\n- [ ] Call\n",
};

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function findButton(root: TestNode, label: string): TestNode {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (node.tagName === "BUTTON" && (node.textContent.includes(label) || node.getAttribute("aria-label")?.includes(label)))
      found.push(node);
  });
  const button = found[0];
  if (!button) throw new Error(`Missing button: ${label}`);
  return button;
}

function findById(root: TestNode, id: string): TestNode {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (node.id === id || node.getAttribute("id") === id) found.push(node);
  });
  const match = found[0];
  if (!match) throw new Error(`Missing #${id}`);
  return match;
}

function findForm(root: TestNode): TestNode {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (node.tagName === "FORM") found.push(node);
  });
  const form = found[0];
  if (!form) throw new Error("Missing form");
  return form;
}

async function typeInto(node: TestNode, value: string) {
  await act(async () => {
    node.value = value;
    node.dispatchEvent(new TestEvent("input", node));
  });
}

async function submit(form: TestNode) {
  await act(async () => {
    form.dispatchEvent(new TestEvent("submit", form));
  });
}

async function press(button: TestNode) {
  await act(async () => {
    button.click();
  });
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

beforeEach(() => {
  templateResult = undefined;
  push.mockReset();
  for (const fn of [createTemplate, updateTemplate, removeTemplate]) fn.mockClear();
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});

describe("TemplateBuilderScreen", () => {
  test("a blank template keeps Save off until it has a name, and shows the empty hint", async () => {
    const view = await renderNode((<TemplateBuilderScreen />) as ReactElement);
    expect(view.textContent).toContain("A blank template.");
    expect(findButton(view, "Save template").disabled).toBe(true);
    await typeInto(findById(view, "template-name"), "Evening page");
    expect(findButton(view, "Save template").disabled).toBe(false);
    await press(findButton(view, "Save template"));
    expect(createTemplate).toHaveBeenCalledWith({ name: "Evening page", periodType: "none", body: "" });
    expect(push).toHaveBeenCalledWith("/templates");
  });

  test("a copy of a starter saves as a new template and opens the library", async () => {
    templateResult = dailyTemplate;
    const view = await renderNode((<TemplateBuilderScreen fromId="starter:daily-page" />) as ReactElement);
    expect(view.textContent).toContain("A copy of Daily page");
    expect(findById(view, "template-name").value).toBe("Daily page");
    expect(view.textContent).not.toContain("# Today");
    await press(findButton(view, "Save template"));
    expect(createTemplate).toHaveBeenCalledWith({
      name: "Daily page",
      description: "A short outline for one day.",
      periodType: "daily",
      body: dailyTemplate.body,
    });
    expect(push).toHaveBeenCalledWith("/templates");
  });

  test("?id= edits your own template in place", async () => {
    templateResult = userTemplate;
    const view = await renderNode((<TemplateBuilderScreen editId="jd7userdaily" />) as ReactElement);
    expect(view.textContent).toContain("Saved");
    expect(findButton(view, "Save template").disabled).toBe(true);
    await typeInto(findById(view, "fake-editor"), "## Focus\nTwo things.\n");
    expect(view.textContent).toContain("Not saved yet");
    await press(findButton(view, "Save template"));
    expect(updateTemplate).toHaveBeenCalledWith({
      templateId: "jd7userdaily",
      name: "My daily",
      description: "Personal",
      periodType: "weekly",
      body: "## Focus\nTwo things.\n",
    });
    expect(view.textContent).toContain("Template saved. It shows in Templates.");
    expect(push).not.toHaveBeenCalled();
  });

  test("a sketch outline arrives as a new template", async () => {
    const view = await renderNode((<TemplateBuilderScreen outline={"Talk prep\nSlides (tasks)"} />) as ReactElement);
    expect(findById(view, "template-name").value).toBe("Talk prep");
    expect(view.textContent).toContain("From your sketch");
  });

  test("a missing template says so calmly", async () => {
    templateResult = null;
    const view = await renderNode((<TemplateBuilderScreen fromId="gone" />) as ReactElement);
    expect(view.textContent).toContain("Couldn't open this template.");
    expect(view.textContent).not.toContain("{");
  });
});

describe("TemplateEditorScreen", () => {
  test("a starter is read-only and offers a copy in the builder", async () => {
    templateResult = dailyTemplate;
    const view = await renderNode((<TemplateEditorScreen templateId="starter:daily-page" />) as ReactElement);
    expect(view.textContent).toContain("This starter is read-only");
    expect(findById(view, "ed-name").disabled).toBe(true);
    await press(findButton(view, "Make my own copy"));
    expect(push).toHaveBeenCalledWith("/templates/builder?from=starter%3Adaily-page");
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  test("sections move and save as Markdown, keeping the words under each heading", async () => {
    templateResult = userTemplate;
    const view = await renderNode((<TemplateEditorScreen templateId="jd7userdaily" />) as ReactElement);
    expect(view.textContent).toContain("Sections, in order");
    await press(findButton(view, "Move down: Focus"));
    await submit(findForm(view));
    expect(updateTemplate).toHaveBeenCalledWith({
      templateId: "jd7userdaily",
      name: "My daily",
      description: "Personal",
      periodType: "weekly",
      body: "## Later\n- [ ] Call\n## Focus\nOne thing.\n",
    });
    expect(view.textContent).toContain("Template saved");
  });

  test("Save with no name shows the summary and saves nothing", async () => {
    templateResult = userTemplate;
    const view = await renderNode((<TemplateEditorScreen templateId="jd7userdaily" />) as ReactElement);
    await typeInto(findById(view, "ed-name"), "  ");
    await submit(findForm(view));
    expect(view.textContent).toContain("One thing to fix before saving");
    expect(findById(view, "ed-name").getAttribute("aria-invalid")).toBe("true");
    expect(updateTemplate).not.toHaveBeenCalled();
  });

  test("removing a section offers Undo, which puts it back", async () => {
    templateResult = userTemplate;
    const view = await renderNode((<TemplateEditorScreen templateId="jd7userdaily" />) as ReactElement);
    await press(findButton(view, "Remove section: Focus"));
    expect(view.textContent).toContain("Section removed");
    expect(view.textContent).not.toContain("Move down: Focus");
    await press(findButton(view, "Undo"));
    findButton(view, "Move down: Focus");
  });
});

describe("TemplateSketch", () => {
  test("an outline becomes a proposal; nothing is saved until Accept, and Undo removes it", async () => {
    const view = await renderNode((<TemplateSketch />) as ReactElement);
    expect(view.textContent).toContain("Nothing sketched yet.");
    await submit(findForm(view));
    expect(view.textContent).toContain("Write at least one line first.");

    await typeInto(findById(view, "sk-outline"), "Talk prep\nThe one thing (question)\nSlides (tasks)\nDeck (tasks)");
    await submit(findForm(view));
    expect(view.textContent).toContain("1 question, 2 tasks");
    expect(createTemplate).not.toHaveBeenCalled();

    await press(findButton(view, "Accept"));
    expect(createTemplate).toHaveBeenCalledWith({
      name: "Talk prep",
      periodType: "none",
      body: "# Talk prep\n\n> The one thing\n\n- [ ] Slides\n- [ ] Deck\n",
    });
    expect(view.textContent).toContain("Saved to Templates.");

    await press(findButton(view, "Undo"));
    expect(removeTemplate).toHaveBeenCalledWith({ templateId: "templates_new" });
  });

  test("changing the outline after a proposal marks it out of date; Reject keeps the outline", async () => {
    const view = await renderNode((<TemplateSketch />) as ReactElement);
    await typeInto(findById(view, "sk-outline"), "Plan");
    await submit(findForm(view));
    await typeInto(findById(view, "sk-outline"), "Plan\nMore");
    expect(view.textContent).toContain("Out of date");
    await press(findButton(view, "Reject"));
    expect(view.textContent).toContain("Rejected. Your outline is still here.");
    expect(findById(view, "sk-outline").value).toBe("Plan\nMore");
  });
});
