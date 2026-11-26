import {
	INVALID_PARAMS,
	INVALID_REQUEST,
	isRecord,
	type JsonRpcRequest,
	type JsonRpcResponse,
	METHOD_NOT_FOUND,
	rpcError,
	rpcResult,
} from "./jsonrpc";
import { validateAgainstSchema } from "./schema";
import { findTool, MCP_TOOLS, type McpTool } from "./tools";

export const SERVER_INFO = { name: "tempo", version: "1.0.0" } as const;
/** Newest protocol version this server speaks (Streamable HTTP transport). */
export const LATEST_PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_PROTOCOL_VERSIONS = [
	"2025-06-18",
	"2025-03-26",
	"2024-11-05",
] as const;

export function negotiateProtocolVersion(requested: unknown): string {
	return typeof requested === "string" &&
		(SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
		? requested
		: LATEST_PROTOCOL_VERSION;
}

export type ToolOutcome =
	| { ok: true; data: unknown }
	| { ok: false; message: string };

/** Runs one validated tool call for the token's user. Provided by the HTTP action. */
export type CallTool = (
	tool: McpTool,
	args: Record<string, unknown>,
) => Promise<ToolOutcome>;

/**
 * Handle one JSON-RPC message. Returns null for notifications (HTTP 202, no body).
 */
export async function handleRpc(
	req: JsonRpcRequest,
	callTool: CallTool,
): Promise<JsonRpcResponse | null> {
	const isNotification = req.id === undefined;
	if (isNotification) {
		// notifications/initialized, notifications/cancelled, ...: accepted and ignored.
		return null;
	}
	const id = req.id ?? null;

	switch (req.method) {
		case "initialize": {
			const params = isRecord(req.params) ? req.params : {};
			return rpcResult(id, {
				protocolVersion: negotiateProtocolVersion(params.protocolVersion),
				capabilities: { tools: {} },
				serverInfo: SERVER_INFO,
			});
		}
		case "ping":
			return rpcResult(id, {});
		case "tools/list":
			return rpcResult(id, {
				tools: MCP_TOOLS.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema,
				})),
			});
		case "tools/call": {
			if (!isRecord(req.params) || typeof req.params.name !== "string") {
				return rpcError(id, INVALID_PARAMS, "tools/call needs params.name");
			}
			const tool = findTool(req.params.name);
			if (!tool) {
				return rpcError(id, INVALID_PARAMS, `Unknown tool: ${req.params.name}`);
			}
			const args = req.params.arguments ?? {};
			if (!isRecord(args)) {
				return rpcError(
					id,
					INVALID_PARAMS,
					"params.arguments must be an object",
				);
			}
			const problems = validateAgainstSchema(tool.inputSchema, args);
			if (problems.length > 0) {
				return rpcError(id, INVALID_PARAMS, problems.join("; "));
			}
			let outcome: ToolOutcome;
			try {
				outcome = await callTool(tool, args);
			} catch (err) {
				outcome = {
					ok: false,
					message: err instanceof Error ? err.message : "Tool failed",
				};
			}
			if (!outcome.ok) {
				return rpcResult(id, {
					isError: true,
					content: [{ type: "text", text: outcome.message }],
				});
			}
			return rpcResult(id, {
				content: [{ type: "text", text: JSON.stringify(outcome.data) }],
				structuredContent: outcome.data,
			});
		}
		default:
			if (typeof req.method !== "string" || req.method === "") {
				return rpcError(id, INVALID_REQUEST, "Invalid request");
			}
			return rpcError(id, METHOD_NOT_FOUND, `Method not found: ${req.method}`);
	}
}
