export const EXECUTOR_GUIDE_URL =
  "https://github.com/Levidavidspublic/tempo-rhythm/blob/integration/docs/ops/EXECUTOR.md";

export const EXECUTOR_HEADER_PLACEHOLDER = "Authorization: Bearer <your token>";

export type ExecutorSetup = {
  /** Source type to pick in Executor. */
  sourceType: string;
  /** The usable endpoint URL, nothing else. */
  url: string;
  /** The header line with a placeholder, never a real token. */
  header: string;
};

/** Pure: the separate values to paste into Executor's "add MCP source" form. */
export function buildExecutorSetup(endpoint: string): ExecutorSetup {
  return {
    sourceType: "Streamable HTTP",
    url: endpoint,
    header: EXECUTOR_HEADER_PLACEHOLDER,
  };
}
