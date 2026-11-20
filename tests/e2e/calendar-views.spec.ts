import { expect, test } from "@playwright/test";

// Runs against the shared Playwright webServer (playwright.config.ts), which
// starts apps/web in dev mode with TEMPO_E2E_PUBLIC_CALENDAR=1 so /calendar
// is reachable without auth and uses the local (browser-storage) event source.

test("event created in Day view appears in Week and Month views for that date", async ({
  page,
}) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { level: 1, name: "Calendar", exact: true })).toBeVisible();
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  // Type only once the page has hydrated: text typed into the server-rendered field before React
  // takes over is lost, and the Add then reads an empty title.
  await page.waitForLoadState("networkidle");

  await page.getByRole("textbox", { name: "Event title" }).fill("Boundary planning call");
  await page.getByLabel("Event date").fill("2026-08-01");
  await page.getByRole("button", { name: "Add event" }).click();

  await expect(page.getByTestId("day-events")).toContainText("Boundary planning call");

  await page.getByRole("button", { name: "Week" }).click();
  await expect(page.getByTestId("week-events")).toContainText("Boundary planning call");

  await page.getByRole("button", { name: "Month" }).click();
  await expect(page.getByTestId("month-events")).toContainText("Boundary planning call");
});
