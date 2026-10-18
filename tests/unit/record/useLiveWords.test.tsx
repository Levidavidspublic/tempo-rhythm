/**
 * useLiveWords (kitchen T8, S7): when the recorder can't be made or started once the socket opens,
 * the microphone and the socket are released and the hook says "connect". The DOM is the small
 * TestNode harness; recordApi is mocked the way RecordSession.test.tsx does it, and MediaRecorder,
 * WebSocket and getUserMedia are fakes.
 */
import { afterAll, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot } from "../../../apps/web/node_modules/react-dom/client";
import { installTestDom, useTestDom } from "./testDom";

const documentNode = installTestDom();

const webDir = `${process.cwd()}/apps/web`;
const recordApi = Bun.resolveSync("./components/study/record/recordApi", webDir);
const previous = { ...(await import(recordApi)) };

const calls = {
  start: mock(async (_args: unknown) => ({ ok: true, sessionId: "recordingSessions:1", minutesLeft: 10, renewEveryMs: 60_000 })),
  renew: mock(async (_args: unknown) => ({ status: "ok", minutesLeft: 10 })),
  stop: mock(async (_args: unknown) => null),
  grant: mock(async (_args: unknown) => ({ ok: true, url: "wss://speech.example.test/listen", token: "t" })),
};
mock.module(recordApi, () => ({
  ...previous,
  useRecordingLease: () => ({ startLease: calls.start, renewLease: calls.renew, stopLease: calls.stop, grant: calls.grant }),
}));

const g = globalThis as Record<string, unknown>;
const savedGlobals = { MediaRecorder: g.MediaRecorder, WebSocket: g.WebSocket, navigator: g.navigator };

afterAll(() => {
  mock.module(recordApi, () => previous);
  g.MediaRecorder = savedGlobals.MediaRecorder;
  g.WebSocket = savedGlobals.WebSocket;
  g.navigator = savedGlobals.navigator;
});

const { useLiveWords } = await import("../../../apps/web/components/study/record/useLiveWords?live-words-test");

class FakeSocket {
  static OPEN = 1;
  static last: FakeSocket | null = null;
  readyState = 1;
  closed = false;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeSocket.last = this;
  }
  send(data: unknown) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
}

describe("useLiveWords", () => {
  test("a recorder that throws on open releases the mic and the socket and says connect", async () => {
    useTestDom(documentNode);
    const track = { stopped: false, enabled: true, stop() {
      this.stopped = true;
    } };
    const media = { getTracks: () => [track], getAudioTracks: () => [track] };
    g.navigator = { userAgent: "bun-test", mediaDevices: { getUserMedia: async () => media } };
    g.WebSocket = FakeSocket;
    g.MediaRecorder = class {
      static isTypeSupported() {
        return true;
      }
      constructor() {
        throw new Error("NotSupportedError");
      }
    };

    let live: ReturnType<typeof useLiveWords> | null = null;
    function Probe() {
      live = useLiveWords({ lang: "en", onFinal: () => {}, onInterim: () => {} });
      return null;
    }
    const host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    const root = createRoot(host as unknown as HTMLElement);
    await act(async () => {
      root.render(createElement(Probe));
    });
    await act(async () => {
      await live?.start({ reducedMotion: true });
    });
    const ws = FakeSocket.last;
    expect(ws).not.toBeNull();
    expect(track.stopped).toBe(false);

    let thrown: unknown = null;
    await act(async () => {
      try {
        ws?.onopen?.();
      } catch (error) {
        thrown = error;
      }
    });
    expect(thrown).toBeNull();
    expect(track.stopped).toBe(true);
    expect(ws?.closed).toBe(true);
    expect(calls.stop).toHaveBeenCalledTimes(1);
    expect((live as ReturnType<typeof useLiveWords> | null)?.issue).toBe("connect");

    await act(async () => {
      root.unmount();
    });
    documentNode.body?.removeChild(host);
  });
});
