import { expect, test } from "@playwright/test";

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "playwright", version: "1" },
  },
};

test("POST /api/mcp without a token is not redirected to /sign-in", async ({ request }) => {
  const response = await request.post("/api/mcp", {
    data: initializeBody,
    headers: { Accept: "application/json, text/event-stream" },
    maxRedirects: 0,
  });
  // 401 with a live Convex backend. CI points at a placeholder Convex URL, so the
  // upstream may answer 404 or be unreachable (calm 502). Never a redirect.
  expect([401, 404, 502]).toContain(response.status());
  expect(response.headers().location).toBeUndefined();
});

test.describe("signed in", () => {
  test.skip(
    !process.env.TEMPO_E2E_STORAGE_STATE || !process.env.PLAYWRIGHT_BASE_URL,
    "needs TEMPO_E2E_STORAGE_STATE on PLAYWRIGHT_BASE_URL",
  );

  test("create a token, call tools, revoke", async ({ page, request }) => {
  const stamp = Date.now();
  const call = async (token: string, id: number, method: string, params?: unknown) =>
    request.post("/api/mcp", {
      data: { jsonrpc: "2.0", id, method, params },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
      },
    });

  await page.goto("/settings/integrations");
  await page.getByLabel("Token name").fill(`pw-mcp-${stamp}`);
  await page.getByRole("button", { name: "Create token" }).click();
  const token = await page.getByTestId("mcp-new-token").inputValue();
  expect(token.startsWith("tmcp_")).toBe(true);

  const init = await call(token, 1, "initialize", initializeBody.params);
  expect(init.status()).toBe(200);
  expect((await init.json()).result.serverInfo.name).toBe("tempo");

  const list = await call(token, 2, "tools/list");
  expect((await list.json()).result.tools).toHaveLength(11);

  const title = `pw mcp task ${stamp}`;
  const created = await call(token, 3, "tools/call", {
    name: "task_create",
    arguments: { title },
  });
  expect(created.status()).toBe(200);

  await page.goto("/tasks");
  await expect(page.getByText(title).first()).toBeVisible();

  await page.goto("/settings/integrations");
  await page
    .getByRole("listitem")
    .filter({ hasText: `pw-mcp-${stamp}` })
    .getByRole("button", { name: "Revoke" })
    .click();
  await expect(page.getByText(`pw-mcp-${stamp}`)).toHaveCount(0);

  const after = await call(token, 4, "tools/list");
  expect(after.status()).toBe(401);
  });
});
