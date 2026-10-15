/**
 * Vitest and Testing Library are not dependencies in this repo, and package.json
 * is outside this ticket's scope. bun:test plus react-dom/server covers the
 * crisis path: a match renders CrisisResourcesCard and does not send coaching.
 */
import { describe, expect, mock, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useQuery: () => undefined,
  useMutation: () => async () => null,
  useAction: () => async () => ({ status: "idle" }),
  useConvex: () => ({
    query: async () => ({ isCrisis: false }),
  }),
}));

mock.module("@/convex/_generated/api", () => ({
  api: {
    users: { getProfile: "users.getProfile" },
    conversations: { list: "conversations.list", create: "conversations.create" },
    messages: { list: "messages.list" },
    coach: {
      sendMessage: "coach.sendMessage",
      reply: "coach.reply",
      acceptProposal: "coach.acceptProposal",
      rejectProposal: "coach.rejectProposal",
      undoProposal: "coach.undoProposal",
    },
    crisis: { check: "crisis.check", resourcesCard: "crisis.resourcesCard" },
  },
}));

// The v3 coach reads its copy through LocaleProvider; render it with the English strings.
const { translate } = await import("@/lib/i18n");
mock.module("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ lang: "en", dir: "ltr", setLang: () => {}, t: (key: Parameters<typeof translate>[1]) => translate("en", key) }),
}));

const { CoachChat, CoachCrisisReply, deliverCoachMessage } = await import("./CoachChat");
const { ChatProposal } = await import("./ChatProposal");

function markup(node: ReactElement): string {
  return renderToStaticMarkup(node);
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
    const outcome = await deliverCoachMessage(
      "Help me pick one thing for this afternoon",
      async () => ({ isCrisis: false }),
      send,
    );

    expect(outcome).toBe("sent");
    expect(send).toHaveBeenCalledWith("Help me pick one thing for this afternoon");

    const html = markup(createElement(CoachChat));
    expect(html).toContain("Coach");
    expect(html).toContain("Message");
    expect(html).not.toContain("coach-crisis-resources");
  });
});

describe("ChatProposal", () => {
  test("a pending proposal offers Accept, Edit and Not now, and shows the whole body before Accept", () => {
    const body = "# Trip\n\n- [ ] Passport\n- [ ] Charger\n\nThe last line is far below the first.";
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:1" as never,
        proposal: { kind: "note", title: "Trip", body, status: "pending" },
      }),
    );
    expect(html).toContain(">Accept<");
    expect(html).toContain(">Edit<");
    expect(html).toContain(">Not now<");
    expect(html).toContain("Show all of it");
    expect(html).toContain("The last line is far below the first.");
  });

  test("an accepted proposal no longer offers Edit", () => {
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:2" as never,
        proposal: { kind: "task", title: "Call", minutes: 5, when: "today", status: "accepted", createdId: "tasks:1" },
      }),
    );
    expect(html).not.toContain(">Edit<");
  });

  const STEPS = [
    { title: "Reply to Dana", minutes: 10, reason: "It unblocks her" },
    { title: "Draft the report", minutes: 45 },
  ];

  test("a decision draws its steps as a DecisionCard with Save to today and Not now, and no Accept or Edit", () => {
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:3" as never,
        proposal: { kind: "decision", title: "This afternoon", steps: STEPS, status: "pending" } as never,
      }),
    );
    expect(html).toContain('data-component="DecisionCard"');
    expect(html).toContain("This afternoon");
    expect(html).toContain("Suggested order");
    expect(html.indexOf("Reply to Dana")).toBeGreaterThan(-1);
    expect(html.indexOf("Draft the report")).toBeGreaterThan(html.indexOf("Reply to Dana"));
    expect(html).toContain("It unblocks her");
    expect(html).toContain("Save to today");
    expect(html).toContain(">Not now<");
    expect(html).not.toContain(">Accept<");
    expect(html).not.toContain(">Edit<");
  });

  test("a saved decision says so, links to Today and offers Undo while it lasts; untitled ones get a default title", () => {
    const html = markup(
      createElement(ChatProposal, {
        messageId: "messages:4" as never,
        proposal: { kind: "decision", steps: STEPS, status: "accepted", createdId: "notes:1", undoUntilMs: Date.now() + 4 * 60_000 } as never,
      }),
    );
    expect(html).toContain("An order for today");
    expect(html).toContain("Saved to today. You can undo this for 5 minutes.");
    expect(html).toContain('href="/today"');
    expect(html).toContain(">Undo<");
    expect(html).not.toContain("Save to today<");
  });
});
