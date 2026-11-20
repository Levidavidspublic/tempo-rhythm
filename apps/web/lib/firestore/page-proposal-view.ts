import type { PageProposalDoc } from "../firestore-docs/page-proposal-doc";

export type PageProposalView = {
  state: "waiting" | "confirmed" | "rejected" | "cancelled" | "expired" | "gone";
  canDecide: boolean;
  secondsLeft: number;
  task?: { title: string; durationMin: number };
};

const finishedView = (state: Exclude<PageProposalView["state"], "waiting">): PageProposalView => ({
  state,
  canDecide: false,
  secondsLeft: 0,
});

export function readPageProposal(doc: PageProposalDoc, now: number): PageProposalView {
  if (doc.deletedAt !== undefined) return finishedView("gone");

  if (doc.status === "confirmed" || doc.status === "rejected" || doc.status === "cancelled") {
    return finishedView(doc.status);
  }

  if (
    doc.status === "expired" ||
    doc.payload.state === "expired" ||
    !Number.isFinite(now) ||
    now >= doc.proposalExpiresAtMs
  ) {
    return finishedView("expired");
  }

  return {
    state: "waiting",
    canDecide: true,
    secondsLeft: Math.max(0, Math.ceil((doc.proposalExpiresAtMs - now) / 1000)),
    task: { ...doc.payload.task },
  };
}
