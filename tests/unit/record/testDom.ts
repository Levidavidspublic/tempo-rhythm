/**
 * A small dependency-free DOM for React tests in tests/unit/record (the same TestNode approach as
 * tests/unit/releaseOnboardingGate.test.tsx; no Testing Library or happy-dom is installed here).
 * Enough for createRoot, clicks, typing into fields (`type`) and key presses on the document.
 */

type Listener = (event: TestEvent) => void;

export class TestEvent {
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
  ctrlKey = false;
  shiftKey = false;
  altKey = false;
  metaKey = false;
  key = "";
  view: unknown = globalThis;
  relatedTarget: null = null;
  currentTarget: TestNode | null = null;
  srcElement: TestNode;
  constructor(
    public type: string,
    public target: TestNode,
    init: Partial<Pick<TestEvent, "key" | "ctrlKey" | "metaKey" | "altKey">> = {},
  ) {
    this.srcElement = target;
    Object.assign(this, init);
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

export class TestNode {
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
  style = { setProperty() {}, removeProperty() {}, getPropertyValue: () => "" };
  className = "";
  id = "";
  value = "";
  checked = false;
  disabled = false;
  href = "";
  type = "";
  nodeValue: string | null = null;
  defaultView: unknown = globalThis;
  activeElement: TestNode | null = null;
  body: TestNode | null = null;
  documentElement: TestNode | null = null;
  visibilityState = "visible";
  tagName: string;
  private listeners: Record<string, Listener[]> = {};

  constructor(
    public nodeName: string,
    owner: TestNode | null,
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
    if (name === "href") this.href = String(value);
    if (name === "type") this.type = String(value);
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
    for (const current of [...path].reverse()) {
      event.currentTarget = current;
      for (const fn of [...(current.listeners[`${event.type}:capture`] ?? [])]) fn(event);
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

  /** Calls only this node's own listeners (a document-level key press with any target). */
  emit(event: TestEvent) {
    event.currentTarget = this;
    for (const fn of [...(this.listeners[event.type] ?? [])]) fn(event);
    return !event.defaultPrevented;
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

/** Builds a document and installs it (and the globals React needs) on globalThis. */
export function installTestDom(): TestNode {
  const documentNode = new TestNode("#document", null);
  documentNode.nodeType = 9;
  documentNode.ownerDocument = documentNode;
  const documentElement = new TestNode("HTML", documentNode);
  const body = new TestNode("BODY", documentNode);
  documentNode.appendChild(documentElement);
  documentElement.appendChild(body);
  documentNode.documentElement = documentElement;
  documentNode.body = body;
  documentNode.activeElement = body;
  useTestDom(documentNode);
  return documentNode;
}

/** Points the globals at this document again (another test file may have installed its own). */
export function useTestDom(documentNode: TestNode) {
  const globals = globalThis as Record<string, unknown>;
  globals.window = globalThis;
  globals.document = documentNode;
  globals.HTMLElement = TestNode;
  globals.Element = TestNode;
  globals.Node = TestNode;
  globals.HTMLIFrameElement = class HTMLIFrameElement extends TestNode {};
  globals.navigator = { userAgent: "bun-test" };
  globals.location = { protocol: "http:", href: "http://localhost/" };
  globals.getComputedStyle = () => ({ getPropertyValue: () => "" });
  globals.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globals.IS_REACT_ACT_ENVIRONMENT = true;
}

export function walk(node: TestNode, visit: (node: TestNode) => void) {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

export function findAll(root: TestNode, match: (node: TestNode) => boolean): TestNode[] {
  const found: TestNode[] = [];
  walk(root, (node) => {
    if (match(node)) found.push(node);
  });
  return found;
}

/** The first element with this tag whose text includes `label` (when given). */
export function findByTag(root: TestNode, tag: string, label?: string): TestNode {
  const match = findAll(root, (node) => node.tagName === tag && (label === undefined || node.textContent.includes(label)))[0];
  if (!match) throw new Error(`Missing ${tag}: ${label ?? ""}`);
  return match;
}

export function findById(root: TestNode, id: string): TestNode {
  const match = findAll(root, (node) => node.id === id)[0];
  if (!match) throw new Error(`Missing #${id}`);
  return match;
}

export function queryByTag(root: TestNode, tag: string, label?: string): TestNode | null {
  return findAll(root, (node) => node.tagName === tag && (label === undefined || node.textContent.includes(label)))[0] ?? null;
}

/**
 * Calls the field's React `onChange` with the new value. React decides at load time whether the
 * DOM supports `input` events, and in a shared test process it may have loaded before any DOM
 * existed, so dispatching a DOM event isn't reliable here; the handler React attached is.
 */
export function fireChange(node: TestNode, patch: { value?: string; checked?: boolean }) {
  if (patch.value !== undefined) node.value = patch.value;
  if (patch.checked !== undefined) node.checked = patch.checked;
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  const props = key ? (node as unknown as Record<string, { onChange?: (event: unknown) => void }>)[key] : undefined;
  if (!props?.onChange) throw new Error(`No onChange on ${node.tagName}#${node.id}`);
  props.onChange({ target: node, currentTarget: node, preventDefault() {}, stopPropagation() {} });
}

/** The props React rendered on this element (for a controlled field's current value). */
export function reactProps(node: TestNode): Record<string, unknown> {
  const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
  return key ? ((node as unknown as Record<string, Record<string, unknown>>)[key] ?? {}) : {};
}

/** Types into an input or textarea. */
export function typeInto(node: TestNode, text: string) {
  fireChange(node, { value: text });
}
