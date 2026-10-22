# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: calendar-views.spec.ts >> event created in Day view appears in Week and Month views for that date
- Location: tests/e2e/calendar-views.spec.ts:7:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.reload: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - waiting for navigation until "load"

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
        - strong [ref=e165]: Calendar
      - button "Search or jump to" [ref=e166] [cursor=pointer]
      - button "Dark theme" [ref=e169] [cursor=pointer]
    - main [ref=e172]:
      - generic [ref=e173]:
        - generic [ref=e175]:
          - heading "Calendar" [level=1] [ref=e176]
          - paragraph [ref=e177]: Add an event once, then switch between Day, Week, and Month without losing the thread.
        - generic [ref=e179]:
          - generic [ref=e180]:
            - generic [ref=e181]: Event title
            - textbox "Event title" [ref=e182]:
              - /placeholder: Planning call
          - generic [ref=e183]:
            - generic [ref=e184]: Event date
            - textbox "Event date" [ref=e185]: 2026-10-21
          - button "Add event" [ref=e186] [cursor=pointer]
        - generic [ref=e190]:
          - group "Calendar views" [ref=e191]:
            - generic [ref=e193]:
              - button "Day" [pressed] [ref=e194] [cursor=pointer]
              - button "Week" [ref=e195] [cursor=pointer]
              - button "Month" [ref=e196] [cursor=pointer]
          - paragraph [ref=e197]: Wednesday, 21 October 2026
        - region "Day events" [ref=e198]:
          - heading "Day events" [level=2] [ref=e199]
          - paragraph [ref=e203]: No events in this window yet. Add one when you know where it belongs.
    - button "Open coach (Ctrl J)" [ref=e204] [cursor=pointer]:
      - generic [ref=e207]: Coach
  - button "Open Next.js Dev Tools" [ref=e213] [cursor=pointer]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | // Runs against the shared Playwright webServer (playwright.config.ts), which
  4  | // starts apps/web in dev mode with TEMPO_E2E_PUBLIC_CALENDAR=1 so /calendar
  5  | // is reachable without auth and uses the local (browser-storage) event source.
  6  |
  7  | test("event created in Day view appears in Week and Month views for that date", async ({
  8  |   page,
  9  | }) => {
  10 |   await page.goto("/calendar");
  11 |   await expect(page.getByRole("heading", { level: 1, name: "Calendar", exact: true })).toBeVisible();
  12 |   await page.evaluate(() => window.localStorage.clear());
> 13 |   await page.reload();
     |              ^ Error: page.reload: net::ERR_ABORTED; maybe frame was detached?
  14 |   // Type only once the page has hydrated: text typed into the server-rendered field before React
  15 |   // takes over is lost, and the Add then reads an empty title.
  16 |   await page.waitForLoadState("networkidle");
  17 |
  18 |   await page.getByRole("textbox", { name: "Event title" }).fill("Boundary planning call");
  19 |   await page.getByLabel("Event date").fill("2026-08-01");
  20 |   await page.getByRole("button", { name: "Add event" }).click();
  21 |
  22 |   await expect(page.getByTestId("day-events")).toContainText("Boundary planning call");
  23 |
  24 |   await page.getByRole("button", { name: "Week" }).click();
  25 |   await expect(page.getByTestId("week-events")).toContainText("Boundary planning call");
  26 |
  27 |   await page.getByRole("button", { name: "Month" }).click();
  28 |   await expect(page.getByTestId("month-events")).toContainText("Boundary planning call");
  29 | });
  30 |
```