import { test, expect } from "@playwright/test";

const STORAGE_KEY = "badmintonsg_tour_seen";

test.describe("onboarding tour", () => {
  // Override the config-wide default (tour marked "seen") so these tests see the
  // real first-visit experience.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("mobile: first visit walks through all steps, then never shows again", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("dialog", { name: "Courts & Players" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Pick a date" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Narrow it down" })).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Post in seconds" })).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe("1");

    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Replay tutorial" }).click();
    await expect(page.getByRole("dialog", { name: "Courts & Players" })).toBeVisible();
  });

  test("desktop: skip tutorial dismisses it immediately and marks it seen", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("dialog", { name: "Courts & Players" })).toBeVisible();
    await page.getByText("Skip tutorial").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBe("1");

    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
