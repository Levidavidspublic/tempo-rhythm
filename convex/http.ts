import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { mcpNotAllowed, mcpOptions, mcpPost } from "./mcpHttp";
import { telegramWebhook } from "./reminders";
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
http.route({ path: "/mcp", method: "POST", handler: mcpPost });
http.route({ path: "/mcp", method: "GET", handler: mcpNotAllowed });
http.route({ path: "/mcp", method: "DELETE", handler: mcpNotAllowed });
http.route({ path: "/mcp", method: "OPTIONS", handler: mcpOptions });

// Telegram reminders (S14): the bot's webhook. Auth: X-Telegram-Bot-Api-Secret-Token must match
// TELEGRAM_WEBHOOK_SECRET (set with setWebhook's secret_token). See convex/reminders.ts.
http.route({ path: "/telegram/webhook", method: "POST", handler: telegramWebhook });

export default http;
