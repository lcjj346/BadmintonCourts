import { test, expect, type Locator, type Page } from "@playwright/test";
import dayjs from "dayjs";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

// dev=true forces .env.local/.env precedence over .env.production.local (see
// the identical comment in e2e/global-setup.ts) — without it, this spec's own
// per-test DB wipe could silently target production on a machine that also
// has prod:migrate/prod:seed credentials configured.
loadEnvConfig(process.cwd(), true);
const prisma = new PrismaClient();

const PHONE = "91234567";

// Post for TOMORROW (SGT) so the run is never time-of-day dependent: today's slots
// would expire mid-suite once their start time passes. A strictly-future date also
// keeps every start-time option selectable. Board defaults to all upcoming dates.
function tomorrowSgt(): string {
  const sgt = new Date(Date.now() + 8 * 3600 * 1000); // shift UTC → SGT wall clock
  sgt.setUTCDate(sgt.getUTCDate() + 1);
  return sgt.toISOString().slice(0, 10);
}

// The Date field is a button that opens a CalendarGrid sheet (not a native
// input), so picking a date means: open it, page forward to the right month if
// needed, then click the day cell (aria-label matches CalendarGrid's "D MMMM YYYY").
async function pickDate(trigger: Locator, dateStr: string) {
  const page = trigger.page();
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const monthLabel = dayjs(dateStr).format("MMMM YYYY");
  while ((await dialog.getByText(monthLabel).count()) === 0) {
    await dialog.getByRole("button", { name: "Next month" }).click();
  }
  await dialog.getByRole("button", { name: dayjs(dateStr).format("D MMMM YYYY"), exact: true }).click();
}

// Delete is a two-step flow: "Delete post" opens a confirm sheet with its own
// "Delete" button (replaced the native confirm() dialog).
async function deletePost(page: Page, nth = 0) {
  await page.getByRole("button", { name: /delete post/i }).nth(nth).click();
  await page.getByRole("dialog", { name: "Delete post?" }).getByRole("button", { name: /^delete$/i }).click();
}

// Captured per-page in a beforeEach below — an uncaught exception thrown
// synchronously inside submit() (e.g. while building the request body, before
// its try/catch) would leave the button stuck on "Posting…" forever with no
// visible error text at all, which a DOM-only diagnostic can't distinguish
// from, say, the click just not registering. Console/pageerror capture can.
const pageErrors = new WeakMap<Page, string[]>();

