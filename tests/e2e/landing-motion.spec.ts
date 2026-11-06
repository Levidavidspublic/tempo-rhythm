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
        const examples = hero.locator(".tempo-hero__examples");
        await expect(copy).toBeVisible();
        // Capture the examples before waiting for the copy: an unwanted entrance
        // must not finish unnoticed while the other container settles.
        const examplesInitial = width === 1280
          ? await examples.evaluate((element) => {
            const style = getComputedStyle(element);
            const animations = element.getAnimations();
            const timing = animations[0]?.effect?.getTiming();
            const box = element.getBoundingClientRect();
            return {
              name: style.animationName,
              count: animations.length,
              duration: timing?.duration,
              iterations: timing?.iterations,
              transformIsIdentity: new DOMMatrix(style.transform).isIdentity,
              opacity: style.opacity,
              box: { x: box.x, y: box.y, width: box.width, height: box.height },
            };
          })
          : undefined;
        if (examplesInitial) {
          await expect(examples).toBeVisible();
          if (motion === "reduce") {
            expect(examplesInitial.name).toBe("none");
            expect(examplesInitial.count).toBe(0);
            expect(examplesInitial.duration).toBeUndefined();
            expect(examplesInitial.transformIsIdentity).toBe(true);
            expect(examplesInitial.opacity).toBe("1");
          } else {
            expect(examplesInitial.name).toBe("tempo-hero-enter");
            expect(examplesInitial.count).toBe(1);
            expect(examplesInitial.duration).toBe(240);
            expect(examplesInitial.iterations).toBe(1);
          }
        }
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
        const examplesSettled = examplesInitial
          ? await examples.evaluate(async (element) => {
            const animations = element.getAnimations();
            await Promise.all(animations.map((item) => item.finished));
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return {
              finished: animations.every((item) => item.playState === "finished"),
              transformIsIdentity: new DOMMatrix(style.transform).isIdentity,
              opacity: style.opacity,
              box: { x: box.x, y: box.y, width: box.width, height: box.height },
            };
          })
          : undefined;
        if (examplesSettled) {
          expect(examplesSettled.finished).toBe(true);
          expect(examplesSettled.transformIsIdentity).toBe(true);
          expect(examplesSettled.opacity).toBe("1");
          if (motion === "reduce") {
            expect(examplesSettled.box).toEqual(examplesInitial?.box);
          }
        }
        // A later committed frame keeps the final position, with no looping entrance.
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        expect(await copy.boundingBox()).toEqual(settledBox);
        if (examplesSettled) {
          const laterBox = await examples.boundingBox();
          expect(laterBox).toEqual(examplesSettled.box);
          await testInfo.attach("desktop examples motion", {
            body: JSON.stringify({ initial: examplesInitial, settled: examplesSettled, laterBox }),
            contentType: "application/json",
          });
        }
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
