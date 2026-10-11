/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * send path (chat.send), the Thinking state, calm errors with Retry, and the
 * crisis path: a match renders CrisisResourcesCard and never calls the model.
 */
import { describe, expect, mock, test } from "bun:test";
import { ConvexError } from "convex/values";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "@/convex/_generated/dataModel";

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useQuery: () => undefined,
  useMutation: () => async () => null,
  useAction: () => async () => null,
  useConvex: () => ({
    query: async () => ({ isCrisis: false }),
  }),
}));

mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    conversations: { list: "conversations.list", create: "conversations.create" },
    messages: { list: "messages.list" },
    chat: { send: "chat.send" },
    crisis: { check: "crisis.check", resourcesCard: "crisis.resourcesCard" },
  },
}));

const {
  COACH_COPY,
  CRISIS_CARD_MODEL,
  CoachChat,
  CoachComposer,
  CoachCrisisReply,
  CoachLocalBubble,
  CoachMessageBubble,
  CoachSendNotice,
  CoachThinking,
  deliverCoachMessage,
  describeCoachError,
  runCoachTurn,
  turnIdentity,
} = await import("./CoachChat");

type CoachTurn = Parameters<typeof runCoachTurn>[0];

const TURN_ID = "k57turn0000000000000000000000001" as Id<"messages">;
const OTHER_ID = "k57turn0000000000000000000000002" as Id<"messages">;
const PROMPT = "Help me pick one thing for this afternoon";

