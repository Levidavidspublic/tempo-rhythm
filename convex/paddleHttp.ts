import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { statusFromPaddle, tierFromPriceId } from "./lib/billingPlans";
import { verifyPaddle } from "./lib/paddleSignature";

/**
 * Paddle Billing webhook. Endpoint: POST /api/paddle-webhook
 * Env (Convex dev/preview only):
 *   PADDLE_WEBHOOK_SECRET   notification destination secret (sandbox)
 *   PADDLE_ENVIRONMENT      "sandbox" (anything else is refused; live is not allowed yet)
 *   PADDLE_PRICE_ID_TIER_20 / PADDLE_PRICE_ID_TIER_50  sandbox price ids
 * Checkout must pass custom_data.userId = Convex users _id.
 */
export const paddleWebhook = httpAction(async (ctx, request) => {
	const secret = process.env.PADDLE_WEBHOOK_SECRET;
	if (!secret) return new Response("Webhook not configured", { status: 503 });
	if (process.env.PADDLE_ENVIRONMENT !== "sandbox") {
		return new Response("Only sandbox is enabled", { status: 503 });
	}

	const raw = await request.text();
	if (
		!(await verifyPaddle(raw, request.headers.get("Paddle-Signature"), secret))
	) {
		return new Response("Invalid signature", { status: 401 });
	}

	let evt: {
		event_id?: string;
		event_type?: string;
		data?: {
			id?: string;
			status?: string;
			customer_id?: string;
			custom_data?: { userId?: string } | null;
			items?: { price?: { id?: string } }[];
			current_billing_period?: { ends_at?: string } | null;
		};
	};
	try {
		evt = JSON.parse(raw);
	} catch {
		return new Response("Invalid JSON body", { status: 400 });
	}
	if (!evt.event_id || !evt.event_type)
		return new Response("Missing event fields", { status: 400 });

	const d = evt.data ?? {};
	const isSub = evt.event_type.startsWith("subscription.");
	const ends = d.current_billing_period?.ends_at;
	await ctx.runMutation(internal.billing.recordPaymentEvent, {
		provider: "paddle",
		eventId: evt.event_id,
		eventType: evt.event_type,
		testMode: true,
		userId: d.custom_data?.userId,
		tierKey: tierFromPriceId(d.items?.[0]?.price?.id, {
			tier20: process.env.PADDLE_PRICE_ID_TIER_20,
			tier50: process.env.PADDLE_PRICE_ID_TIER_50,
		}),
		status: isSub ? statusFromPaddle(d.status) : undefined,
		providerSubscriptionId: isSub ? d.id : undefined,
		providerCustomerId: d.customer_id,
		currentPeriodEnd: ends ? Date.parse(ends) : undefined,
	});
	return new Response("ok", { status: 200 });
});
