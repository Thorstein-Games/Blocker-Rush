import { test, expect, type Page } from "@playwright/test";

// The tutorial opens by itself only on a first visit, and never for automated
// browsers unless they ask (window.__tutorialAuto), so other specs don't see it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __tutorialAuto: boolean }).__tutorialAuto = true));
});

const tour = (page: Page) => page.getByRole("dialog", { name: "Blocker Rush tutorial" });

test("first visit: the tray, the board, then the header", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/blocker-rush");
  const dialog = tour(page);
  const hole = page.locator("#game-tutorial .hole");

  // Each step spotlights the real part of the page it talks about.
  const spotlights = async (selector: string) => {
    await expect
      .poll(async () => {
        const box = await page.locator(selector).first().boundingBox();
        const h = await hole.boundingBox();
        return !!h && !!box && Math.abs(h.x + 6 - box.x) < 2 && Math.abs(h.width - 12 - box.width) < 2;
      })
      .toBe(true);
  };

  await expect(dialog.getByRole("heading", { name: "Pick a piece" })).toBeVisible();
  await expect(dialog).toContainText("Rotate and Flip");
  await spotlights(".pieces-area");
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: "Fill every square" })).toBeVisible();
  await spotlights(".board");
  // Tapping the spotlighted part goes on, rather than closing the tutorial.
  await hole.click();
  await expect(dialog.getByRole("heading", { name: "A new puzzle every day" })).toBeVisible();
  await dialog.getByRole("button", { name: "Let's play" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
  await expect(tour(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test("skip, then replay from How to Play", async ({ page }) => {
  await page.goto("/blocker-rush/casual");
  await tour(page).getByRole("button", { name: "Skip" }).click();
  await expect(tour(page)).toBeHidden();
  await page.getByRole("button", { name: "Open how to play" }).click();
  await page.getByRole("button", { name: "Show the tutorial" }).click();
  await expect(tour(page)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "How to Play" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(tour(page)).toBeHidden();
});

test("returning players and multiplayer don't get it", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("blockerRush.daily.stats", "{}"));
  await page.goto("/blocker-rush");
  await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
  await expect(tour(page)).toBeHidden();
});
