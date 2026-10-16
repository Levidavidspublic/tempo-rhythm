/**
 * Kitchen T4 S16: the audio recap player and read-aloud. Static renders and pure logic, in the
 * style of study_screens.test.tsx (the repo has no DOM library): the player's states, its
 * reducer and skip, the speed control's keys, the speech seam over a fake SpeechSynthesis, the
 * set screen's Listen link and the copy.
 */
import { afterEach, describe, expect, mock, test } from "bun:test";
// react is only installed under apps/web (not the repo root), so import it from there.
import { act, createElement, type ReactElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { renderToStaticMarkup } from "../../../apps/web/node_modules/react-dom/server";
import { translate } from "../../../apps/web/lib/i18n";
import { en, he } from "../../../apps/web/lib/i18n-groups/study";
import type { SpeakOptions, SpeechEngine } from "../../../apps/web/components/study/recap/speech";
import { buildRecap, estimateTimeline } from "../../../packages/core/recap";
import { findAll, installTestDom, type TestNode, useTestDom } from "../record/testDom";

// The small TestNode DOM (tests/unit/record/testDom) for the player's mounted tests below.
const documentNode = installTestDom();

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

// Same stand-in for components/goals/shared as study_screens.test.tsx (convex/react is replaced
// process-wide by other tests, so the real module can't link here).
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

const { AudioRecapPlayerView, rateForKey } = await import("../../../apps/web/components/study/recap/AudioRecapPlayerView");
const { AudioRecapPlayer } = await import("../../../apps/web/components/study/recap/AudioRecapPlayer");
const { ListenStates } = await import("../../../apps/web/components/study/recap/ListenScreen");
const { StudySetView } = await import("../../../apps/web/components/study/StudySetView");
const player = await import("../../../apps/web/components/study/recap/player");
const speech = await import("../../../apps/web/components/study/recap/speech");
const { speechStatus } = await import("../../../apps/web/components/study/recap/useReadAloud");

const html = (node: ReactElement) => renderToStaticMarkup(node);
const primaries = (markup: string) => markup.match(/tp-btn--primary/g)?.length ?? 0;
const BANNED = /\b(failed|must|overdue|streaks?|points? earned|level up|leaderboard)\b|—/i;

const PAGE = `# Cell biology, unit 2

Cells divide in two ways. Each has its own job.

Mitosis: cell division that makes two identical cells
Meiosis: cell division that makes four cells with half the chromosomes

## Steps of mitosis

1. Prophase
2. Metaphase
3. Anaphase
4. Telophase
`;

const sentences = buildRecap(PAGE, { lang: "en" });
const timeline = estimateTimeline(sentences);

function view(overrides: Record<string, unknown> = {}) {
  return createElement(AudioRecapPlayerView, {
    noteId: "notes:11",
    title: "Cell biology, unit 2",
    mode: "recap",
    lang: "en",
    sentences,
    timeline,
    state: player.initialPlayer,
    status: "ready",
    elapsed: 0,
    onAction: () => {},
    question: "",
    onQuestion: () => {},
    answers: null,
    onAsk: () => {},
    idBase: "p",
    ...overrides,
  } as never);
}

describe("AudioRecapPlayer view", () => {
  test("ready: one primary Play, back 15 s and forward 30 s, speed 0.75 to 2, times in tp-num", () => {
    const markup = html(view());
    expect(markup).toContain('data-component="AudioRecapPlayer"');
    expect(primaries(markup)).toBe(1);
    expect(markup).toContain('data-action="recap-play"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain("<span>Play</span>");
    expect(markup).toContain('aria-label="Back 15 seconds"');
    expect(markup).toContain('aria-label="Forward 30 seconds"');
    expect(markup).toContain('<span class="tp-num">15</span> s');
    for (const rate of ["0.75", "1", "1.25", "1.5", "2"]) expect(markup).toContain(`data-rate="${rate}"`);
    expect(markup).toContain('role="radiogroup"');
    expect(markup.match(/aria-checked="true"/g)?.length).toBe(1);
    expect(markup).toContain('<span class="tp-num" dir="ltr">00:00</span> of <span class="tp-num" dir="ltr">');
    expect(markup).toContain("Times are estimates.");
    expect(markup).not.toMatch(BANNED);
  });

  test("the transcript lists every sentence; the current one is marked in words and aria-current", () => {
    const markup = html(view({ state: { ...player.initialPlayer, index: 1, playing: true } }));
    expect(markup.match(/data-action="recap-jump"/g)?.length).toBe(sentences.length);
    expect(markup.match(/aria-current="true"/g)?.length).toBe(1);
    expect(markup).toContain('aria-current="true"><span class="tp-recap__now">Now</span><span dir="auto">Cells divide in two ways.</span>');
    expect(markup).toContain('data-kind="cue"');
    expect(markup).toContain("Prophase, Metaphase, Anaphase and Telophase.");
    expect(markup).toContain("<span>Pause</span>");
    expect(markup).toContain('aria-pressed="true"');
  });

  test("no Hebrew voice: says so plainly, no controls, the transcript and Ask still work", () => {
    const markup = html(view({ lang: "he", status: "noVoice" }));
    expect(markup).toContain("This device has no Hebrew voice");
    expect(markup).not.toContain('data-action="recap-play"');
    expect(primaries(markup)).toBe(0);
    expect(markup).toContain('data-action="recap-jump"');
    expect(markup).toContain('data-component="RecapAsk"');
  });

  test("after a speech error the player says so in words, and Play is ready again", () => {
    const markup = html(view({ state: { ...player.initialPlayer, index: 1, speechError: true } }));
    expect(markup).toContain('<p class="tp-small tp-muted" aria-live="polite">The voice stopped on this sentence. Play tries it again.</p>');
    expect(markup).toContain('data-action="recap-play" aria-pressed="false"');
  });

  test("no speech at all, and the quiet checking state", () => {
    expect(html(view({ status: "none" }))).toContain("This browser can&#x27;t read aloud.");
    const checking = html(view({ status: "checking" }));
    expect(checking).toContain("Getting the voice ready");
    expect(checking).toMatch(/data-action="recap-play" aria-pressed="false" disabled=""/);
  });

  test("Ask a question shows the page's own sentences, then the coach", () => {
    const answers = [{ text: "Meiosis: cell division that makes four cells.", index: 3, score: 2 }];
    const markup = html(view({ question: "How many cells?", answers }));
    expect(markup).toContain("From your page:");
    expect(markup).toContain('<li dir="auto">Meiosis: cell division that makes four cells.</li>');
    expect(markup).toContain('href="/coach"');
    const none = html(view({ question: "Photosynthesis?", answers: [] }));
    expect(none).toContain("Your page doesn&#x27;t seem to say.");
    expect(none).toContain('href="/coach"');
    expect(html(view())).not.toContain('href="/coach"');
  });

  test("the header switches between the recap and the whole page", () => {
    expect(html(view())).toContain('href="/study/listen?from=notes%3A11&amp;mode=full"');
    const full = html(view({ mode: "full" }));
    expect(full).toContain("Whole page, read aloud");
    expect(full).toContain('href="/study/listen?from=notes%3A11&amp;mode=recap"');
  });
});

describe("the listen screen's states", () => {
  const states = (props: Record<string, unknown>) => html(createElement(ListenStates, { mode: "recap", online: true, ...props } as never));
  test("no page id explains where to start", () => {
    expect(states({ note: undefined })).toContain("Pick a page to listen to");
  });
  test("loading, gone and empty", () => {
    expect(states({ from: "n1", note: undefined })).toContain('data-component="StateLoading"');
    expect(states({ from: "n1", note: null })).toContain("This page isn&#x27;t here anymore");
    expect(states({ from: "n1", note: { title: "Empty", body: "```json tempo\n{}\n```" } })).toContain("Nothing to read aloud yet");
  });
  test("every state around the player keeps the screen's h1, Listen", () => {
    const h1 = '<h1 class="tp-pagehead__title">Listen</h1>';
    const all = [
      states({ note: undefined }),
      states({ from: "n1", signedOut: true, note: undefined }),
      states({ from: "n1", note: undefined }),
      states({ from: "n1", note: null }),
      states({ from: "n1", note: { title: "Empty", body: "```json tempo\n{}\n```" } }),
    ];
    for (const markup of all) expect(markup.match(/<h1[ >]/g)?.length).toBe(1);
    for (const markup of all) expect(markup).toContain(h1);
    expect(all[1]).toContain('data-component="StateSignedOut"');
  });
  test("a Hebrew page with a link and a json tempo block is read as Hebrew, list joiners and all", () => {
    const body = [
      "# שלבי המיטוזה",
      "",
      "התא עובר כמה שלבים. עוד ב[ויקיפדיה](https://en.wikipedia.org/wiki/Mitosis_and_cell_division).",
      "",
      "- פרופאזה",
      "- מטאפאזה",
      "- אנאפאזה",
      "",
      "```json tempo",
      '{"type":"flashcards","title":"Mitosis","origin":"user","cards":[{"id":"a","front":"Prophase","back":"Chromosomes condense"}]}',
      "```",
    ].join("\n");
    const markup = states({ from: "n1", note: { title: "מיטוזה", body } });
    expect(markup).toContain("פרופאזה, מטאפאזה ואנאפאזה.");
    expect(markup).not.toContain(" and ");
  });
  test("a page with text draws the player (checking until the device answers)", () => {
    const markup = states({ from: "n1", note: { title: "Cells", body: PAGE } });
    expect(markup).toContain('data-component="AudioRecapPlayer"');
    expect(markup).toContain("Getting the voice ready");
  });
});

describe("player state", () => {
  const { playerReducer, initialPlayer } = player;
  test("play, sentence ends advance, the last one ends the reading, Play starts over", () => {
    let state = playerReducer(initialPlayer, { type: "play" });
    expect(state.playing).toBe(true);
    state = playerReducer(state, { type: "sentenceEnd", count: 2 });
    expect(state).toMatchObject({ index: 1, playing: true });
    state = playerReducer(state, { type: "sentenceEnd", count: 2 });
    expect(state).toMatchObject({ index: 1, playing: false, ended: true });
    state = playerReducer(state, { type: "play" });
    expect(state).toMatchObject({ index: 0, playing: true, ended: false });
  });
  test("jump, skip by the timeline, speed and pause", () => {
    const long = estimateTimeline(Array.from({ length: 20 }, () => "one two three four five six seven eight nine ten eleven"));
    let state = playerReducer(initialPlayer, { type: "jump", index: 10 });
    state = playerReducer(state, { type: "skip", seconds: -15, timeline: long });
    expect(state.index).toBe(6);
    state = playerReducer(state, { type: "skip", seconds: 30, timeline: long });
    expect(state.index).toBe(12);
    state = playerReducer(state, { type: "rate", rate: 1.5 });
    expect(state.rate).toBe(1.5);
    expect(playerReducer(state, { type: "pause" })).toBe(state);
  });
  test("choosing a transcript sentence plays from there when a voice is ready, else only marks it", () => {
    expect(playerReducer(initialPlayer, player.jumpTo(3, true))).toMatchObject({ index: 3, playing: true });
    expect(playerReducer(initialPlayer, player.jumpTo(3, false))).toMatchObject({ index: 3, playing: false });
    const ended = { ...initialPlayer, index: 4, ended: true };
    expect(playerReducer(ended, player.jumpTo(1, true))).toMatchObject({ index: 1, playing: true, ended: false });
  });
  test("a shorter page keeps the place in range: its last sentence, or a stop when none is left", () => {
    const playing = { ...initialPlayer, index: 5, playing: true };
    expect(playerReducer(playing, { type: "clamp", count: 3 })).toMatchObject({ index: 2, playing: true });
    expect(playerReducer(playing, { type: "clamp", count: 0 })).toMatchObject({ index: 0, playing: false });
    expect(playerReducer(playing, { type: "clamp", count: 6 })).toBe(playing);
  });
  test("a speech error pauses on the same sentence and says so; Play tries it again", () => {
    let state = playerReducer({ ...initialPlayer, index: 2, playing: true }, { type: "speechError" });
    expect(state).toMatchObject({ index: 2, playing: false, ended: false, speechError: true });
    state = playerReducer(state, { type: "play" });
    expect(state).toMatchObject({ index: 2, playing: true, speechError: false });
    expect(playerReducer({ ...state, speechError: true }, { type: "jump", index: 0 }).speechError).toBe(false);
  });
  test("elapsed time never runs past the sentence", () => {
    expect(player.elapsedSeconds(timeline, 1, 0)).toBe(timeline[1]?.start ?? -1);
    expect(player.elapsedSeconds(timeline, 1, 999)).toBe(timeline[1]?.end ?? -1);
    expect(player.elapsedSeconds([], 0, 3)).toBe(0);
  });
  test("speed keys follow the reading direction and wrap", () => {
    expect(rateForKey("ArrowRight", 1, false)).toBe(1.25);
    expect(rateForKey("ArrowRight", 1, true)).toBe(0.75);
    expect(rateForKey("ArrowLeft", 0.75, false)).toBe(2);
    expect(rateForKey("Enter", 1, false)).toBeNull();
  });
  test("addresses and modes", () => {
    expect(player.listenHref("n 1")).toBe("/study/listen?from=n%201&mode=recap");
    expect(player.parseMode("full")).toBe("full");
    expect(player.parseMode(["full"])).toBe("recap");
  });
});

describe("the speech seam", () => {
  const voices = [
    { lang: "en-US", name: "Remote", localService: false },
    { lang: "en-GB", name: "Local", localService: true },
    { lang: "iw-IL", name: "Carmit", localService: true },
  ];
  test("pickVoice matches the language base, prefers a voice on the device, knows iw is Hebrew", () => {
    expect(speech.pickVoice(voices, "en")?.name).toBe("Local");
    expect(speech.pickVoice(voices, "he")?.name).toBe("Carmit");
    expect(speech.pickVoice(voices.slice(0, 2), "he")).toBeNull();
  });

  function fakeSynth(list = voices) {
    const spoken: {
      text: string;
      lang: string;
      rate: number;
      onend: (() => void) | null;
      onerror: ((event?: { error?: string }) => void) | null;
    }[] = [];
    let cancels = 0;
    const synth = {
      getVoices: () => list,
      speak: (u: unknown) => spoken.push(u as never),
      cancel: () => {
        cancels += 1;
      },
    };
    const engine = speech.createSynthEngine(synth, (text) => ({ text, lang: "", rate: 1, voice: null, onend: null, onerror: null, onboundary: null }) as never);
    return { engine, spoken, cancels: () => cancels };
  }

  test("speaks with the picked voice's language and rate; onEnd once; never on cancel", () => {
    const { engine, spoken } = fakeSynth();
    let ended = 0;
    engine.speak("Hello", { lang: "en", rate: 1.5, onEnd: () => (ended += 1) });
    expect(spoken[0]).toMatchObject({ text: "Hello", lang: "en-GB", rate: 1.5 });
    spoken[0]?.onend?.();
    spoken[0]?.onend?.();
    expect(ended).toBe(1);
    const handle = engine.speak("Again", { lang: "en", rate: 1, onEnd: () => (ended += 1) });
    handle.cancel();
    expect(spoken[1]?.onend).toBeNull();
    expect(ended).toBe(1);
  });

  test("a new reading interrupts the one before and says so", () => {
    const { engine } = fakeSynth();
    let interrupted = 0;
    engine.speak("First", { lang: "en", rate: 1, onEnd: () => {}, onInterrupt: () => (interrupted += 1) });
    engine.speak("Second", { lang: "en", rate: 1, onEnd: () => {} });
    expect(interrupted).toBe(1);
  });

  test("an engine error is never 'read to the end': onError gets the reason, once", () => {
    const { engine, spoken } = fakeSynth();
    const seen: string[] = [];
    engine.speak("Hello", {
      lang: "en",
      rate: 1,
      onEnd: () => seen.push("end"),
      onInterrupt: () => seen.push("interrupt"),
      onError: (reason) => seen.push(`error:${reason}`),
    });
    spoken[0]?.onerror?.({ error: "voice-unavailable" });
    spoken[0]?.onerror?.({ error: "voice-unavailable" });
    spoken[0]?.onend?.();
    expect(seen).toEqual(["error:voice-unavailable"]);
  });

  test("a cancel from elsewhere reads as an interruption; our own cancel detaches first", () => {
    const { engine, spoken } = fakeSynth();
    const seen: string[] = [];
    const handlers = {
      onEnd: () => seen.push("end"),
      onInterrupt: () => seen.push("interrupt"),
      onError: () => seen.push("error"),
    };
    engine.speak("One", { lang: "en", rate: 1, ...handlers });
    spoken[0]?.onerror?.({ error: "interrupted" });
    expect(seen).toEqual(["interrupt"]);
    const handle = engine.speak("Two", { lang: "en", rate: 1, ...handlers });
    handle.cancel();
    expect(spoken[1]?.onerror).toBeNull();
    expect(seen).toEqual(["interrupt"]);
  });

  test("without onError, an error falls back to onInterrupt, then onEnd", () => {
    const { engine, spoken } = fakeSynth();
    const seen: string[] = [];
    engine.speak("A", { lang: "en", rate: 1, onEnd: () => seen.push("end"), onInterrupt: () => seen.push("interrupt") });
    spoken[0]?.onerror?.({ error: "audio-busy" });
    engine.speak("B", { lang: "en", rate: 1, onEnd: () => seen.push("end") });
    spoken[1]?.onerror?.({ error: "audio-busy" });
    expect(seen).toEqual(["interrupt", "end"]);
  });

  test("availability per language, and the status the screens show", () => {
    const { engine } = fakeSynth(voices.slice(0, 2));
    expect(engine.available("en")).toBe(true);
    expect(engine.available("he")).toBe(false);
    expect(speechStatus({ engine: null, settled: false }, "en")).toBe("checking");
    expect(speechStatus({ engine, settled: true }, "en")).toBe("ready");
    expect(speechStatus({ engine, settled: false }, "he")).toBe("checking");
    expect(speechStatus({ engine, settled: true }, "he")).toBe("noVoice");
    expect(speechStatus({ engine: speech.silentEngine, settled: true }, "en")).toBe("none");
  });

  test("no speechSynthesis in this runtime: the silent engine, which never speaks", () => {
    expect(speech.browserSpeechEngine()).toBe(speech.silentEngine);
    expect(speech.silentEngine.available("en")).toBe(false);
  });
});

describe("entry point and copy", () => {
  test("a study set links to listening to its page, as a ghost (Flip stays the one primary)", () => {
    const markup = html(
      createElement(StudySetView, {
        data: {
          set: { setId: "s1", noteId: "n1", kind: "flashcards", title: "Cells", itemCount: 1 },
          note: { id: "n1", title: "Cells" },
          block: { id: "blk", type: "flashcards", data: { title: "Cells", origin: "user", cards: [{ id: "a", front: "Mitosis", back: "Division" }] } },
          states: {},
          attempts: [],
        },
        online: true,
        now: 0,
        onRecord: async () => {},
        onRemove: () => {},
      } as never),
    );
    expect(markup).toContain('href="/study/listen?from=n1&amp;mode=recap"');
    expect(markup).toContain("Listen to the page this came from");
    expect(primaries(markup)).toBe(1);
  });

  test("the new copy exists in both languages, kind and plain", () => {
    const keys = (Object.keys(en) as (keyof typeof en)[]).filter((key) => key.startsWith("st.ls.") || key.startsWith("st.ra.") || key === "st.set.listen");
    expect(keys.length).toBeGreaterThan(30);
    for (const key of keys) {
      expect(he[key].trim().length).toBeGreaterThan(0);
      expect(`${en[key]} ${he[key]}`).not.toMatch(BANNED);
    }
    expect(translate("en", "st.ra.read")).toBe("Read aloud");
    expect(translate("en", "st.ra.stop")).toBe("Stop reading");
  });
});

describe("ListenMenuItem", () => {
  test("a page-menu link to this page's audio recap", async () => {
    const { ListenMenuItem } = await import("../../../apps/web/components/study/recap/ListenMenuItem");
    const markup = renderToStaticMarkup(createElement(ListenMenuItem, { noteId: "n 7" }));
    expect(markup).toContain('role="menuitem"');
    expect(markup).toContain('href="/study/listen?from=n%207&amp;mode=recap"');
    expect(markup).toContain("Listen to a recap");
  });
});

describe("the mounted player", () => {
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
  async function rerender(node: ReactElement) {
    await act(async () => {
      root?.render(node);
    });
  }
  async function click(node: TestNode | undefined) {
    if (!node) throw new Error("nothing to click");
    await act(async () => {
      node.click();
    });
  }
  const byAction = (view: TestNode, action: string) => findAll(view, (n) => n.getAttribute?.("data-action") === action);

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    if (host?.parentNode) host.parentNode.removeChild(host);
    root = null;
    host = null;
  });

  /** An engine that records what it was asked to say; the test ends sentences by hand. */
  function recordingEngine() {
    const said: { text: string; options: SpeakOptions; cancelled: boolean }[] = [];
    const engine: SpeechEngine = {
      available: () => true,
      speak(text, options) {
        const call = { text, options, cancelled: false };
        said.push(call);
        return {
          cancel() {
            call.cancelled = true;
          },
        };
      },
    };
    return { engine, said };
  }
  const playerOf = (engine: SpeechEngine, body = PAGE) =>
    createElement(AudioRecapPlayer, { noteId: "n1", title: "Cells", body, mode: "recap", engine });

  test("choosing a transcript sentence plays from there", async () => {
    const { engine, said } = recordingEngine();
    const view = await mount(playerOf(engine));
    expect(said).toEqual([]);
    await click(byAction(view, "recap-jump")[2]);
    expect(said.map((call) => call.text)).toEqual([sentences[2]?.text]);
    expect(byAction(view, "recap-play")[0]?.getAttribute("aria-pressed")).toBe("true");
  });

  test("an edit elsewhere in the page doesn't restart the sentence being read", async () => {
    const { engine, said } = recordingEngine();
    const view = await mount(playerOf(engine));
    await click(byAction(view, "recap-play")[0]);
    await act(async () => said[0]?.options.onEnd());
    expect(said.map((call) => call.text)).toEqual([sentences[0]?.text, sentences[1]?.text]);
    await rerender(playerOf(engine, `${PAGE}\nA closing line was added.\n`));
    expect(said).toHaveLength(2);
    expect(said[1]?.cancelled).toBe(false);
  });

  test("a page that got shorter than the place reads its last sentence instead of going quiet", async () => {
    const { engine, said } = recordingEngine();
    const view = await mount(playerOf(engine));
    await click(byAction(view, "recap-jump")[3]);
    await rerender(playerOf(engine, "Only one line is left."));
    expect(said.at(-1)).toMatchObject({ text: "Only one line is left.", cancelled: false });
    expect(byAction(view, "recap-play")[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(findAll(view, (n) => n.getAttribute?.("aria-current") === "true")).toHaveLength(1);
  });
});
