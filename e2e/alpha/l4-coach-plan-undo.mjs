// L4: ask the coach to plan the afternoon -> the proposal card shows the exact change -> Accept ->
// the change appears -> Undo within 5 minutes restores it.
import { BASE_URL, assertSignedIn, controlFail, expectVisible, fail, marker, runLoop, sendCoachMessage } from "./lib.mjs";

const LIST_FOR_KIND = { task: "/tasks", note: "/notes", template: "/templates" };

await runLoop("l4", "Coach plans the afternoon: proposal, Accept, Undo", async (page, shot) => {
  await page.goto(`${BASE_URL}/coach`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  await expectVisible(page.getByRole("textbox", { name: "Message" }), "the coach message box", 45_000);
  // Every run shares the account's one coach thread, which keeps earlier runs' cards (some still
  // pending). This run's card is the first one after its own message, found by a run marker.
  const ask = `Plan my afternoon. Suggest one task for it. (${marker("run")})`;
  const mine = () => page.locator(".tp-msg--user", { hasText: ask }).last();
  const ownCard = () => mine().locator('xpath=following::*[@data-component="ProposalCard"][1]');
  await sendCoachMessage(page, ask);
  await expectVisible(mine(), "this run's message in the thread");
  try {
    await ownCard().waitFor({ state: "attached", timeout: 120_000 });
  } catch {
    const unavailable = await page.locator('[data-component="CoachUnavailable"]').innerText().catch(() => "");
    throw fail(`no proposal card for this run's message within 120 s${unavailable ? ` (coach says: ${unavailable.trim().split("\n")[0]})` : ""}`);
  }
  const card = ownCard();
  const kind = (await card.getAttribute("data-kind")) ?? "task";
  const title = (await card.locator(".tp-change__title").first().innerText()).trim();
  if (!title) throw fail("the proposal card shows no title for the change");
  await shot(page, "proposal");
  await card.getByRole("button", { name: "Accept" }).click();
  await expectVisible(card.getByText("Done. You can undo this for 5 minutes."), "the accepted note with Undo");
  const list = LIST_FOR_KIND[kind] ?? "/tasks";
  await page.goto(`${BASE_URL}${list}`, { waitUntil: "domcontentloaded" });
  // Rows on the list itself: the sidebar also lists pages, so a note shows there too.
  const rows = () => page.locator(".tp-app__main").getByText(title, { exact: true });
  await expectVisible(rows().first(), `the accepted ${kind} on ${list}`, 45_000);
  // An earlier run may have left a row with the same title: Undo must take exactly one away.
  await page.waitForLoadState("networkidle").catch(() => {});
  const withIt = await rows().count();
  await shot(page, "applied");
  await page.goto(`${BASE_URL}/coach`, { waitUntil: "domcontentloaded" });
  await expectVisible(mine(), "this run's message after coming back", 45_000);
  const accepted = ownCard();
  await accepted.getByRole("button", { name: /Undo/ }).click();
  await expectVisible(accepted.getByText("Undone. Nothing changed."), "the undone note");
  await page.goto(`${BASE_URL}${list}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3_000);
  const after = await rows().count();
  if (after !== withIt - 1) throw controlFail(`the ${kind} is still on ${list} after Undo (${withIt} before, ${after} after)`);
  await shot(page, "after-undo");
});
