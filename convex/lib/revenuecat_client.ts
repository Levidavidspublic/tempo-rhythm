import {
	isRevenueCatIdentifier,
	isRevenueCatMappingConfigured,
	parseRevenueCatSnapshot,
	type NormalizedSnapshot,
	type ServerMapping,
} from "./revenuecat_snapshot";

type ReadResult =
	| { ok: true; snapshot: NormalizedSnapshot }
	| {
			ok: false;
			reason: "disabled" | "unconfigured" | "unavailable" | "invalid-response";
	  };
type ReadOptions = {
	enabled: boolean;
	/** Caller must first prove a configured canonical provider identity server-side. */
	canonicalCustomerId: string;
	mapping: ServerMapping;
	environment: "sandbox" | "production" | null;
	signal?: AbortSignal;
};
type ServerDependencies = {
	fetch?: (url: string, init: RequestInit) => Promise<Response>;
	getApiKey?: () => string | undefined;
};
const DEADLINE_MS = 5_000;
const MAX_BYTES = 128 * 1024;

/**
 * Internal TypeScript helper, deliberately unmounted. RAM-ONLY: provider response
 * bytes exist only during this call. No logs, cache, writes, retries or redirects.
 * Never call with a public/request-selected ID: this GET can create a customer.
 */
export async function readRevenueCatSnapshot(
	options: ReadOptions,
	dependencies: ServerDependencies = {},
): Promise<ReadResult> {
	if (!options.enabled) return { ok: false, reason: "disabled" };
	if (
		!isRevenueCatMappingConfigured(options.mapping) ||
		(options.environment !== "sandbox" &&
			options.environment !== "production") ||
		!isRevenueCatIdentifier(options.canonicalCustomerId)
	)
		return { ok: false, reason: "unconfigured" };
	let key: string | undefined;
	try {
		key = (dependencies.getApiKey ?? (() => process.env.REVENUECAT_API_KEY))();
	} catch {
		return { ok: false, reason: "unconfigured" };
	}
	if (!key || key.trim() !== key || /[\r\n]/.test(key))
		return { ok: false, reason: "unconfigured" };
	if (options.signal?.aborted) return { ok: false, reason: "unavailable" };
	const controller = new AbortController();
	const abort = () => controller.abort();
	let rejectAbort: () => void = () => {};
	const aborted = new Promise<never>((_resolve, reject) => {
		rejectAbort = () => reject(new Error("unavailable"));
	});
	controller.signal.addEventListener("abort", rejectAbort, { once: true });
	options.signal?.addEventListener("abort", abort, { once: true });
	const timer = setTimeout(abort, DEADLINE_MS);
	const deadline = Date.now() + DEADLINE_MS;
	let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
	let body: ReadableStream<Uint8Array> | null = null;
	let complete = false;
	let settled = false;
	try {
		const fetcher = dependencies.fetch ?? fetch;
		const responsePromise = fetcher(
			`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(options.canonicalCustomerId)}`,
			{
				method: "GET",
				redirect: "error",
				headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
				signal: controller.signal,
			},
		).then((response) => {
			if (settled || controller.signal.aborted)
				void response.body?.cancel().catch(() => {});
			return response;
		});
		const response = await Promise.race([responsePromise, aborted]);
		body = response.body;
		if (controller.signal.aborted || Date.now() >= deadline)
			return { ok: false, reason: "unavailable" };
		if (response.status !== 200 || response.redirected) {
			return { ok: false, reason: "unavailable" };
		}
		if (!body) return { ok: false, reason: "invalid-response" };
		reader = body.getReader();
		const chunks: Uint8Array[] = [];
		let size = 0;
		for (;;) {
			if (controller.signal.aborted || Date.now() >= deadline)
				return { ok: false, reason: "unavailable" };
			const next = await Promise.race([reader.read(), aborted]);
			if (controller.signal.aborted || Date.now() >= deadline)
				return { ok: false, reason: "unavailable" };
			if (next.done) break;
			size += next.value.byteLength;
			if (size > MAX_BYTES) return { ok: false, reason: "invalid-response" };
			if (next.value.byteLength > 0) chunks.push(next.value);
		}
		complete = true;
		const bytes = new Uint8Array(size);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.byteLength;
		}
		let payload: unknown;
		try {
			payload = JSON.parse(
				new TextDecoder("utf-8", { fatal: true }).decode(bytes),
			);
		} catch {
			return { ok: false, reason: "invalid-response" };
		}
		const parsed = parseRevenueCatSnapshot(
			payload,
			options.mapping,
			options.environment,
		);
		return parsed.ok ? parsed : { ok: false, reason: "invalid-response" };
	} catch {
		return { ok: false, reason: "unavailable" };
	} finally {
		settled = true;
		clearTimeout(timer);
		options.signal?.removeEventListener("abort", abort);
		controller.signal.removeEventListener("abort", rejectAbort);
		if (!complete) {
			controller.abort();
			// A hostile/stalled stream may never settle cancellation; never await it.
			void (reader ? reader.cancel() : body?.cancel())?.catch(() => {});
		}
		try {
			reader?.releaseLock();
		} catch {
			/* A pending read is already aborted. */
		}
	}
}
