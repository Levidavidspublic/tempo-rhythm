export type MemoryImportSource = "chatgpt" | "claude" | "grok" | "other";

const MAX_ITEMS = 300;
const MAX_ITEM_LENGTH = 1000;
const BULLET_PREFIX = /^\s*(?:[-*\u2022]|\d+[.)])\s+/;
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/;

/** Actual UTF-8 size of a string, without Node-only APIs. */
export function utf8ByteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

function cleanItem(value: string): string | null {
	const cleaned = value
		.replace(BULLET_PREFIX, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_ITEM_LENGTH)
		.trim();
	if (cleaned.length < 3 || !/[\p{L}\p{N}]/u.test(cleaned)) return null;
	return cleaned;
}

function objectItem(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	for (const key of ["content", "text", "memory"] as const) {
		if (typeof item[key] === "string") return item[key];
	}
	return null;
}

function markdownItems(value: unknown): string[] {
	return typeof value === "string" ? lineItems(value) : [];
}

function claudeAccountItems(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const accounts = value.filter(
		(account): account is Record<string, unknown> =>
			account !== null && typeof account === "object" && !Array.isArray(account),
	);
	if (
		!accounts.some(
			(account) =>
				"conversations_memory" in account ||
				"project_memories" in account ||
				"memory_files" in account,
		)
	) {
		return null;
	}

	const items: string[] = [];
	for (const account of accounts) {
		items.push(...markdownItems(account.conversations_memory));

		if (
			account.project_memories !== null &&
			typeof account.project_memories === "object" &&
			!Array.isArray(account.project_memories)
		) {
			for (const memory of Object.values(account.project_memories)) {
				items.push(...markdownItems(memory));
			}
		}

		if (Array.isArray(account.memory_files)) {
			for (const file of account.memory_files) {
				if (file !== null && typeof file === "object" && !Array.isArray(file)) {
					items.push(...markdownItems((file as Record<string, unknown>).content));
				}
			}
		}
	}
	return items;
}

function jsonItems(value: unknown, source: MemoryImportSource): string[] | null {
	if (source === "claude") {
		const accountItems = claudeAccountItems(value);
		if (accountItems !== null) return accountItems;
	}
	const items = Array.isArray(value)
		? value
		: value && typeof value === "object"
			? ((value as Record<string, unknown>).memories ??
				(value as Record<string, unknown>).items)
			: null;
	if (!Array.isArray(items)) return null;
	return items.map(objectItem).filter((item): item is string => item !== null);
}

function lineItems(text: string): string[] {
	const items: string[] = [];
	let heading: string | null = null;
	for (const rawLine of text.split(/\r?\n/)) {
		const headingMatch = rawLine.match(HEADING);
		if (headingMatch) {
			heading = cleanItem(headingMatch[1] ?? "");
			continue;
		}
		const item = cleanItem(rawLine);
		if (item) items.push(heading ? `${heading}: ${item}` : item);
	}
	return items;
}

/** Parse a pasted memory export without making assumptions about its provider. */
export function parseMemoryExport(text: string, source: MemoryImportSource): string[] {
	if (!text.trim() || /\0/.test(text)) return [];

	let candidates: string[];
	try {
		// Successfully parsed JSON in an unsupported shape yields nothing, so account or
		// profile metadata is never imported as memories.
		candidates = jsonItems(JSON.parse(text), source) ?? [];
	} catch {
		// Export snippets are often incomplete JSON; treat those as ordinary pasted lines.
		candidates = lineItems(text);
	}

	const seen = new Set<string>();
	const result: string[] = [];
	for (const candidate of candidates) {
		const item = cleanItem(candidate);
		if (!item) continue;
		const key = item.toLocaleLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(item);
		if (result.length === MAX_ITEMS) break;
	}
	return result;
}
