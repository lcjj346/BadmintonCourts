import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  // CI runners are slower/shared and occasionally miss a 5s assertion window on
  // an otherwise-passing test (real network + DB round trip); a couple of
  // retries absorbs that without masking a genuinely broken test, which would
  // still fail all three attempts. Local runs stay retry-free for fast feedback.
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: "http://localhost:3000" },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"], permissions: ["clipboard-write"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
