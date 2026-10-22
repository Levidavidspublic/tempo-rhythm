# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wiring/habits-braindump-search.spec.ts >> habits, brain dump and search wiring >> /habits mounts the habits screen
- Location: tests/e2e/wiring/habits-braindump-search.spec.ts:8:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeAttached() failed

Locator:  getByTestId('habits-route')
Expected: attached
Received: undefined

Call log:
  - Expect "toBeAttached" with timeout 10000ms
  - waiting for getByTestId('habits-route')
  - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - link "Skip to page" [ref=e3] [cursor=pointer]:
    - /url: "#main"
  - navigation "Pages" [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]: T
      - generic [ref=e7]: Tempo
    - button "Search or jump to Ctrl K" [ref=e8] [cursor=pointer]:
      - generic [ref=e11]: Search or jump to
      - generic [ref=e12]: Ctrl K
    - list [ref=e14]:
      - listitem [ref=e15]:
        - link "Today" [ref=e16] [cursor=pointer]:
          - /url: /today
      - listitem [ref=e21]:
        - link "Brain dump" [ref=e22] [cursor=pointer]:
          - /url: /brain-dump
      - listitem [ref=e27]:
        - link "Coach" [ref=e28] [cursor=pointer]:
          - /url: /coach
      - listitem [ref=e33]:
        - link "Plan" [ref=e34] [cursor=pointer]:
          - /url: /plan
    - generic [ref=e39]:
      - generic [ref=e40]: Pages
      - list "Pages" [ref=e41]:
        - listitem [ref=e42]:
          - link "All pages" [ref=e43] [cursor=pointer]:
            - /url: /notes
        - listitem [ref=e48]:
          - link "Templates" [ref=e49] [cursor=pointer]:
            - /url: /templates
    - generic [ref=e54]:
      - generic [ref=e55]: Library
      - list "Library" [ref=e56]:
        - listitem [ref=e57]:
          - link "Tasks" [ref=e58] [cursor=pointer]:
            - /url: /tasks
        - listitem [ref=e63]:
          - link "Journal" [ref=e64] [cursor=pointer]:
            - /url: /journal
        - listitem [ref=e69]:
          - link "Calendar" [ref=e70] [cursor=pointer]:
            - /url: /calendar
        - listitem [ref=e75]:
          - link "Habits" [ref=e76] [cursor=pointer]:
            - /url: /habits
        - listitem [ref=e81]:
          - link "Routines" [ref=e82] [cursor=pointer]:
            - /url: /routines
        - listitem [ref=e87]:
          - link "Goals" [ref=e88] [cursor=pointer]:
            - /url: /goals
        - listitem [ref=e93]:
          - link "Projects" [ref=e94] [cursor=pointer]:
            - /url: /projects
    - generic [ref=e99]:
      - generic [ref=e100]: You
      - list "You" [ref=e101]:
        - listitem [ref=e102]:
          - link "Insights" [ref=e103] [cursor=pointer]:
            - /url: /insights
        - listitem [ref=e108]:
          - link "Search" [ref=e109] [cursor=pointer]:
            - /url: /search
        - listitem [ref=e114]:
          - link "Coach history" [ref=e115] [cursor=pointer]:
            - /url: /history
        - listitem [ref=e120]:
          - link "Recent activity" [ref=e121] [cursor=pointer]:
            - /url: /activity
        - listitem [ref=e126]:
          - link "Memory" [ref=e127] [cursor=pointer]:
            - /url: /settings/memory
        - listitem [ref=e132]:
          - link "Nags" [ref=e133] [cursor=pointer]:
            - /url: /settings/nags
    - generic [ref=e138]:
      - button "Reading font" [ref=e139] [cursor=pointer]
      - button "עברית" [ref=e144] [cursor=pointer]
      - listitem [ref=e149]:
        - link "Settings" [ref=e150] [cursor=pointer]:
          - /url: /settings/profile
      - button "Sign out" [ref=e155] [cursor=pointer]
  - banner [ref=e160]:
    - generic [ref=e161]:
      - generic [ref=e162]: Pages
      - strong [ref=e165]: Habits
    - button "Search or jump to" [ref=e166] [cursor=pointer]
    - button "Dark theme" [ref=e169] [cursor=pointer]
  - main [ref=e172]:
    - generic [ref=e174]:
      - generic [ref=e176]:
        - heading "Habits" [level=1] [ref=e177]
        - paragraph [ref=e178]: Small things you'd like to do most days. Log what happened. An empty circle is just an empty circle.
      - status [ref=e179]:
        - generic [ref=e180]: Loading your habits
  - button "Open coach (Ctrl J)" [ref=e202] [cursor=pointer]:
    - generic [ref=e205]: Coach
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | // TEMPO-B05-05: each route mounts its component (not ScaffoldScreen). Signed out under the dev E2E
  4  | // bypass, so assert only on the route wrapper and the component's own markers, never on live data.
  5  | test.describe("habits, brain dump and search wiring", () => {
  6  |   test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");
  7  |
  8  |   test("/habits mounts the habits screen", async ({ page }) => {
  9  |     await page.goto("/habits");
> 10 |     await expect(page.getByTestId("habits-route")).toBeAttached();
     |                                                    ^ Error: expect(locator).toBeAttached() failed
  11 |     await expect(page.getByText("Beta preview")).toHaveCount(0);
  12 |   });
  13 |
  14 |   test("/habits/[id] mounts HabitDetail", async ({ page }) => {
  15 |     await page.goto("/habits/abc123");
  16 |     await expect(page.getByTestId("habit-detail-route")).toBeAttached();
  17 |     await expect(page.getByText("Beta preview")).toHaveCount(0);
  18 |   });
  19 |
  20 |   test("/brain-dump mounts BrainDumpScreen", async ({ page }) => {
  21 |     await page.goto("/brain-dump");
  22 |     await expect(page.getByTestId("brain-dump-route")).toBeAttached();
  23 |     await expect(page.getByText("Beta preview")).toHaveCount(0);
  24 |   });
  25 |
  26 |   test("/search mounts SearchScreen", async ({ page }) => {
  27 |     await page.goto("/search");
  28 |     await expect(
  29 |       page.getByRole("searchbox", { name: "Search notes, tasks, habits and goals" }),
  30 |     ).toBeVisible();
  31 |     await expect(page.getByText("Beta preview")).toHaveCount(0);
  32 |   });
  33 | });
  34 |
```