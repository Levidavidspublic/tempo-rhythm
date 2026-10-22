import { resolveSync, spawn } from "bun";
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { join, resolve } from "node:path";
import type { ReactElement } from "react";
import type { Root } from "react-dom/client";
import type { ExecutorStatusView } from "../../apps/web/lib/executor-connection";

// This dependency-free DOM is adapted from this repo's releaseOnboardingGate.test.tsx.
// Run mocks in a fresh Bun child so they cannot affect other files in the full suite.
const fixtureRoot = resolve(import.meta.dir, "../..");
const navigated: string[] = [];
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
    assign: (url: string) => navigated.push(url),
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

if (process.env.TEMPO_EXECUTOR_HUB_FIXTURE_CHILD !== "1") {
  test("Executor hub mounted behavior (isolated child)", async () => {
    const child = spawn([process.execPath, "--no-env-file", "test", import.meta.path], {
      cwd: fixtureRoot,
      env: { PATH: process.env.PATH, NODE_ENV: "test", TEMPO_EXECUTOR_HUB_FIXTURE_CHILD: "1" },
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
      if (code !== 0) throw new Error(`Mounted Executor fixture exited ${code}\n${out}\n${errors}`);
      expect(errors).toContain("0 fail");
      expect(errors).toContain("15 pass");
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
  const { translate, MESSAGES } = await import("../../apps/web/lib/i18n");
  const helpers = await import("../../apps/web/lib/executor-connection");
  type Lang = "en" | "he";
  let lang: Lang = "en";
  let view: ExecutorStatusView | undefined;
  let unreadable = false;
  let root: Root | null = null;
  let host: TestNode;
  const calls: { name: string; args: unknown }[] = [];
  const replacements: string[] = [];
  let startError: unknown = null;
  let disconnectError = false;
  let confirmResult: () => Promise<{ status: "connected" | "error" }> = async () => ({
    status: "connected",
  });
  const router = { replace: (url: string) => replacements.push(url) };
  const start = async (args: unknown) => {
    calls.push({ name: "start", args });
    if (startError) throw startError;
    return { authorizationUrl: "https://accounts.executor.invalid/authorize" };
  };
  const disconnect = async (args: unknown) => {
    calls.push({ name: "disconnect", args });
    if (disconnectError) throw new Error("FICTIONAL_DISCONNECT_ERROR");
    view = { status: "not_connected", enabled: true };
    return { status: "disconnected", revokedAtProvider: true };
  };
  const confirm = (args: unknown) => {
    calls.push({ name: "confirm", args });
    return confirmResult();
  };
  mock.module("convex/react", () => ({
    useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
    useQuery: (ref: string, args: unknown) => {
      if (args === "skip") return undefined;
      if (ref === "profile") return { _id: "fictional-owner" };
      if (unreadable) throw new Error("FICTIONAL_STATUS_UNAVAILABLE");
      return view;
    },
    useAction: (ref: string) =>
      ref === "start" ? start : ref === "disconnect" ? disconnect : confirm,
  }));
  mock.module("next/navigation", () => ({ useRouter: () => router }));
  mock.module("next/link", () => ({
    default: ({ href, children, ...props }: { href: string; children: ReactElement }) =>
      createElement("a", { href, ...props }, children),
  }));
  mock.module("@/components/providers/LocaleProvider", () => ({
    useLocale: () => ({
      lang,
      dir: lang === "he" ? "rtl" : "ltr",
      t: (key: keyof typeof MESSAGES.en) => translate(lang, key),
    }),
  }));
  mock.module("@/components/tempo/TpIcon", () => ({
    TpIcon: () => createElement("span", { "aria-hidden": true }),
  }));
  mock.module("@/components/mcp/McpTokensCard", () => ({
    McpTokensCard: () =>
      createElement(
        "section",
        { "data-testid": "existing-mcp-card" },
        "Existing personal assistant connection"
      ),
  }));
  mock.module("@/convex/_generated/api", () => ({
    api: {
      users: { getProfile: "profile" },
      connections: {
        status: "status",
        startExecutorConnect: "start",
        disconnect: "disconnect",
        confirmExecutorConnect: "confirm",
      },
    },
  }));
  mock.module("@/lib/executor-connection", () => helpers);
  const controls = await import("../../apps/web/components/you/Controls");
  mock.module("@/components/you/Controls", () => controls);
  const { IntegrationsList } = await import("../../apps/web/components/settings/IntegrationsList");

  const elements = (tag: string, text?: string) => {
    const found: TestNode[] = [];
    walk(host, (node) => {
      if (node.tagName === tag && (text === undefined || node.textContent.includes(text)))
        found.push(node);
    });
    return found;
  };
  const button = (label: string) => {
    const found = elements("BUTTON").find((node) => node.textContent === label);
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  };
  const attr = (name: string, value: string) => {
    let found: TestNode | undefined;
    walk(host, (node) => {
      if (node.getAttribute(name) === value) found = node;
    });
    return found;
  };
  const render = async () => {
    await act(async () =>
      root!.render(
        createElement(
          "main",
          { dir: lang === "he" ? "rtl" : "ltr" },
          createElement("h1", null, translate(lang, "set.integ.title")),
          createElement(IntegrationsList)
        )
      )
    );
  };
  const click = async (node: TestNode) => {
    await act(async () => node.click());
  };

  beforeEach(() => {
    view = { status: "not_connected", enabled: true };
    lang = "en";
    unreadable = false;
    startError = null;
    disconnectError = false;
    calls.length = 0;
    replacements.length = 0;
    navigated.length = 0;
    confirmResult = async () => ({ status: "connected" });
    window.location.search = "";
    host = documentNode.createElement("div");
    documentNode.body!.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    documentNode.body!.removeChild(host);
  });

  describe("real mounted Executor hub with fictional backend boundaries", () => {
    test("OFF is honest and Connect stays inert", async () => {
      view = { status: "unavailable", enabled: false };
      await render();
      expect(attr("data-phase", "not_set_up")).toBeDefined();
      const connect = button(translate("en", "exec.connect"));
      expect(connect.getAttribute("aria-disabled")).toBe("true");
      await click(connect);
      expect(calls).toEqual([]);
      expect(host.textContent).toContain(translate("en", "exec.hub.limits"));
    });
    test("disconnected Connect calls existing start contract and authorization redirect", async () => {
      await render();
      await click(button(translate("en", "exec.connect")));
      expect(calls).toEqual([{ name: "start", args: { returnTo: "settings" } }]);
      expect(navigated).toEqual(["https://accounts.executor.invalid/authorize"]);
      expect(button(translate("en", "exec.opening")).getAttribute("aria-disabled")).toBe("true");
    });
    test("hub removes six speculative providers and retains import and personal MCP entry", async () => {
      await render();
      for (const provider of [
        "Google Calendar",
        "Gmail",
        "WhatsApp",
        "Telegram",
        "Obsidian",
        "Apple Notes",
      ])
        expect(host.textContent).not.toContain(provider);
      expect(elements("A").map((node) => node.href)).toEqual(["/ask-founder", "/settings/memory"]);
      expect(attr("data-testid", "existing-mcp-card")).toBeDefined();
      expect(elements("MAIN")).toHaveLength(1);
      expect(elements("H1")).toHaveLength(1);
      expect(host.textContent).toContain(translate("en", "exec.hub.permissions"));
    });
    test("pending status does not pretend a tool is connected", async () => {
      view = { status: "connecting", enabled: true };
      await render();
      expect(attr("data-phase", "connecting")).toBeDefined();
      expect(button(translate("en", "exec.startAgain"))).toBeDefined();
      expect(
        elements("BUTTON").some((node) => node.textContent === translate("en", "exec.disconnect"))
      ).toBe(false);
      expect(calls).toEqual([]);
    });
    test("OAuth return confirms once, removes nonce from URL and shows pending notice", async () => {
      view = { status: "connecting", enabled: true };
      window.location.search = "?keep=1&executor=confirm&n=fictional-confirm-nonce-0001";
      let finish!: (value: { status: "connected" }) => void;
      confirmResult = () =>
        new Promise((resolve) => {
          finish = resolve;
        });
      await render();
      expect(calls).toEqual([{ name: "confirm", args: { nonce: "fictional-confirm-nonce-0001" } }]);
      expect(replacements).toEqual(["/settings/integrations?keep=1"]);
      expect(host.textContent).toContain(translate("en", "exec.back.confirming"));
      expect(host.textContent).not.toContain("fictional-confirm-nonce-0001");
      await act(async () => finish({ status: "connected" }));
      expect(host.textContent).toContain(translate("en", "exec.back.connected"));
      expect(calls).toHaveLength(1);
    });
    test("connected state comes from status with dates and no extra connection claims", async () => {
      view = {
        status: "connected",
        enabled: true,
        connectedAt: 1_800_000_000_000,
        lastUsedAt: 1_800_000_000_000,
      };
      await render();
      expect(attr("data-phase", "connected")).toBeDefined();
      expect(button(translate("en", "exec.disconnect"))).toBeDefined();
      expect(elements("BDI")).toHaveLength(2);
      expect(calls).toEqual([]);
    });
    test("reconnect uses start contract and never invents a refresh action", async () => {
      view = { status: "needs_reauth", enabled: true };
      await render();
      await click(button(translate("en", "exec.reconnect")));
      expect(calls).toEqual([{ name: "start", args: { returnTo: "settings" } }]);
    });
    test("connect error is calm, redacts diagnostics and permits retry", async () => {
      startError = new Error("FICTIONAL_PROVIDER_DIAGNOSTIC");
      await render();
      await click(button(translate("en", "exec.connect")));
      expect(attr("role", "alert")?.textContent).toContain(translate("en", "exec.err.connect"));
      expect(host.textContent).not.toContain("FICTIONAL_PROVIDER_DIAGNOSTIC");
      startError = null;
      await click(button(translate("en", "exec.connect")));
      expect(calls).toHaveLength(2);
      expect(navigated).toHaveLength(1);
    });
    test("unreadable status is an error with Retry, not a false OFF state", async () => {
      unreadable = true;
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
      expect(attr("role", "alert")?.textContent).toBe(translate("en", "exec.hub.statusError"));
      expect(attr("data-phase", "not_set_up")).toBeUndefined();
      expect(host.textContent).not.toContain("FICTIONAL_STATUS_UNAVAILABLE");
      unreadable = false;
      await click(button(translate("en", "set.retry")));
      expect(attr("data-phase", "not_connected")).toBeDefined();
      expect(calls).toEqual([]);
    });
    test("disconnect requires confirmation, explains irreversibility and cancels via Escape", async () => {
      view = { status: "connected", enabled: true, connectedAt: 1 };
      await render();
      const opener = button(translate("en", "exec.disconnect"));
      opener.focus();
      await click(opener);
      expect(attr("role", "alertdialog")).toBeDefined();
      expect(host.textContent).toContain("This cannot be undone here");
      expect(calls).toEqual([]);
      const cancel = button(translate("en", "exec.confirm.no"));
      expect(documentNode.activeElement).toBe(cancel);
      const event = new TestEvent("keydown", cancel);
      event.key = "Escape";
      await act(async () => documentNode.dispatchEvent(event));
      expect(attr("role", "alertdialog")).toBeUndefined();
      expect(documentNode.activeElement).toBe(opener);
      expect(calls).toEqual([]);
    });
    test("confirmed disconnect calls existing contract and restores Connect", async () => {
      view = { status: "connected", enabled: true, connectedAt: 1 };
      await render();
      await click(button(translate("en", "exec.disconnect")));
      const dialog = attr("role", "alertdialog")!;
      const confirmButton = dialog
        .querySelectorAll("button")
        .find((node) => node.textContent === translate("en", "exec.confirm.yes"))!;
      await click(confirmButton);
      expect(calls).toEqual([{ name: "disconnect", args: { provider: "executor" } }]);
      expect(attr("role", "alertdialog")).toBeUndefined();
      expect(attr("data-phase", "not_connected")).toBeDefined();
      expect(host.textContent).toContain(translate("en", "exec.disconnected"));
    });
    test("disconnect error retains live connection and shows a recoverable error", async () => {
      view = { status: "connected", enabled: true, connectedAt: 1 };
      disconnectError = true;
      await render();
      await click(button(translate("en", "exec.disconnect")));
      const confirmButton = attr("role", "alertdialog")!
        .querySelectorAll("button")
        .find((node) => node.textContent === translate("en", "exec.confirm.yes"))!;
      await click(confirmButton);
      expect(attr("data-phase", "connected")).toBeDefined();
      expect(attr("role", "alert")?.textContent).toContain(translate("en", "exec.err.disconnect"));
      expect(host.textContent).not.toContain("FICTIONAL_DISCONNECT_ERROR");
      expect(button(translate("en", "exec.disconnect"))).toBeDefined();
    });
    test("disabled deployment with an existing connection preserves Disconnect", async () => {
      view = { status: "unavailable", enabled: false, connectedAt: 1 };
      await render();
      expect(attr("data-phase", "paused")).toBeDefined();
      expect(button(translate("en", "exec.disconnect"))).toBeDefined();
    });
    test("Hebrew inherits RTL and every new hub string has translated copy", async () => {
      lang = "he";
      await render();
      expect(elements("MAIN")[0]!.getAttribute("dir")).toBe("rtl");
      expect(host.textContent).toContain(translate("he", "exec.hub.title"));
      for (const key of Object.keys(MESSAGES.en).filter((key) => key.startsWith("exec.hub."))) {
        expect(MESSAGES.he[key as keyof typeof MESSAGES.he]).not.toBe(
          MESSAGES.en[key as keyof typeof MESSAGES.en]
        );
        expect(MESSAGES.he[key as keyof typeof MESSAGES.he]).toMatch(/[א-ת]/);
      }
      expect(button(translate("he", "exec.connect"))).toBeDefined();
    });
    test("mounted parent notice keys describe a hub in both languages", () => {
      expect(translate("en", "set.integ.nTitle")).toBe("One hub for your tools.");
      expect(translate("en", "set.integ.nBody")).not.toContain("coming later");
      expect(translate("he", "set.integ.nTitle")).toContain("מרכז אחד");
      expect(translate("he", "set.integ.nBody")).not.toContain("שאר האפליקציות למטה");
    });
  });
}
