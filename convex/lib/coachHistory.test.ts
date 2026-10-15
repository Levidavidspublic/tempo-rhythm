import { describe, expect, test } from "bun:test";
import { buildCoachMessages, cardOutcome, parseCoachReply, withoutAcceptPromise } from "./coachPrompt";

/**
 * Alpha run, L4: after a card was added and undone, the coach said "It's already on your list" and
 * "Nothing changes until you accept it" with no card. The coach now sees what happened to each of
 * its cards, and a reply with no card can't promise one.
 */
describe("what happened to the coach's cards", () => {
  const task = { kind: "task" as const, title: "10-minute tidy of one surface", minutes: 10, when: "today" as const };

  test("each outcome reads as plain words the coach can go by", () => {
    expect(cardOutcome(task, "undone")).toBe(
      '[Card: a task "10-minute tidy of one surface" for today. They added it, then undid it; nothing is left of it.]',
    );
    expect(cardOutcome(task, "rejected")).toBe(
      '[Card: a task "10-minute tidy of one surface" for today. They said not now; nothing changed.]',
    );
    expect(cardOutcome(task, "accepted")).toContain("They added it.]");
    expect(cardOutcome(task, "pending")).toContain("They haven't answered it yet.]");
    expect(cardOutcome({ kind: "decision", title: "This afternoon", steps: [{ title: "A", minutes: 5 }] }, "accepted")).toBe(
      '[Card: an order of 1 step ("This afternoon"). They saved it to today\'s page.]',
    );
    expect(cardOutcome({ kind: "note", title: "Packing list", body: "- [ ] Passport" }, "pending")).toContain('a new page "Packing list"');
  });

  test("the system prompt tells the coach to go by the card line", () => {
    const [system] = buildCoachMessages({ dial: 5, history: [], page: null });
    expect(system?.content).toContain("a line in [brackets] says what happened to its card");
    expect(system?.content).toContain("a declined or undone change didn't happen");
  });
});

describe("a reply with no card", () => {
  test("loses its promise that nothing changes until they accept", () => {
    expect(withoutAcceptPromise("One thing for this afternoon: a 10-minute tidy. Nothing changes until you accept it.")).toBe(
      "One thing for this afternoon: a 10-minute tidy.",
    );
    expect(withoutAcceptPromise("Nothing will change unless you say yes. Start small.")).toBe("Start small.");
    // When that sentence is all there is, it stays rather than leaving an empty reply.
    expect(withoutAcceptPromise("Nothing changes until you accept it.")).toBe("Nothing changes until you accept it.");
    expect(withoutAcceptPromise("Start with the email.")).toBe("Start with the email.");
  });

  test("parseCoachReply keeps the promise only when a card is there", () => {
    const words = "One task for the afternoon. Nothing changes until you accept it.";
    expect(parseCoachReply(JSON.stringify({ reply: words, proposal: null }))?.reply).toBe("One task for the afternoon.");
    const withCard = parseCoachReply(
      JSON.stringify({ reply: words, proposal: { kind: "task", title: "Tidy", minutes: 10, when: "today" } }),
    );
    expect(withCard?.reply).toBe(words);
    expect(parseCoachReply(words)?.reply).toBe("One task for the afternoon.");
  });
});
