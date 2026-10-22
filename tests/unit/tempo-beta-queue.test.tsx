import { resolveSync, spawn } from "bun";
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { join, resolve } from "node:path";
import type { Root } from "react-dom/client";
const fixtureRoot = resolve(import.meta.dir, "../..");
// Repository-owned dependency-free DOM pattern, isolated in a Bun child.
function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}
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
  key = "";
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

  focus() {
    this.ownerDocument.activeElement = this;
  }
  blur() {
    this.ownerDocument.activeElement = this.ownerDocument.body;
  }
  get isConnected(): boolean {
    return this.ownerDocument.contains(this);
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
  querySelector(selector: string): TestNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector: string): TestNode[] {
    const matches: TestNode[] = [];
    walk(this, (node) => {
      if (node === this) return;
      if (selector === "button" && node.tagName === "BUTTON") matches.push(node);
      if (
        selector === "button:not([disabled]), a[href]" &&
        ((node.tagName === "BUTTON" && !node.disabled) || (node.tagName === "A" && node.href))
      )
        matches.push(node);
    });
    return matches;
  }
  getElementById(id: string): TestNode | null {
    let found: TestNode | null = null;
    walk(this, (node) => {
      if (node.id === id) found = node;
    });
    return found;
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
  globals.location = {
    protocol: "https:",
    href: "https://tempo.invalid/settings/integrations",
    pathname: "/settings/integrations",
    search: "",
    hash: "",
    assign() {},
  };
  globals.addEventListener = () => {};
  globals.removeEventListener = () => {};
  globals.getComputedStyle = () => ({ getPropertyValue: () => "" });
  globals.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  return documentNode;
}

