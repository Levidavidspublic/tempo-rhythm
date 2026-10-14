// L5: chat-first decision ("what order should I do these in?") on Today -> a decision card renders
// from the json-render catalog -> saving it writes to today's page.
// Contract (Phase 3): Today has the coach composer ("Message"); the reply renders
// [data-component="DecisionCard"] with ordered TaskBlock rows (.tp-task-row__title) and a
// "Save to today" button; after saving, today's daily page lists the same titles in the same order.
import { BASE_URL, assertSignedIn, completeAlphaTasks, expectVisible, fail, marker, runLoop, sendCoachMessage } from "./lib.mjs";

await runLoop("l5", "Decision card on Today, saved to today's page", async (page, shot) => {
  await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  const quickAdd = page.getByLabel("Add something small for today");
  await expectVisible(quickAdd, "Today's quick add", 45_000);
  await completeAlphaTasks(page);
  const list = page.locator('[aria-labelledby="today-task-list-heading"]');
  const seeded = [];
  for (const name of ["email", "laundry", "bill"]) {
    const title = marker(`Alpha L5 ${name}`);
    seeded.push(title);
    await quickAdd.fill(title);
    await quickAdd.press("Enter");
    await expectVisible(list.getByText(title, { exact: true }), `seed task ${name}`);
  }
  const cards = page.locator('[data-component="DecisionCard"]');
  const before = await cards.count();
  if ((await page.getByRole("textbox", { name: "Message" }).count()) === 0) throw fail("Today has no chat box");
  await sendCoachMessage(page, "What order should I do these in?");
  try {
    await page.waitForFunction((n) => document.querySelectorAll('[data-component="DecisionCard"]').length > n, before, {
      timeout: 120_000,
    });
  } catch {
    throw fail("no decision card within 120 s");
  }
  const card = cards.last();
  const titles = (await card.locator(".tp-task-row__title").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  const seededOnCard = new Set(titles.filter((title) => seeded.includes(title)));
  if (seededOnCard.size < 2) throw fail(`the decision card orders ${seededOnCard.size} of the 3 seeded tasks`);
  await shot(page, "decision-card");
  await card.getByRole("button", { name: "Save to today" }).click();
  await expectVisible(card.getByText(/Saved to today/i), "the saved note on the card");
  await page.reload({ waitUntil: "domcontentloaded" });
  const day = page.getByTestId("today-daily-page");
  await expectVisible(day, "today's daily page", 45_000);
  const onPage = (await day.locator(".tp-task-row__title").allInnerTexts()).map((t) => t.trim());
  let at = -1;
  for (const title of titles) {
    const next = onPage.indexOf(title, at + 1);
    if (next < 0) throw fail(`today's page is missing the decision step "${title}"`);
    at = next;
  }
  await shot(page, "today-page");
  await completeAlphaTasks(page);
});
