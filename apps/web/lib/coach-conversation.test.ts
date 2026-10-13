import { describe, expect, test } from "bun:test";
import { pickCoachConversation } from "./coach-conversation";

describe("pickCoachConversation", () => {
  test("the newest legacy conversation, skipping ones moved to Agent chat", () => {
    const list = [
      { _id: "c3", chatMode: "agent" as const },
      { _id: "c2", chatMode: "legacy" as const },
      { _id: "c1", chatMode: "legacy" as const },
    ];
    expect(pickCoachConversation(list)?._id).toBe("c2");
  });

  test("none when every conversation moved, or there are none", () => {
    expect(pickCoachConversation([{ _id: "c1", chatMode: "agent" as const }])).toBeNull();
    expect(pickCoachConversation([])).toBeNull();
  });
});
