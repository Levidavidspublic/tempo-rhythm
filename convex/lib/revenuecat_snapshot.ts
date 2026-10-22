/** Server-owned mappings only. No provider identifiers are configured here. */
export type ServerMapping = Readonly<
	Record<
		string,
		{
			plan: "basic" | "pro" | "max";
			products: Readonly<
				Record<
					string,
					{
						billingCycle: "monthly" | "annual";
						basePlanId?: string;
					}
				>
			>;
		}
	>
>;

export type SnapshotGrant = {
	entitlementId: string;
	productId: string;
	plan: "basic" | "pro" | "max";
	billingCycle: "monthly" | "annual";
	expiresAtMs: number;
};
export type NormalizedSnapshot = {
	requestAtMs: number;
	grants: readonly SnapshotGrant[];
};
export type SnapshotResult =
	| { ok: true; snapshot: NormalizedSnapshot }
	| {
			ok: false;
			reason: "malformed" | "unsupported" | "environment-mismatch" | "oversize";
	  };

const MAX_ENTRIES = 128;
const MAX_GRANTS = 32;

function owns(value: object, key: PropertyKey): boolean {
	return Object.prototype.hasOwnProperty.call(value, key);
}

function record(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}

export function isRevenueCatIdentifier(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value.length <= 256 &&
		value.trim() === value &&
		!/[\p{Cc}\p{Cf}]/u.test(value)
	);
}

function mappingValid(mapping: unknown): mapping is ServerMapping {
	if (!record(mapping) || Object.keys(mapping).length > MAX_ENTRIES)
		return false;
	return Object.entries(mapping).every(([id, entry]) => {
		if (
			!isRevenueCatIdentifier(id) ||
			!record(entry) ||
			!["basic", "pro", "max"].includes(entry.plan as string) ||
			!record(entry.products)
		)
			return false;
		const products = Object.entries(entry.products);
		return (
			products.length > 0 &&
			products.length <= MAX_ENTRIES &&
			products.every(
				([productId, product]) =>
					isRevenueCatIdentifier(productId) &&
					record(product) &&
					["monthly", "annual"].includes(product.billingCycle as string) &&
					(!owns(product, "basePlanId") ||
						isRevenueCatIdentifier(product.basePlanId)),
			)
		);
	});
}

/** A reader must not contact the provider until its server catalog is configured. */
export function isRevenueCatMappingConfigured(
	mapping: unknown,
): mapping is ServerMapping {
	try {
		return mappingValid(mapping) && Object.keys(mapping).length > 0;
	} catch {
		return false;
	}
}

function millis(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** RFC3339 instants exactly representable in milliseconds; never normalize invalid days. */
function dateMillis(value: unknown): number | null {
	if (typeof value !== "string" || value.length > 40) return null;
	const match =
		/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([Zz]|[+-]\d{2}:\d{2})$/.exec(
			value,
		);
	if (!match) return null;
	const [
		,
		yearText,
		monthText,
		dayText,
		hourText,
		minuteText,
		secondText,
		fraction,
		zone,
	] = match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
	const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	if (
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > days[month - 1] ||
		Number(hourText) > 23 ||
		Number(minuteText) > 59 ||
		Number(secondText) > 59 ||
		(fraction && /[1-9]/.test(fraction.slice(3)))
	)
		return null;
	if (
		zone.length > 1 &&
		(Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)
	)
		return null;
	const parsed = Date.parse(value);
	return millis(parsed) ? parsed : null;
}

/**
 * Provider response dates are observation times, not monotonic customer revisions.
 * Complete empty maps are valid; missing or malformed maps must never mean revoke.
 * Different entitlement IDs may legitimately share the same product.
 */
export function parseRevenueCatSnapshot(
	input: unknown,
	mapping: ServerMapping,
	environment: "sandbox" | "production",
): SnapshotResult {
	const malformed = { ok: false, reason: "malformed" } as const;
	try {
		if (
			!record(input) ||
			!mappingValid(mapping) ||
			(environment !== "sandbox" && environment !== "production")
		)
			return malformed;
		const hasDate = owns(input, "request_date");
		const hasMs = owns(input, "request_date_ms");
		const fromDate = hasDate ? dateMillis(input.request_date) : null;
		const fromMs =
			hasMs && millis(input.request_date_ms) ? input.request_date_ms : null;
		if (
			(!hasDate && !hasMs) ||
			(hasDate && fromDate === null) ||
			(hasMs && fromMs === null) ||
			(hasDate && hasMs && fromDate !== fromMs)
		)
			return malformed;
		const requestAtMs = fromDate ?? fromMs;
		if (requestAtMs === null || !record(input.subscriber)) return malformed;
		const { entitlements, subscriptions } = input.subscriber;
		if (!record(entitlements) || !record(subscriptions)) return malformed;
		const entries = Object.entries(entitlements);
		const products = Object.entries(subscriptions);
		if (entries.length > MAX_ENTRIES || products.length > MAX_ENTRIES) {
			return { ok: false, reason: "oversize" };
		}
		if (
			!products.every(
				([id, value]) => isRevenueCatIdentifier(id) && record(value),
			)
		)
			return malformed;
		const grants: SnapshotGrant[] = [];
		for (const [entitlementId, value] of entries) {
			if (!isRevenueCatIdentifier(entitlementId) || !record(value))
				return malformed;
			if (!owns(mapping, entitlementId)) continue;
			const configured = mapping[entitlementId];
			const productId = value.product_identifier;
			if (!isRevenueCatIdentifier(productId)) return malformed;
			if (!owns(configured.products, productId))
				return { ok: false, reason: "unsupported" };
			if (!owns(subscriptions, productId)) return malformed;
			const subscription = subscriptions[productId];
			if (!record(subscription)) return malformed;
			const product = configured.products[productId];
			if (
				product.basePlanId !== undefined &&
				value.product_plan_identifier !== product.basePlanId
			) {
				return { ok: false, reason: "unsupported" };
			}
			if (
				owns(subscription, "product_plan_identifier") &&
				subscription.product_plan_identifier !== null &&
				(subscription.product_plan_identifier !==
					value.product_plan_identifier ||
					!isRevenueCatIdentifier(subscription.product_plan_identifier))
			) {
				return { ok: false, reason: "unsupported" };
			}
			if (typeof subscription.is_sandbox !== "boolean") return malformed;
			if (subscription.is_sandbox !== (environment === "sandbox")) {
				return { ok: false, reason: "environment-mismatch" };
			}
			if (value.expires_date === null)
				return { ok: false, reason: "unsupported" };
			const expiresAtMs = dateMillis(value.expires_date);
			if (expiresAtMs === null) return malformed;
			grants.push({
				entitlementId,
				productId,
				plan: configured.plan,
				billingCycle: product.billingCycle,
				expiresAtMs,
			});
			if (grants.length > MAX_GRANTS) return { ok: false, reason: "oversize" };
		}
		grants.sort((a, b) =>
			a.entitlementId < b.entitlementId
				? -1
				: a.entitlementId > b.entitlementId
					? 1
					: 0,
		);
		return { ok: true, snapshot: { requestAtMs, grants } };
	} catch {
		return malformed;
	}
}