if (process.env.TEMPO_BETA_QUEUE_FIXTURE_CHILD !== "1") {
  test("Beta queue mounted behavior (isolated child)", async () => {
    const child = spawn([process.execPath, "--no-env-file", "test", import.meta.path], {
      cwd: fixtureRoot,
      env: { PATH: process.env.PATH, NODE_ENV: "test", TEMPO_BETA_QUEUE_FIXTURE_CHILD: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    try {
      const [code, out, errors] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      if (code !== 0) throw new Error(`Mounted beta queue exited ${code}\n${out}\n${errors}`);
      expect(errors).toContain("0 fail");
      expect(errors).toContain("21 pass");
    } finally {
      clearTimeout(timer);
    }
  }, 35_000);
} else {
  const documentNode = installTestDom();
  const { act, createElement } = (await import(
    resolveSync("react", join(fixtureRoot, "apps/web"))
  )) as typeof import("react");
  const { createRoot } = (await import(
    resolveSync("react-dom/client", join(fixtureRoot, "apps/web"))
  )) as typeof import("react-dom/client");
  const { en, he } = await import("../../apps/web/lib/i18n-groups/settings");
  type Lang = "en" | "he";
  type Status = "pending" | "approved" | "revoked";
  type Applicant = { id: string; email: string | null; name: string | null; requestedAt: number };
  type Page = { page: Applicant[]; isDone: boolean; continueCursor: string };
  type Account = {
    _id: string;
    email: string;
    isAdmin: boolean;
    status: Status;
    createdAt: number;
  };
  let lang: Lang = "en";
  let me: { isAdmin: boolean; email: string } | null | undefined;
  let accounts: Account[] | undefined;
  let pages: Map<string | null, Page | undefined>;
  let queueError = false;
  let root: Root | null = null;
  let host: TestNode;
  const calls: { userId: string; status: Status }[] = [];
  const queries: { ref: string; args: unknown }[] = [];
  let save: (args: { userId: string; status: Status }) => Promise<unknown> = async (args) => args;
  const setStatus = (args: { userId: string; status: Status }) => {
    calls.push(args);
    return save(args);
  };
  const t = (key: string) => (lang === "he" ? he : en)[key as keyof typeof en] ?? key;
  const applicant = (id: string): Applicant => ({
    id,
    email: `${id}@example.invalid`,
    name: `Sample ${id}`,
    requestedAt: 1_800_000_000_000,
  });
  const page = (items: Applicant[], isDone = true, continueCursor = "end"): Page => ({
    page: items,
    isDone,
    continueCursor,
  });
  mock.module("convex/react", () => ({
    useQuery: (ref: string, args: unknown) => {
      queries.push({ ref, args });
      if (ref === "me") return me;
      if (ref === "accounts") return accounts;
      if (queueError) throw new Error("FICTIONAL_QUEUE_DIAGNOSTIC");
      return pages.get((args as { cursor: string | null }).cursor);
    },
    useMutation: () => setStatus,
  }));
  mock.module("@/components/providers/LocaleProvider", () => ({
    useLocale: () => ({ lang, dir: lang === "he" ? "rtl" : "ltr", t }),
  }));
  mock.module("@/components/tempo/TpIcon", () => ({
    TpIcon: () => createElement("span", { "aria-hidden": true }),
  }));
  mock.module("@/convex/_generated/api", () => ({
    api: {
      approval: {
        myStatus: "me",
        listForAdmin: "accounts",
        listBetaRequests: "queue",
        setStatus: "setStatus",
      },
    },
  }));
  const controls = await import("../../apps/web/components/you/Controls");
  mock.module("@/components/you/Controls", () => controls);
  const { AdminApprovals } = await import("../../apps/web/components/approval/AdminApprovals");
  const elements = (tag: string) => {
    const found: TestNode[] = [];
    walk(host, (node) => {
      if (node.tagName === tag) found.push(node);
    });
    return found;
  };
  const button = (text: string) => {
    const found = elements("BUTTON").find((node) => node.textContent === text);
    if (!found) throw new Error(`Missing button ${text}`);
    return found;
  };
  const attr = (name: string, value: string) => {
    let found: TestNode | undefined;
    walk(host, (node) => {
      if (node.getAttribute(name) === value) found = node;
    });
    return found;
  };
  const queue = () => attr("data-testid", "beta-queue")!;
  const render = async () => {
    await act(async () =>
      root!.render(
        createElement("div", { dir: lang === "he" ? "rtl" : "ltr" }, createElement(AdminApprovals))
      )
    );
  };
  const click = async (node: TestNode) => {
    await act(async () => node.click());
  };
  const confirm = () => button(t("adminApproval.confirm"));
  beforeEach(() => {
    lang = "en";
    me = { isAdmin: true, email: "sample-admin@example.invalid" };
    accounts = [
      {
        _id: "ordinary",
        email: "ordinary@example.invalid",
        isAdmin: false,
        status: "pending",
        createdAt: 1,
      },
    ];
    pages = new Map([[null, page([applicant("beta-one")])]]);
    queueError = false;
    calls.length = 0;
    queries.length = 0;
    save = async (args) => args;
    host = documentNode.createElement("div");
    documentNode.body!.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    documentNode.body!.removeChild(host);
  });
  describe("mounted administrator beta queue", () => {
    test("loading access queries no applicant or account identities", async () => {
      me = undefined;
      await render();
      expect(host.textContent).toContain(t("adminApproval.loading"));
      expect(queries.every((query) => query.ref === "me")).toBe(true);
      expect(attr("data-testid", "beta-queue")).toBeUndefined();
    });
    test("non-admin never queries protected lists", async () => {
      me = { isAdmin: false, email: "sample-member@example.invalid" };
      await render();
      expect(host.textContent).toContain(t("adminApproval.adminOnly"));
      expect(queries.every((query) => query.ref === "me")).toBe(true);
      expect(calls).toEqual([]);
    });
    test("queue loading does not claim an empty queue", async () => {
      pages.set(null, undefined);
      await render();
      expect(queue().textContent).toContain(t("adminApproval.loadingQueue"));
      expect(queue().textContent).not.toContain(t("adminApproval.empty"));
    });
    test("empty is shown only for a completed initial page", async () => {
      pages.set(null, page([]));
      await render();
      expect(queue().textContent).toContain(t("adminApproval.empty"));
      expect(queue().querySelectorAll("button")).toHaveLength(0);
    });
    test("next request page uses the real bounded cursor contract and replaces identities", async () => {
      pages.set(null, page([applicant("beta-one")], false, "cursor-two"));
      pages.set("cursor-two", page([applicant("beta-two")]));
      await render();
      await click(button(t("adminApproval.next")));
      expect(queue().textContent).toContain("Sample beta-two");
      expect(queue().textContent).not.toContain("Sample beta-one");
      const queueArgs = queries.filter((query) => query.ref === "queue").map((query) => query.args);
      expect(queueArgs).toContainEqual({ cursor: null, numItems: 20 });
      expect(queueArgs).toContainEqual({ cursor: "cursor-two", numItems: 20 });
      await click(button(t("adminApproval.start")));
      expect(queue().textContent).toContain("Sample beta-one");
    });
    test("empty filtered continuation pages are followed until actual requests arrive", async () => {
      pages.set(null, page([], false, "filtered-one"));
      pages.set("filtered-one", page([], false, "filtered-two"));
      pages.set("filtered-two", page([applicant("beta-last")]));
      await render();
      expect(queue().textContent).toContain("Sample beta-last");
      expect(queue().textContent).not.toContain(t("adminApproval.empty"));
      expect(
        queries.filter((query) => query.ref === "queue").map((query) => query.args)
      ).toContainEqual({ cursor: "filtered-two", numItems: 20 });
    });
    test("final filtered page does not claim earlier skipped requests were processed", async () => {
      pages.set(null, page([applicant("beta-one")], false, "last"));
      pages.set("last", page([]));
      await render();
      await click(button(t("adminApproval.next")));
      expect(queue().textContent).toContain(t("adminApproval.endPage"));
      expect(queue().textContent).not.toContain(t("adminApproval.empty"));
    });
    test("auto-hop budget stops honestly and explicit Next continues", async () => {
      pages.set(null, page([], false, "cursor-1"));
      for (let i = 1; i <= 10; i++) pages.set(`cursor-${i}`, page([], false, `cursor-${i + 1}`));
      pages.set("cursor-11", page([applicant("beta-after-gap")]));
      await render();
      expect(queue().textContent).toContain(t("adminApproval.morePages"));
      expect(queue().textContent).not.toContain(t("adminApproval.empty"));
      expect(
        queries.filter((query) => query.ref === "queue").map((query) => query.args)
      ).not.toContainEqual({ cursor: "cursor-11", numItems: 20 });
      await click(button(t("adminApproval.next")));
      expect(queue().textContent).toContain("Sample beta-after-gap");
    });
    test("repeating cursor does not loop or claim completion", async () => {
      pages.set(null, page([], false, "repeat"));
      pages.set("repeat", page([], false, "repeat"));
      await render();
      expect(queue().textContent).toContain(t("adminApproval.cursorError"));
      expect(queue().textContent).not.toContain(t("adminApproval.empty"));
      expect(queries.filter((query) => query.ref === "queue").length).toBeLessThan(8);
    });
    test("beta approval requires confirmation describing Max free and uses only setStatus", async () => {
      await render();
      await click(button(t("adminApproval.approveBeta")));
      expect(calls).toEqual([]);
      expect(attr("role", "alertdialog")?.textContent).toContain("Max free");
      expect(attr("role", "alertdialog")?.textContent).toContain(
        "Existing paid or founder access stays unchanged"
      );
      await click(confirm());
      expect(calls).toEqual([{ userId: "beta-one", status: "approved" }]);
      // The client does not remove/grant locally; the actual query remains authoritative.
      expect(queue().textContent).toContain("Sample beta-one");
      expect(host.textContent).toContain(t("adminApproval.saved"));
    });
    test("pending mutation disables duplicate submission and page changes", async () => {
      pages.set(null, page([applicant("beta-one")], false, "next"));
      let release!: () => void;
      save = () =>
        new Promise((resolve) => {
          release = () => resolve({});
        });
      await render();
      await click(button(t("adminApproval.approveBeta")));
      await click(confirm());
      expect(button(t("adminApproval.saving")).disabled).toBe(true);
      expect(button(t("adminApproval.next")).disabled).toBe(true);
      await click(button(t("adminApproval.saving")));
      expect(calls).toHaveLength(1);
      await act(async () => release());
    });
    test("approval error keeps dialog and permits a scoped retry without exposing diagnostics", async () => {
      save = async () => {
        throw new Error("FICTIONAL_ADMIN_DIAGNOSTIC");
      };
      await render();
      await click(button(t("adminApproval.approveBeta")));
      await click(confirm());
      expect(attr("role", "alertdialog")).toBeDefined();
      expect(attr("role", "alert")?.textContent).toContain(t("adminApproval.saveError"));
      expect(host.textContent).not.toContain("FICTIONAL_ADMIN_DIAGNOSTIC");
      save = async (args) => args;
      await click(button(t("set.retry")));
      expect(calls).toEqual([
        { userId: "beta-one", status: "approved" },
        { userId: "beta-one", status: "approved" },
      ]);
      expect(attr("role", "alertdialog")).toBeUndefined();
    });
    test("changed request cannot be approved through an old confirmation", async () => {
      await render();
      await click(button(t("adminApproval.approveBeta")));
      pages.set(null, page([applicant("beta-two")]));
      await render();
      await click(confirm());
      expect(calls).toEqual([]);
      expect(attr("role", "alert")?.textContent).toContain(t("adminApproval.changed"));
      expect(queue().textContent).toContain("Sample beta-two");
    });
    test("late mutation completion from another admin cannot update the new account UI", async () => {
      let release!: () => void;
      save = () =>
        new Promise((resolve) => {
          release = () => resolve({});
        });
      await render();
      await click(button(t("adminApproval.approveBeta")));
      await click(confirm());
      me = { isAdmin: true, email: "sample-other-admin@example.invalid" };
      pages.set(null, page([applicant("beta-new-owner")]));
      await render();
      await act(async () => release());
      expect(queue().textContent).toContain("Sample beta-new-owner");
      expect(host.textContent).not.toContain(t("adminApproval.saved"));
      expect(attr("role", "alertdialog")).toBeUndefined();
      expect(button(t("adminApproval.approveBeta")).disabled).toBe(false);
      expect(calls).toEqual([{ userId: "beta-one", status: "approved" }]);
    });
    test("losing admin access unmounts identities and ignores pending failure", async () => {
      let reject!: (error: Error) => void;
      save = () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        });
      await render();
      await click(button(t("adminApproval.approveBeta")));
      await click(confirm());
      me = null;
      queries.length = 0;
      await render();
      await act(async () => reject(new Error("FICTIONAL_OLD_ACCOUNT_ERROR")));
      expect(host.textContent).toContain(t("adminApproval.adminOnly"));
      expect(host.textContent).not.toContain("Sample beta-one");
      expect(queries.every((query) => query.ref === "me")).toBe(true);
      expect(attr("role", "alert")).toBeUndefined();
    });
    test("pausing a beta applicant uses revoked and explains request removal", async () => {
      await render();
      const pause = queue()
        .querySelectorAll("button")
        .find((node) => node.textContent === t("adminApproval.revoke"))!;
      await click(pause);
      expect(attr("role", "alertdialog")?.textContent).toContain(t("adminApproval.revokeBody"));
      await click(confirm());
      expect(calls).toEqual([{ userId: "beta-one", status: "revoked" }]);
    });
    test("ordinary account management keeps approve, revoke and return-to-pending paths", async () => {
      accounts = [
        {
          _id: "ordinary",
          email: "ordinary@example.invalid",
          isAdmin: false,
          status: "revoked",
          createdAt: 1,
        },
      ];
      await render();
      await click(button(t("adminApproval.toPending")));
      await click(confirm());
      expect(calls).toEqual([{ userId: "ordinary", status: "pending" }]);
      await click(button(t("adminApproval.approve")));
      await click(confirm());
      expect(calls[1]).toEqual({ userId: "ordinary", status: "approved" });
      expect(
        elements("H2").some((node) => node.textContent === t("adminApproval.accountsTitle"))
      ).toBe(true);
    });
    test("administrator rows have no access-changing buttons", async () => {
      accounts = [
        {
          _id: "admin",
          email: "sample-admin@example.invalid",
          isAdmin: true,
          status: "approved",
          createdAt: 1,
        },
      ];
      await render();
      expect(
        elements("BUTTON").filter((node) =>
          node.getAttribute("aria-label")?.includes("sample-admin@example.invalid")
        )
      ).toHaveLength(0);
    });
    test("Escape cancels confirmation and restores keyboard focus", async () => {
      await render();
      const opener = button(t("adminApproval.approveBeta"));
      opener.focus();
      await click(opener);
      const cancel = button(t("adminApproval.cancel"));
      expect(documentNode.activeElement).toBe(cancel);
      const event = new TestEvent("keydown", cancel);
      event.key = "Escape";
      await act(async () => documentNode.dispatchEvent(event));
      expect(attr("role", "alertdialog")).toBeUndefined();
      expect(documentNode.activeElement).toBe(opener);
      expect(calls).toEqual([]);
    });
    test("Hebrew copy and RTL preserve one page heading without another main", async () => {
      lang = "he";
      await render();
      expect(attr("dir", "rtl")).toBeDefined();
      expect(elements("H1")).toHaveLength(1);
      expect(elements("MAIN")).toHaveLength(0);
      expect(button(t("adminApproval.approveBeta"))).toBeDefined();
      for (const key of Object.keys(en).filter((key) => key.startsWith("adminApproval."))) {
        expect(he[key as keyof typeof en]).toMatch(/[א-ת]/);
      }
    });
    test("queue query errors allow Retry and leave ordinary management available", async () => {
      queueError = true;
      const errors: unknown[][] = [];
      const errorLog = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });
      try {
        await render();
      } finally {
        errorLog.mockRestore();
      }
      expect(errors.length).toBeGreaterThan(0);
      expect(attr("role", "alert")?.textContent).toContain(t("adminApproval.queueError"));
      expect(host.textContent).toContain("ordinary@example.invalid");
      expect(host.textContent).not.toContain("FICTIONAL_QUEUE_DIAGNOSTIC");
      queueError = false;
      await click(button(t("set.retry")));
      expect(queue().textContent).toContain("Sample beta-one");
      expect(calls).toEqual([]);
    });
  });
}