function markup(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

const notCrisis = async () => ({ isCrisis: false });
const isCrisis = async () => ({ isCrisis: true });

function replyWith(reply = "Pick the smallest one. Start there.", crisis?: true) {
  return mock(async (_turn: CoachTurn) =>
    crisis ? { reply, crisis, messageId: TURN_ID } : { reply, messageId: TURN_ID },
  );
}

function rejectWith(error: unknown) {
  return mock(async (_turn: CoachTurn): Promise<never> => {
    throw error;
  });
}

/** Things a user must never see: JSON, ids, error codes, stack traces, server prefixes. ("busy" is plain English.) */
function expectNoLeaks(text: string) {
  expect(text).not.toContain("{");
  expect(text).not.toContain("}");
  expect(text).not.toContain(TURN_ID);
  expect(text).not.toContain(OTHER_ID);
  expect(text).not.toMatch(/ConvexError|Server Error|Request ID|\bat \w+ \(|stack/i);
  expect(text).not.toMatch(
    /\b(upstream|empty_reply|not_configured|still_replying|retry_mismatch|turn_outdated|conversation_too_long|ACCOUNT_PENDING_APPROVAL)\b/,
  );
}

describe("deliverCoachMessage", () => {
  test("a crisis match renders CrisisResourcesCard and does not send coaching", async () => {
    const send = mock(async () => undefined);
    const outcome = await deliverCoachMessage(
      "I want to die",
      async () => ({ isCrisis: true }),
      send,
    );

    expect(outcome).toBe("resources");
    expect(send).not.toHaveBeenCalled();

    const html = markup(createElement(CoachCrisisReply));
    expect(html).toContain('data-testid="coach-crisis-resources"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Help is available");
    expect(html).toContain("Tempo is a coach, not a therapist or counselor.");
    expect(html).not.toContain("{");
  });

  test("a normal message is sent and the chat still exposes Coach and Message", async () => {
    const send = mock(async () => undefined);
    const outcome = await deliverCoachMessage(PROMPT, async () => ({ isCrisis: false }), send);

    expect(outcome).toBe("sent");
    expect(send).toHaveBeenCalledWith(PROMPT);

    const html = markup(createElement(CoachChat));
    expect(html).toContain("Coach");
    expect(html).toContain("Message");
    expect(html).not.toContain("coach-crisis-resources");
    expect(html).not.toContain("Thinking…");
    expect(html).not.toContain("coach-send-notice");
  });
});

describe("runCoachTurn: chat.send", () => {
  test("a normal message calls chat.send once with the text and no retry identity", async () => {
    const guard = mock(notCrisis);
    const send = replyWith();

    const outcome = await runCoachTurn({ content: PROMPT }, guard, send);

    expect(outcome).toEqual({ kind: "replied", crisis: false });
    expect(guard).toHaveBeenCalledWith(PROMPT);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toEqual({ content: PROMPT });
  });

  test("the crisis guard path shows resources and never calls chat.send (no model)", async () => {
    const send = replyWith();

    const outcome = await runCoachTurn({ content: "I want to die" }, isCrisis, send);

    expect(outcome).toEqual({ kind: "resources" });
    expect(send).not.toHaveBeenCalled();
  });

  test("a crisis retry still never calls chat.send", async () => {
    const send = replyWith();

    const outcome = await runCoachTurn(
      { content: "I want to die", retryOf: TURN_ID },
      isCrisis,
      send,
    );

    expect(outcome).toEqual({ kind: "resources" });
    expect(send).not.toHaveBeenCalled();
  });

  test("a crisis card that comes back from the server is reported as crisis", async () => {
    const send = replyWith("You are not alone, and help is available", true);

    const outcome = await runCoachTurn({ content: "something heavy" }, notCrisis, send);

    expect(outcome).toEqual({ kind: "replied", crisis: true });
  });

  test("a message over the limit is not sent and goes back to the box", async () => {
    const send = replyWith();
    const long = "a".repeat(4001);

    const outcome = await runCoachTurn({ content: long }, notCrisis, send);

    expect(send).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: "failed",
      failure: { copy: COACH_COPY.tooLongMessage, canRetry: false, restoreInput: true },
    });
    expect(COACH_COPY.tooLongMessage).toContain("4,000");
  });

  test("a long crisis message still shows resources first and never sends", async () => {
    const send = replyWith();

    const outcome = await runCoachTurn(
      { content: `I want to die ${"a".repeat(4100)}` },
      isCrisis,
      send,
    );

    expect(outcome).toEqual({ kind: "resources" });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("runCoachTurn: errors and Retry", () => {
  test("a model failure shows calm copy and Retry with the failed turn's id", async () => {
    const error = new ConvexError({
      code: "upstream",
      message: "Tempo had a hiccup. Try again in a moment?",
      messageId: TURN_ID,
    });

    const outcome = await runCoachTurn({ content: PROMPT }, notCrisis, rejectWith(error));

    expect(outcome).toEqual({
      kind: "failed",
      failure: { copy: COACH_COPY.hiccup, canRetry: true, retryOf: TURN_ID, restoreInput: false },
    });
  });

  test("Retry resends the same text with retryOf, so the user message is not stored twice", async () => {
    const first = await runCoachTurn(
      { content: PROMPT },
      notCrisis,
      rejectWith(new ConvexError({ code: "busy", message: "busy", messageId: TURN_ID })),
    );
    if (first.kind !== "failed") throw new Error("expected a failure");
    expect(first.failure.canRetry).toBe(true);

    const send = replyWith();
    const retried = await runCoachTurn(
      { content: PROMPT, retryOf: first.failure.retryOf },
      notCrisis,
      send,
    );

    expect(retried).toEqual({ kind: "replied", crisis: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toEqual({ content: PROMPT, retryOf: TURN_ID });
  });

  test("a refusal without its own id keeps the identity of the attempt that was refused", async () => {
    const outcome = await runCoachTurn(
      { content: PROMPT, retryOf: TURN_ID },
      notCrisis,
      rejectWith(new ConvexError({ code: "still_replying", message: "Give it a moment." })),
    );

    expect(outcome).toEqual({
      kind: "failed",
      failure: {
        copy: COACH_COPY.stillReplying,
        canRetry: true,
        retryOf: TURN_ID,
        restoreInput: false,
      },
    });
  });

  test("each backend code maps to fixed calm copy", () => {
    const cases: Array<[string, string, boolean]> = [
      ["busy", COACH_COPY.busy, true],
      ["upstream", COACH_COPY.hiccup, true],
      ["empty_reply", COACH_COPY.emptyReply, true],
      ["not_configured", COACH_COPY.offline, true],
      ["still_replying", COACH_COPY.stillReplying, true],
      ["conversation_too_long", COACH_COPY.tooLongChat, false],
      ["retry_mismatch", COACH_COPY.movedOn, false],
      ["turn_outdated", COACH_COPY.movedOn, false],
      ["legacy_chat_moved", COACH_COPY.newCoach, false],
    ];
    for (const [code, copy, canRetry] of cases) {
      const failure = describeCoachError(
        new ConvexError({ code, message: `server text for ${code}`, messageId: TURN_ID }),
      );
      expect(failure.copy).toBe(copy);
      expect(failure.canRetry).toBe(canRetry);
      expect(failure.restoreInput).toBe(!canRetry);
      expect(failure.copy).not.toContain("server text");
      expectNoLeaks(failure.copy);
    }
  });

  test("approval-pending errors get calm copy, no Retry, and the words go back to the box", () => {
    const failure = describeCoachError(
      new Error(
        "[CONVEX A(chat:send)] [Request ID: 0123abcd] Server Error\nUncaught Error: ACCOUNT_PENDING_APPROVAL: your account is waiting for approval.",
      ),
    );

    expect(failure).toEqual({
      copy: COACH_COPY.pendingApproval,
      canRetry: false,
      restoreInput: true,
    });
    expectNoLeaks(failure.copy);
  });

  test("an unknown error never shows its text, JSON or stack, and offers Retry", () => {
    const raw = new Error(
      `[Request ID: 9f9f] Server Error {"code":"x","messageId":"${OTHER_ID}"}\n    at sendChat (convex/chat.ts:1:1)`,
    );

    const failure = describeCoachError(raw, OTHER_ID);

    expect(failure).toEqual({
      copy: COACH_COPY.notSent,
      canRetry: true,
      retryOf: OTHER_ID,
      restoreInput: false,
    });
    expectNoLeaks(failure.copy);
    expectNoLeaks(describeCoachError("plain string").copy);
    expectNoLeaks(describeCoachError(new ConvexError("raw convex text")).copy);
  });
});

describe("turnIdentity", () => {
  const assistant = { _id: OTHER_ID, role: "assistant" as const, content: "Reply" };
  const unanswered = { _id: TURN_ID, role: "user" as const, content: PROMPT };

  test("an explicit retryOf wins", () => {
    expect(turnIdentity(PROMPT, OTHER_ID, [assistant, unanswered])).toBe(OTHER_ID);
  });

  test("the user's own unanswered message with the same words is resumed, not duplicated", () => {
    expect(turnIdentity(PROMPT, undefined, [assistant, unanswered])).toBe(TURN_ID);
  });

  test("a new message after a reply, or different words, starts a new turn", () => {
    expect(turnIdentity(PROMPT, undefined, [unanswered, assistant])).toBeUndefined();
    expect(turnIdentity("Something else", undefined, [assistant, unanswered])).toBeUndefined();
    expect(turnIdentity(PROMPT, undefined, [])).toBeUndefined();
    expect(turnIdentity(PROMPT, undefined, undefined)).toBeUndefined();
  });
});

describe("rendering", () => {
  test("while waiting: a polite Thinking… bubble, the input enabled, Send disabled", () => {
    const thinking = markup(createElement(CoachThinking, { active: true }));
    expect(thinking).toContain('aria-live="polite"');
    expect(thinking).toContain("Thinking…");
    expect(thinking).not.toContain("data-role=");

    const idle = markup(createElement(CoachThinking, { active: false }));
    expect(idle).toContain('aria-live="polite"');
    expect(idle).not.toContain("Thinking");

    const composer = markup(
      createElement(CoachComposer, {
        value: "Next thought",
        onChange: () => undefined,
        onSubmit: () => undefined,
        ready: true,
        sending: true,
      }),
    );
    expect(composer).toMatch(/<input(?![^>]*disabled)[^>]*aria-label="Message"/);
    expect(composer).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Send<\/button>/);
  });

  test("when not waiting and there is text, Send is enabled", () => {
    const composer = markup(
      createElement(CoachComposer, {
        value: PROMPT,
        onChange: () => undefined,
        onSubmit: () => undefined,
        ready: true,
        sending: false,
      }),
    );
    expect(composer).not.toContain('disabled=""');
  });

  test("a retryable error shows calm copy and Retry; others show no Retry", () => {
    const retryable = markup(
      createElement(CoachSendNotice, {
        failure: describeCoachError(
          new ConvexError({ code: "upstream", message: "x", messageId: TURN_ID }),
        ),
        onRetry: () => undefined,
        busy: false,
      }),
    );
    expect(retryable).toContain(COACH_COPY.hiccup.replace("?", ""));
    expect(retryable).toMatch(/<button[^>]*type="button"[^>]*>Retry<\/button>/);
    expect(retryable).toContain('aria-live="polite"');
    expectNoLeaks(retryable.replace(/class="[^"]*"/g, ""));

    const editOnly = markup(
      createElement(CoachSendNotice, {
        failure: describeCoachError(new ConvexError({ code: "turn_outdated", message: "x" })),
        onRetry: () => undefined,
        busy: false,
      }),
    );
    expect(editOnly).not.toContain("Retry");
  });

  test("a crisis card stored by the server renders as the resources card, not as text", () => {
    const html = markup(
      createElement(CoachMessageBubble, {
        message: {
          _id: OTHER_ID,
          role: "assistant",
          content: "You are not alone, and help is available\n\n- Emergency services: call",
          modelUsed: CRISIS_CARD_MODEL,
        },
      }),
    );
    expect(html).toContain('data-testid="coach-crisis-resources"');
    expect(html).toContain('data-role="assistant"');
    expect(html).not.toContain(OTHER_ID);
  });

  test("a normal reply renders its words and never its id", () => {
    const html = markup(
      createElement(CoachMessageBubble, {
        message: {
          _id: OTHER_ID,
          role: "assistant",
          content: "Pick the smallest one.",
          modelUsed: "mistral-small",
        },
      }),
    );
    expect(html).toContain("Pick the smallest one.");
    expect(html).toContain('data-role="assistant"');
    expect(html).not.toContain(OTHER_ID);
    expect(html).not.toContain("mistral-small");
    expect(html).not.toContain("coach-crisis-resources");
  });

  test("a message that did not go through stays visible, marked not sent yet", () => {
    const html = markup(createElement(CoachLocalBubble, { text: PROMPT, notSent: true }));
    expect(html).toContain(PROMPT);
    expect(html).toContain("Not sent yet");

    const sending = markup(createElement(CoachLocalBubble, { text: PROMPT, notSent: false }));
    expect(sending).not.toContain("Not sent yet");
  });
});
