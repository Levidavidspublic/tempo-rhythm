import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  for (const lang of ["en", "he"]) {
    for (const motion of ["no-preference", "reduce"] as const) {
      test(`landing hero ${width} ${lang} ${motion}`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: motion, colorScheme: "light" });
        const failures: string[] = [];
        page.on("pageerror", (error) => failures.push(error.message));
        await page.goto(`/?lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("html")).toHaveAttribute("dir", lang === "he" ? "rtl" : "ltr");
        await expect(page.locator("main").locator("..")).toHaveAttribute("lang", lang);
        await expect(page.getByRole("main")).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        const hero = page.locator(".tempo-hero");
        const copy = hero.locator(".tempo-hero__copy");
        await expect(copy).toBeVisible();
        const animation = await copy.evaluate(async (element) => {
          const style = getComputedStyle(element);
          const animations = element.getAnimations();
          const timing = animations[0]?.effect?.getTiming();
          await Promise.all(animations.map((item) => item.finished));
          return {
            name: style.animationName,
            duration: timing?.duration,
            iterations: timing?.iterations,
            finished: animations.every((item) => item.playState === "finished"),
            transformIsIdentity: new DOMMatrix(getComputedStyle(element).transform).isIdentity,
            opacity: getComputedStyle(element).opacity,
          };
        });
        if (motion === "reduce") {
          expect(animation.name).toBe("none");
          expect(animation.duration).toBeUndefined();
        } else {
          expect(animation.name).toBe("tempo-hero-enter");
          expect(animation.duration).toBe(240);
          expect(animation.iterations).toBe(1);
          expect(animation.finished).toBe(true);
        }
        expect(animation.transformIsIdentity).toBe(true);
        expect(animation.opacity).toBe("1");
        const settledBox = await copy.boundingBox();
        expect(settledBox).not.toBeNull();
        // A later committed frame keeps the final position, with no looping entrance.
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await copy.boundingBox()).toEqual(settledBox);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const action = hero.locator('a[href="/sign-up"]').first();
        // Start at the adjacent preceding control, then use the real keyboard path into the hero.
        await page.locator('nav a[href="/sign-up"]').last().focus();
        await page.keyboard.press("Tab");
        await expect(action).toBeFocused();
        const focus = await action.evaluate((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { visible: element.matches(":focus-visible"), outline: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), height: rect.height, targetWidth: rect.width };
        });
        expect(focus.visible).toBe(true);
        expect(focus.outline).not.toBe("none");
        expect(focus.width).toBeGreaterThan(0);
        expect(focus.height).toBeGreaterThanOrEqual(44);
        expect(focus.targetWidth).toBeGreaterThanOrEqual(44);
        expect(failures).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`hero-${width}-${lang}-${motion}.png`), fullPage: true });
        await testInfo.attach("landing hero", { path: testInfo.outputPath(`hero-${width}-${lang}-${motion}.png`), contentType: "image/png" });
      });
    }
  }
}
