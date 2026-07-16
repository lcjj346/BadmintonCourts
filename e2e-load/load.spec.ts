import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { test, expect } from "@playwright/test";
import { seedLoadTest, cleanupLoadTest, LOAD_TEST_TAG } from "../scripts/loadTestSeed";

/**
 * Opt-in perf/load test: seeds ~1000 courts + 1000 games and pings the endpoints a
 * real user's session exercises most — browsing the board, posting, revealing contact
 * — asserting each stays under a generous "something is badly wrong" threshold rather
 * than a tight budget, since this also runs on whatever machine happens to invoke it.
 *
 * Not part of the default e2e run (see playwright.load.config.ts) — invoke explicitly:
 *   npm run test:load
 */

const ROW_COUNT = 1000;
const POST_TEST_PHONE = "+6599990000";

// Generous ceilings: this catches a real regression (an N+1 query, a missing index,
// an accidentally-unbounded payload) without flaking on a slower dev machine.
const THRESHOLDS = {
  boardFetchMs: 2000,
  createPostMs: 2000,
  revealContactMs: 2000,
  clickToDetailMs: 5000,
};

let prisma: PrismaClient;

test.beforeAll(async () => {
  loadEnvConfig(process.cwd());
  prisma = new PrismaClient();
  await cleanupLoadTest(prisma);
  await prisma.rateLimitEvent.deleteMany({ where: { action: "CREATE" } });
  await prisma.listing.deleteMany({ where: { phone: POST_TEST_PHONE } });
  const { listings, sessions } = await seedLoadTest(prisma, ROW_COUNT);
  console.log(`[load test] seeded ${listings} courts and ${sessions} games`);
});

test.afterAll(async () => {
  const { listings, sessions } = await cleanupLoadTest(prisma);
  await prisma.listing.deleteMany({ where: { phone: POST_TEST_PHONE } });
  console.log(`[load test] cleaned up ${listings} courts and ${sessions} games`);
  await prisma.$disconnect();
});

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const t0 = Date.now();
  const result = await fn();
  return { ms: Date.now() - t0, result };
}

test.describe(`with ${ROW_COUNT} courts + ${ROW_COUNT} games posted`, () => {
  test(`GET /api/listings responds in under ${THRESHOLDS.boardFetchMs}ms`, async ({ request }) => {
    const { ms, result } = await timeIt(() => request.get("/api/listings"));
    expect(result.ok()).toBe(true);
    const json = await result.json();
    expect(json.data.length).toBeGreaterThanOrEqual(ROW_COUNT);
    console.log(`[load test] GET /api/listings: ${ms}ms for ${json.data.length} rows`);
    expect(ms).toBeLessThan(THRESHOLDS.boardFetchMs);
  });

  test(`GET /api/sessions responds in under ${THRESHOLDS.boardFetchMs}ms`, async ({ request }) => {
    const { ms, result } = await timeIt(() => request.get("/api/sessions"));
    expect(result.ok()).toBe(true);
    const json = await result.json();
    expect(json.data.length).toBeGreaterThanOrEqual(ROW_COUNT);
    console.log(`[load test] GET /api/sessions: ${ms}ms for ${json.data.length} rows`);
    expect(ms).toBeLessThan(THRESHOLDS.boardFetchMs);
  });

  test(`posting a new court responds in under ${THRESHOLDS.createPostMs}ms`, async ({ request }) => {
    const venuesRes = await request.get("/api/venues");
    const venues = (await venuesRes.json()).data;
    const date = new Date();
    date.setDate(date.getDate() + 5);

    const { ms, result } = await timeIt(() =>
      request.post("/api/listings", {
        data: {
          items: [{
            venueId: venues[0].id,
            date: date.toISOString().slice(0, 10),
            startTime: "19:00",
            endTime: "21:00",
            priceCents: 1000,
            notes: `${LOAD_TEST_TAG} perf test post`,
          }],
          phone: POST_TEST_PHONE,
          website: "",
        },
      }),
    );
    expect(result.status()).toBe(201);
    console.log(`[load test] POST /api/listings (${ROW_COUNT} existing rows): ${ms}ms`);
    expect(ms).toBeLessThan(THRESHOLDS.createPostMs);
  });

  test(`revealing a poster's contact responds in under ${THRESHOLDS.revealContactMs}ms`, async ({ request }) => {
    const listing = await prisma.listing.findFirst({ where: { notes: { startsWith: LOAD_TEST_TAG } } });
    if (!listing) throw new Error("no seeded listing to reveal");

    const { ms, result } = await timeIt(() => request.post(`/api/listings/${listing.id}/reveal`));
    expect(result.ok()).toBe(true);
    console.log(`[load test] POST reveal contact: ${ms}ms`);
    expect(ms).toBeLessThan(THRESHOLDS.revealContactMs);
  });

  test(`clicking an available court navigates to its detail page in under ${THRESHOLDS.clickToDetailMs}ms`, async ({ page }) => {
    await page.goto("/");
    // Target listing cards specifically (href starts with /listing/) — a plain
    // role=link query would also match header/nav links like the logo or FAQ.
    const target = page.locator('a[href^="/listing/"]').first();
    await expect(target).toBeVisible();

    const t0 = Date.now();
    await target.click();
    await page.waitForURL(/\/listing\//);
    await expect(page.getByRole("button", { name: /reveal/i })).toBeVisible();
    const ms = Date.now() - t0;
    console.log(`[load test] click court card -> detail page rendered: ${ms}ms`);
    expect(ms).toBeLessThan(THRESHOLDS.clickToDetailMs);
  });
});
