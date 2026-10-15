import { describe, expect, test } from "bun:test";
import { COACH_LIMITS, buildCoachMessages, dayName, parseCoachReply, readProposal, truncate } from "./coachPrompt";

const META =
  '```json tempo\n{"id":"blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2X","v":1,"type":"page-meta","data":{"pageType":"daily","date":"2026-10-13","tags":[]}}\n```\n';

describe("buildCoachMessages", () => {
  test("the system prompt carries the dial line and asks for JSON", () => {
    const [system] = buildCoachMessages({ dial: 7, history: [{ role: "user", content: "hi" }], page: null });
    expect(system?.role).toBe("system");
    expect(system?.content).toContain("Current accountability dial: 7 / 10. Match tone accordingly.");
    expect(system?.content).toContain('{"reply": "what you say", "proposal": null}');
    expect(system?.content).toContain("Reply in the language the person writes in.");
    // Asked to plan or suggest with enough to go on, the coach proposes now instead of asking
    // first (alpha run, L4); a request it can't act on still gets one short question (HARD_RULES §6.3).
    expect(system?.content).toContain("make a concrete proposal in this reply instead of asking first");
    expect(system?.content).toContain("Only when you can't tell what they want, ask one short question.");
    // Proposals can't carry a date or time yet, so the coach isn't told to propose schedules, and
    // an add for another day or a time is asked about instead of losing its date.
    expect(system?.content).not.toContain("schedule something");
    expect(system?.content).toContain("A task can only be added for today or with no date.");
    // "Plan my afternoon" (L4) is today, not a schedule: the guard covers other days and clock times only.
    expect(system?.content).toContain('A part of today ("this afternoon", "tonight") is just today: propose.');
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

  test("today's open tasks come after the page and before the thread, marked as the person's material", () => {
    const messages = buildCoachMessages({
      dial: 5,
      history: [{ role: "user", content: "What order should I do these in?" }],
      page: { title: "Thu", text: "Intention" },
      tasks: [
        { title: "Reply to  Dana", minutes: 10 },
        { title: "Laundry", minutes: null },
      ],
    });
    expect(messages.map((m) => m.role)).toEqual(["system", "system", "system", "user"]);
    expect(messages[2]?.content).toBe("Their open tasks for today.\n<tasks>\n- Reply to Dana (10 min)\n- Laundry\n</tasks>");
    expect(messages[0]?.content).toContain("copy its title exactly from <tasks>");
  });

  test("no tasks, no tasks message; many tasks are cut to the limit", () => {
    expect(buildCoachMessages({ dial: 5, history: [], page: null, tasks: [] })).toHaveLength(1);
    const tasks = Array.from({ length: 40 }, (_, i) => ({ title: `t${i}`, minutes: null }));
    const content = buildCoachMessages({ dial: 5, history: [], page: null, tasks })[1]?.content ?? "";
    expect(content.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(COACH_LIMITS.contextTasks);
  });

  test("a long page is cut", () => {
    const messages = buildCoachMessages({ dial: 5, history: [], page: { title: "", text: "y".repeat(50_000) } });
    expect(messages[1]?.content).toContain('title="Untitled"');
    expect(messages[1]?.content.length).toBeLessThan(COACH_LIMITS.pageChars + 200);
  });
});

describe("the person's date", () => {
  test("names the weekday of the date itself, in any time zone", () => {
    expect(dayName("2026-10-16")).toBe("Friday, 16 October 2026");
    expect(dayName("2024-02-29")).toBe("Thursday, 29 February 2024");
    expect(dayName("2026-02-30")).toBeNull();
    expect(dayName("16/10/2026")).toBeNull();
  });

  test("goes right after the system prompt, and only when it is a real date", () => {
    const messages = buildCoachMessages({ dial: 5, history: [], page: null, today: "2026-10-16" });
    expect(messages[1]).toEqual({ role: "system", content: "For them it is Friday, 16 October 2026." });
    expect(buildCoachMessages({ dial: 5, history: [], page: null, today: "2026-13-01" })).toHaveLength(1);
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

  test("a decision keeps its steps in order, each checked like a task", () => {
    const decision = readProposal({
      kind: "decision",
      title: " This afternoon ",
      steps: [
        { title: " Reply to Dana ", minutes: 10, reason: " Quick " },
        { title: "Draft the report", minutes: 9999 },
        { title: "   " },
        "Laundry",
        { title: "Laundry", minutes: "ten", reason: "" },
      ],
    });
    expect(decision).toEqual({
      kind: "decision",
      title: "This afternoon",
      steps: [
        { title: "Reply to Dana", minutes: 10, reason: "Quick" },
        { title: "Draft the report", minutes: 480 },
        { title: "Laundry", minutes: 15 },
      ],
    });
  });

  test("a decision needs at least 2 steps, keeps at most 7, and may have no title", () => {
    expect(readProposal({ kind: "decision", steps: [{ title: "Only one", minutes: 5 }] })).toBeNull();
    expect(readProposal({ kind: "decision", title: "x", steps: "first A then B" })).toBeNull();
    const many = readProposal({
      kind: "decision",
      steps: Array.from({ length: 10 }, (_, i) => ({ title: `Step ${i}`, minutes: 5 })),
    });
    expect(many).toMatchObject({ kind: "decision" });
    expect(many && "steps" in many ? many.steps.map((s) => s.title) : []).toEqual(
      Array.from({ length: COACH_LIMITS.maxSteps }, (_, i) => `Step ${i}`),
    );
    expect(many && "title" in many).toBe(false);
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
