/**
 * Vitest and Testing Library are not dependencies in this repo. bun:test plus react-dom renders
 * /coach's "Today's plan" card in English and Hebrew and clicks through it: every label comes
 * from the cp.* copy, and a Hebrew render has no English label left besides the tasks' own
 * titles (which stay as written, in dir="auto"). The card shows no clock time or date.
 */
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { anyApi, componentsGeneric, getFunctionName } from "convex/server";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TEN_SECOND_ACTIONS } from "@/convex/lib/coachLoad";
import { type Lang, MESSAGES, type MessageKey, translate } from "@/lib/i18n";

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
  type = "";
  nodeValue: string | null = null;
  defaultView: unknown = globalThis;
  activeElement: TestNode | null = null;
  body: TestNode | null = null;
  documentElement: TestNode | null = null;
  tagName: string;
  private listeners: Record<string, Listener[]> = {};

  constructor(
    public nodeName: string,
    owner: TestNode | null
  ) {
    this.tagName = nodeName;
    this.ownerDocument = owner ?? this;
  }

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
    if (name === "disabled") this.disabled = true;
  }

  getAttribute(name: string) {
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

// ---- Fixtures and mocks -------------------------------------------------------------------

type ProposalTask = { taskId: string; title: string; minutes: number };
type Proposal = {
  _id: string;
  status: "pending";
  tasks: ProposalTask[];
  tenSecondAction: string;
  realism: { ok: boolean; totalMinutes: number; availableMinutes: number; note: string };
  createdAt: number;
};
type Decision = { status: "accepted" | "rejected"; taskLoad: number };

/** The person's own words, never translated. */
const TITLES = ["Reply to Sam", "Book dentist"];
const TASKS: ProposalTask[] = [
  { taskId: "task-a", title: "Reply to Sam", minutes: 10 },
  { taskId: "task-b", title: "Book dentist", minutes: 4.6 },
];
const WATER = TEN_SECOND_ACTIONS[1] as string;
/** The server's own English realism note; the card never shows it. */
const SERVER_NOTE = "Server note that the card never shows.";

function proposal(over: Partial<Proposal> = {}): Proposal {
  return {
    _id: "proposal-1",
    status: "pending",
    tasks: TASKS,
    tenSecondAction: WATER,
    realism: { ok: true, totalMinutes: 15, availableMinutes: 240, note: SERVER_NOTE },
    createdAt: new Date(2026, 9, 16, 9, 0).getTime(),
    ...over,
  };
}

let lang: Lang = "en";
let auth = { isAuthenticated: true, isLoading: false };
let current: Proposal | null | undefined = proposal();
let isBadDay = false;
let openTasks: { status: "todo" | "in_progress" | "done" }[] | undefined = [{ status: "todo" }];

const createProposal = mock(async (_args: Record<string, never>) => "proposal-1");
const decideProposal = mock(
  async (_args: { proposalId: string; decision: "accept" | "reject" }): Promise<Decision> => ({
    status: "accepted",
    taskLoad: 3,
  })
);

// bun's mock.module is process-wide and outlives this file. Load the real modules first, so
// files that run later can still import every export, and put them back after this file.
const realModules = {
  "@/convex/_generated/api": { ...(await import("@/convex/_generated/api")) },
  "convex/react": { ...(await import("convex/react")) },
  "@/components/providers/LocaleProvider": { ...(await import("@/components/providers/LocaleProvider")) },
};
afterAll(() => {
  for (const [key, real] of Object.entries(realModules)) mock.module(key, () => real);
});

// The same api as convex/_generated/api.js, so a partial api mock left by another test file
// in the same bun process cannot hide these functions.
mock.module("@/convex/_generated/api", () => ({
  api: anyApi,
  internal: anyApi,
  components: componentsGeneric(),
}));

mock.module("convex/react", () => ({
  useConvexAuth: () => auth,
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    if (args === "skip") return undefined;
    switch (getFunctionName(ref)) {
      case "coach:getSettings":
        return { dial: 5, taskLoad: 2, panicUntil: null, acceptedStreak: 0 };
      case "coach:badDay":
        return { isBadDay, reason: isBadDay ? "panic" : null, suggestedLoad: 2 };
      case "coach:currentProposal":
        return current;
      case "tasks:list":
        return openTasks;
      default:
        return undefined;
    }
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref) === "coach:createProposal" ? createProposal : decideProposal,
}));

mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    setLang() {},
    t: (key: MessageKey) => translate(lang, key),
  }),
}));

const { CoachProposalCard } = await import("./CoachProposalCard");

// ---- Render helpers -----------------------------------------------------------------------

const mounted: { root: Root; host: TestNode }[] = [];

async function render(nextLang: Lang): Promise<TestNode> {
  lang = nextLang;
  const host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  mounted.push({ root, host });
  await act(async () => {
    root.render(createElement(CoachProposalCard) as ReactElement);
  });
  return host;
}

function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function findAll(view: TestNode, match: (node: TestNode) => boolean): TestNode[] {
  const found: TestNode[] = [];
  walk(view, (node) => {
    if (node.nodeType === 1 && match(node)) found.push(node);
  });
  return found;
}

function buttons(view: TestNode): string[] {
  return findAll(view, (node) => node.tagName === "BUTTON").map((node) => node.textContent);
}

async function click(view: TestNode, label: string) {
  const button = findAll(view, (n) => n.tagName === "BUTTON" && n.textContent === label)[0];
  if (!button) throw new Error(`Missing button: ${label} (have: ${buttons(view).join(", ")})`);
  await act(async () => {
    button.click();
  });
}

/** Everything a person reads or hears: text plus aria-label values. */
function readable(view: TestNode): string {
  const parts: string[] = [];
  walk(view, (node) => {
    if (node.nodeType === 3) parts.push(node.nodeValue ?? "");
    const label = node.nodeType === 1 ? node.getAttribute("aria-label") : null;
    if (label) parts.push(label);
  });
  return parts.join(" ");
}

/** What is left after removing the proposal's own text (the titles, and `extra`). */
function copyOnly(view: TestNode, extra: string[] = []): string {
  let text = readable(view);
  for (const own of [...TITLES, ...extra]) text = text.split(own).join(" ");
  return text;
}

/** Text of the elements marked dir="auto". */
function autoText(view: TestNode): string[] {
  return findAll(view, (node) => node.getAttribute("dir") === "auto").map((n) => n.textContent);
}

function he(key: MessageKey): string {
  return translate("he", key);
}

function cpKeys(): MessageKey[] {
  return (Object.keys(MESSAGES.en) as MessageKey[]).filter((key) => key.startsWith("cp."));
}

beforeEach(() => {
  lang = "en";
  auth = { isAuthenticated: true, isLoading: false };
  current = proposal();
  isBadDay = false;
  openTasks = [{ status: "todo" }];
  createProposal.mockReset();
  createProposal.mockImplementation(async () => "proposal-1");
  decideProposal.mockReset();
  decideProposal.mockImplementation(async () => ({ status: "accepted", taskLoad: 3 }));
});

afterEach(async () => {
  for (const { root, host } of mounted.splice(0)) {
    await act(async () => {
      root.unmount();
    });
    host.parentNode?.removeChild(host);
  }
});

// ---- Tests --------------------------------------------------------------------------------

describe("cp.* copy", () => {
  test("every key has its own Hebrew, with no Latin letters and the same placeholders", () => {
    const keys = cpKeys();
    expect(keys.length).toBeGreaterThanOrEqual(25);
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of keys) {
      const en = MESSAGES.en[key];
      const heText = MESSAGES.he[key];
      expect(heText.length).toBeGreaterThan(0);
      expect(heText).not.toBe(en);
      expect(placeholders(heText)).toEqual(placeholders(en));
      expect(heText.replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
    }
  });

  test("every 10-second action the server can pick has a cp.action key, word for word", () => {
    const actionKeys = cpKeys().filter((key) => key.startsWith("cp.action."));
    expect(actionKeys.length).toBe(TEN_SECOND_ACTIONS.length);
    for (const action of TEN_SECOND_ACTIONS) {
      expect(actionKeys.some((key) => MESSAGES.en[key] === action)).toBe(true);
    }
  });
});