// Waits for the post-submit redirect to the manage page. A plain toHaveURL
// timeout gives no clue *why* the app didn't navigate (validation error?
// server rejection? network failure? uncaught exception?) — this dumps
// whatever error text, JS errors, and submit-button state were left on the
// page directly into the failure message, so a CI-only failure is
// diagnosable straight from the log instead of needing the HTML report.
async function expectManageRedirect(page: Page, pattern: RegExp | string = /\/manage\/[0-9a-f-]{36}\?created=1/) {
  const ok = await page
    .waitForURL(pattern, { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) {
    const errors = await page.locator(".text-red-600").allTextContents();
    const jsErrors = pageErrors.get(page) ?? [];
    const submitButtonText = await page
      .locator('form button[type="submit"]')
      .first()
      .textContent()
      .catch(() => null);
    throw new Error(
      `Expected navigation matching ${pattern} but the page stayed at ${page.url()}. ` +
        `Visible error text on page: ${JSON.stringify(errors)}. ` +
        `Submit button text: ${JSON.stringify(submitButtonText)}. ` +
        `Browser console/page errors: ${JSON.stringify(jsErrors)}`,
    );
  }
}

// Retries re-run a whole test from scratch, but a *failed* attempt never
// reaches its own cleanup code — so its created listing/session and its
// create/reveal rate-limit events stick around into the next attempt (and
// into later, unrelated tests). That cascades badly: a stray "Choa Chu Kang"
// listing left behind makes `.first()` venue lookups in other tests grab the
// wrong post, and leftover rate-limit events from repeated retries can push
// the whole run's shared IP over the real per-hour create/reveal caps,
// failing tests that would otherwise pass cleanly. Wiping both before every
// single attempt (not just once for the whole run, like global-setup.ts
// does) gives each attempt — first try or retry — a guaranteed-clean slate.
test.beforeEach(async ({ page }) => {
  await Promise.all([
    prisma.listing.deleteMany({}),
    prisma.gameSession.deleteMany({}),
    prisma.rateLimitEvent.deleteMany({}),
  ]);

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  pageErrors.set(page, errors);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("court: post → browse → detail → reveal → mark sold", async ({ page }) => {
  // Post a court listing.
  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  // Success = manage page, gated behind an explicit "copy my manage link" click.
  await expectManageRedirect(page);
  await expect(page.getByText(/copy your manage link before continuing/i)).toBeVisible();
  const manageUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: /copy my manage link/i }).click();

  // Browse: today's board shows it, and the phone is nowhere in the HTML.
  await page.goto("/");
  const card = page.getByRole("link", { name: /choa chu kang/i }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText("$16").first()).toBeVisible();
  expect(await page.content()).not.toContain(PHONE);

  // Detail: phone still hidden until reveal.
  await card.click();
  await expect(page.getByRole("button", { name: /reveal/i })).toBeVisible();
  expect(await page.content()).not.toContain(PHONE);

  // Reveal → formatted phone + WhatsApp deep link.
  await page.getByRole("button", { name: /reveal/i }).click();
  await expect(page.getByText("9123 4567")).toBeVisible();
  await expect(page.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
    "href",
    `https://wa.me/65${PHONE}`,
  );

  // Manage: mark sold. Exact match — "SOLD" is a case-insensitive substring of the
  // "Mark as sold" button's own label, so a loose match here would false-positive
  // even if the close request never actually persisted.
  await page.goto(manageUrl);
  await page.getByRole("button", { name: /mark as sold/i }).click();
  await expect(page.getByText("SOLD", { exact: true }).first()).toBeVisible();

  // Board reflects the SOLD badge. Re-navigate on each retry (not just poll the
  // DOM) so a stale prefetched/cached board render can't satisfy — or defeat —
  // the assertion; the server render is authoritative and shows SOLD.
  await expect(async () => {
    await page.goto(`/?t=${Date.now()}`, { waitUntil: "networkidle" });
    await expect(page.getByText("SOLD", { exact: true }).first()).toBeVisible();
  }).toPass({ timeout: 20_000 });
});

test("game: post → players tab → skill filter → detail", async ({ page }) => {
  await page.goto("/post/game");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByLabel("Skill level from").selectOption("ADVANCED");
  await page.getByPlaceholder("9123 4567").fill("81234567");
  await page.getByRole("button", { name: /post game/i }).click();

  await expectManageRedirect(page, /\/manage\//);
  const manageUrl = page.url().split("?")[0];

  // Manage actions are gated behind the "copy my manage link" click.
  await page.getByRole("button", { name: /copy my manage link/i }).click();

  // Poster edits "Players needed" via the Edit form → 1, and it sticks after refresh.
  await page.getByRole("button", { name: /^edit$/i }).click();
  await page.getByLabel("Edit players needed").selectOption("1");
  await page.getByRole("button", { name: /save changes/i }).click();
  await expect(page.getByText(/needs 1/i).first()).toBeVisible();

  // Players board shows the open game with the updated count ("Needs 1").
  await page.goto("/?tab=players");
  await expect(page.getByText(/needs 1/i).first()).toBeVisible();

  // Skill filter → Advanced, game still shown.
  await page.getByRole("button", { name: /skill/i }).click();
  await page.getByRole("button", { name: /^Advanced$/ }).click();
  await expect(page.getByText(/needs 1/i).first()).toBeVisible();

  // Clean up so repeated runs don't hit the per-phone active-post cap.
  await page.goto(manageUrl);
  await deletePost(page);
  await expect(page).toHaveURL("/");
});

test("posts two courts in one batch under a single manage link", async ({ page }) => {
  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");

  await page.getByRole("button", { name: /add another court/i }).click();
  await expect(page.getByText("Court 2")).toBeVisible();
  // Court 1's venue button now reads "Choa Chu Kang Sport Hall", so only Court 2's
  // button still matches "Choose a venue…".
  await page.getByRole("button", { name: /choose a venue/i }).click();
  const sheet = page.getByRole("dialog", { name: "Venue" });
  await sheet.getByPlaceholder(/search venues/i).fill("choa chu");
  await sheet.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date").nth(1), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).nth(1).fill("20");

  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post 2 courts/i }).click();

  await expectManageRedirect(page);
  const manageUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: /copy my manage link/i }).click();

  // Both courts are listed under the same link.
  await expect(page.getByText("$16")).toBeVisible();
  await expect(page.getByText("$20")).toBeVisible();
  await expect(page.getByRole("button", { name: /mark as sold/i })).toHaveCount(2);

  // Clean up: delete both so repeated runs don't hit the per-phone active-post cap.
  // Deleting the first (of two) refreshes back to the manage page with one left;
  // deleting the last returns to the board.
  await page.goto(manageUrl);
  await deletePost(page);
  // Deleting triggers router.refresh(), a fire-and-forget RSC re-fetch that
  // occasionally takes longer than the default 5s assertion window under load —
  // a generous timeout here absorbs that instead of flaking on a slow refresh.
  await expect(page.getByRole("button", { name: /delete post/i })).toHaveCount(1, { timeout: 15_000 });
  await deletePost(page);
  await expect(page).toHaveURL("/");
});

