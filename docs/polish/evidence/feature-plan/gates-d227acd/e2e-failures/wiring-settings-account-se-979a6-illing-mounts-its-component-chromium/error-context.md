# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wiring/settings-account.spec.ts >> settings + account wiring >> /billing mounts its component
- Location: tests/e2e/wiring/settings-account.spec.ts:16:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/billing", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | // TEMPO-B05-06: each account route mounts its component (not ScaffoldScreen). Signed out under the
  4  | // dev E2E bypass, so we assert on the route wrapper marker only, never on live data.
  5  | test.describe("settings + account wiring", () => {
  6  |   test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");
  7  |
  8  |   const routes = [
  9  |     ["/settings/profile", "settings-profile"],
  10 |     ["/settings/preferences", "settings-preferences"],
  11 |     ["/notifications", "notifications-page"],
  12 |     ["/billing", "billing-page"],
  13 |   ] as const;
  14 |
  15 |   for (const [route, testId] of routes) {
  16 |     test(`${route} mounts its component`, async ({ page }) => {
> 17 |       await page.goto(route);
     |                  ^ Error: page.goto: Test timeout of 30000ms exceeded.
  18 |       await expect(page.getByTestId(testId)).toBeVisible();
  19 |     });
  20 |   }
  21 | });
  22 |
```