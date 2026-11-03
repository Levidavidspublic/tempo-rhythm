// L1: sign in on preview with the guest/test sign-in -> Today loads as the daily page.
import { BASE_URL, assertSignedIn, expectVisible, runLoop } from "./lib.mjs";

await runLoop("l1", "Sign in, Today loads as the daily page", async (page, shot) => {
  await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  await expectVisible(page.getByTestId("today-daily-page"), "today's daily page (DailyPage)", 45_000);
  await expectVisible(page.locator('[data-testid="today-daily-page"] .cm-content'), "the daily page's editor");
  await shot(page, "today");
});