test("can't reach 'add another' before saving the manage link, and adding one re-gates it", async ({ page }) => {
  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  await expectManageRedirect(page);
  const manageUrl = page.url().split("?")[0];

  // Before copying the link, "+ Add another court" must not be reachable — otherwise a
  // poster who skips the copy step and adds more right away permanently loses the link.
  await expect(page.getByText(/copy your manage link before continuing/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /add another court/i })).not.toBeVisible();

  await page.getByRole("button", { name: /copy my manage link/i }).click();
  await page.getByRole("link", { name: /add another court/i }).click();

  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("20");
  await page.getByRole("button", { name: /^add court$/i }).click();

  // Landing back on the same manage link, the save-link gate fires again — a second
  // safety net even for a poster who already copied it once.
  await expectManageRedirect(page, `${manageUrl}?created=1`);
  await expect(page.getByText(/copy your manage link before continuing/i)).toBeVisible();
  await page.getByRole("button", { name: /copy my manage link/i }).click();
  await expect(page.getByText("$16")).toBeVisible();
  await expect(page.getByText("$20")).toBeVisible();

  // Clean up so repeated runs don't hit the per-phone active-post cap.
  await deletePost(page);
  // Deleting triggers router.refresh(), a fire-and-forget RSC re-fetch that
  // occasionally takes longer than the default 5s assertion window under load —
  // a generous timeout here absorbs that instead of flaking on a slow refresh.
  await expect(page.getByRole("button", { name: /delete post/i })).toHaveCount(1, { timeout: 15_000 });
  await deletePost(page);
  await expect(page).toHaveURL("/");
});

test("posts at a venue not in the list, and it shows up filtered by region", async ({ page }) => {
  const venueName = `Test Private Hall ${Date.now()}`;

  await page.goto("/post/court");
  await page.getByRole("button", { name: /enter it and post now/i }).click();
  await page.getByPlaceholder("Venue name").fill(venueName);
  await page.getByLabel("Venue region").selectOption("EAST");
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  await expectManageRedirect(page);
  const manageUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: /copy my manage link/i }).click();
  await expect(page.getByText(venueName)).toBeVisible();

  // Shows on the board, filterable by region even without a curated venue.
  await page.goto("/?region=EAST");
  await expect(page.getByText(venueName)).toBeVisible();

  await page.goto(manageUrl);
  await deletePost(page);
  await expect(page).toHaveURL("/");
});

test("posts with only a Telegram handle (no phone), reveals a Telegram link, and a Maps link works", async ({ page }) => {
  const handle = `test_user_${Date.now()}`;

  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("@username").fill(handle);
  await page.getByRole("button", { name: /post court/i }).click();

  await expectManageRedirect(page);
  const manageUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: /copy my manage link/i }).click();

  // Browse to the court and reveal — Telegram link shows, no phone/WhatsApp button since none was given.
  await page.goto("/");
  await page.getByRole("link", { name: /choa chu kang/i }).first().click();
  await expect(page.getByText(/open in google maps/i)).toHaveAttribute(
    "href", /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
  );
  await page.getByRole("button", { name: /reveal/i }).click();
  await expect(page.getByText(`@${handle}`)).toBeVisible();
  await expect(page.getByRole("link", { name: /telegram/i })).toHaveAttribute("href", `https://t.me/${handle}`);
  await expect(page.getByRole("link", { name: /^call$/i })).toHaveCount(0);

  await page.goto(manageUrl);
  await deletePost(page);
  await expect(page).toHaveURL("/");
});

test("editing a post can switch its contact from phone to Telegram", async ({ page }) => {
  const handle = `edited_user_${Date.now()}`;

  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await pickDate(page.getByLabel("Date"), tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  await expectManageRedirect(page);
  const manageUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: /copy my manage link/i }).click();

  await page.getByRole("button", { name: /^edit$/i }).click();
  await page.getByLabel("Phone number").fill("");
  await page.getByLabel("Telegram handle").fill(handle);
  await page.getByRole("button", { name: /save changes/i }).click();

  // Confirm it actually persisted by browsing + revealing — Telegram now shows, no phone.
  await page.goto("/");
  await page.getByRole("link", { name: /choa chu kang/i }).first().click();
  await page.getByRole("button", { name: /reveal/i }).click();
  await expect(page.getByText(`@${handle}`)).toBeVisible();
  await expect(page.getByRole("link", { name: /^call$/i })).toHaveCount(0);

  await page.goto(manageUrl);
  await deletePost(page);
  await expect(page).toHaveURL("/");
});
