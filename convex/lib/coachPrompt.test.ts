import { describe, expect, test } from "bun:test";
import { COACH_LIMITS, buildCoachMessages, parseCoachReply, readProposal, truncate } from "./coachPrompt";

const META =
  '```json tempo\n{"id":"blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2X","v":1,"type":"page-meta","data":{"pageType":"daily","date":"2026-10-13","tags":[]}}\n```\n';

describe("buildCoachMessages", () => {
  test("the system prompt carries the dial line and asks for JSON", () => {
    const [system] = buildCoachMessages({ dial: 7, history: [{ role: "user", content: "hi" }], page: null });
    expect(system?.role).toBe("system");
    expect(system?.content).toContain("Current accountability dial: 7 / 10. Match tone accordingly.");
    expect(system?.content).toContain('{"reply": "what you say", "proposal": null}');
    expect(system?.content).toContain("Reply in the language the person writes in.");
  });

  test("the open page comes before the thread, marked as the person's material", () => {
    const messages = buildCoachMessages({
      dial: 5,
      history: [{ role: "user", content: "What should I start with?" }],
      page: { title: 'Today "Tue"', text: "Intention\nCall the bank" },
    });
    expect(messages.map((m) => m.role)).toEqual(["system", "system", "user"]);
    expect(messages[1]?.content).toContain("<page title=\"Today 'Tue'\">\nIntention\nCall the bank\n</page>");
    expect(messages[2]?.content).toBe("What should I start with?");
  });

  test("only the newest messages go, each cut to its limit", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 ? "assistant" : "user") as "user" | "assistant",
      content: `m${i} ${"x".repeat(5000)}`,
    }));
    const messages = buildCoachMessages({ dial: 5, history, page: null });
    expect(messages).toHaveLength(1 + COACH_LIMITS.historyMessages);
    expect(messages[1]?.content.startsWith("m18 ")).toBe(true);
    for (const m of messages.slice(1)) expect(m.content.length).toBe(COACH_LIMITS.historyChars);
  });

  test("a long page is cut", () => {
    const messages = buildCoachMessages({ dial: 5, history: [], page: { title: "", text: "y".repeat(50_000) } });
    expect(messages[1]?.content).toContain('title="Untitled"');
    expect(messages[1]?.content.length).toBeLessThan(COACH_LIMITS.pageChars + 200);
  });
});

describe("parseCoachReply", () => {
  test("reads the reply and a task proposal", () => {
    const parsed = parseCoachReply(
      JSON.stringify({ reply: "Here it is.", proposal: { kind: "task", title: " Call the bank ", minutes: 10, when: "today" } }),
    );
    expect(parsed).toEqual({
      reply: "Here it is.",
      proposal: { kind: "task", title: "Call the bank", minutes: 10, when: "today" },
    });
  });

  test("JSON inside a code fence or extra words still parses", () => {
    expect(parseCoachReply('```json\n{"reply":"Ok","proposal":null}\n```')).toEqual({ reply: "Ok", proposal: null });
    expect(parseCoachReply('Sure! {"reply":"Ok","proposal":null}')).toEqual({ reply: "Ok", proposal: null });
  });

  test("an answer that is not JSON is kept as a plain reply with no proposal", () => {
    expect(parseCoachReply("Take one small step.")).toEqual({ reply: "Take one small step.", proposal: null });
  });

  test("broken JSON is never shown as chat text: a whole reply is kept, anything else is no answer", () => {
    expect(parseCoachReply('{"reply":"Try this","proposal":}')).toEqual({ reply: "Try this", proposal: null });
    expect(parseCoachReply('```json\n{"reply":"Say \\"hi\\" first","proposal":{"kind":\n```')).toEqual({
      reply: 'Say "hi" first',
      proposal: null,
    });
    expect(parseCoachReply('{"reply":"Try th')).toBeNull();
    expect(parseCoachReply('{"proposal":{"kind":"task"')).toBeNull();
    expect(parseCoachReply("[1, 2,")).toBeNull();
  });

  test("an empty answer gives null", () => {
    expect(parseCoachReply("")).toBeNull();
    expect(parseCoachReply('{"reply":"","proposal":null}')).toBeNull();
  });

  test("a broken proposal is dropped and the reply kept", () => {
    expect(parseCoachReply('{"reply":"Ok","proposal":{"kind":"delete_everything"}}')).toEqual({ reply: "Ok", proposal: null });
    expect(parseCoachReply('{"reply":"Ok","proposal":{"kind":"note","title":"x","body":"  "}}')).toEqual({
      reply: "Ok",
      proposal: null,
    });
  });

  test("a long reply is cut", () => {
    const parsed = parseCoachReply(JSON.stringify({ reply: "z".repeat(10_000), proposal: null }));
    expect(parsed?.reply.length).toBe(COACH_LIMITS.replyChars);
    expect(parsed?.reply.endsWith("…")).toBe(true);
  });
});

describe("readProposal", () => {
  test("task minutes are whole, at least 1 and at most 480; when defaults to later", () => {
    expect(readProposal({ kind: "task", title: "A", minutes: 0 })).toEqual({ kind: "task", title: "A", minutes: 1, when: "later" });
    expect(readProposal({ kind: "task", title: "A", minutes: 9999 })).toMatchObject({ minutes: 480 });
    expect(readProposal({ kind: "task", title: "A", minutes: 12.6 })).toMatchObject({ minutes: 13 });
    expect(readProposal({ kind: "task", title: "A", minutes: "ten" })).toMatchObject({ minutes: 15 });
  });

  test("note and template bodies keep Markdown and lose Tempo blocks", () => {
    const note = readProposal({ kind: "note", title: "Plan", body: `${META}## Steps\n- [ ] one\n` });
    expect(note).toEqual({ kind: "note", title: "Plan", body: "## Steps\n- [ ] one" });
    const template = readProposal({ kind: "template", name: "Gentle Monday", body: "## {{weekday}}\n", period: "monthly" });
    expect(template).toEqual({ kind: "template", name: "Gentle Monday", body: "## {{weekday}}", period: "none" });
  });

  test("a body that is only a Tempo block is no proposal", () => {
    expect(readProposal({ kind: "note", title: "Plan", body: META })).toBeNull();
  });

  test("anything else is null", () => {
    for (const raw of [null, "task", [], { kind: "task" }, { kind: "task", title: "   " }, { kind: "module", name: "Water" }]) {
      expect(readProposal(raw)).toBeNull();
    }
  });
});

describe("truncate", () => {
  test("never splits a surrogate pair", () => {
    const cut = truncate(`ab${"😀".repeat(5)}`, 6);
    expect(cut).toBe("ab😀…");
    expect(truncate("short", 10)).toBe("short");
  });
});
