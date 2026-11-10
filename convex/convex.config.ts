import agent from "@convex-dev/agent/convex.config";
import { defineApp } from "convex/server";

/**
 * Convex app definition (ticket #806, B06).
 *
 * Registers exactly one component: the pinned `@convex-dev/agent` 0.3.2 Agent
 * component, under its default name `agent` (its own `defineComponent("agent")`),
 * so host code reaches it as `components.agent.*`.
 *
 * Registration only. This sets up no model provider, key or gateway, and adds no
 * public chat function. Tempo's ownership checks, soft-delete and account
 * tombstones stay host-side: the component stores `userId` as an opaque string.
 */
const app = defineApp();
app.use(agent);

export default app;
