import { execSync } from "child_process";
import { loadEnvConfig } from "@next/env";

/**
 * Points the whole Jest run at the dedicated test database and makes sure its
 * migrations are current. Jest sets NODE_ENV=test, so loadEnvConfig resolves
 * .env.test (the badmintonsg_test URLs) ahead of .env — and in test mode never
 * reads .env.production.local at all, so this can't repeat the old
 * "tests silently target production" incident. Values already present in
 * process.env (CI's workflow-level DATABASE_URL) win over any file.
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  // Local safety net: outside CI, refuse to run against anything but the test
  // database — resetDb() wipes every table in whatever database it's pointed at.
  const url = process.env.DATABASE_URL ?? "";
  if (!process.env.CI && !url.includes("badmintonsg_test")) {
    throw new Error(
      'Jest is not pointed at the test database (expected DATABASE_URL to contain "badmintonsg_test" — ' +
        "is .env.test missing or overridden?). Refusing to run: the test suite wipes every table it touches.",
    );
  }

  // migrate deploy creates the database on first run, no-ops when up to date.
  try {
    execSync("npx prisma migrate deploy", { stdio: "pipe", env: process.env });
  } catch (e) {
    const err = e as { stderr?: Buffer; stdout?: Buffer };
    throw new Error(
      `prisma migrate deploy failed for the test schema:\n${err.stderr?.toString() ?? err.stdout?.toString() ?? String(e)}`,
    );
  }
}
