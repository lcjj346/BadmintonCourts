import { defineConfig, devices } from "@playwright/test";

// Separate from playwright.config.ts / the "e2e" testDir on purpose: this suite seeds
// 1000+1000 rows and asserts perf thresholds, which would make CI slow and flaky if it
// ran on every push. It's opt-in only, via `npm run test:load`.
export default defineConfig({
  testDir: "./e2e-load",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
