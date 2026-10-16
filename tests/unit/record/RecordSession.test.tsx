/**
 * RecordSession (kitchen T8, S7): the consent gate, the no-key path (typing works end to end),
 * pins, review rows (Accept / Reject) and Save → Undo. convex/react and the locale are mocked the
 * way tests/unit/releaseOnboardingGate.test.tsx does it; the DOM is the small TestNode harness.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import {
  findAll,
  findById,
  fireChange,
  findByTag,
  installTestDom,
  queryByTag,
  reactProps,
  TestEvent,
  type TestNode,
  typeInto,
  useTestDom,
} from "./testDom";

const documentNode = installTestDom();

const webDir = `${process.cwd()}/apps/web`;
// The component reaches the backend through one module of its own (recordApi.ts); mocking that
// instead of convex/react keeps this file independent of other files' convex/react mocks.
const recordApi = Bun.resolveSync("./components/study/record/recordApi", webDir);
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const MOCKED = [recordApi, localeProvider];
let previous: Record<string, Record<string, unknown>> = {};

type Availability = { live: boolean; reason: string | null; minutesLeft: number; proposals: boolean };
let availability: Availability | undefined;

const calls = {
  start: mock(async (_args: unknown) => ({ ok: false, reason: "no_key" })),
  renew: mock(async (_args: unknown) => ({ status: "ok", minutesLeft: 10 })),
  stop: mock(async (_args: unknown) => null),
  grant: mock(async (_args: unknown) => ({ ok: false, reason: "no_key" })),
  saveSession: mock(async (_args: unknown) => ({
    noteId: "notes:1",
    taskIds: ["tasks:1"],
    undoUntil: Date.now() + 5 * 60_000,
  })),
  undoSave: mock(async (_args: unknown) => ({ success: true, removedTasks: 1 })),
  propose: mock(async (_args: unknown): Promise<Record<string, unknown>> => ({ status: "unavailable", reason: "no_key" })),
};

function installModuleMocks() {
  mock.module(recordApi, () => ({
    useRecordingAvailability: () => availability,
    useRecordingSave: () => ({ propose: calls.propose, saveSession: calls.saveSession, undoSave: calls.undoSave }),
    useRecordingLease: () => ({ startLease: calls.start, renewLease: calls.renew, stopLease: calls.stop, grant: calls.grant }),
  }));
  mock.module(localeProvider, () => ({
    useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
  }));
}

async function snapshotModuleMocks() {
  previous = {};
  for (const key of MOCKED) previous[key] = { ...(await import(key)) };
}

function restoreModuleMocks() {
  for (const key of MOCKED) mock.module(key, () => previous[key]);
}

await snapshotModuleMocks();
installModuleMocks();
const { RecordSession } = await import("../../../apps/web/components/study/record/RecordSession?record-test");

let root: Root | null = null;
let host: TestNode | null = null;

async function render() {
  useTestDom(documentNode);
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(createElement(RecordSession));
  });
  return host;
}

async function click(node: TestNode) {
  await act(async () => {
    node.click();
  });
}

async function clickButton(view: TestNode, label: string) {
  await click(findByTag(view, "BUTTON", label));
}

async function type(node: TestNode, text: string) {
  await act(async () => {
    typeInto(node, text);
  });
}

/** A key press as the document's keydown listener sees it, with `target` as the focused element. */
async function press(target: TestNode, key: string) {
  await act(async () => {
    documentNode.emit(new TestEvent("keydown", target, { key }));
  });
}

const NOTES = "We met about the launch.\nI'll send the deck to Dana by Friday.\nWe need to book the room by Monday.";

beforeAll(() => {
  installModuleMocks();
});
afterAll(restoreModuleMocks);

beforeEach(() => {
  installModuleMocks();
  useTestDom(documentNode);
  availability = { live: false, reason: "no_key", minutesLeft: 0, proposals: false };
  for (const fn of Object.values(calls)) fn.mockClear();
  const globals = globalThis as Record<string, unknown>;
  delete globals.MediaRecorder;
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});

describe("consent", () => {
  test("no consent, no microphone: Start stays disabled until the box is ticked", async () => {
    availability = { live: true, reason: null, minutesLeft: 15, proposals: false };
    const getUserMedia = mock(async () => {
      throw new Error("denied");
    });
    const globals = globalThis as Record<string, unknown>;
    globals.MediaRecorder = { isTypeSupported: () => true };
    const view = await render();
    (globalThis as { navigator: unknown }).navigator = { userAgent: "bun-test", mediaDevices: { getUserMedia } };
    expect(view.textContent).toContain("Audio is never stored");
    expect(view.textContent).toContain("Everyone here knows this is being recorded");
    const start = findByTag(view, "BUTTON", "Start recording");
    expect(start.disabled).toBe(true);
    expect(start.className).toContain("tp-btn--primary");
    await click(start);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(calls.start).not.toHaveBeenCalled();

    await act(async () => {
      fireChange(findById(view, "rec-consent"), { checked: true });
    });
    expect(findByTag(view, "BUTTON", "Start recording").disabled).toBe(false);
    await clickButton(view, "Start recording");
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    // The microphone said no: the screen says so in words and typing takes over.
    expect(view.textContent).toContain("The microphone isn't available here");
    expect(findById(view, "rec-typed").tagName).toBe("TEXTAREA");
    expect(calls.start).not.toHaveBeenCalled();
  });

  test("one primary button on the consent screen", async () => {
    availability = { live: true, reason: null, minutesLeft: 15, proposals: false };
    const view = await render();
    expect(findAll(view, (n) => n.tagName === "BUTTON" && n.className.includes("tp-btn--primary"))).toHaveLength(1);
  });
});

