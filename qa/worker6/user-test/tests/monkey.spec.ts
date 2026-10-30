// Monkey / fuzz: thousands of random clicks, keys, scrolls. Seeded so a failure can be replayed.
import { test } from '@playwright/test';
import { verdict } from './verdict';
const N = Number(process.env.MONKEY_ACTIONS || 2000);
const SEED = Number(process.env.MONKEY_SEED || Date.now() % 100000);
test(`monkey ${N} actions seed ${SEED}`, async ({ page }) => {
  test.setTimeout(N * 300 + 60_000);
  let s = SEED; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const errors: string[] = []; const crashes: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('crash', () => crashes.push('crash'));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const origin = new URL(process.env.PREVIEW_URL!).origin;
  await page.goto('/');
  for (let i = 0; i < N; i++) {
    if (!page.url().startsWith(origin)) await page.goto('/').catch(() => {});
    const vp = page.viewportSize()!; const r = rnd();
    try {
      if (r < 0.6) await page.mouse.click(rnd() * vp.width, rnd() * vp.height);
      else if (r < 0.75) await page.mouse.wheel(0, (rnd() - 0.5) * 4000);
      else if (r < 0.9) await page.keyboard.type(String.fromCharCode(32 + Math.floor(rnd() * 90)).repeat(1 + Math.floor(rnd() * 50)));
      else await page.keyboard.press(['Tab', 'Enter', 'Escape', 'Backspace', 'ArrowDown'][Math.floor(rnd() * 5)]);
    } catch {}
  }
  const alive = await page.evaluate(() => document.body.innerText.length > 0).catch(() => false);
  verdict('stability', `monkey ${N} no crash, page alive`, crashes.length === 0 && alive, `seed ${SEED}`);
  verdict('stability', `monkey ${N} no uncaught errors`, errors.length === 0, `${errors.length} errors, seed ${SEED}: ${errors.slice(0, 3).join(' | ')}`);
});
