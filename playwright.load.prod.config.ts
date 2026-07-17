import { defineConfig, devices } from "@playwright/test";

// Runs e2e-load/load.spec.ts against the already-deployed production app
// directly — no local webServer, no local DB. Only ever invoke via
// `npm run test:load:prod`, which wraps this with dotenv-cli so the seed/
// cleanup Prisma client explicitly targets .env.production.local — never
// leave that to any file-precedence default.
export default defineConfig({
  testDir: "./e2e-load",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "https://badminton-courts-sable.vercel.app" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  // No webServer — production is already running.
});
