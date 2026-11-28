import { expect, test } from "@playwright/test";

// TEMPO-B05-08: each route mounts its component (not ScaffoldScreen). The marker is a data-testid on the
// route's wrapper element, so it holds in the signed-out, loading and empty states of the E2E harness.
test.describe("templates and onboarding wiring", () => {
  test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");

  const routes = [
    { name: "/templates", path: "/templates", testId: "templates-library-route" },
    { name: "/templates/builder", path: "/templates/builder", testId: "template-builder-route" },
    {
      name: "/templates/builder?from=<id>",
      path: "/templates/builder?from=starter-1",
      testId: "template-builder-route",
    },
    {
      name: "/templates/editor/[id]",
      path: "/templates/editor/abc123",
      testId: "template-editor-route",
    },
    { name: "/templates/run/[id]", path: "/templates/run/abc123", testId: "template-run-route" },
    { name: "/onboarding", path: "/onboarding", testId: "onboarding-route" },
  ];

  for (const route of routes) {
    test(`${route.name} mounts its component`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).not.toHaveURL(/\/sign-in/);
      await expect(page.getByTestId(route.testId)).toBeVisible();
      await expect(page.getByText("Copy placeholder")).toHaveCount(0);
    });
  }
});
