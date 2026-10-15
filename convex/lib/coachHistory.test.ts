import { describe, expect, test } from "bun:test";
import {
  COACH_LIMITS,
  buildCoachMessages,
  cardOutcome,
  parseCoachReply,
  withCardOutcome,
  withoutAcceptPromise,
} from "./coachPrompt";

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

  test("loses only the promise when it shares a sentence with advice", () => {
    expect(withoutAcceptPromise("I can propose a short plan, but nothing changes until you accept it.")).toBe(
      "I can propose a short plan.",
    );
    expect(withoutAcceptPromise("Call the bank first — nothing changes until you approve. Then lunch.")).toBe(
      "Call the bank first. Then lunch.",
    );
    expect(withoutAcceptPromise("A short walk. But nothing will change unless you say yes, so no rush.")).toBe(
      "A short walk. So no rush.",
    );
    expect(withoutAcceptPromise("Call the bank, but nothing changes until you accept it, so take your time.")).toBe(
      "Call the bank, so take your time.",
    );
    expect(withoutAcceptPromise("Nothing changes until you say yes to it, 10 minutes is plenty.")).toBe("10 minutes is plenty.");
  });

  test("keeps advice that only sounds like the promise", () => {
    const advice = "Nothing changes until you accept that rest counts as progress.";
    expect(withoutAcceptPromise(advice)).toBe(advice);
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

describe("an earlier reply with its card's note", () => {
  test("a long reply is cut so the note still reaches the model", () => {
    const outcome = cardOutcome({ kind: "task", title: "Tidy", minutes: 10, when: "today" }, "undone");
    const content = withCardOutcome("word ".repeat(800), outcome);
    expect(content.length).toBeLessThanOrEqual(COACH_LIMITS.historyChars);
    expect(content.endsWith(`…\n${outcome}`)).toBe(true);
    const sent = buildCoachMessages({ dial: 5, history: [{ role: "assistant", content }], page: null });
    expect(sent.some((m) => m.role === "assistant" && m.content.endsWith(outcome))).toBe(true);
  });

  test("a short reply is kept whole", () => {
    const outcome = cardOutcome({ kind: "task", title: "Tidy", minutes: 10, when: "today" }, "accepted");
    expect(withCardOutcome("One task.", outcome)).toBe(`One task.\n${outcome}`);
  });
});
