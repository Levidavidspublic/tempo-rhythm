import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { executorCallback } from "./connectionsHttp";
import { mcpNotAllowed, mcpOptions, mcpPost } from "./mcpHttp";
import { paddleWebhook } from "./paddleHttp";
import { revenueCatWebhook } from "./revenuecat";

const http = httpRouter();

// Convex Auth routes (sign-in, sign-out, session management)
auth.addHttpRoutes(http);

// RevenueCat subscription webhook
// Called by RevenueCat on: INITIAL_PURCHASE, RENEWAL, EXPIRATION, CANCELLATION, etc.
// Requires: REVENUECAT_WEBHOOK_SECRET env var set in Convex dashboard
http.route({
  path: "/api/revenuecat-webhook",
  method: "POST",
  handler: revenueCatWebhook,
});

// MCP server (Streamable HTTP, stateless). Auth: personal token, see convex/mcp.ts.
// Paddle Billing webhook (sandbox only). Needs PADDLE_WEBHOOK_SECRET + PADDLE_ENVIRONMENT=sandbox.
http.route({ path: "/api/paddle-webhook", method: "POST", handler: paddleWebhook });

http.route({ path: "/mcp", method: "POST", handler: mcpPost });
http.route({ path: "/mcp", method: "GET", handler: mcpNotAllowed });
http.route({ path: "/mcp", method: "DELETE", handler: mcpNotAllowed });
http.route({ path: "/mcp", method: "OPTIONS", handler: mcpOptions });

// Executor connection: the OAuth callback (TEMPO-B07-07, see convex/connections.ts).
http.route({ path: "/connections/executor/callback", method: "GET", handler: executorCallback });

export default http;
