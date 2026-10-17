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
  undoSave: mock(async (_args: unknown): Promise<Record<string, unknown>> => ({ success: true, removedTasks: 1 })),
  redoUndo: mock(async (_args: unknown) => ({ success: true, restoredTasks: 1 })),
  propose: mock(async (_args: unknown): Promise<Record<string, unknown>> => ({ status: "unavailable", reason: "no_key" })),
};

function installModuleMocks() {
  mock.module(recordApi, () => ({
    useRecordingAvailability: () => availability,
    useRecordingSave: () => ({
      propose: calls.propose,
      saveSession: calls.saveSession,
      undoSave: calls.undoSave,
      redoUndo: calls.redoUndo,
    }),
    useRecordingLease: () => ({ startLease: calls.start, renewLease: calls.renew, stopLease: calls.stop, grant: calls.grant }),
    useRecordingAccount: () => null,
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

  test("Undo that also took changes made since says so and offers Bring it back (HARD_RULES §1)", async () => {
    const view = await render();
    await toReview(view);
    await click(findByTag(findAll(view, (n) => n.getAttribute("data-row") === "l0")[0] as TestNode, "BUTTON", "Accept"));
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession.mock.calls[0]?.[0]).toMatchObject({ lang: "en" });
    calls.undoSave.mockImplementationOnce(async () => ({
      success: true,
      removedTasks: 1,
      removedDone: 1,
      redoUntil: Date.now() + 5 * 60_000,
    }));
    await clickButton(view, "Undo");
    // Undo always takes the save back, in one click.
    expect(view.textContent).toContain("Undone. Nothing from this recording is saved");
    expect(view.textContent).toContain("Review before saving");
    expect(view.textContent).toContain("Removed the page and its tasks, with the changes made since.");
    expect(view.textContent).toContain("You can bring it back for");
    expect(view.textContent).toContain("5:00");
    await clickButton(view, "Bring it back");
    expect(calls.redoUndo).toHaveBeenCalledWith({ noteId: "notes:1" });
    expect(view.textContent).toContain("Brought back: the page and its tasks, with the changes made since.");
    expect(findAll(view, (n) => n.getAttribute("data-rec-restored") !== null)).toHaveLength(1);
    expect(findByTag(view, "A", "Open the page").getAttribute("href")).toBe("/notes/notes:1");
    expect(view.textContent).not.toContain("Undone. Nothing from this recording is saved");
    expect(queryByTag(view, "BUTTON", "Bring it back")).toBeNull();
  });

  test("a save with no tasks names only the page", async () => {
    const view = await render();
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    calls.undoSave.mockImplementationOnce(async () => ({ success: true, removedTasks: 0, removedEdits: true }));
    await clickButton(view, "Undo");
    expect(view.textContent).toContain("Removed the page, with the changes made since.");
    expect(view.textContent).not.toContain("its tasks");
  });

  test("a plain Undo offers nothing to bring back", async () => {
    const view = await render();
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    await clickButton(view, "Undo");
    expect(view.textContent).toContain("Undone. Nothing from this recording is saved");
    expect(queryByTag(view, "BUTTON", "Bring it back")).toBeNull();
  });

  test("Bring it back that doesn't go through says so and stays on offer", async () => {
    const view = await render();
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    calls.undoSave.mockImplementationOnce(async () => ({ success: true, removedTasks: 0, removedEdits: true }));
    calls.redoUndo.mockImplementationOnce(async () => {
      throw new Error("The 5 minutes to bring this back have passed.");
    });
    await clickButton(view, "Undo");
    await clickButton(view, "Bring it back");
    expect(view.textContent).toContain("That didn't come back. Try again in a moment.");
    expect(queryByTag(view, "BUTTON", "Bring it back")).not.toBeNull();
    expect(view.textContent).toContain("Review before saving");
  });

  test("after saving, the page can go straight to a flashcards, quiz or test preview", async () => {
    const view = await render();
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    const study = findAll(view, (n) => n.getAttribute("data-rec-study") !== null)[0] as TestNode;
    expect(study.getAttribute("aria-label")).toBe("Study this page");
    expect(findByTag(study, "A", "Flashcards").getAttribute("href")).toBe("/study/new?from=notes%3A1&kind=flashcards");
    expect(findByTag(study, "A", "Quiz").getAttribute("href")).toBe("/study/new?from=notes%3A1&kind=quiz");
    expect(findByTag(study, "A", "Practice test").getAttribute("href")).toBe("/study/new?from=notes%3A1&kind=test");
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

// Kitchen states pass: offline and "still checking" said in words, and an offline Save that waits
// for the connection instead of spinning.
async function renderWith(props: { online: boolean }) {
  useTestDom(documentNode);
  if (!host) {
    host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  }
  await act(async () => {
    root?.render(createElement(RecordSession, props));
  });
  return host as TestNode;
}

describe("states", () => {
  test("while live words' availability is still loading, the screen says it is checking", async () => {
    availability = undefined;
    const view = await render();
    expect(view.textContent).toContain("Checking whether live words are available.");
    expect(view.textContent).not.toContain("Live words aren't available");
    // Typing works while it checks.
    expect(findByTag(view, "BUTTON", "Type or paste notes").disabled).toBe(false);
  });

  test("once it is known, the checking line goes", async () => {
    const view = await render();
    expect(view.textContent).not.toContain("Checking whether live words are available.");
  });

  test("offline: a notice says so, Save waits in words, and saves by itself once back online", async () => {
    let view = await renderWith({ online: false });
    expect(view.textContent).toContain("You're offline. Your notes stay here, and saving waits until you're back.");
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).not.toHaveBeenCalled();
    const waiting = findByTag(view, "BUTTON", "Saves when you're back online");
    expect(waiting.disabled).toBe(false);
    expect(waiting.getAttribute("aria-disabled")).toBe("true");
    // Pressing it again changes nothing.
    await click(waiting);
    expect(calls.saveSession).not.toHaveBeenCalled();

    view = await renderWith({ online: true });
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
    expect(view.textContent).not.toContain("You're offline.");
    expect(view.textContent).toContain("Saved");
  });

  test("offline: going back to the notes drops the waiting save", async () => {
    let view = await renderWith({ online: false });
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    await clickButton(view, "Back to notes");
    view = await renderWith({ online: true });
    expect(calls.saveSession).not.toHaveBeenCalled();
    expect(findById(view, "rec-typed").tagName).toBe("TEXTAREA");
  });
});

describe("states: a waiting save checks the title again", () => {
  test("a title cleared while the save waits: nothing is sent, and the field says so", async () => {
    let view = await renderWith({ online: false });
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    await type(findById(view, "rec-title"), "");
    view = await renderWith({ online: true });
    expect(calls.saveSession).not.toHaveBeenCalled();
    expect(view.textContent).toContain("Give the page a title.");
    expect(findById(view, "rec-title").getAttribute("aria-invalid")).toBe("true");
    // The wait is over: Save is a plain Save again.
    expect(findByTag(view, "BUTTON", "Save page and tasks")).toBeTruthy();
    // Typing a title clears the mark, and Save works.
    await type(findById(view, "rec-title"), "Launch sync");
    expect(view.textContent).not.toContain("Give the page a title.");
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
  });
});

describe("states: Undo and Bring it back offline", () => {
  test("offline, Undo sends nothing and the toast says so; back online, one click undoes", async () => {
    let view = await renderWith({ online: true });
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    view = await renderWith({ online: false });
    await clickButton(view, "Undo");
    expect(calls.undoSave).not.toHaveBeenCalled();
    expect(view.textContent).toContain("You're offline, so nothing was undone.");
    view = await renderWith({ online: true });
    await clickButton(view, "Undo");
    expect(calls.undoSave).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain("Undone. Nothing from this recording is saved");
  });

  test("offline, Bring it back sends nothing and says so", async () => {
    let view = await renderWith({ online: true });
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    calls.undoSave.mockImplementationOnce(async () => ({
      success: true,
      removedTasks: 1,
      removedEdits: true,
      redoUntil: Date.now() + 5 * 60_000,
    }));
    await clickButton(view, "Undo");
    view = await renderWith({ online: false });
    await clickButton(view, "Bring it back");
    expect(calls.redoUndo).not.toHaveBeenCalled();
    expect(view.textContent).toContain("You're offline, so nothing came back.");
  });
});

// Review: once the recorder was ready, a session that reads "loading" again or signed out must
// not unmount it (the notes and live words can't be recovered).
const { RecordKeeper } = await import("../../../apps/web/components/study/record/RecordSession?record-test");

async function renderKeeper(signedIn: "loading" | "ready" | "signedOut", online = true) {
  useTestDom(documentNode);
  if (!host) {
    host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  }
  await act(async () => {
    root?.render(
      createElement(RecordKeeper, {
        signedIn,
        online,
        before: (state: string) => createElement("p", { "data-before": state }, `before:${state}`),
      }),
    );
  });
  return host as TestNode;
}

describe("RecordKeeper", () => {
  test("before the first ready it draws the gate's own states", async () => {
    let view = await renderKeeper("loading");
    expect(view.textContent).toContain("before:loading");
    view = await renderKeeper("signedOut");
    expect(view.textContent).toContain("before:signedOut");
    expect(view.textContent).not.toContain("Before you start");
  });

  test("ready → loading → ready keeps the session and its notes", async () => {
    let view = await renderKeeper("ready");
    await clickButton(view, "Type or paste notes");
    await type(findById(view, "rec-typed"), NOTES);
    view = await renderKeeper("loading");
    expect(view.textContent).not.toContain("before:");
    expect(reactProps(findById(view, "rec-typed")).value).toBe(NOTES);
    view = await renderKeeper("ready");
    expect(reactProps(findById(view, "rec-typed")).value).toBe(NOTES);
  });

  test("ready → signed out keeps the notes, says so, and Save waits for the sign-in", async () => {
    let view = await renderKeeper("ready");
    await toReview(view);
    view = await renderKeeper("signedOut");
    expect(view.textContent).toContain("You're signed out. Your notes stay on this screen");
    expect(findByTag(view, "A", "Sign in in a new tab").getAttribute("target")).toBe("_blank");
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).not.toHaveBeenCalled();
    expect(findByTag(view, "BUTTON", "Saves once you sign in again").getAttribute("aria-disabled")).toBe("true");
    view = await renderKeeper("ready");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
    expect(view.textContent).not.toContain("You're signed out.");
  });
});

describe("Bring it back offers the save's own Undo again", () => {
  test("after Bring it back, Undo is there while the save's window is open", async () => {
    const view = await render();
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    calls.undoSave.mockImplementationOnce(async () => ({
      success: true,
      removedTasks: 1,
      removedEdits: true,
      redoUntil: Date.now() + 5 * 60_000,
    }));
    await clickButton(view, "Undo");
    await clickButton(view, "Bring it back");
    expect(calls.redoUndo).toHaveBeenCalledTimes(1);
    await clickButton(view, "Undo");
    expect(calls.undoSave).toHaveBeenCalledTimes(2);
  });

  test("not once the save's window has ended", async () => {
    calls.saveSession.mockImplementationOnce(async () => ({ noteId: "notes:1", taskIds: [], undoUntil: Date.now() + 50 }));
    const view = await render();
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    calls.undoSave.mockImplementationOnce(async () => ({
      success: true,
      removedTasks: 0,
      removedEdits: true,
      redoUntil: Date.now() + 5 * 60_000,
    }));
    await clickButton(view, "Undo");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });
    await clickButton(view, "Bring it back");
    expect(queryByTag(view, "BUTTON", "Undo")).toBeNull();
  });
});

// Review (privacy): RecordKeeper knows whose screen it is. Nothing is sent while the session is
// checked again, and a different account signing in on this browser never gets the first person's
// words, rows or waiting save.
async function renderKeeperAs(signedIn: "loading" | "ready" | "signedOut", accountId: string | null, online = true) {
  useTestDom(documentNode);
  if (!host) {
    host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  }
  await act(async () => {
    root?.render(
      createElement(RecordKeeper, {
        signedIn,
        accountId,
        online,
        before: (state: string) => createElement("p", { "data-before": state }, `before:${state}`),
      }),
    );
  });
  return host as TestNode;
}

describe("RecordKeeper: the same person only", () => {
  test("ready → loading: Save sends nothing and no notice appears; ready again (same account) sends it once", async () => {
    let view = await renderKeeperAs("ready", "users:a");
    await toReview(view);
    view = await renderKeeperAs("loading", null);
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).not.toHaveBeenCalled();
    expect(view.textContent).not.toContain("You're signed out.");
    view = await renderKeeperAs("ready", "users:a");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
    view = await renderKeeperAs("ready", "users:a");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
  });

  test("ready (A) → signed out → ready (B): nothing is sent and A's words are gone", async () => {
    let view = await renderKeeperAs("ready", "users:a");
    await toReview(view);
    expect(view.textContent).toContain("Send the deck to Dana by Friday");
    view = await renderKeeperAs("signedOut", null);
    await clickButton(view, "Save page and tasks");
    view = await renderKeeperAs("loading", null);
    view = await renderKeeperAs("ready", "users:b");
    expect(calls.saveSession).not.toHaveBeenCalled();
    expect(view.textContent).not.toContain("Send the deck to Dana by Friday");
    expect(view.textContent).not.toContain("We met about the launch");
    expect(queryByTag(view, "BUTTON", "Save page and tasks")).toBeNull();
    expect(findByTag(view, "BUTTON", "Type or paste notes")).toBeTruthy();
    expect(view.textContent).not.toContain("You're signed out.");
    // B's own screen works, and stays with B.
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
  });

  test("ready (A) → signed out → ready (A): the waiting save goes", async () => {
    let view = await renderKeeperAs("ready", "users:a");
    await toReview(view);
    view = await renderKeeperAs("signedOut", null);
    await clickButton(view, "Save page and tasks");
    expect(calls.saveSession).not.toHaveBeenCalled();
    view = await renderKeeperAs("ready", "users:a");
    expect(calls.saveSession).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain("Page saved.");
  });
});

