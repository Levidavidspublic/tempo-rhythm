import { describe, expect, test } from "bun:test";
import {
  EXECUTOR_GUIDE_URL,
  EXECUTOR_HEADER_PLACEHOLDER,
  buildExecutorSetup,
} from "../../apps/web/components/mcp/executorSetup";

describe("buildExecutorSetup", () => {
  const endpoint = "https://tempo.example.com/api/mcp";

  test("contains the endpoint and the header placeholder", () => {
    const setup = buildExecutorSetup(endpoint);
    expect(setup.url).toBe(endpoint);
    expect(setup.header).toContain(EXECUTOR_HEADER_PLACEHOLDER);
    expect(setup.header).toContain("<your token>");
    expect(setup.sourceType).toBe("Streamable HTTP");
  });

  test("never contains a real-looking token and keeps fields separate", () => {
    const setup = buildExecutorSetup(endpoint);
    expect(JSON.stringify(setup)).not.toContain("tmcp_");
    expect(setup.url).not.toContain("Authorization");
    expect(setup.header).not.toContain(endpoint);
    expect(EXECUTOR_GUIDE_URL).toContain("/blob/integration/docs/ops/EXECUTOR.md");
  });
});
