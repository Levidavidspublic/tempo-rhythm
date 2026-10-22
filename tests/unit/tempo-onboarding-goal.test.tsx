/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom covers the same checks.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { act, createElement, type ReactElement } from "../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../apps/web/node_modules/react-dom/client";
import { getFunctionName } from "convex/server";
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

  focus() { this.ownerDocument.activeElement = this; }
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

const changedGlobals = ["window", "document", "HTMLElement", "Element", "Node", "HTMLIFrameElement", "navigator", "location", "getComputedStyle", "MutationObserver", "IS_REACT_ACT_ENVIRONMENT"];
const originalGlobals = new Map(changedGlobals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
afterAll(() => { for (const [key, descriptor] of originalGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
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
const createGoal = mock(async (_args: {title:string;description?:string}) => "fictional-goal");
const updateGoal = mock(async (_args: {goalId:string;title:string;description?:string}) => "fictional-goal");
let language: "en" | "he" = "en";

type Profile = { fullName?: string; greetingName: string; onboardedAt?: number } | null;

let profileResult: Profile | undefined;
let coachResult: { dial: number } | undefined;

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const webDir = new URL("../../apps/web/", import.meta.url).pathname;
const linkModule = Bun.resolveSync("next/link", webDir);
const navigationModule = Bun.resolveSync("next/navigation", webDir);
const convexModule = Bun.resolveSync("convex/react", webDir);
const localeModule = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const themeModule = Bun.resolveSync("@/components/providers/ThemeProvider", webDir);
const realModules: Record<string, Record<string, unknown>> = {};
for (const path of [linkModule, navigationModule, convexModule, localeModule, themeModule]) realModules[path] = { ...(await import(path)) };

afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

mock.module(linkModule, () => ({default: ({children,...props}: {children?: ReactElement}) => createElement("a", props, children)}));

mock.module(navigationModule, () => ({
  useRouter: () => ({ push, replace }),
}));

const MUTATIONS: Record<string, unknown> = {
  "users:completeOnboarding": completeOnboarding,
  "coach:setDial": setDial,
  "notes:create": createNote,
  "notes:update": updateNote,
  "preferences:update": updatePreferences,
  "goals:create": createGoal,
  "goals:update": updateGoal,
};

mock.module(convexModule, () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    return getFunctionName(ref) === "coach:getSettings" ? coachResult : profileResult;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => MUTATIONS[getFunctionName(ref)],
}));

mock.module(localeModule, () => ({
  useLocale: () => ({ lang: language, dir: language === "he" ? "rtl" : "ltr", setLang, t: (key: MessageKey) => translate(language, key) }),
}));

mock.module(themeModule, () => ({
  useTheme: () => ({ theme: "system", resolvedTheme: "light", setTheme() {}, dyslexia: false, setDyslexia }),
}));

const { OnboardingFlow } = await import("../../apps/web/components/onboarding/OnboardingFlow");

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
    root?.render(createElement(OnboardingFlow) as ReactElement);
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

function findById(view: TestNode, id: string): TestNode {
  let found: TestNode | undefined;
  walk(view, node => { if (node.id === id) found = node; });
  if (!found) throw new Error(`Missing field ${id}`);
  return found;
}
async function openGoalStep() {
  const view = await renderFlow();
  for (let index = 0; index < 3; index++) await click(view, translate(language, "set.onb.next"));
  return view;
}
function deferred() {
  let resolve!: (id: string) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("optional onboarding goal", () => {
  beforeEach(() => {
    language = "en";
    profileResult = { greetingName: "Fictional reader" };
    coachResult = { dial: 4 };
    for (const fn of [push, replace, completeOnboarding, setDial, createNote, updateNote, updatePreferences, setLang, setDyslexia, createGoal, updateGoal]) fn.mockClear();
    createGoal.mockImplementation(async () => "fictional-goal");
    updateGoal.mockImplementation(async () => "fictional-goal");
    completeOnboarding.mockImplementation(async () => ({ onboardedAt: 1 }));
  });
  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null; host = null;
  });

  test("mount and blank or whitespace title never create a goal", async () => {
    const view = await openGoalStep();
    expect(findByTag(view, "BUTTON", "Add goal").disabled).toBe(true);
    await change(findById(view, "ob-goal-title"), "   ");
    expect(findByTag(view, "BUTTON", "Add goal").disabled).toBe(true);
    expect(createGoal).not.toHaveBeenCalled();
    expect(createNote).not.toHaveBeenCalled();
  });

  test("explicit Add goal submits only trimmed title and description", async () => {
    const view = await openGoalStep();
    await change(findById(view, "ob-goal-title"), "  Learn piano  ");
    await change(findById(view, "ob-goal-description"), "  A short piece  ");
    expect(createGoal).not.toHaveBeenCalled();
    await click(view, "Add goal");
    expect(createGoal).toHaveBeenCalledTimes(1);
    expect(createGoal).toHaveBeenCalledWith({title:"Learn piano",description:"A short piece"});
    expect(view.textContent).toContain("Saved. You can edit this goal in Goals after setup.");
    expect(findByTag(view,"A","Open Goals").getAttribute("href")).toBe("/goals");
    expect(createNote).not.toHaveBeenCalled();
  });

  test("an empty optional description is omitted on create", async () => {
    const view = await openGoalStep();
    await change(findById(view, "ob-goal-title"), "Read a chapter");
    await change(findById(view, "ob-goal-description"), "  ");
    await click(view, "Add goal");
    expect(createGoal).toHaveBeenCalledWith({title:"Read a chapter"});
  });

  test("two immediate clicks share one pending mutation", async () => {
    const pending = deferred(); createGoal.mockImplementation(() => pending.promise);
    const view = await openGoalStep();
    await change(findById(view, "ob-goal-title"), "Make a sketch");
    const save = reactProps(findByTag(view,"BUTTON","Add goal")).onClick as () => void;
    await act(async () => { save(); save(); });
    expect(createGoal).toHaveBeenCalledTimes(1);
    expect(findByTag(view,"BUTTON","Saving goal").disabled).toBe(true);
    expect(findById(view,"ob-goal-title").disabled).toBe(true);
    await act(async () => pending.resolve("fictional-goal"));
  });

  test("an unconfirmed create keeps the draft and never announces Saved", async () => {
    createGoal.mockImplementationOnce(async () => { throw new Error("synthetic rejection"); });
    const view = await openGoalStep();
    await change(findById(view,"ob-goal-title"), "Visit a museum");
    await change(findById(view,"ob-goal-description"), "On a quiet afternoon");
    await click(view,"Add goal");
    expect(findById(view,"ob-goal-title").value).toBe("Visit a museum");
    expect(findById(view,"ob-goal-description").value).toBe("On a quiet afternoon");
    expect(view.textContent).toContain("We couldn't confirm this save.");
    expect(view.textContent).not.toContain("Saved.");
    expect(findById(view,"ob-goal-title").getAttribute("aria-describedby")).toContain("ob-goal-error");
    await click(view,"Add goal");
    expect(createGoal).toHaveBeenCalledTimes(2);
  });

  test("editing a successful goal updates that ID and can clear its description", async () => {
    const view = await openGoalStep();
    await change(findById(view,"ob-goal-title"),"Read");
    await change(findById(view,"ob-goal-description"),"One chapter");
    await click(view,"Add goal");
    expect(findByTag(view,"BUTTON","Save goal changes").disabled).toBe(true);
    await change(findById(view,"ob-goal-title")," Read a short book ");
    await change(findById(view,"ob-goal-description"),"");
    await click(view,"Save goal changes");
    expect(updateGoal).toHaveBeenCalledWith({goalId:"fictional-goal",title:"Read a short book",description:""});
    expect(createGoal).toHaveBeenCalledTimes(1);
  });

  test("Skip creates neither a drafted goal nor a drafted brain-dump page", async () => {
    const view = await openGoalStep();
    await change(findById(view,"ob-goal-title"),"Maybe later");
    await change(findById(view,"ob-dump"),"Fictional loose thoughts");
    await click(view,"Skip");
    expect(view.textContent).toContain("Your privacy");
    expect(createGoal).not.toHaveBeenCalled(); expect(createNote).not.toHaveBeenCalled();
  });

  test("Finish never creates an unsaved goal", async () => {
    const view = await openGoalStep();
    await change(findById(view,"ob-goal-title"),"A draft only");
    await click(view,"Continue"); await click(view,"Start using Tempo");
    expect(createGoal).not.toHaveBeenCalled(); expect(updateGoal).not.toHaveBeenCalled();
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });

  test("Back and Continue retain the successful goal ID and draft", async () => {
    const view = await openGoalStep();
    await change(findById(view,"ob-goal-title"),"Play piano"); await click(view,"Add goal");
    await click(view,"Back"); await click(view,"Continue");
    expect(findById(view,"ob-goal-title").value).toBe("Play piano");
    await change(findById(view,"ob-goal-title"),"Play two songs"); await click(view,"Save goal changes");
    expect(createGoal).toHaveBeenCalledTimes(1);
    expect(updateGoal).toHaveBeenCalledWith({goalId:"fictional-goal",title:"Play two songs",description:""});
  });

  test("a pending request survives step unmount without a duplicate submission", async () => {
    const pending=deferred(); createGoal.mockImplementation(() => pending.promise);
    const view=await openGoalStep();
    await change(findById(view,"ob-goal-title"),"Make a small garden"); await click(view,"Add goal");
    await click(view,"Back"); await click(view,"Continue");
    expect(findByTag(view,"BUTTON","Saving goal").disabled).toBe(true);
    expect(createGoal).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve("fictional-goal"));
    expect(view.textContent).toContain("Saved.");
    await change(findById(view,"ob-goal-title"),"Plant herbs"); await click(view,"Save goal changes");
    expect(updateGoal).toHaveBeenCalledWith({goalId:"fictional-goal",title:"Plant herbs",description:""});
  });

  test("an update rejection preserves the saved identity for a deliberate retry", async () => {
    const view=await openGoalStep();
    await change(findById(view,"ob-goal-title"),"Learn"); await click(view,"Add goal");
    updateGoal.mockImplementationOnce(async () => { throw new Error("synthetic rejection"); });
    await change(findById(view,"ob-goal-title"),"Learn a song"); await click(view,"Save goal changes");
    expect(view.textContent).toContain("We couldn't confirm this save.");
    await click(view,"Continue"); await click(view,"Back");
    expect(updateGoal).toHaveBeenCalledTimes(1);
    await click(view,"Save goal changes");
    expect(updateGoal).toHaveBeenCalledTimes(2); expect(createGoal).toHaveBeenCalledTimes(1);
  });

  test("the existing brain dump still creates and updates one note independently", async () => {
    const view=await openGoalStep();
    expect(findByTag(view,"TEXTAREA").id).toBe("ob-dump");
    await change(findById(view,"ob-goal-title"),"An unsaved goal");
    await change(findById(view,"ob-dump"),"First note"); await click(view,"Continue"); await click(view,"Back");
    await change(findById(view,"ob-dump"),"Edited note"); await click(view,"Continue");
    expect(createNote).toHaveBeenCalledTimes(1);
    expect(createNote).toHaveBeenCalledWith({title:"Brain dump",body:"First note"});
    expect(updateNote).toHaveBeenCalledWith({noteId:"note-1",body:"Edited note"});
    expect(createGoal).not.toHaveBeenCalled();
  });

  test("English fields have labels and the explicit keyboard action is a normal button", async () => {
    const view=await openGoalStep();
    const title=findById(view,"ob-goal-title"); title.focus();
    expect(documentNode.activeElement).toBe(title);
    expect(findByTag(view,"LABEL","Goal").getAttribute("for")).toBe("ob-goal-title");
    expect(reactProps(findByTag(view,"BUTTON","Add goal")).type).toBe("button");
    expect(reactProps(title).dir).toBe("auto");
    expect(reactProps(title).style).toEqual({minBlockSize:"var(--tp-touch)"});
  });

  test("Hebrew uses RTL copy while entered text keeps automatic direction", async () => {
    language="he";
    const view=await openGoalStep();
    expect(view.textContent).toContain("מטרה, אם רוצים");
    let panel:TestNode|undefined;walk(view,node=>{if(node.getAttribute("data-component")==="OnboardingGoal")panel=node;});
    expect(panel?.getAttribute("dir")).toBe("rtl");
    expect(findByTag(view,"BUTTON","הוספת מטרה").disabled).toBe(true);
    await change(findById(view,"ob-goal-title"),"ללמוד שיר"); await click(view,"הוספת מטרה");
    expect(createGoal).toHaveBeenCalledWith({title:"ללמוד שיר"});
    expect(view.textContent).toContain("נשמר.");
    expect(reactProps(findById(view,"ob-goal-title")).dir).toBe("auto");
  });
});
