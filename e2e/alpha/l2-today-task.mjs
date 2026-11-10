// L2: on Today, add a task by typing -> reload -> the task is still there.
import { BASE_URL, assertSignedIn, completeAlphaTasks, expectVisible, fail, marker, runLoop } from "./lib.mjs";

await runLoop("l2", "Add a task on Today, it survives a reload", async (page, shot) => {
  const title = marker("Alpha L2 task");
  await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  const input = page.getByLabel("Add something small for today");
  await expectVisible(input, "Today's quick add", 45_000);
  await completeAlphaTasks(page);
  await input.fill(title);
  await input.press("Enter");
  const list = page.locator('[aria-labelledby="today-task-list-heading"]');
  await expectVisible(list.getByText(title, { exact: true }), "the new task in Today's list");
  await shot(page, "added");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expectVisible(list.getByText(title, { exact: true }), "the task after a reload", 45_000);
  const copies = await list.getByText(title, { exact: true }).count();
  if (copies !== 1) throw fail(`the task is listed ${copies} times after the reload`);
  await shot(page, "after-reload");
  await completeAlphaTasks(page);
});
