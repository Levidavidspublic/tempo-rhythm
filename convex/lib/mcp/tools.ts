import type { JsonSchema } from "./schema";

/**
 * Tempo MCP tool registry (TEMPO-MCP-01). 12 tools, no delete tools in v1 (PRD F-100:
 * heavy writes are refused). `kind` says which Convex function type runs the tool.
 */
export type McpToolKind = "query" | "mutation" | "action";

export type McpTool = {
	name: string;
	description: string;
	kind: McpToolKind;
	inputSchema: JsonSchema & { type: "object" };
};

const ms = (description: string): JsonSchema => ({
	type: "integer",
	minimum: 0,
	description,
});
const id = (description: string): JsonSchema => ({
	type: "string",
	minLength: 1,
	description,
});

export const MCP_TOOLS: readonly McpTool[] = [
	{
		name: "tasks_list",
		description:
			"List the user's tasks. status: open (default), done, or all. Optional due-date window in epoch ms.",
		kind: "query",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				status: { type: "string", enum: ["open", "done", "all"] },
				dueFrom: ms("Only tasks due at or after this time (epoch ms)."),
				dueTo: ms("Only tasks due before this time (epoch ms)."),
				limit: {
					type: "integer",
					minimum: 1,
					maximum: 200,
					description: "Default 50.",
				},
			},
		},
	},
	{
		name: "task_create",
		description: "Create a task.",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["title"],
			properties: {
				title: { type: "string", minLength: 1, maxLength: 280 },
				notes: { type: "string", maxLength: 10000 },
				dueAtMs: ms("Due time, epoch ms."),
				priority: { type: "string", enum: ["low", "medium", "high"] },
				energy: { type: "string", enum: ["low", "medium", "high"] },
			},
		},
	},
	{
		name: "task_update",
		description:
			"Update a task. completed: true marks it done, false reopens it. dueAtMs: null clears the due time.",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["taskId"],
			properties: {
				taskId: id("Task id from tasks_list."),
				title: { type: "string", minLength: 1, maxLength: 280 },
				notes: { type: "string", maxLength: 10000 },
				dueAtMs: { type: ["integer", "null"], minimum: 0 },
				completed: { type: "boolean" },
			},
		},
	},
	{
		name: "notes_list",
		description: "List the user's notes, newest first.",
		kind: "query",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				limit: {
					type: "integer",
					minimum: 1,
					maximum: 200,
					description: "Default 50.",
				},
				pinnedOnly: { type: "boolean" },
			},
		},
	},
	{
		name: "note_create",
		description: "Create a note.",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["title"],
			properties: {
				title: { type: "string", minLength: 1, maxLength: 280 },
				body: { type: "string", maxLength: 100000 },
			},
		},
	},
	{
		name: "note_update",
		description: "Update a note's title, body or pinned flag.",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["noteId"],
			properties: {
				noteId: id("Note id from notes_list."),
				title: { type: "string", minLength: 1, maxLength: 280 },
				body: { type: "string", maxLength: 100000 },
				pinned: { type: "boolean" },
			},
		},
	},
	{
		name: "calendar_list",
		description:
			"List calendar events starting in [fromMs, toMs). The range is at most 32 days.",
		kind: "query",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["fromMs", "toMs"],
			properties: {
				fromMs: ms("Range start, epoch ms."),
				toMs: ms("Range end, epoch ms."),
			},
		},
	},
	{
		name: "calendar_create",
		description:
			"Create a calendar event. Tempo events have a start time only (no end time yet).",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["title", "startsAtMs"],
			properties: {
				title: { type: "string", minLength: 1, maxLength: 280 },
				startsAtMs: ms("Start time, epoch ms."),
			},
		},
	},
	{
		name: "calendar_update",
		description: "Update a calendar event's title or start time.",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["eventId"],
			properties: {
				eventId: id("Event id from calendar_list."),
				title: { type: "string", minLength: 1, maxLength: 280 },
				startsAtMs: ms("Start time, epoch ms."),
			},
		},
	},
	{
		name: "today_plan_get",
		description:
			"Read the day plan (intention, top tasks, energy) plus tasks due that day. Defaults to today in the given timezone (UTC if none).",
		kind: "query",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				date: { type: "string", description: "YYYY-MM-DD" },
				timezone: {
					type: "string",
					description: "IANA name, e.g. Asia/Jerusalem",
				},
			},
		},
	},
	{
		name: "today_plan_set",
		description:
			"Set the day plan's intention, up to 3 top tasks, or energy. Omitted fields are unchanged. Defaults to today in the given timezone (UTC if none).",
		kind: "mutation",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			properties: {
				date: { type: "string", description: "YYYY-MM-DD" },
				timezone: {
					type: "string",
					description: "IANA name, e.g. Asia/Jerusalem",
				},
				intention: { type: "string", maxLength: 280 },
				// The shared schema validator does not inspect arrays; the mutation validates
				// the array shape, three-item limit, IDs, and ownership before writing.
				topTaskIds: { description: "Task ids from tasks_list (maximum 3)." },
				energy: { type: "string", enum: ["low", "medium", "high"] },
			},
		},
	},
	{
		name: "brain_dump",
		description:
			"Turn messy text into a prioritized plan (up to 6 items, uses the AI planner). accept: true also saves the items as tasks.",
		kind: "action",
		inputSchema: {
			type: "object",
			additionalProperties: false,
			required: ["text"],
			properties: {
				text: { type: "string", minLength: 1, maxLength: 20000 },
				accept: { type: "boolean" },
			},
		},
	},
];

export function findTool(name: string): McpTool | undefined {
	return MCP_TOOLS.find((t) => t.name === name);
}
