import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 180_000, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results/results.json' }]],
  use: {
    baseURL: process.env.PREVIEW_URL,
    // Vercel deployment protection bypass. Inject from 1Password dev vault. Never print.
    extraHTTPHeaders: process.env.VERCEL_BYPASS ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' } : {},
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-web', use: { ...devices['Pixel 7'] } },
  ],
});
