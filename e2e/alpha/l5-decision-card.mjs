// L5: chat-first decision ("what order should I do these in?") on Today -> a decision card renders
// from the json-render catalog -> saving it writes to today's page.
// Contract (Phase 3): Today has the coach composer ("Message"); the reply renders
// [data-component="DecisionCard"] with ordered TaskBlock rows (.tp-task-row__title) and a
// "Save to today" button; after saving, today's daily page lists the same titles in the same order.
import {
  BASE_URL,
  assertSignedIn,
  completeAlphaTasks,
  completeOpenTasks,
  expectVisible,
  fail,
  marker,
  runLoop,
  sendCoachMessage,
} from "./lib.mjs";

await runLoop("l5", "Decision card on Today, saved to today's page", async (page, shot) => {
  // Seeds from earlier L5 runs ("Alpha L5 …"), wherever they are: Today's list shows only 3 open
  // tasks, so seeds behind other tasks can't be reached there. Other tasks are left alone.
  await completeOpenTasks(page, /^Mark Alpha L5 .* complete$/, "Alpha L5 seed task(s)");
  await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  const quickAdd = page.getByLabel("Add something small for today");
  await expectVisible(quickAdd, "Today's quick add", 45_000);
  await completeAlphaTasks(page);
  const list = page.locator('[aria-labelledby="today-task-list-heading"]');
  // Today's list shows 3 open tasks ("Showing 3 of 4 open today."), so a task that isn't this
  // script's can push a seeded one out of sight: each add is confirmed by the open count instead.
  const openToday = async () => {
    const m = /of (\d+) open today|(\d+) still open today/.exec(await list.innerText());
    return m ? Number(m[1] ?? m[2]) : 0;
  };
  const seeded = [];
  for (const name of ["email", "laundry", "bill"]) {
    const title = marker(`Alpha L5 ${name}`);
    seeded.push(title);
    const before = await openToday();
    await quickAdd.fill(title);
    await quickAdd.press("Enter");
    const deadline = Date.now() + 30_000;
    while ((await openToday()) <= before) {
      if (Date.now() > deadline) throw fail(`seed task ${name} was not added (still ${before} open today)`);
      await page.waitForTimeout(250);
    }
  }
  if ((await page.getByRole("textbox", { name: "Message" }).count()) === 0) throw fail("Today has no chat box");
  // Every run shares the account's one coach thread. This run's card is the first decision card
  // after its own message, found by a run marker (never an earlier run's card).
  const ask = `What order should I do these in? (${marker("run")})`;
  const mine = page.locator(".tp-msg--user", { hasText: ask }).last();
  const card = mine.locator('xpath=following::*[@data-component="DecisionCard"][1]');
  await sendCoachMessage(page, ask);
  await expectVisible(mine, "this run's message in the thread");
  try {
    await card.waitFor({ state: "attached", timeout: 120_000 });
  } catch {
    throw fail("no decision card for this run's message within 120 s");
  }
  const titles = (await card.locator(".tp-task-row__title").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const seededOnCard = new Set(titles.filter((title) => seeded.includes(title)));
  if (seededOnCard.size < 2) throw fail(`the decision card orders ${seededOnCard.size} of the 3 seeded tasks`);
  await shot(page, "decision-card");
  await card.getByRole("button", { name: "Save to today" }).click();
  await expectVisible(card.getByText(/Saved to today/i), "the saved note on the card");
  await page.reload({ waitUntil: "domcontentloaded" });
  const day = page.getByTestId("today-daily-page");
  await expectVisible(day, "today's daily page", 45_000);
  // On the page a task title is an <input> (editable in place), so read its value, not its text.
  const readRows = () =>
    day
      .locator(".tp-task-row__title")
      .evaluateAll((els) => els.map((el) => (el instanceof HTMLInputElement ? el.value : (el.textContent ?? "")).trim()));
  // Save adds the steps at the end of today's page, as its newest rows. The page grows run by run,
  // and its editor only draws the lines near the screen, so read it from its end, and match the
  // steps from the last row back (an earlier run can have left rows with the same titles).
  const missingStep = (rows) => {
    let at = rows.length;
    for (const title of [...titles].reverse()) {
      at = at > 0 ? rows.lastIndexOf(title, at - 1) : -1;
      if (at < 0) return title;
    }
    return null;
  };
  let missing = null;
  const deadline = Date.now() + 20_000;
  do {
    await day.locator(".cm-content").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.waitForTimeout(500);
    missing = missingStep(await readRows());
  } while (missing !== null && Date.now() < deadline);
  if (missing !== null) throw fail(`today's page is missing the decision step "${missing}"`);
  await shot(page, "today-page");
  await completeAlphaTasks(page);
});
