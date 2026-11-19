import { describe, expect, test } from "bun:test";
import {
  checkPageProposalDoc,
  softDeletePageProposal,
  type PageProposalDoc,
} from "./page-proposal-doc";

const proposal: PageProposalDoc = {
  kind: "add_task_to_today",
  schemaVersion: 1,
  noteId: "note-1",
  localDate: "2026-11-19",
  conversationId: "conversation-1",
  sourceRequestKey: "request_1",
  sourceAgentPromptId: "prompt-1",
  proposalRevision: 0,
  expectedPageRevision: 3,
  blockId: "blk_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  status: "pending",
  proposalExpiresAtMs: 1_700_086_400_000,
  cleanupDueAtMs: 1_700_090_000_000,
  metadataExpiresAtMs: 1_704_320_000_000,
  payload: { state: "available", task: { title: "Plan tomorrow", durationMin: 15 } },
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe("page proposal Firestore document", () => {
  test("accepts a valid pending proposal", () => {
    expect(checkPageProposalDoc(proposal)).toEqual({ ok: true, doc: proposal });
  });

  test("accepts an expired payload", () => {
    const expired: PageProposalDoc = {
      ...proposal,
      status: "expired",
      payload: { state: "expired", expiredAtMs: 1_700_086_400_000 },
    };
    expect(checkPageProposalDoc(expired)).toEqual({ ok: true, doc: expired });
  });

  test("rejects the unknown userId key", () => {
    expect(checkPageProposalDoc({ ...proposal, userId: "user-1" }).ok).toBe(false);
  });

  test("rejects an impossible localDate", () => {
    expect(checkPageProposalDoc({ ...proposal, localDate: "2026-02-30" }).ok).toBe(false);
  });

  test("rejects a bad blockId", () => {
    expect(checkPageProposalDoc({ ...proposal, blockId: "blk_not-a-ulid" }).ok).toBe(false);
  });

  test("rejects a blank task title", () => {
    expect(
      checkPageProposalDoc({
        ...proposal,
        payload: { state: "available", task: { title: "   ", durationMin: 15 } },
      }).ok,
    ).toBe(false);
  });

  test("rejects durationMin 1441", () => {
    expect(
      checkPageProposalDoc({
        ...proposal,
        payload: { state: "available", task: { title: "Plan tomorrow", durationMin: 1441 } },
      }).ok,
    ).toBe(false);
  });

  test("rejects an unknown status", () => {
    expect(checkPageProposalDoc({ ...proposal, status: "accepted" }).ok).toBe(false);
  });

  test("soft delete sets deletedAt and keeps the payload unchanged", () => {
    const deleted = softDeletePageProposal(proposal, 1_700_000_000_500);
    expect(deleted.deletedAt).toBe(1_700_000_000_500);
    expect(deleted.updatedAt).toBe(1_700_000_000_500);
    expect(deleted.payload).toEqual(proposal.payload);
  });
});