describe("without the key (or for Hebrew), typing works end to end", () => {
  test("says why in words, offers typing, and the notes reach review with local suggestions", async () => {
    const view = await render();
    expect(view.textContent).toContain("Live words aren't switched on yet");
    expect(queryByTag(view, "INPUT")).toBeNull();
    expect(findByTag(view, "BUTTON", "Type or paste notes").className).toContain("tp-btn--primary");
    await clickButton(view, "Type or paste notes");
    await type(findById(view, "rec-typed"), NOTES);
    await clickButton(view, "Stop and review");
    expect(view.textContent).toContain("Review before saving");
    expect(view.textContent).toContain("Found in your notes");
    expect(view.textContent).toContain("Send the deck to Dana by Friday");
    expect(view.textContent).toContain("Book the room");
    expect(reactProps(findById(view, "rec-transcript")).value).toBe(NOTES);
    expect(calls.propose).not.toHaveBeenCalled();
    expect(calls.saveSession).not.toHaveBeenCalled();
  });

  test("Hebrew says live words in Hebrew aren't ready yet", async () => {
    availability = { live: false, reason: "language", minutesLeft: 0, proposals: false };
    const view = await render();
    expect(view.textContent).toContain("Live words in Hebrew aren't ready yet");
  });
});

describe("pins", () => {
  test("the Pin button and the P key pin now; P while typing in a field doesn't", async () => {
    const view = await render();
    await clickButton(view, "Type or paste notes");
    expect(view.textContent).toContain("No pins yet");
    await clickButton(view, "Pin this moment");
    expect(findAll(view, (n) => n.tagName === "LI" && n.className === "tp-rec-pin")).toHaveLength(1);
    expect(view.textContent).toContain("00:00");
    await press(documentNode, "p");
    expect(findAll(view, (n) => n.tagName === "LI" && n.className === "tp-rec-pin")).toHaveLength(2);
    await press(findById(view, "rec-typed"), "p");
    expect(findAll(view, (n) => n.tagName === "LI" && n.className === "tp-rec-pin")).toHaveLength(2);
  });
});

async function toReview(view: TestNode) {
  await clickButton(view, "Type or paste notes");
  await type(findById(view, "rec-typed"), NOTES);
  await clickButton(view, "Pin this moment");
  await clickButton(view, "Stop and review");
}

describe("review and save", () => {
  test("Accept / Reject rows; only accepted tasks are saved, with the page body", async () => {
    const view = await render();
    await toReview(view);
    const rows = findAll(view, (n) => n.tagName === "LI" && n.getAttribute("data-row") !== null);
    expect(rows.map((r) => r.getAttribute("data-status"))).toEqual(["pending", "pending"]);
    await click(findByTag(rows[0] as TestNode, "BUTTON", "Accept"));
    await click(findByTag(rows[1] as TestNode, "BUTTON", "Reject"));
    const after = findAll(view, (n) => n.tagName === "LI" && n.getAttribute("data-row") !== null);
    expect(after.map((r) => r.getAttribute("data-status"))).toEqual(["accepted", "rejected"]);
    expect(view.textContent).toContain("Accepted tasks: 1.");

    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
    const args = calls.saveSession.mock.calls[0]?.[0] as { title: string; body: string; tasks: unknown[] };
    expect(args.title.startsWith("Notes from")).toBe(true);
    expect(args.tasks).toEqual([{ title: "Send the deck to Dana by Friday" }]);
    expect(args.body).toContain("## Transcript");
    expect(args.body).toContain("I'll send the deck to Dana by Friday.");
    expect(args.body).toContain("## Pinned moments");
    expect(args.body).toContain("Audio was not stored");
  });

  test("Save → Undo toast with 5:00 → Undo removes it and the notes come back", async () => {
    const view = await render();
    await toReview(view);
    await click(findByTag(findAll(view, (n) => n.getAttribute("data-row") === "l0")[0] as TestNode, "BUTTON", "Accept"));
    await clickButton(view, "Save page and tasks");
    expect(view.textContent).toContain("Page saved. Tasks added: 1.");
    expect(view.textContent).toContain("5:00");
    expect(findByTag(view, "A", "Open the page").getAttribute("href")).toBe("/notes/notes:1");
    await clickButton(view, "Undo");
    expect(calls.undoSave).toHaveBeenCalledWith({ noteId: "notes:1", taskIds: ["tasks:1"] });
    expect(view.textContent).toContain("Undone. Nothing from this recording is saved");
    expect(view.textContent).toContain("Review before saving");
  });

  test("an empty title says so and nothing is saved", async () => {
    const view = await render();
    await toReview(view);
    await type(findById(view, "rec-title"), "   ");
    await clickButton(view, "Save page and tasks");
    expect(view.textContent).toContain("Give the page a title.");
    expect(calls.saveSession).not.toHaveBeenCalled();
  });

  test("with the model key, its proposal replaces the local rows and is labelled", async () => {
    availability = { live: false, reason: "no_key", minutesLeft: 0, proposals: true };
    calls.propose.mockImplementationOnce(async () => ({
      status: "ready",
      title: "Launch sync",
      summary: "We planned the launch.",
      tasks: [{ title: "Send the deck", minutes: 15 }],
    }));
    const view = await render();
    await toReview(view);
    expect(calls.propose).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain("Suggested by Tempo's assistant");
    expect(view.textContent).toContain("We planned the launch.");
    expect(view.textContent).toContain("15 min");
    expect(reactProps(findById(view, "rec-title")).value).toBe("Launch sync");
  });
});
