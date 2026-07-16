import { test, expect } from "@playwright/test";

const PHONE = "91234567";

// Post for TOMORROW (SGT) so the run is never time-of-day dependent: today's slots
// would expire mid-suite once their start time passes. A strictly-future date also
// keeps every start-time option selectable. Board defaults to all upcoming dates.
function tomorrowSgt(): string {
  const sgt = new Date(Date.now() + 8 * 3600 * 1000); // shift UTC → SGT wall clock
  sgt.setUTCDate(sgt.getUTCDate() + 1);
  return sgt.toISOString().slice(0, 10);
}

test("court: post → browse → detail → reveal → mark sold", async ({ page }) => {
  // Post a court listing.
  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  // Success = manage page, gated behind an explicit "copy my manage link" click.
  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
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
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByLabel("Skill level from").selectOption("ADVANCED");
  await page.getByPlaceholder("9123 4567").fill("81234567");
  await page.getByRole("button", { name: /post game/i }).click();

  await expect(page).toHaveURL(/\/manage\//);
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
  page.on("dialog", (d) => d.accept());
  await page.goto(manageUrl);
  await page.getByRole("button", { name: /delete post/i }).click();
  await expect(page).toHaveURL("/");
});

test("posts two courts in one batch under a single manage link", async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");

  await page.getByRole("button", { name: /add another court/i }).click();
  await expect(page.getByText("Court 2")).toBeVisible();
  // Court 1's venue button now reads "Choa Chu Kang Sport Hall", so only Court 2's
  // button still matches "Choose a venue…".
  await page.getByRole("button", { name: /choose a venue/i }).click();
  const sheet = page.getByRole("dialog", { name: "Venue" });
  await sheet.getByPlaceholder(/search venues/i).fill("choa chu");
  await sheet.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Date").nth(1).fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).nth(1).fill("20");

  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post 2 courts/i }).click();

  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
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
  await page.getByRole("button", { name: /delete post/i }).first().click();
  await expect(page.getByRole("button", { name: /delete post/i })).toHaveCount(1);
  await page.getByRole("button", { name: /delete post/i }).first().click();
  await expect(page).toHaveURL("/");
});

test("can't reach 'add another' before saving the manage link, and adding one re-gates it", async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
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
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("20");
  await page.getByRole("button", { name: /^add court$/i }).click();

  // Landing back on the same manage link, the save-link gate fires again — a second
  // safety net even for a poster who already copied it once.
  await expect(page).toHaveURL(`${manageUrl}?created=1`);
  await expect(page.getByText(/copy your manage link before continuing/i)).toBeVisible();
  await page.getByRole("button", { name: /copy my manage link/i }).click();
  await expect(page.getByText("$16")).toBeVisible();
  await expect(page.getByText("$20")).toBeVisible();

  // Clean up so repeated runs don't hit the per-phone active-post cap.
  await page.getByRole("button", { name: /delete post/i }).first().click();
  await expect(page.getByRole("button", { name: /delete post/i })).toHaveCount(1);
  await page.getByRole("button", { name: /delete post/i }).first().click();
  await expect(page).toHaveURL("/");
});

test("posts at a venue not in the list, and it shows up filtered by region", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const venueName = `Test Private Hall ${Date.now()}`;

  await page.goto("/post/court");
  await page.getByRole("button", { name: /enter it and post now/i }).click();
  await page.getByPlaceholder("Venue name").fill(venueName);
  await page.getByLabel("Venue region").selectOption("EAST");
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("9123 4567").fill(PHONE);
  await page.getByRole("button", { name: /post court/i }).click();

  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
  const manageUrl = page.url().split("?")[0];
  await page.getByRole("button", { name: /copy my manage link/i }).click();
  await expect(page.getByText(venueName)).toBeVisible();

  // Shows on the board, filterable by region even without a curated venue.
  await page.goto("/?region=EAST");
  await expect(page.getByText(venueName)).toBeVisible();

  await page.goto(manageUrl);
  await page.getByRole("button", { name: /delete post/i }).click();
  await expect(page).toHaveURL("/");
});

test("posts with only a Telegram handle (no phone), reveals a Telegram link, and a Maps link works", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const handle = `test_user_${Date.now()}`;

  await page.goto("/post/court");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByPlaceholder(/negotiable/i).fill("16");
  await page.getByPlaceholder("@username").fill(handle);
  await page.getByRole("button", { name: /post court/i }).click();

  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
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
  await page.getByRole("button", { name: /delete post/i }).click();
  await expect(page).toHaveURL("/");
});
