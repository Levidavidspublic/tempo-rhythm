import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

/**
 * Call FIRST in every Convex action that calls an LLM, STT or TTS provider.
 * Runs `approval.assertApprovedForAi` as the calling user (actions pass their
 * auth identity to ctx.runQuery), so a signed-out, pending or revoked account
 * is rejected before any provider request is made.
 */
export async function requireApprovedForAi(ctx: ActionCtx): Promise<void> {
	await ctx.runQuery(internal.approval.assertApprovedForAi, {});
}
