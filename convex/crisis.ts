import { v } from "convex/values";
import { query } from "./_generated/server";
import { CRISIS_CARD, isCrisisText } from "./lib/crisisWords";
import { requireUser } from "./lib/requireUser";

/** Fixed word list in code. No model call. */
export const check = query({
  args: { text: v.string() },
  returns: v.object({ isCrisis: v.boolean() }),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return { isCrisis: isCrisisText(args.text) };
  },
});

/** Fixed, generic card. Country-specific numbers are not set up yet (PRD §6). */
export const resourcesCard = query({
  args: {},
  returns: v.object({
    title: v.string(),
    body: v.string(),
    resources: v.array(v.object({ label: v.string(), detail: v.string() })),
  }),
  handler: async (ctx) => {
    await requireUser(ctx);
    return CRISIS_CARD;
  },
});
