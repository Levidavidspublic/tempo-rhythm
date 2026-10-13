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
});
