/**
 * Which Executor tools the coach may run (TEMPO-B07-07, #989; research doc §4.1).
 *
 * The table:
 * - **auto**: on Tempo's allow list (`search`, `describe` in Executor 2; `integrations`, `search`
 *   in Executor 1's passthrough mode) AND the server marks it `readOnlyHint: true` and not
 *   `destructiveHint: true`. Runs without asking; logged and rate-limited.
 * - **blocked**: `execute` (runs a whole program; a card cannot preview it) and `skills` (text
 *   written by app authors: a prompt-injection path). Never, in B07.
 * - **card**: everything else (`call`, `invoke`, `resume`, unknown tools, tools with missing or
 *   false hints). Only after the person accepts a Tempo approval card, every time.
 *
 * Missing hints count as writing: MCP's defaults are `readOnlyHint: false` and
 * `destructiveHint: true` (source S15). Hints only ever make Tempo more careful, never less.
 *
 * B07 has no approval card yet, so `coachMayRun` lets only `search` and `describe` through, and
 * only when they classify as auto. Every other tool is refused.
 */
import type { McpToolAnnotations } from "./mcpClient";

export type ToolClass = "auto" | "card" | "blocked";

/** Tempo's allow list for auto tools (doc §4.1). */
export const AUTO_ALLOW_LIST: readonly string[] = ["search", "describe", "integrations"];
/** Never run by the coach in B07 (doc §4.1). */
export const BLOCKED_TOOLS: readonly string[] = ["execute", "skills"];
/** What the coach may run in B07: read-only lookups only (ticket #989 step 5). */
export const B07_RUNNABLE_TOOLS: readonly string[] = ["search", "describe"];

/**
 * The class of one Executor MCP tool. `annotations` are the tool's own, from `tools/list`;
 * undefined means none were seen, which counts as not read-only.
 */
export function classifyExecutorTool(name: string, annotations?: McpToolAnnotations): ToolClass {
  if (BLOCKED_TOOLS.includes(name)) return "blocked";
  const readOnly = annotations?.readOnlyHint === true && annotations.destructiveHint !== true;
  if (AUTO_ALLOW_LIST.includes(name) && readOnly) return "auto";
  return "card";
}

/** True only for a B07-runnable tool that classifies as auto. Everything else is refused. */
export function coachMayRun(name: string, annotations?: McpToolAnnotations): boolean {
  return B07_RUNNABLE_TOOLS.includes(name) && classifyExecutorTool(name, annotations) === "auto";
}

/**
 * The argument name `search` takes its words under. EXTRAPOLATED (doc §4.3 calls it `{ query }`;
 * the hosted input schema is UNKNOWN): `query` when the schema lists it or there is no schema;
 * else the one required string property, if there is exactly one; else null (not callable).
 */
export function searchArgumentName(inputSchema: unknown): string | null {
  if (!inputSchema || typeof inputSchema !== "object") return "query";
  const schema = inputSchema as { properties?: unknown; required?: unknown };
  const properties =
    schema.properties && typeof schema.properties === "object"
      ? (schema.properties as Record<string, unknown>)
      : {};
  if ("query" in properties) return "query";
  const required = Array.isArray(schema.required)
    ? schema.required.filter((name): name is string => typeof name === "string")
    : [];
  const strings = required.filter((name) => {
    const prop = properties[name];
    return Boolean(prop) && typeof prop === "object" && (prop as { type?: unknown }).type === "string";
  });
  if (Object.keys(properties).length === 0 && required.length === 0) return "query";
  return strings.length === 1 && required.length === 1 ? (strings[0] as string) : null;
}
