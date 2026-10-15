// L3: create a page from a template -> edit it with the slash menu -> reload -> the edit persisted.
import { BASE_URL, assertSignedIn, expectVisible, marker, runLoop, waitForPageSaved } from "./lib.mjs";

await runLoop("l3", "Page from a template, slash-menu edit, survives a reload", async (page, shot) => {
  const pageTitle = marker("Alpha L3 page");
  const heading = marker("Alpha L3 heading");
  await page.goto(`${BASE_URL}/templates`, { waitUntil: "domcontentloaded" });
  await assertSignedIn(page);
  const use = page.getByRole("link", { name: /^Use / });
  await expectVisible(use, "a template's Use link", 45_000);
  await use.first().click();
  await page.waitForURL(/\/templates\/run\//);
  await page.getByLabel("Page title").fill(pageTitle);
  await shot(page, "template-run");
  await page.getByRole("button", { name: "Make the page" }).click();
  await page.waitForURL(/\/notes\//, { timeout: 45_000 });
  const editor = page.locator(".cm-content").first();
  await expectVisible(editor, "the page editor");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  const menu = page.getByRole("listbox", { name: "Insert a block" });
  await expectVisible(menu, "the slash menu");
  await shot(page, "slash-menu");
  await menu.getByRole("option", { name: /Heading 2/ }).click();
  await page.keyboard.type(heading);
  await waitForPageSaved(page);
  const url = page.url();
  await page.reload({ waitUntil: "domcontentloaded" });
  if (page.url() !== url) await page.goto(url, { waitUntil: "domcontentloaded" });
  await expectVisible(page.locator(".cm-line.cm-tp-h2", { hasText: heading }), "the slash-menu heading after a reload", 45_000);
  await shot(page, "after-reload");
});
