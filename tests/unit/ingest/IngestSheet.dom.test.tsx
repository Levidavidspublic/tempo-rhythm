/**
 * IngestSheet (T8-T10 spec, S2) in a small DOM: where focus goes when the control that had it
 * goes away. Uses the TestNode DOM from tests/unit/record
 * (no happy-dom or Testing Library here); `focus()` is made to set `activeElement` for this file
 * only, and the locale is stood in for the way the record tests do it.
 */
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { IngestSheetViewProps } from "../../../apps/web/components/ingest/IngestSheet";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import {
  findAll,
  findById,
  findByTag,
  installTestDom,
  queryByTag,
  reactProps,
  TestEvent,
  TestNode,
  typeInto,
  useTestDom,
} from "../record/testDom";

const documentNode = installTestDom();

const webDir = `${process.cwd()}/apps/web`;
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
let previousLocale: Record<string, unknown> = {};
const realFocus = TestNode.prototype.focus;
const globals = globalThis as Record<string, unknown>;
const SAVED_GLOBALS = ["FileReader", "TextDetector", "createImageBitmap"] as const;
const savedGlobals: Record<string, unknown> = {};

function installLocale() {
  mock.module(localeProvider, () => ({
    ...previousLocale,
    useLocale: () => ({
      lang: "en",
      dir: "ltr",
      setLang() {},
      t: (key: MessageKey) => translate("en", key),
    }),
  }));
}

beforeAll(async () => {
  previousLocale = { ...(await import(localeProvider)) };
  installLocale();
  TestNode.prototype.focus = function focus(this: TestNode) {
    this.ownerDocument.activeElement = this;
  };
  for (const key of SAVED_GLOBALS) savedGlobals[key] = globals[key];
  // Reading a file or a photo never finishes here, so the "reading" state can be looked at.
  globals.FileReader = class {
    readAsArrayBuffer() {}
  };
  globals.TextDetector = class {
    detect() {
      return new Promise(() => {});
    }
  };
  globals.createImageBitmap = async () => ({ close() {} });
});

afterAll(() => {
  mock.module(localeProvider, () => previousLocale);
  TestNode.prototype.focus = realFocus;
  for (const key of SAVED_GLOBALS) {
    if (savedGlobals[key] === undefined) delete globals[key];
    else globals[key] = savedGlobals[key];
  }
});

let root: Root | null = null;
let host: TestNode | null = null;
let View: (props: IngestSheetViewProps) => ReturnType<typeof createElement>;

async function render(props: Partial<IngestSheetViewProps> = {}) {
  useTestDom(documentNode);
  installLocale();
  ({ IngestSheetView: View } = await import(
    "../../../apps/web/components/ingest/IngestSheet?ingest-dom"
  ));
  const all: IngestSheetViewProps = {
    id: "ig",
    onClose: () => {},
    onSave: async () => "n1",
    online: true,
    photoSupported: false,
    ...props,
  };
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(View, all));
  });
  const rerender = async (next: Partial<IngestSheetViewProps>) => {
    await act(async () => {
      root?.render(createElement(View, { ...all, ...next }));
    });
  };
  return { view: host, rerender };
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
  documentNode.activeElement = documentNode.body;
});

async function focusAndClick(node: TestNode) {
  node.focus();
  await act(async () => {
    node.click();
  });
}

async function submit(view: TestNode) {
  const form = findById(view, "ig-form");
  await act(async () => {
    form.dispatchEvent(new TestEvent("submit", form));
  });
}

const sheetOf = (view: TestNode) => findById(view, "ig");
/** What has focus, as TAG#id (the TestNode itself prints its whole React tree). */
function focused(): string {
  const node = documentNode.activeElement;
  const connected = node ? documentNode.contains(node) : false;
  return node ? `${node.tagName}#${node.id}${connected ? "" : " (removed)"}` : "none";
}

/** The sheet's one submit button (Save as a page). */
function saveButton(view: TestNode): TestNode {
  const [save] = findAll(
    view,
    (n) => n.tagName === "BUTTON" && n.getAttribute("type") === "submit"
  );
  if (!save) throw new Error("Missing the Save button");
  return save;
}

describe("IngestSheet focus", () => {
  test("the sheet itself can take focus, so a click on its words keeps Esc working", async () => {
    const onClose = mock(() => {});
    const { view } = await render({ onClose });
    const sheet = sheetOf(view);
    expect(sheet.getAttribute("tabindex")).toBe("-1");
    sheet.focus();
    await act(async () => {
      (reactProps(sheet).onKeyDown as (event: unknown) => void)({
        key: "Escape",
        shiftKey: false,
        preventDefault() {},
        stopPropagation() {},
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("Paste text instead moves focus to the text box it opens", async () => {
    const { view } = await render({ initialTab: "photo" });
    await focusAndClick(findByTag(view, "BUTTON", "Paste text instead"));
    expect(focused()).toBe("TEXTAREA#ig-text");
  });

  test("when the focused control goes away, focus goes to the sheet instead of the page", async () => {
    let calls = 0;
    const onSave = () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("offline")) : new Promise<string>(() => {});
    };
    const { view } = await render({ initialTab: "paste", initialText: "Notes", onSave });
    await submit(view);
    const retry = findByTag(view, "BUTTON", "Try again");
    await focusAndClick(retry);
    expect(queryByTag(view, "BUTTON", "Try again")).toBeNull();
    expect(focused()).toBe("SECTION#ig");
  });

  test("Save while saving and the pickers while reading stay focusable (aria-disabled)", async () => {
    const { view } = await render({
      initialTab: "paste",
      initialText: "Notes",
      onSave: () => new Promise<string>(() => {}),
      photoSupported: true,
    });
    await submit(view);
    const save = saveButton(view);
    expect(save.textContent).toContain("Saving");
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(save.hasAttribute("disabled")).toBe(false);

    for (const [tab, inputId] of [
      ["File", "ig-file"],
      ["Photo", "ig-photo"],
    ] as const) {
      await act(async () => {
        findByTag(view, "BUTTON", tab).click();
      });
      const input = findById(view, inputId);
      (input as unknown as { files: File[] }).files = [new File(["x"], "a.txt")];
      await act(async () => {
        (reactProps(input).onChange as (event: unknown) => void)({
          target: input,
          currentTarget: input,
        });
      });
      const reading = findById(view, inputId);
      expect(reading.getAttribute("aria-disabled")).toBe("true");
      expect(reading.hasAttribute("disabled")).toBe(false);
      // A second pick while the first is read doesn't open the picker.
      const click = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };
      (reactProps(reading).onClick as (event: unknown) => void)(click);
      expect(click.defaultPrevented).toBe(true);
    }
  });
});
