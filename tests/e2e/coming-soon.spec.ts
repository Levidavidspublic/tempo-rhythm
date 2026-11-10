import { expect, test } from "@playwright/test";

/**
 * Coming-soon page (design export: public-coming-soon.html), opened at /coming-soon in the app
 * surface. The join form's network call is stubbed here: the route's own rules are unit tested in
 * apps/web/lib, and the real Firestore write is checked on a Vercel preview, not in this suite.
 */
test.describe("coming-soon page", () => {
  test("shows the export's hero and a labelled join form, with no sign-in or app links", async ({
    page,
  }) => {
    await page.goto("/coming-soon");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find your rhythm.");
    await expect(page.getByLabel("Your email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join the waitlist" })).toBeVisible();
    await expect(page.getByText("No spam, ever.")).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /trial/i })).toHaveCount(0);
    const hrefs = await page
      .locator(".tf-page a")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
    expect(hrefs.every((href) => href?.startsWith("#"))).toBe(true);
  });

  test("fits a phone screen without sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/coming-soon");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBe(0);
  });

  test("joining shows the confirmation line", async ({ page }) => {
    let posted: unknown;
    await page.route("**/api/waitlist", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await page.goto("/coming-soon");
    await page.getByLabel("Your email").fill("dana@example.com");
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(
      page.getByText("You're on the list. We'll send one email when your spot opens.")
    ).toBeVisible();
    expect(posted).toMatchObject({ email: "dana@example.com" });
  });

  test("when the save does not go through, it says so without blame", async ({ page }) => {
    await page.route("**/api/waitlist", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: '{"ok":false}' })
    );
    await page.goto("/coming-soon");
    await page.getByLabel("Your email").fill("dana@example.com");
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await expect(page.locator(".tf-page").getByRole("alert")).toContainText("That didn't go through.");
    await expect(page.getByText("You're on the list.")).toBeHidden();
  });

  test("the demo tabs switch the panel", async ({ page }) => {
    await page.goto("/coming-soon");
    const second = page.getByRole("tab", { name: /Tempo finds the beat/ });
    await second.click();
    await expect(second).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-step="2"]')).toBeVisible();
    await expect(page.locator('[data-step="1"]')).toBeHidden();
  });
});
