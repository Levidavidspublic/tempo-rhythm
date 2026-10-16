/**
 * What each OpenUI coach-card action does (components/coach/openui/OpenUiProposal.tsx). The same
 * mutations, in the same order, as the direct cards in components/coach/ChatProposal.tsx.
 * Edit is not here: it opens the direct card's form and changes nothing on the server.
 */

export type CoachCardMutations = {
  /** The card is a decision (an order saved to today's page), not a change. */
  decision: boolean;
  accept: () => Promise<unknown>;
  /** Accept for a decision: adds its steps to today's page. */
  save: () => Promise<unknown>;
  reject: () => Promise<unknown>;
  undo: () => Promise<unknown>;
  /** Saves today's open page now, so its next autosave can't write over a decision's steps. */
  flushPage: () => Promise<unknown>;
};

/** The work for an action event type, or null for one that changes nothing on the server. */
export function coachCardTask(type: string, m: CoachCardMutations): (() => Promise<void>) | null {
  switch (type) {
    case "Accept":
      return m.decision
        ? null
        : async () => {
            await m.accept();
          };
    case "Save":
      return m.decision
        ? async () => {
            await m.flushPage();
            await m.save();
          }
        : null;
    case "Reject":
      return async () => {
        await m.reject();
      };
    case "Undo":
      return async () => {
        // A save still waiting would write the removed steps back.
        if (m.decision) await m.flushPage();
        await m.undo();
      };
    default:
      return null;
  }
}
