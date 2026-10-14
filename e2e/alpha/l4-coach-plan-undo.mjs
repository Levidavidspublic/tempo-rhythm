// L4: ask the coach to plan the afternoon -> the proposal card shows the exact change -> Accept ->
// the change appears -> Undo within 5 minutes restores it.
import { BASE_URL, assertSignedIn, expectVisible, fail, runLoop, sendCoachMessage } from "./lib.mjs";

const LIST_FOR_KIND = { task: "/tasks", note: "/notes", template: "/templates" };

await runLoop("l4", "Coach plans the afternoon: proposal, Accept, Undo", async (page, shot) => {
  await page.goto(`${BASE_URL}/coach`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  const cards = page.locator('[data-component="ProposalCard"]');
  await expectVisible(page.getByRole("textbox", { name: "Message" }), "the coach message box", 45_000);
  const before = await cards.count();
  await sendCoachMessage(page, "Plan my afternoon. Suggest one task for it.");
  try {
    await page.waitForFunction((n) => document.querySelectorAll('[data-component="ProposalCard"]').length > n, before, {
      timeout: 120_000,
    });
  } catch {
    const unavailable = await page.locator('[data-component="CoachUnavailable"]').innerText().catch(() => "");
    throw fail(`no proposal card within 120 s${unavailable ? ` (coach says: ${unavailable.trim().split("\n")[0]})` : ""}`);
  }
  const card = cards.last();
  const kind = (await card.getAttribute("data-kind")) ?? "task";
  const title = (await card.locator(".tp-change__title").first().innerText()).trim();
  if (!title) throw fail("the proposal card shows no title for the change");
  await shot(page, "proposal");
  await card.getByRole("button", { name: "Accept" }).click();
  await expectVisible(card.getByText("Done. You can undo this for 5 minutes."), "the accepted note with Undo");
  const list = LIST_FOR_KIND[kind] ?? "/tasks";
  await page.goto(`${BASE_URL}${list}`, { waitUntil: "domcontentloaded" });
  await expectVisible(page.getByText(title, { exact: true }), `the accepted ${kind} on ${list}`, 45_000);
  await shot(page, "applied");
  await page.goto(`${BASE_URL}/coach`, { waitUntil: "domcontentloaded" });
  const accepted = page.locator('[data-component="ProposalCard"]').last();
  await accepted.getByRole("button", { name: /Undo/ }).click();
  await expectVisible(accepted.getByText("Undone. Nothing changed."), "the undone note");
  await page.goto(`${BASE_URL}${list}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3_000);
  if (await page.getByText(title, { exact: true }).count()) throw fail(`the ${kind} is still on ${list} after Undo`);
  await shot(page, "after-undo");
});
