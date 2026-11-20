import { describe, expect, test } from "bun:test";

import type { PageProposalDoc } from "../firestore-docs/page-proposal-doc";
import { readPageProposal } from "./page-proposal-view";

const NOW = 10_000;

function proposal(overrides: Partial<PageProposalDoc> = {}): PageProposalDoc {
  return {
    kind: "add_task_to_today",
    schemaVersion: 1,
    noteId: "note-1",
    localDate: "2026-11-20",
    conversationId: "conversation-1",
    sourceRequestKey: "request-1",
    proposalRevision: 0,
    expectedPageRevision: 0,
    blockId: "blk_00000000000000000000000000",
    status: "pending",
    proposalExpiresAtMs: NOW + 5_000,
    cleanupDueAtMs: NOW + 10_000,
    metadataExpiresAtMs: NOW + 20_000,
    payload: {
      state: "available",
      task: { title: "Call the bank", durationMin: 15 },
    },
    createdAt: NOW - 1_000,
    updatedAt: NOW - 1_000,
    ...overrides,
  };
}

describe("readPageProposal", () => {
  test("returns a waiting view with a copied task while a pending proposal has time left", () => {
    const doc = proposal();
    const view = readPageProposal(doc, NOW);

    expect(view).toEqual({
      state: "waiting",
      canDecide: true,
      secondsLeft: 5,
      task: { title: "Call the bank", durationMin: 15 },
    });
    expect(view.task).not.toBe(doc.payload.state === "available" ? doc.payload.task : undefined);
    expect(doc).toEqual(proposal());
  });

  test.each([
    ["exactly at expiry", NOW + 5_000],
    ["after expiry", NOW + 5_001],
  ])("expires pending proposals %s", (_label, now) => {
    expect(readPageProposal(proposal(), now)).toEqual({
      state: "expired",
      canDecide: false,
      secondsLeft: 0,
    });
  });

  test("expires an already-expired payload even while its status is pending", () => {
    const doc = proposal({
      payload: { state: "expired", expiredAtMs: NOW - 1 },
    });
    expect(readPageProposal(doc, NOW)).toEqual({
      state: "expired",
      canDecide: false,
      secondsLeft: 0,
    });
  });

  test.each(["confirmed", "rejected", "cancelled"] as const)(
    "maps the %s status to a finished view",
    (status) => {
      expect(readPageProposal(proposal({ status }), NOW)).toEqual({
        state: status,
        canDecide: false,
        secondsLeft: 0,
      });
    }
  );

  test("returns gone for a deleted proposal before considering its status", () => {
    const doc = proposal({ status: "confirmed", deletedAt: NOW });
    expect(readPageProposal(doc, Number.NaN)).toEqual({
      state: "gone",
      canDecide: false,
      secondsLeft: 0,
    });
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "fails closed for non-finite now value %s",
    (now) => {
      expect(readPageProposal(proposal(), now)).toEqual({
        state: "expired",
        canDecide: false,
        secondsLeft: 0,
      });
    }
  );

  test("rounds a partial second up", () => {
    expect(readPageProposal(proposal({ proposalExpiresAtMs: NOW + 1_001 }), NOW).secondsLeft).toBe(
      2
    );
  });
});
