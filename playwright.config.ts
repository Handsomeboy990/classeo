import { defineConfig, devices } from "@playwright/test";

// End to end suite for the critical journeys. Runs against the production
// build: set E2E_BASE_URL to test a server that is already running, otherwise
// Playwright starts `scripts/start-e2e.sh` on E2E_PORT (3000 by default).
// Playwright builds nothing: run `npm run build` first.
const externalBaseURL = process.env.E2E_BASE_URL;
const port = process.env.E2E_PORT ?? "3000";
const baseURL = externalBaseURL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // Files run in parallel, tests inside a file run in order.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retry: a test that only passes on a second attempt is a defect to fix.
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Africa/Porto-Novo",
    // The service worker caches pages for offline reading; a cached page
    // would hide what a test has just written.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "desktop",
      testIgnore: /auth\.setup\.ts/,
      grepInvert: /@mobile-only/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 900 } },
    },
    {
      // The narrowest supported width, for the journeys tagged @mobile.
      name: "mobile",
      testIgnore: /auth\.setup\.ts/,
      grep: /@mobile/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `sh scripts/start-e2e.sh ${port}`,
        url: `${baseURL}/connexion`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
