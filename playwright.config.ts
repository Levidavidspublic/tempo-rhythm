import { defineConfig, devices } from "@playwright/test";

const previewBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  // These specs need the local dev webServer's E2E env below (auth bypass, public /calendar,
  // browser-storage task/event sources). A deployed preview has none of that, so against a preview
  // (factory-nightly runs the full suite there) they always failed. CI's E2E job still runs them.
  ...(previewBaseURL ? { testIgnore: ["**/calendar-views.spec.ts", "**/task-views-core.spec.ts", "**/fix/calendar-add.spec.ts"] } : {}),
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: previewBaseURL ?? "http://localhost:3000",
    // Preview runs (e2e-preview check) keep screenshots and traces of every test as EVIDENCE.
    trace: previewBaseURL ? "on" : "retain-on-failure",
    screenshot: previewBaseURL ? "on" : "only-on-failure",
    ...(previewBaseURL && bypassSecret
      ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypassSecret } }
      : {}),
  },
  ...(previewBaseURL
    ? {}
    : {
        webServer: {
          command: "bun run --cwd apps/web dev",
          env: {
            NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
            NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS: "1",
            TEMPO_E2E_AUTH_BYPASS: "1",
            TEMPO_E2E_PUBLIC_CALENDAR: "1",
          },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          url: "http://localhost:3000",
        },
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
