/**
 * MiniAppFrame mounted (kitchen T10, S24): a widget that navigates its own frame is taken down,
 * and an approval holds only for the code it was given. The DOM is the small TestNode harness
 * from tests/unit/record; the locale is mocked the way RecordSession.test.tsx does it.
 */
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { type MessageKey, translate } from "../../../apps/web/lib/i18n";
import { findAll, findByTag, installTestDom, queryByTag, reactProps, type TestNode, useTestDom } from "../record/testDom";

const documentNode = installTestDom();

const webDir = `${process.cwd()}/apps/web`;
const localeProvider = Bun.resolveSync("@/components/providers/LocaleProvider", webDir);
const previous = { ...(await import(localeProvider)) };
mock.module(localeProvider, () => ({
  ...previous,
  useLocale: () => ({ lang: "en", dir: "ltr", setLang() {}, t: (key: MessageKey) => translate("en", key) }),
}));
afterAll(() => {
  mock.module(localeProvider, () => previous);
});

const { MiniAppFrame } = await import("../../../apps/web/components/mini-app/MiniAppFrame?mini-frame-test");
const { miniAppFingerprint } = await import("../../../apps/web/components/mini-app/mini-app");

const HTML = "<p>Hello</p><script>parent.postMessage({type:'tempo:done'},'*')</script>";

let root: Root | null = null;
let host: TestNode | null = null;

async function render(props: { html: string; approvedFingerprint: string | null; onApprove?: (f: string) => void }) {
  useTestDom(documentNode);
  if (!host) {
    host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
  }
  await act(async () => {
    root?.render(createElement(MiniAppFrame, { title: "Timer", onApprove: () => {}, ...props }));
  });
  return host as TestNode;
}

async function frameLoad(view: TestNode) {
  const frame = findByTag(view, "IFRAME");
  const onLoad = reactProps(frame).onLoad as (() => void) | undefined;
  if (!onLoad) throw new Error("The iframe has no onLoad");
  await act(async () => {
    onLoad();
  });
}

const state = (view: TestNode) =>
  findAll(view, (n) => n.getAttribute("data-component") === "MiniAppFrame")[0]?.getAttribute("data-state");

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host) documentNode.body?.removeChild(host);
  root = null;
  host = null;
});

describe("MiniAppFrame navigation guard", () => {
  test("the srcdoc's own load keeps it running; a second load (navigation) takes the frame down", async () => {
    const view = await render({ html: HTML, approvedFingerprint: miniAppFingerprint(HTML) });
    expect(state(view)).toBe("running");
    await frameLoad(view);
    expect(queryByTag(view, "IFRAME")).not.toBeNull();
    await frameLoad(view);
    expect(queryByTag(view, "IFRAME")).toBeNull();
    expect(state(view)).toBe("stopped");
    expect(view.textContent).toContain("This widget tried to open another page, so Tempo stopped it.");
    expect(view.textContent).not.toContain("Run this widget");
  });
});

describe("MiniAppFrame approval", () => {
  test("Run approves the fingerprint of the code shown; new code needs approval again", async () => {
    const approvals: string[] = [];
    let view = await render({ html: HTML, approvedFingerprint: null, onApprove: (f) => approvals.push(f) });
    await act(async () => {
      findByTag(view, "BUTTON", "Run this widget").click();
    });
    expect(approvals).toEqual([miniAppFingerprint(HTML)]);

    view = await render({ html: HTML, approvedFingerprint: approvals[0] ?? null });
    expect(state(view)).toBe("running");

    const changed = `${HTML}<script>location.href='https://example.test/'</script>`;
    view = await render({ html: changed, approvedFingerprint: approvals[0] ?? null });
    expect(queryByTag(view, "IFRAME")).toBeNull();
    expect(state(view)).toBe("ask");
    expect(view.textContent).toContain("Run this widget");
  });
});

describe("MiniAppFrame stopped: Run it again", () => {
  test("a stopped widget offers Run it again, which starts a fresh frame its own load doesn't stop", async () => {
    const approved = miniAppFingerprint(HTML);
    let view = await render({ html: HTML, approvedFingerprint: approved });
    await frameLoad(view);
    await frameLoad(view);
    expect(state(view)).toBe("stopped");
    await act(async () => {
      findByTag(view, "BUTTON", "Run it again").click();
    });
    expect(state(view)).toBe("running");
    // The new frame's first load is the srcdoc's own: it keeps running.
    await frameLoad(view);
    expect(state(view)).toBe("running");
    // Navigating again takes it down again.
    await frameLoad(view);
    expect(state(view)).toBe("stopped");

    // Without the approval for this code, Run it again asks first instead of running.
    view = await render({ html: HTML, approvedFingerprint: null });
    await act(async () => {
      findByTag(view, "BUTTON", "Run it again").click();
    });
    expect(state(view)).toBe("ask");
    expect(queryByTag(view, "IFRAME")).toBeNull();
  });
});

describe("MiniAppFrame Run it again: focus", () => {
  test("the keyboard goes to the new frame, or to Run this widget when the approval no longer holds", async () => {
    const focused: string[] = [];
    const proto = Object.getPrototypeOf(documentNode) as { focus: (this: TestNode) => void };
    const plain = proto.focus;
    proto.focus = function (this: TestNode) {
      focused.push(this.tagName === "BUTTON" ? `BUTTON:${this.textContent}` : this.tagName);
    };
    try {
      const approved = miniAppFingerprint(HTML);
      let view = await render({ html: HTML, approvedFingerprint: approved });
      await frameLoad(view);
      await frameLoad(view);
      await act(async () => {
        findByTag(view, "BUTTON", "Run it again").click();
      });
      expect(focused.at(-1)).toBe("IFRAME");

      await frameLoad(view);
      await frameLoad(view);
      view = await render({ html: HTML, approvedFingerprint: null });
      await act(async () => {
        findByTag(view, "BUTTON", "Run it again").click();
      });
      expect(state(view)).toBe("ask");
      expect(focused.at(-1)).toBe("BUTTON:Run this widget");
    } finally {
      proto.focus = plain;
    }
  });
});
