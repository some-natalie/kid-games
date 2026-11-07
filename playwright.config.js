import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/games",
  testMatch: "**/browser/**/*.spec.js",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8880",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "touch-chromium", use: { ...devices["iPad (gen 7)"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    // CI downloads a site built once by the build job; local runs build it here.
    command: `${process.env.PREBUILT_SITE ? "" : "zola build --base-url http://127.0.0.1:8880 && "}python3 -m http.server 8880 --bind 127.0.0.1 --directory public`,
    url: "http://127.0.0.1:8880",
    reuseExistingServer: false,
  },
});