describe("CoachProposalCard", () => {
  test("English: the plan keeps its words, and the titles stay as written", async () => {
    const view = await render("en");
    const text = readable(view);
    expect(text).toContain("Your plan for today");
    expect(text).toContain("Today: 2 tasks");
    expect(text).toContain("(10 min)");
    expect(text).toContain("(5 min)");
    expect(text).toContain("First, a 10-second action");
    expect(text).toContain("Stand up and drink a sip of water.");
    expect(text).toContain("This fits the time you have.");
    expect(text).not.toContain("Rough day?");
    expect(text).not.toContain(SERVER_NOTE);
    expect(buttons(view)).toEqual(["Accept", "Not today"]);
    expect(autoText(view)).toEqual(TITLES);
    const heading = findAll(view, (n) => n.id === "coach-proposal-heading")[0];
    expect(heading?.textContent).toBe("Your plan for today");
  });

  test("Hebrew: the plan has no English label besides the task titles", async () => {
    isBadDay = true;
    current = proposal({
      realism: { ok: false, totalMinutes: 300, availableMinutes: 90, note: SERVER_NOTE },
    });
    const view = await render("he");
    const text = readable(view);
    expect(text).toContain(he("cp.heading"));
    expect(text).toContain(he("cp.badDay"));
    expect(text).toContain("יום קל יותר: 2 משימות");
    expect(text).toContain("(10 דק׳)");
    expect(text).toContain("(5 דק׳)");
    expect(text).toContain(he("cp.firstAction"));
    expect(text).toContain(he("cp.action.water"));
    expect(text).toContain(he("cp.realism.tooMuch"));
    expect(buttons(view)).toEqual([he("cp.accept"), he("cp.notToday")]);
    expect(autoText(view)).toEqual(TITLES);
    expect(copyOnly(view)).not.toMatch(/[A-Za-z]/);

    isBadDay = false;
    current = proposal({ tasks: [TASKS[0] as ProposalTask] });
    const one = await render("he");
    expect(readable(one)).toContain("היום: משימה אחת");
    expect(readable(one)).toContain(he("cp.realism.ok"));
    expect(copyOnly(one)).not.toMatch(/[A-Za-z]/);
    expect(readable(await render("en"))).toContain("Today: 1 task");
  });

  test("an action the card has no copy for stays as written, in dir=auto", async () => {
    const own = "Look out of the window for ten seconds.";
    current = proposal({ tenSecondAction: own });
    const view = await render("he");
    expect(autoText(view)).toEqual([...TITLES, own]);
    expect(copyOnly(view, [own])).not.toMatch(/[A-Za-z]/);
  });

  test("loading reads in Hebrew, label and all", async () => {
    auth = { isAuthenticated: false, isLoading: true };
    const en = await render("en");
    const busy = findAll(en, (n) => n.getAttribute("aria-busy") === "true")[0];
    expect(busy?.getAttribute("aria-label")).toBe("Plan my day");
    expect(readable(en)).toContain("Loading your plan.");

    auth = { isAuthenticated: true, isLoading: false };
    current = undefined;
    const view = await render("he");
    const heBusy = findAll(view, (n) => n.getAttribute("aria-busy") === "true")[0];
    expect(heBusy?.getAttribute("aria-label")).toBe(he("cp.plan"));
    expect(readable(view)).toContain(he("cp.loading"));
    expect(copyOnly(view)).not.toMatch(/[A-Za-z]/);
  });

  test("no plan yet: Plan my day, and with no open task it says so without asking the server", async () => {
    current = null;
    openTasks = [{ status: "done" }];
    const en = await render("en");
    expect(findAll(en, (n) => n.id === "coach-proposal-heading")[0]?.textContent).toBe(
      "Today’s plan"
    );
    await click(en, "Plan my day");
    expect(readable(en)).toContain("Nothing to plan yet. Add a task or do a brain dump.");

    const view = await render("he");
    expect(readable(view)).toContain(he("cp.title"));
    await click(view, he("cp.plan"));
    expect(readable(view)).toContain(he("cp.empty"));
    expect(copyOnly(view)).not.toMatch(/[A-Za-z]/);
    expect(createProposal).not.toHaveBeenCalled();
  });

  test("a failed plan shows the error copy, never the server's words, and offers Try again", async () => {
    current = null;
    const serverText = "No open tasks to plan yet. Add one and come back.";
    createProposal.mockImplementation(async () => {
      throw new Error(serverText);
    });
    const en = await render("en");
    await click(en, "Plan my day");
    const alert = findAll(en, (n) => n.getAttribute("role") === "alert")[0];
    expect(alert?.textContent).toBe("That didn't work. Try again?");
    expect(buttons(en)).toEqual(["Try again"]);
    expect(readable(en)).not.toContain(serverText);

    const view = await render("he");
    await click(view, he("cp.plan"));
    const heAlert = findAll(view, (n) => n.getAttribute("role") === "alert")[0];
    expect(heAlert?.textContent).toBe(he("cp.error"));
    expect(buttons(view)).toEqual([he("cp.retry")]);
    expect(copyOnly(view)).not.toMatch(/[A-Za-z]/);
    expect(createProposal).toHaveBeenCalledTimes(2);
  });

  test("Accept and Not today answer in the app language, with the next load", async () => {
    const decide = (status: Decision["status"], taskLoad: number) => async () => {
      current = null;
      return { status, taskLoad };
    };

    decideProposal.mockImplementation(decide("accepted", 3));
    const en = await render("en");
    await click(en, "Accept");
    expect(readable(en)).toContain("Plan accepted. You can start with the first one.");
    expect(readable(en)).toContain("Next time: 3 tasks");
    expect(decideProposal.mock.calls[0]?.[0]).toEqual({
      proposalId: "proposal-1",
      decision: "accept",
    });

    current = proposal();
    const accepted = await render("he");
    await click(accepted, he("cp.accept"));
    expect(readable(accepted)).toContain(he("cp.title"));
    expect(readable(accepted)).toContain(he("cp.accepted"));
    expect(readable(accepted)).toContain("בפעם הבאה: 3 משימות");
    expect(buttons(accepted)).toEqual([he("cp.plan")]);
    expect(copyOnly(accepted)).not.toMatch(/[A-Za-z]/);

    decideProposal.mockImplementation(decide("rejected", 1));
    current = proposal();
    const rejectedEn = await render("en");
    await click(rejectedEn, "Not today");
    expect(readable(rejectedEn)).toContain("No problem. We can try again whenever.");
    expect(readable(rejectedEn)).toContain("Next time: 1 task");

    current = proposal();
    const rejected = await render("he");
    await click(rejected, he("cp.notToday"));
    expect(readable(rejected)).toContain(he("cp.rejected"));
    expect(readable(rejected)).toContain(he("cp.next.one"));
    expect(copyOnly(rejected)).not.toMatch(/[A-Za-z]/);
    expect(decideProposal.mock.calls.at(-1)?.[0]).toEqual({
      proposalId: "proposal-1",
      decision: "reject",
    });
  });

  test("a plan with no open tasks left offers only Not today", async () => {
    current = proposal({ tasks: [] });
    const en = await render("en");
    expect(readable(en)).toContain("Your plan for today");
    expect(readable(en)).toContain("Nothing to plan yet. Add a task or do a brain dump.");
    expect(buttons(en)).toEqual(["Not today"]);

    const view = await render("he");
    expect(readable(view)).toContain(he("cp.heading"));
    expect(readable(view)).toContain(he("cp.empty"));
    expect(buttons(view)).toEqual([he("cp.notToday")]);
    expect(copyOnly(view)).not.toMatch(/[A-Za-z]/);
  });
});
