# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: wiring/coach.spec.ts >> coach wiring >> /coach renders dial/panic and proposal markers next to Coach chat
- Location: tests/e2e/wiring/coach.spec.ts:8:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.screenshot: Test timeout of 30000ms exceeded.
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
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
        - strong [ref=e165]: Coach
      - button "Search or jump to" [ref=e166] [cursor=pointer]
      - button "Dark theme" [ref=e169] [cursor=pointer]
    - main [ref=e172]:
      - generic [ref=e173]:
        - generic [ref=e175]:
          - generic [ref=e176]: Flow
          - heading "Coach" [level=1] [ref=e177]
          - paragraph [ref=e178]: Talk through what's in front of you. One small step at a time.
        - generic [ref=e179]:
          - region [ref=e180]:
            - heading "Chats" [level=2] [ref=e182]
            - button "New chat" [disabled] [ref=e183]
            - generic [ref=e187]:
              - generic [ref=e188]: Search all chats
              - searchbox "Search all chats" [disabled] [ref=e190]
            - paragraph [ref=e192]: No chats yet.
            - paragraph [ref=e193]
          - region "Coach" [ref=e194]:
            - paragraph [ref=e196]: New chat
            - paragraph [ref=e198]
            - generic [ref=e200]:
              - generic [ref=e201]: Message
              - textbox "Message" [disabled] [ref=e202]:
                - /placeholder: Help me pick one thing for this afternoon
              - button "Send" [disabled] [ref=e204]
  - button "Open Next.js Dev Tools" [ref=e214] [cursor=pointer]
  - alert [ref=e218]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | // TEMPO-B05-04: local Playwright webServer opens /coach signed out (placeholder Convex URL).
  4  | // Assert route markers and the chat selectors. Never assert on live coach data.
  5  | test.describe("coach wiring", () => {
  6  |   test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "local webServer only");
  7  |
  8  |   test("/coach renders dial/panic and proposal markers next to Coach chat", async ({ page }) => {
  9  |     await page.goto("/coach");
  10 |     await expect(page).not.toHaveURL(/\/sign-in/);
  11 |     await expect(page.getByRole("main").getByRole("heading", { name: "Coach" })).toBeVisible();
  12 |     await expect(page.getByLabel("Message")).toBeVisible();
  13 |
  14 |     const controls = page.getByTestId("coach-controls");
  15 |     const proposal = page.getByTestId("coach-proposal");
  16 |     await expect(controls).toBeAttached();
  17 |     await expect(controls).toHaveAttribute("data-coach-marker", "dial-panic");
  18 |     await expect(proposal).toBeAttached();
  19 |     await expect(proposal).toHaveAttribute("data-coach-marker", "proposal");
  20 |
> 21 |     await page.screenshot({ path: "test-results/coach-wiring.png", fullPage: true });
     |                ^ Error: page.screenshot: Test timeout of 30000ms exceeded.
  22 |   });
  23 | });
  24 |
```