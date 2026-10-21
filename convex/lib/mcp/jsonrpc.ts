/** JSON-RPC 2.0 types and error codes for the Tempo MCP endpoint. */
export type JsonRpcId = string | number | null;

export type JsonRpcRequest = {
	jsonrpc: "2.0";
	id?: JsonRpcId;
	method: string;
	params?: unknown;
};

export type JsonRpcError = { code: number; message: string; data?: unknown };

export type JsonRpcResponse =
	| { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
	| { jsonrpc: "2.0"; id: JsonRpcId; error: JsonRpcError };

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export function rpcResult(id: JsonRpcId, result: unknown): JsonRpcResponse {
	return { jsonrpc: "2.0", id, result };
}

export function rpcError(
	id: JsonRpcId,
	code: number,
	message: string,
	data?: unknown,
): JsonRpcResponse {
	return {
		jsonrpc: "2.0",
		id,
		error: { code, message, ...(data !== undefined ? { data } : {}) },
	};
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A request has an `id`; a notification does not. */
export function parseRequest(value: unknown): JsonRpcRequest | null {
	if (
		!isRecord(value) ||
		value.jsonrpc !== "2.0" ||
		typeof value.method !== "string"
	) {
		return null;
	}
	const id = value.id;
	if (
		id !== undefined &&
		id !== null &&
		typeof id !== "string" &&
		typeof id !== "number"
	) {
		return null;
	}
	return value as JsonRpcRequest;
}
