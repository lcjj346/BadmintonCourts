import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// `next start` (production mode, used for CI below) resolves .env.production.local
// ahead of .env if that file exists — which it does on a machine also used for the
// prod:migrate/prod:seed scripts, and it points at the REAL production database.
// Forcing dev=true here reproduces `next dev`'s precedence (.env.local/.env win),
// so e2e traffic can never end up hitting production no matter what other .env
// files exist locally. In actual CI there's no local .env file at all — only the
// workflow's own already-correct env: block — so DATABASE_URL/DIRECT_URL below are
// undefined there and this override is skipped entirely.
const { combinedEnv } = loadEnvConfig(__dirname, true);

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
    // Dev mode compiles each route on first hit, which is slower and more
    // variable than a prebuilt server — that variance was a plausible
    // contributor to a hard-to-pin-down CI timing flake. CI builds
    // (see ci.yml) then serves the production build here; local runs keep
    // `next dev` for fast iteration without a rebuild on every change.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    ...(typeof combinedEnv.DATABASE_URL === "string"
      ? {
          env: {
            DATABASE_URL: combinedEnv.DATABASE_URL,
            DIRECT_URL: typeof combinedEnv.DIRECT_URL === "string" ? combinedEnv.DIRECT_URL : combinedEnv.DATABASE_URL,
          },
        }
      : {}),
  },
});