describe("RecordKeeper: Undo and Bring it back while signed out", () => {
  test("signed out, Undo sends nothing and the toast says so; signed in again, one click undoes", async () => {
    let view = await renderKeeperAs("ready", "users:a");
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    view = await renderKeeperAs("signedOut", null);
    await clickButton(view, "Undo");
    expect(calls.undoSave).not.toHaveBeenCalled();
    expect(view.textContent).toContain("You're not signed in right now, so nothing was undone.");
    view = await renderKeeperAs("ready", "users:a");
    await clickButton(view, "Undo");
    expect(calls.undoSave).toHaveBeenCalledTimes(1);
  });

  test("signed out, Bring it back sends nothing and says so", async () => {
    let view = await renderKeeperAs("ready", "users:a");
    await toReview(view);
    await clickButton(view, "Save page and tasks");
    calls.undoSave.mockImplementationOnce(async () => ({
      success: true,
      removedTasks: 1,
      removedEdits: true,
      redoUntil: Date.now() + 5 * 60_000,
    }));
    await clickButton(view, "Undo");
    view = await renderKeeperAs("signedOut", null);
    await clickButton(view, "Bring it back");
    expect(calls.redoUndo).not.toHaveBeenCalled();
    expect(view.textContent).toContain("You're not signed in right now, so nothing came back.");
  });
});
