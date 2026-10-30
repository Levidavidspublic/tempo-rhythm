// Per-feature yes/no against an industry standard. A "no" = send ticket back for rewrite.
import { test, expect } from '@playwright/test';
import { verdict } from './verdict';
const PATHS = (process.env.PATHS || '/').split(',');

for (const p of PATHS) {
  test(`page load ${p}`, async ({ page }) => {
    const resp = await page.goto(p, { waitUntil: 'load' });
    const status = resp?.status() ?? 0;
    verdict('page-load', `HTTP 2xx on ${p}`, status >= 200 && status < 300, `status ${status}`);
    // LCP <= 2.5s (web.dev Core Web Vitals "good")
    const lcp: number = await page.evaluate(() => new Promise<number>(res => {
      let v = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) v = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => res(v), 3000);
    }));
    verdict('page-load', `LCP<=2500ms ${p}`, lcp > 0 && lcp <= 2500, `${Math.round(lcp)}ms`);
    const cls: number = await page.evaluate(() => new Promise<number>(res => {
      let v = 0; new PerformanceObserver(l => { for (const e of l.getEntries() as any) if (!e.hadRecentInput) v += e.value; }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => res(v), 2000);
    }));
    verdict('page-load', `CLS<=0.1 ${p}`, cls <= 0.1, cls.toFixed(3));
    // WCAG 2.2 2.4.2 page titled; 3.1.1 language of page
    verdict('a11y', `title present ${p}`, (await page.title()).trim().length > 0, await page.title());
    verdict('a11y', `html lang ${p}`, !!(await page.getAttribute('html', 'lang')), '');
  });

  test(`buttons all respond ${p}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(p);
    const buttons = page.locator('button:visible, [role=button]:visible, a[href]:visible');
    const n = Math.min(await buttons.count(), 200);
    let unnamed = 0;
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      const name = (await b.getAttribute('aria-label')) || (await b.innerText().catch(() => ''));
      if (!name.trim()) unnamed++;
      // WCAG 2.2 2.5.8 target size min 24x24 (inline links exempt, so buttons only)
      const box = await b.boundingBox();
      const tag = await b.evaluate(e => e.tagName);
      if (box && tag !== 'A' && (box.width < 24 || box.height < 24)) verdict('a11y', `target>=24px #${i} ${p}`, false, `${box.width}x${box.height}`);
      const isLink = (await b.evaluate(e => e.tagName)) === 'A';
      if (!isLink) { await b.click({ timeout: 3000, trial: false }).catch(() => {}); await page.goto(p).catch(() => {}); }
    }
    verdict('a11y', `every control has accessible name ${p}`, unnamed === 0, `${unnamed}/${n} unnamed`);
    verdict('stability', `no uncaught JS errors clicking ${p}`, errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  test(`forms extreme input ${p}`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(p);
    const inputs = page.locator('input:visible:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea:visible');
    const n = await inputs.count();
    const nasty = ['', ' '.repeat(5000), 'א'.repeat(10000), '<script>alert(1)</script>', "' OR 1=1 --", '😀'.repeat(2000), '-1e309', '\u202Eabc'];
    for (let i = 0; i < Math.min(n, 30); i++) for (const v of nasty) await inputs.nth(i).fill(v).catch(() => {});
    const alerted = await page.evaluate(() => (window as any).__xss === true);
    verdict('forms', `survives extreme input ${p}`, errors.length === 0 && !alerted, `${n} fields, ${errors.length} errors`);
  });
}
