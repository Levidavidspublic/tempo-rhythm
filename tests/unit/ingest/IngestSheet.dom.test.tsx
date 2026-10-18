/**
 * IngestSheet (T8-T10 spec, S2) in a small DOM: where focus goes when the control that had it
 * goes away, and the Save button's offline wait. Uses the TestNode DOM from tests/unit/record
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
const SAVED_GLOBALS = ["FileReader"] as const;
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
});

afterAll(() => {
  mock.module(localeProvider, () => previousLocale);
  TestNode.prototype.focus = realFocus;
  for (const key of SAVED_GLOBALS) {
    if (savedGlobals[key] === undefined) delete globals[key];
    else globals[key] = savedGlobals[key];
  }
});

// The photo, PDF and Word readers stood in for: they never finish, and never touch the network.
const NEVER_DONE: NonNullable<IngestSheetViewProps["readers"]> = {
  preparePhoto: async (image) => image,
  createOcrWorker: () => new Promise(() => {}),
  readPdfPages: () => new Promise(() => {}),
  readDocxText: () => new Promise(() => {}),
};

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
    readers: NEVER_DONE,
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

describe("IngestSheet offline save", () => {
  test("offline Save waits; if the text is then cleared, coming back online leaves Save ready", async () => {
    const onSave = mock(async () => "n1");
    const { view, rerender } = await render({
      initialTab: "paste",
      initialText: "Notes",
      online: false,
      onSave,
    });
    await submit(view);
    expect(saveButton(view).textContent).toContain("Saves when you're back online");

    await act(async () => {
      typeInto(findById(view, "ig-text"), "");
    });
    await rerender({ online: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(saveButton(view).textContent).toContain("Save as a page");
    expect(saveButton(view).getAttribute("aria-disabled")).toBeNull();
    expect(view.textContent).toContain("Add some text first");
  });

  test("the same when the text grew past 200 KB while waiting", async () => {
    const onSave = mock(async () => "n1");
    const { view, rerender } = await render({
      initialTab: "paste",
      initialText: "Notes",
      online: false,
      onSave,
    });
    await submit(view);
    await act(async () => {
      typeInto(findById(view, "ig-text"), "a".repeat(204_801));
    });
    await rerender({ online: true });
    expect(onSave).not.toHaveBeenCalled();
    expect(saveButton(view).textContent).toContain("Save as a page");
    expect(view.textContent).toContain("more than 200 KB of text");
  });
});

describe("IngestSheet reading PDFs, Word files and photos", () => {
  // A FileReader that hands back the bytes, for the reads that must get past it.
  class BytesFileReader {
    result: ArrayBuffer | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onload?.();
      });
    }
  }
  type Readers = NonNullable<IngestSheetViewProps["readers"]>;
  let hangingReader: unknown;
  const useBytesReader = () => {
    hangingReader = globals.FileReader;
    globals.FileReader = BytesFileReader;
  };
  afterEach(() => {
    if (hangingReader) globals.FileReader = hangingReader;
    hangingReader = undefined;
  });

  async function pick(view: TestNode, inputId: string, file: File) {
    const input = findById(view, inputId);
    (input as unknown as { files: File[] }).files = [file];
    await act(async () => {
      (reactProps(input).onChange as (event: unknown) => void)({
        target: input,
        currentTarget: input,
      });
    });
    // Let the FileReader stand-in and the reader's promises run.
    await act(async () => {
      await Bun.sleep(5);
    });
  }

  const pdfFile = (name = "Biology notes.pdf") =>
    new File(["%PDF-1.7 fictional"], name, { type: "application/pdf" });

  test("a PDF shows its page progress and Stop; Stop ends it and gives the picker focus", async () => {
    useBytesReader();
    let signal: AbortSignal | null = null;
    const readPdfPages: Readers["readPdfPages"] = (_bytes, options) => {
      signal = options.signal;
      options.onPage(3, 12);
      return new Promise(() => {});
    };
    const { view } = await render({ readers: { ...NEVER_DONE, readPdfPages } });
    await pick(view, "ig-file", pdfFile());
    expect(view.textContent).toContain("Reading the PDF…");
    expect(view.textContent).toContain("Page 3 of 12");
    const [bar] = findAll(view, (n) => n.tagName === "PROGRESS");
    expect(bar?.getAttribute("aria-label")).toBe("Reading progress");
    expect(bar?.getAttribute("max")).toBe("12");
    expect(bar?.getAttribute("value")).toBe("3");
    expect(findById(view, "ig-file-status").tagName).toBe("OUTPUT");

    await focusAndClick(findByTag(view, "BUTTON", "Stop reading"));
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    expect(view.textContent).toContain("Reading stopped. Choose the file again to start over.");
    expect(focused()).toBe("INPUT#ig-file");
    expect(findById(view, "ig-file").getAttribute("aria-disabled")).toBeNull();
  });

  test("an old .doc is refused in plain words, without being read", async () => {
    const { view } = await render();
    await pick(view, "ig-file", new File(["x"], "Old essay.doc", { type: "application/msword" }));
    const status = findById(view, "ig-file-status");
    expect(status.getAttribute("role")).toBe("alert");
    expect(status.textContent).toContain("Old Word files (.doc) can't be read here.");
    expect(status.textContent).toContain("save it as .docx");
  });

  test("a PDF without text suggests a photo; Use a photo instead opens the Photo picker", async () => {
    useBytesReader();
    const readPdfPages = async () => ({ pageCount: 2, pages: ["", ""] });
    const { view } = await render({
      photoSupported: true,
      readers: { ...NEVER_DONE, readPdfPages },
    });
    await pick(view, "ig-file", pdfFile("scan.pdf"));
    expect(findById(view, "ig-file-status").textContent).toContain(
      "This PDF has no text in it, so it's probably a scanned page."
    );
    await focusAndClick(findByTag(view, "BUTTON", "Use a photo instead"));
    expect(focused()).toBe("INPUT#ig-photo");
  });

  test("a PDF longer than the cap says how many pages were read", async () => {
    useBytesReader();
    const readPdfPages = async () => ({ pageCount: 240, pages: ["Cells", "Tissues"] });
    const { view } = await render({ readers: { ...NEVER_DONE, readPdfPages } });
    await pick(view, "ig-file", pdfFile());
    expect(view.textContent).toContain("Only the first 2 of 240 pages were read.");
    // "Cells\n\nTissues" is in the text box.
    expect(view.textContent).toContain("14 characters");
  });

  test("a photo: getting ready, then reading with a percent; Stop terminates the worker", async () => {
    type Worker = { recognize: () => Promise<never>; terminate: () => Promise<void> };
    let ready: (worker: Worker) => void = () => {};
    let progress: (p: { stage: "loading" | "reading"; ratio: number }) => void = () => {};
    const terminate = mock(async () => {});
    const readers: Readers = {
      ...NEVER_DONE,
      createOcrWorker: (onProgress) => {
        progress = onProgress;
        return new Promise<Worker>((resolve) => {
          ready = resolve;
        });
      },
    };
    const { view } = await render({ initialTab: "photo", photoSupported: true, readers });
    await pick(view, "ig-photo", new File([Uint8Array.of(1)], "page.jpg", { type: "image/jpeg" }));
    expect(findById(view, "ig-photo-status").textContent).toBe("Getting the photo reader ready…");
    expect(findById(view, "ig-photo").getAttribute("aria-disabled")).toBe("true");

    await act(async () => {
      ready({ recognize: () => new Promise<never>(() => {}), terminate });
      progress({ stage: "reading", ratio: 0.4 });
      await Bun.sleep(0);
    });
    expect(findById(view, "ig-photo-status").textContent).toBe("Reading the photo…");
    expect(view.textContent).toContain("40% read");

    await focusAndClick(findByTag(view, "BUTTON", "Stop reading"));
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain("Reading stopped. Choose the photo again to start over.");
    expect(focused()).toBe("INPUT#ig-photo");
  });

  test("closing the sheet mid-read stops the reader", async () => {
    useBytesReader();
    let signal: AbortSignal | null = null;
    const readPdfPages: Readers["readPdfPages"] = (_bytes, options) => {
      signal = options.signal;
      return new Promise(() => {});
    };
    const { view } = await render({ readers: { ...NEVER_DONE, readPdfPages } });
    await pick(view, "ig-file", pdfFile());
    expect((signal as AbortSignal | null)?.aborted).toBe(false);
    await act(async () => {
      root?.unmount();
    });
    root = null;
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
  });
});
