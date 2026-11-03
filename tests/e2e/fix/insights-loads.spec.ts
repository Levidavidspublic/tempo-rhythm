import { expect, test } from "@playwright/test";

// /insights must never stay on the loading skeleton: within 8 s it shows numbers,
// the calm empty state, the Retry card, or sends a signed-out visitor to sign-in.
test("/insights leaves the loading placeholders within 8 s", async ({ page }) => {
  await page.goto("/insights");
  const settled = page
    .getByText("Done this week")
    .or(page.getByText("Nothing tracked yet"))
    .or(page.getByRole("button", { name: "Retry" }))
    .or(page.getByRole("link", { name: "Sign in" }))
    .or(page.getByRole("button", { name: /magic link/i }));
  await expect(settled.first()).toBeVisible({ timeout: 8_000 });
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
});
