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

  // Success = manage page with the "save this link" banner.
  await expect(page).toHaveURL(/\/manage\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByText(/save this page's link/i)).toBeVisible();
  const manageUrl = page.url().split("?")[0];

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

  // Manage: mark sold.
  await page.goto(manageUrl);
  await page.getByRole("button", { name: /mark as sold/i }).click();
  await expect(page.getByText("SOLD").first()).toBeVisible();

  // Board reflects the SOLD badge. Re-navigate on each retry (not just poll the
  // DOM) so a stale prefetched/cached board render can't satisfy — or defeat —
  // the assertion; the server render is authoritative and shows SOLD.
  await expect(async () => {
    await page.goto(`/?t=${Date.now()}`, { waitUntil: "networkidle" });
    await expect(page.getByText("SOLD").first()).toBeVisible();
  }).toPass({ timeout: 20_000 });
});

test("game: post → players tab → skill filter → detail", async ({ page }) => {
  await page.goto("/post/game");
  await page.getByRole("button", { name: /choose a venue/i }).click();
  await page.getByPlaceholder(/search venues/i).fill("choa chu");
  await page.getByRole("button", { name: /choa chu kang/i }).click();
  await page.getByLabel("Date").fill(tomorrowSgt());
  await page.getByLabel("Skill level").selectOption("ADVANCED");
  await page.getByPlaceholder("9123 4567").fill("81234567");
  await page.getByRole("button", { name: /post game/i }).click();

  await expect(page).toHaveURL(/\/manage\//);
  const manageUrl = page.url().split("?")[0];

  // Poster edits "Players still needed" from the manage link → 1, and it sticks after refresh.
  await page.getByLabel("Players still needed").selectOption("1");
  await page.getByRole("button", { name: /^update$/i }).click();
  await expect(page.getByLabel("Players still needed")).toHaveValue("1");

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
