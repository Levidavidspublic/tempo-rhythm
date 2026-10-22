# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: task-views-core.spec.ts >> core task views >> today, inbox, project, priority, and energy views share one persisted task record
- Location: tests/e2e/task-views-core.spec.ts:14:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('main').getByRole('heading', { name: 'Today' })
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('main').getByRole('heading', { name: 'Today' })
  - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.

```

```yaml
- link "Skip to page":
  - /url: "#main"
- navigation "Pages":
  - text: Tempo
  - button "Search or jump to Ctrl K"
  - list:
    - listitem:
      - link "Today":
        - /url: /today
    - listitem:
      - link "Brain dump":
        - /url: /brain-dump
    - listitem:
      - link "Coach":
        - /url: /coach
    - listitem:
      - link "Plan":
        - /url: /plan
  - text: Pages
  - list "Pages":
    - listitem:
      - link "All pages":
        - /url: /notes
    - listitem:
      - link "Templates":
        - /url: /templates
  - text: Library
  - list "Library":
    - listitem:
      - link "Tasks":
        - /url: /tasks
    - listitem:
      - link "Journal":
        - /url: /journal
    - listitem:
      - link "Calendar":
        - /url: /calendar
    - listitem:
      - link "Habits":
        - /url: /habits
    - listitem:
      - link "Routines":
        - /url: /routines
    - listitem:
      - link "Goals":
        - /url: /goals
    - listitem:
      - link "Projects":
        - /url: /projects
  - text: You
  - list "You":
    - listitem:
      - link "Insights":
        - /url: /insights
    - listitem:
      - link "Search":
        - /url: /search
    - listitem:
      - link "Coach history":
        - /url: /history
    - listitem:
      - link "Recent activity":
        - /url: /activity
    - listitem:
      - link "Memory":
        - /url: /settings/memory
    - listitem:
      - link "Nags":
        - /url: /settings/nags
  - button "Reading font"
  - button "עברית"
  - listitem:
    - link "Settings":
      - /url: /settings/profile
  - button "Sign out"
- banner:
  - text: Pages
  - strong: Today
  - button "Search or jump to"
  - button "Dark theme"
- main
- button "Open coach (Ctrl J)": Coach
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  |
  3  | const taskTitle = "Pay the power bill";
  4  | const updatedTitle = "Pay the power bill online";
  5  |
  6  | test.describe("core task views", () => {
  7  |   test.beforeEach(async ({ page }) => {
  8  |     await page.goto("/today");
  9  |     await page.evaluate(() => {
  10 |       window.localStorage.removeItem("tempo:task-views-core:v1");
  11 |     });
  12 |   });
  13 |
  14 |   test("today, inbox, project, priority, and energy views share one persisted task record", async ({
  15 |     page,
  16 |   }) => {
  17 |     const main = page.getByRole("main");
  18 |
  19 |     await page.goto("/today");
> 20 |     await expect(main.getByRole("heading", { name: "Today" })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  21 |
  22 |     await page.getByLabel("Task title").fill(taskTitle);
  23 |     await page.getByLabel("Project").fill("Home reset");
  24 |     await page.getByLabel("Priority").selectOption("high");
  25 |     await page.getByLabel("Energy").selectOption("low");
  26 |     await page.getByRole("button", { name: "Add task" }).click();
  27 |     await expect(page.getByText(taskTitle)).toBeVisible();
  28 |
  29 |     await page.goto("/tasks");
  30 |     await expect(main.getByRole("heading", { name: "Inbox" })).toBeVisible();
  31 |     await expect(page.getByText(taskTitle)).toBeVisible();
  32 |
  33 |     await page.getByRole("button", { name: `Edit ${taskTitle}` }).click();
  34 |     await page.getByLabel("Edit task title").fill(updatedTitle);
  35 |     await page.getByRole("button", { name: "Save task" }).click();
  36 |     await expect(page.getByText(updatedTitle)).toBeVisible();
  37 |
  38 |     await page.goto("/projects");
  39 |     await expect(main.getByRole("heading", { name: "Home reset" })).toBeVisible();
  40 |     await expect(page.getByText(updatedTitle)).toBeVisible();
  41 |     await page.getByRole("button", { name: `Mark ${updatedTitle} complete` }).click();
  42 |     await expect(page.getByText("Done")).toBeVisible();
  43 |
  44 |     await page.goto("/tasks/priority");
  45 |     await expect(main.getByRole("heading", { name: "Priority", exact: true })).toBeVisible();
  46 |     await expect(main.getByRole("heading", { name: "High priority" })).toBeVisible();
  47 |     await expect(page.getByText(updatedTitle)).toBeVisible();
  48 |     await expect(page.getByText("Done")).toBeVisible();
  49 |
  50 |     await page.goto("/tasks/energy");
  51 |     await expect(main.getByRole("heading", { name: "Energy", exact: true })).toBeVisible();
  52 |     await expect(main.getByRole("heading", { name: "Low energy" })).toBeVisible();
  53 |     await expect(page.getByText(updatedTitle)).toBeVisible();
  54 |     await expect(page.getByText("Done")).toBeVisible();
  55 |
  56 |     await page.reload();
  57 |     await expect(page.getByText(updatedTitle)).toBeVisible();
  58 |     await expect(page.getByText("Done")).toBeVisible();
  59 |   });
  60 | });
  61 |
```