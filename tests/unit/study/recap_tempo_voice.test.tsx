/**
 * Tempo's voice on the audio recap: the pure choice between Tempo's voice and the device's, the
 * piece queue (at most `sentencesAhead` asked for ahead, transient clips, object URLs revoked),
 * and the mounted player falling back to the device's voice on any failure. No network: the
 * pieces come from a stand-in `fetchPiece` and the clips from a stand-in player.
 */
import { afterEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement, type ReactElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { translate } from "../../../apps/web/lib/i18n";
import { en, he } from "../../../apps/web/lib/i18n-groups/study";
import type { SpeakOptions, SpeechEngine } from "../../../apps/web/components/study/recap/speech";
import {
  type ClipPlayer,
  chooseVoice,
  createClipPlayer,
  createTempoReader,
  piecesAt,
  type TempoPiece,
  type TempoVoiceSource,
  windowFrom,
} from "../../../apps/web/components/study/recap/tempoVoice";
import { pageReading, speechPieces } from "../../../convex/lib/studyVoice";
import { VOICE_LIMITS } from "../../../convex/lib/voicePolicy";
import { findAll, installTestDom, type TestNode, useTestDom } from "../record/testDom";

const documentNode = installTestDom();

// The same faithful stand-ins as recap_player.test.tsx (mock.module is process-wide).
const realLocale = await import("../../../apps/web/components/providers/LocaleProvider");
mock.module("../../../apps/web/components/providers/LocaleProvider", () => ({
  ...realLocale,
  useLocale: () => ({
    lang: "en",
    dir: "ltr",
    setLang: () => {},
    t: (key: Parameters<typeof translate>[1]) => translate("en", key),
  }),
}));
const goalsShared = Bun.resolveSync("../../../apps/web/components/goals/shared", import.meta.dir);
mock.module(goalsShared, () => {
  const h = createElement;
  type Kids = { children?: unknown };
  return {
    UNDO_WINDOW_MS: 300_000,
    useSignedIn: () => "ready",
    useOnline: () => true,
    ScreenBoundary: ({ children }: Kids) => children,
    SignedOutState: () => h("div", { "data-component": "StateSignedOut" }),
    OfflineNotice: ({ text }: { text: string }) => h("output", { "data-component": "StateOffline" }, text),
    StateLoading: ({ label }: { label: string }) => h("output", { "data-component": "StateLoading" }, label),
    StateEmpty: ({ title, body, action }: { title: string; body: string; action?: unknown }) =>
      h("div", { "data-component": "StateEmpty" }, h("h2", null, title), h("p", null, body), action as never),
    StateError: ({ title, action }: { title: string; action?: unknown }) => h("div", { "data-component": "StateError" }, title, action as never),
    makeToast: (title: string) => ({ id: 1, title, undoUntilMs: 0 }),
    UndoToast: () => null,
  };
});

const { AudioRecapPlayer } = await import("../../../apps/web/components/study/recap/AudioRecapPlayer");
const { AudioRecapPlayerView, voiceNoteText } = await import("../../../apps/web/components/study/recap/AudioRecapPlayerView");
const player = await import("../../../apps/web/components/study/recap/player");

// A fictional page.
const PAGE = `# Cell biology, unit 2

Cells divide in two ways. Each has its own job.

Mitosis: cell division that makes two identical cells
Meiosis: cell division that makes four cells with half the chromosomes
`;
const { sentences } = pageReading(PAGE, "recap");
const pieces = speechPieces(sentences);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A clip player that records what it was given; the test ends clips by hand. */
function fakeClips() {
  const clips: { mime: string; rate: number; end: () => void; fail: () => void; cancelled: boolean }[] = [];
  const play: ClipPlayer = (clip, options) => {
    const entry = { mime: clip.mime, rate: options.rate, end: options.onEnd, fail: options.onError, cancelled: false };
    clips.push(entry);
    return {
      cancel() {
        entry.cancelled = true;
      },
    };
  };
  return { clips, play };
}

const audio = (): TempoPiece => ({ status: "audio", audio: new Uint8Array([1, 2, 3]).buffer, mime: "audio/wav", count: pieces.length });

describe("chooseVoice", () => {
  const available = { availability: { status: "available" as const, charsLeft: 900 }, online: true };
  test("Tempo's voice only when available, online, not failed and picked", () => {
    expect(chooseVoice({ source: available, pick: "tempo", down: null })).toEqual({ voice: "tempo", offered: true, note: null });
    expect(chooseVoice({ source: available, pick: "device", down: null })).toEqual({ voice: "device", offered: true, note: null });
    expect(chooseVoice({ source: undefined, pick: "tempo", down: null })).toEqual({ voice: "device", offered: false, note: null });
  });
  test("loading or off: the device's voice, with no line", () => {
    expect(chooseVoice({ source: { availability: undefined, online: true }, pick: "tempo", down: null })).toEqual({ voice: "device", offered: false, note: null });
    expect(chooseVoice({ source: { availability: { status: "off", charsLeft: 0 }, online: true }, pick: "tempo", down: null }).note).toBeNull();
  });
  test("budget, offline and a failure each say why", () => {
    expect(chooseVoice({ source: { availability: { status: "budget", charsLeft: 0 }, online: true }, pick: "tempo", down: null })).toEqual({ voice: "device", offered: false, note: "budget" });
    expect(chooseVoice({ source: { ...available, online: false }, pick: "tempo", down: null })).toEqual({ voice: "device", offered: false, note: "offline" });
    expect(chooseVoice({ source: available, pick: "tempo", down: "error" })).toEqual({ voice: "device", offered: false, note: "error" });
    expect(chooseVoice({ source: available, pick: "tempo", down: "budget" }).note).toBe("budget");
  });
});

describe("the piece queue", () => {
  test("pieces map back to their transcript sentence, and the server builds the same list", () => {
    expect(pieces.length).toBeGreaterThanOrEqual(sentences.length);
    expect(piecesAt(pieces, 0)).toEqual([0]);
    expect(pieces.every((piece) => piece.text.length <= VOICE_LIMITS.maxSentenceChars)).toBe(true);
    const long = speechPieces([{ text: `${"word ".repeat(100)}end.` }]);
    expect(long.length).toBeGreaterThan(1);
    expect(piecesAt(long, 0)).toEqual(long.map((_, index) => index));
  });

  test("the window is the piece playing plus at most sentencesAhead, within the reading", () => {
    expect(VOICE_LIMITS.sentencesAhead).toBe(2);
    expect(windowFrom(0, 10)).toEqual([0, 1, 2]);
    expect(windowFrom(8, 10)).toEqual([8, 9]);
    expect(windowFrom(3, 3)).toEqual([]);
  });

  test("reads a sentence's pieces in order, asking at most two ahead, then ends", async () => {
    const asked: number[] = [];
    const { clips, play } = fakeClips();
    const reader = createTempoReader({
      pieces,
      fetchPiece: async (index) => {
        asked.push(index);
        return audio();
      },
      play,
    });
    const ended: string[] = [];
    reader.speak(0, { rate: 1.25, onEnd: () => ended.push("end"), onError: () => ended.push("error") });
    await flush();
    expect(asked).toEqual([0, 1, 2]);
    expect(clips).toHaveLength(1);
    expect(clips[0]?.rate).toBe(1.25);
    clips[0]?.end();
    await flush();
    expect(ended).toEqual(["end"]);

    // The next sentence reuses what was asked for and asks only for the new end of the window.
    reader.speak(1, { rate: 1, onEnd: () => {}, onError: () => {} });
    await flush();
    expect(asked).toEqual([0, 1, 2, 3]);
  });

  test("a sentence with no pieces ends at once; done past the end ends too", async () => {
    const { play } = fakeClips();
    const reader = createTempoReader({ pieces: [{ text: "Only.", at: 1 }], fetchPiece: async () => ({ status: "done" }), play });
    const said: string[] = [];
    reader.speak(0, { rate: 1, onEnd: () => said.push("end0"), onError: () => said.push("error") });
    reader.speak(1, { rate: 1, onEnd: () => said.push("end1"), onError: () => said.push("error") });
    await flush();
    expect(said).toEqual(["end0", "end1"]);
  });

  test("a failed request, a failed clip and a spent day each report once, as error or exhausted", async () => {
    const { clips, play } = fakeClips();
    const failing = createTempoReader({ pieces, fetchPiece: async () => Promise.reject(new Error("offline")), play });
    const reasons: string[] = [];
    failing.speak(0, { rate: 1, onEnd: () => reasons.push("end"), onError: (r) => reasons.push(r) });
    await flush();
    const spent = createTempoReader({ pieces, fetchPiece: async () => ({ status: "exhausted" }), play });
    spent.speak(0, { rate: 1, onEnd: () => reasons.push("end"), onError: (r) => reasons.push(r) });
    await flush();
    const playing = createTempoReader({ pieces, fetchPiece: async () => audio(), play });
    playing.speak(0, { rate: 1, onEnd: () => reasons.push("end"), onError: (r) => reasons.push(r) });
    await flush();
    clips[0]?.fail();
    clips[0]?.fail();
    expect(reasons).toEqual(["error", "exhausted", "error"]);
  });

  test("stop cancels the clip and nothing more is reported", async () => {
    const { clips, play } = fakeClips();
    const reader = createTempoReader({ pieces, fetchPiece: async () => audio(), play });
    const said: string[] = [];
    const handle = reader.speak(0, { rate: 1, onEnd: () => said.push("end"), onError: () => said.push("error") });
    await flush();
    handle.cancel();
    expect(clips[0]?.cancelled).toBe(true);
    clips[0]?.end();
    await flush();
    expect(said).toEqual([]);
  });
});

describe("the <audio> clip player", () => {
  function env() {
    const made: Record<string, unknown>[] = [];
    const urls = { created: [] as string[], revoked: [] as string[] };
    let playResult: Promise<void> = Promise.resolve();
    const player = createClipPlayer({
      makeAudio: () => {
        const element = {
          src: "",
          playbackRate: 1,
          onended: null as (() => void) | null,
          onerror: null as (() => void) | null,
          paused: false,
          play: () => playResult,
          pause() {
            element.paused = true;
          },
          removeAttribute(name: string) {
            if (name === "src") element.src = "";
          },
        };
        made.push(element);
        return element;
      },
      createUrl: () => {
        const url = `blob:clip-${urls.created.length}`;
        urls.created.push(url);
        return url;
      },
      revokeUrl: (url) => urls.revoked.push(url),
    });
    return { made, urls, player, failNextPlay: () => (playResult = Promise.reject(new Error("blocked"))) };
  }
  const clip = { bytes: new Uint8Array([1]).buffer, mime: "audio/wav" };

  test("plays at the rate and revokes its URL when it ends", () => {
    const { made, urls, player } = env();
    const said: string[] = [];
    player(clip, { rate: 1.5, onEnd: () => said.push("end"), onError: () => said.push("error") });
    const element = made[0] as { src: string; playbackRate: number; onended: () => void };
    expect(element.src).toBe("blob:clip-0");
    expect(element.playbackRate).toBe(1.5);
    element.onended();
    expect(said).toEqual(["end"]);
    expect(urls.revoked).toEqual(["blob:clip-0"]);
    expect(element.src).toBe("");
  });

  test("stop and an error revoke too, once", async () => {
    const { made, urls, player, failNextPlay } = env();
    const said: string[] = [];
    const handle = player(clip, { rate: 1, onEnd: () => said.push("end"), onError: () => said.push("error") });
    handle.cancel();
    handle.cancel();
    expect(urls.revoked).toEqual(["blob:clip-0"]);
    expect((made[0] as { paused: boolean }).paused).toBe(true);
    player(clip, { rate: 1, onEnd: () => said.push("end"), onError: () => said.push("error") });
    (made[1] as { onerror: () => void }).onerror();
    failNextPlay();
    player(clip, { rate: 1, onEnd: () => said.push("end"), onError: () => said.push("error") });
    await flush();
    expect(said).toEqual(["error", "error"]);
    expect(urls.revoked).toEqual(["blob:clip-0", "blob:clip-1", "blob:clip-2"]);
  });
});

describe("the view", () => {
  const base = {
    noteId: "notes:11",
    title: "Cell biology, unit 2",
    mode: "recap",
    lang: "en",
    sentences,
    timeline: [],
    state: player.initialPlayer,
    status: "ready",
    elapsed: 0,
    onAction: () => {},
    question: "",
    onQuestion: () => {},
    answers: null,
    onAsk: () => {},
    idBase: "p",
  };
  const voice = { offered: true, pick: "tempo", onPick: () => {}, note: null, deviceReads: false };

  test("offered: a labelled Voice choice beside Speed, Play still the one primary", () => {
    const markup = renderToStaticMarkup(createElement(AudioRecapPlayerView, { ...base, voice } as never));
    expect(markup).toContain('data-component="RecapVoice"');
    expect(markup).toMatch(/aria-checked="true"[^>]*>Tempo voice</);
    expect(markup).toContain("This device&#x27;s voice");
    expect(markup.match(/tp-btn--primary/g)).toHaveLength(1);
  });

  test("not offered: no choice, and the line says why and who reads", () => {
    const markup = renderToStaticMarkup(
      createElement(AudioRecapPlayerView, { ...base, voice: { ...voice, offered: false, note: "budget", deviceReads: true } } as never)
    );
    expect(markup).not.toContain('data-component="RecapVoice"');
    expect(markup).toContain("used up. It&#x27;s back tomorrow. This device&#x27;s voice is reading instead.");
    const t = (key: Parameters<typeof translate>[1]) => translate("en", key);
    expect(voiceNoteText(t, { ...voice, note: "error", deviceReads: false } as never)).toBe("Tempo's voice isn't available right now.");
    expect(voiceNoteText(t, undefined)).toBe("");
  });

  test("copy: en and he for every new key, no em dash", () => {
    const keys = Object.keys(en).filter((key) => key.startsWith("st.ls.voice") || key.startsWith("st.ls.tv.")) as (keyof typeof en)[];
    expect(keys.length).toBe(7);
    for (const key of keys) {
      expect(he[key]?.trim().length).toBeGreaterThan(0);
      expect(`${en[key]} ${he[key]}`).not.toContain("—");
    }
  });
});

describe("the mounted player with Tempo's voice", () => {
  let root: Root | null = null;
  let host: TestNode | null = null;
  async function mount(node: ReactElement) {
    useTestDom(documentNode);
    host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
    await act(async () => {
      root?.render(node);
    });
    return host;
  }
  async function click(node: TestNode | undefined) {
    if (!node) throw new Error("nothing to click");
    await act(async () => {
      node.click();
      await flush();
    });
  }
  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null;
    host = null;
  });
  const byAction = (view: TestNode, action: string) => findAll(view, (n) => n.getAttribute?.("data-action") === action);
  const note = (view: TestNode) => findAll(view, (n) => n.hasAttribute?.("data-voice-note") || (n.getAttribute?.("aria-live") === "polite" && n.textContent.includes("Tempo")))[0]?.textContent ?? "";

  function deviceVoice() {
    const said: { text: string; options: SpeakOptions }[] = [];
    const engine: SpeechEngine = {
      available: () => true,
      speak(text, options) {
        said.push({ text, options });
        return { cancel() {} };
      },
    };
    return { engine, said };
  }
  function tempoSource(fetchPiece: (index: number) => Promise<TempoPiece>, play: ClipPlayer, status: "available" | "budget" = "available"): TempoVoiceSource {
    return { availability: { status, charsLeft: status === "available" ? 900 : 0 }, online: true, fetchPiece, play };
  }
  const playerOf = (engine: SpeechEngine, tempo: TempoVoiceSource) =>
    createElement(AudioRecapPlayer, { noteId: "notes:11", title: "Cells", body: PAGE, mode: "recap", engine, tempo });

  test("reads in Tempo's voice by piece index, never with the device's", async () => {
    const asked: number[] = [];
    const { clips, play } = fakeClips();
    const device = deviceVoice();
    const view = await mount(playerOf(device.engine, tempoSource(async (index) => (asked.push(index), audio()), play)));
    await click(byAction(view, "recap-play")[0]);
    expect(asked).toEqual([0, 1, 2]);
    expect(clips).toHaveLength(1);
    expect(device.said).toEqual([]);
    await act(async () => {
      clips[0]?.end();
      await flush();
    });
    // Sentence 2 now plays from what was already asked for.
    expect(clips).toHaveLength(2);
    expect(findAll(view, (n) => n.getAttribute?.("aria-current") === "true")[0]?.textContent).toContain(sentences[1]?.text ?? "");
  });

  test("a failure hands the same sentence to the device's voice and says so politely", async () => {
    const { play } = fakeClips();
    const device = deviceVoice();
    const view = await mount(playerOf(device.engine, tempoSource(async () => Promise.reject(new Error("down")), play)));
    await click(byAction(view, "recap-play")[0]);
    await act(flush);
    expect(device.said.map((call) => call.text)).toEqual([sentences[0]?.text]);
    expect(note(view)).toBe("Tempo's voice isn't available right now. This device's voice is reading instead.");
    expect(findAll(view, (n) => n.getAttribute?.("data-component") === "RecapVoice")).toHaveLength(0);
  });

  test("today's characters spent mid-reading: the device's voice reads on, with the budget line", async () => {
    const { play } = fakeClips();
    const device = deviceVoice();
    const view = await mount(playerOf(device.engine, tempoSource(async () => ({ status: "exhausted" }), play)));
    await click(byAction(view, "recap-play")[0]);
    await act(flush);
    expect(device.said).toHaveLength(1);
    expect(note(view)).toContain("used up");
  });

  test("picking This device's voice reads with the device", async () => {
    const asked: number[] = [];
    const { play } = fakeClips();
    const device = deviceVoice();
    const view = await mount(playerOf(device.engine, tempoSource(async (index) => (asked.push(index), audio()), play)));
    await click(findAll(view, (n) => n.getAttribute?.("data-voice") === "device")[0]);
    await click(byAction(view, "recap-play")[0]);
    expect(asked).toEqual([]);
    expect(device.said).toHaveLength(1);
  });
});
