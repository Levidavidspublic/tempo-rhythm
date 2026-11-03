import { describe, expect, test } from "bun:test";
import { dayBoundsMs, localDateOf } from "./dates";
import { type CallTool, handleRpc } from "./dispatch";
import type { JsonRpcRequest } from "./jsonrpc";
import { isOriginAllowed, parseOriginList } from "./origin";
import { validateAgainstSchema } from "./schema";
import {
	generateToken,
	hashToken,
	isTokenShaped,
	parseBearer,
	tokenDisplayPrefix,
} from "./token";
import { MCP_TOOLS } from "./tools";

const okTool: CallTool = async (tool, args) => ({
	ok: true,
	data: { tool: tool.name, args },
});

function call(
	method: string,
	params?: unknown,
	id: number | "none" = 1,
	tool: CallTool = okTool,
) {
	const req: JsonRpcRequest = {
		jsonrpc: "2.0",
		method,
		...(id === "none" ? {} : { id }),
		params,
	};
	return handleRpc(req, tool);
}

describe("tokens", () => {
	test("generate: tmcp_ prefix, base64url, unique", () => {
		const a = generateToken();
		const b = generateToken();
		expect(a.startsWith("tmcp_")).toBe(true);
		expect(isTokenShaped(a)).toBe(true);
		expect(a).not.toBe(b);
		expect(tokenDisplayPrefix(a)).toBe(a.slice(0, 8));
	});

	test("hash is deterministic SHA-256 hex and differs from the token", async () => {
		const t = generateToken();
		const h = await hashToken(t);
		expect(h).toMatch(/^[0-9a-f]{64}$/);
		expect(await hashToken(t)).toBe(h);
		expect(h).not.toContain(t);
		expect(await hashToken("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	test("parseBearer", () => {
		expect(parseBearer("Bearer tmcp_x")).toBe("tmcp_x");
		expect(parseBearer("bearer tmcp_x")).toBe("tmcp_x");
		expect(parseBearer("Basic abc")).toBeNull();
		expect(parseBearer(null)).toBeNull();
		expect(isTokenShaped("tmcp_short")).toBe(false);
	});
});

describe("json-rpc dispatch", () => {
	test("initialize", async () => {
		const res = await call("initialize", { protocolVersion: "2025-06-18" });
		expect(res).toMatchObject({
			id: 1,
			result: {
				protocolVersion: "2025-06-18",
				capabilities: { tools: {} },
				serverInfo: { name: "tempo" },
			},
		});
	});

	test("initialize falls back to the latest version for an unknown one", async () => {
		const res = await call("initialize", { protocolVersion: "1999-01-01" });
		expect(
			(res as { result: { protocolVersion: string } }).result.protocolVersion,
		).toBe("2025-06-18");
	});

	test("notifications get no response", async () => {
		expect(
			await call("notifications/initialized", undefined, "none"),
		).toBeNull();
	});

	test("ping", async () => {
		expect(await call("ping")).toMatchObject({ id: 1, result: {} });
	});

	test("tools/list lists all 11 tools, none that delete", async () => {
		const res = (await call("tools/list")) as {
			result: { tools: { name: string }[] };
		};
		const names = res.result.tools.map((t) => t.name).sort();
		expect(names).toEqual(
			[
				"brain_dump",
				"calendar_create",
				"calendar_list",
				"calendar_update",
				"note_create",
				"note_update",
				"notes_list",
				"task_create",
				"task_update",
				"today_plan_get",
				"tasks_list",
			].sort(),
		);
		expect(MCP_TOOLS).toHaveLength(11);
		expect(names.some((n) => /delete|remove/.test(n))).toBe(false);
	});

	test("unknown method -> -32601", async () => {
		expect(await call("resources/list")).toMatchObject({
			error: { code: -32601 },
		});
	});

	test("bad params -> -32602", async () => {
		expect(await call("tools/call", {})).toMatchObject({
			error: { code: -32602 },
		});
		expect(
			await call("tools/call", { name: "nope", arguments: {} }),
		).toMatchObject({
			error: { code: -32602 },
		});
		expect(
			await call("tools/call", { name: "task_create", arguments: {} }),
		).toMatchObject({
			error: { code: -32602 },
		});
		expect(
			await call("tools/call", {
				name: "task_create",
				arguments: { title: "x", bogus: 1 },
			}),
		).toMatchObject({ error: { code: -32602 } });
		expect(
			await call("tools/call", { name: "tasks_list", arguments: [] }),
		).toMatchObject({
			error: { code: -32602 },
		});
	});

	test("tools/call returns text content and structuredContent", async () => {
		const res = (await call("tools/call", {
			name: "task_create",
			arguments: { title: "Buy milk" },
		})) as {
			result: {
				content: { type: string; text: string }[];
				structuredContent: unknown;
			};
		};
		expect(res.result.content[0].type).toBe("text");
		expect(JSON.parse(res.result.content[0].text)).toEqual(
			res.result.structuredContent,
		);
		expect(res.result.structuredContent).toEqual({
			tool: "task_create",
			args: { title: "Buy milk" },
		});
	});

	test("tool failure becomes isError, not a protocol error", async () => {
		const failing: CallTool = async () => {
			throw new Error("Task not found");
		};
		const res = await call(
			"tools/call",
			{ name: "task_update", arguments: { taskId: "x" } },
			1,
			failing,
		);
		expect(res).toMatchObject({
			result: { isError: true, content: [{ text: "Task not found" }] },
		});
	});
});

describe("tool input validation", () => {
	const schema = (name: string) =>
		MCP_TOOLS.find((t) => t.name === name)!.inputSchema;

	test("enums, ranges and types", () => {
		expect(
			validateAgainstSchema(schema("tasks_list"), {
				status: "open",
				limit: 10,
			}),
		).toEqual([]);
		expect(
			validateAgainstSchema(schema("tasks_list"), { status: "weird" }),
		).not.toEqual([]);
		expect(
			validateAgainstSchema(schema("tasks_list"), { limit: 0 }),
		).not.toEqual([]);
		expect(
			validateAgainstSchema(schema("calendar_list"), { fromMs: 1 }),
		).not.toEqual([]);
		expect(
			validateAgainstSchema(schema("calendar_list"), { fromMs: 1.5, toMs: 2 }),
		).not.toEqual([]);
		expect(
			validateAgainstSchema(schema("task_update"), {
				taskId: "a",
				dueAtMs: null,
			}),
		).toEqual([]);
		expect(
			validateAgainstSchema(schema("task_create"), { title: "" }),
		).not.toEqual([]);
	});
});

describe("origin", () => {
	test("no Origin passes; localhost passes; other browsers need the allowlist", () => {
		const allowed = parseOriginList("https://app.example.com/");
		expect(isOriginAllowed(null, allowed)).toBe(true);
		expect(isOriginAllowed("http://localhost:3000", allowed)).toBe(true);
		expect(isOriginAllowed("https://app.example.com", allowed)).toBe(true);
		expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
		expect(isOriginAllowed("not a url", allowed)).toBe(false);
	});
});

describe("dates", () => {
	test("day bounds in a timezone", () => {
		const { startMs, endMs } = dayBoundsMs("2026-10-06", "Asia/Jerusalem"); // UTC+3 in October
		expect(new Date(startMs).toISOString()).toBe("2026-10-05T21:00:00.000Z");
		expect(new Date(endMs).toISOString()).toBe("2026-10-06T21:00:00.000Z");
		expect(
			localDateOf("Asia/Jerusalem", Date.parse("2026-10-06T22:30:00Z")),
		).toBe("2026-10-07");
	});

	test("DST day is 23 or 25 hours", () => {
		const { startMs, endMs } = dayBoundsMs("2026-03-08", "America/New_York");
		expect((endMs - startMs) / 3_600_000).toBe(23);
	});
});
