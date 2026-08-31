const { devices } = require("./tests/e2e/playwright-runtime.cjs");

/** @type {import('playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: "./tests/e2e",
  outputDir: "./test-results/playwright",
  snapshotDir: "./screenshots/playwright",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://localhost:5173/apps/nostrill/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_NO_WEBSERVER
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:5173/apps/nostrill",
        reuseExistingServer: true,
        timeout: 30_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
};
