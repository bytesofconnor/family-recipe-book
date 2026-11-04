import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for PR checks (smoke + accessibility + mobile intake).
 * Runs against the local a11y fixture preview on port 4821 — never
 * production Convex, never real credentials.
 * Accessibility specs set their own desktop (1280x800) and mobile (390x844)
 * viewports inside the desktop Chrome project.
 * Adding a recipe is covered on an iPhone (WebKit) and a Pixel (Chrome).
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4821",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: "**/mobile-intake.spec.ts",
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"] },
      testMatch: "**/mobile-intake.spec.ts",
    },
    {
      name: "pixel",
      use: { ...devices["Pixel 7"] },
      testMatch: "**/mobile-intake.spec.ts",
    },
  ],
  webServer: {
    command: "npm run preview:a11y",
    url: "http://localhost:4821",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
