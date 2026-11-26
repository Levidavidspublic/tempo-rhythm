// Dev-only smoke test of the single model seam (convex/lib/ai_router.ts).
//   npx convex run ai_smoke:pingModel
import { internalAction } from "./_generated/server";
import { callLLM, resolveAiModel } from "./lib/ai_router";

export const pingModel = internalAction({
  args: {},
  handler: async () => {
    try {
      const result = await callLLM({
        tier: "fast",
        messages: [{ role: "user", content: "Reply with exactly: pong" }],
        maxTokens: 10,
        temperature: 0,
      });
      return {
        model: result.model,
        content: result.content,
        totalTokens: result.usage.totalTokens,
        ok: true,
      };
    } catch (err) {
      const e = err as Error;
      return { model: resolveAiModel(), content: "", totalTokens: 0, ok: false, error: `${e.name}: ${e.message}` };
    }
  },
});
