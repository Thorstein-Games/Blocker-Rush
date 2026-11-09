import { test, expect, type Page } from "@playwright/test";

// The tutorial opens by itself only on a first visit, and never for automated
// browsers unless they ask (window.__tutorialAuto), so other specs don't see it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __tutorialAuto: boolean }).__tutorialAuto = true));
});

const tour = (page: Page) => page.getByRole("dialog", { name: "Blocker Rush tutorial" });
const square = (page: Page, name: string) =>
  tour(page).getByRole("gridcell", { name: new RegExp(`^Square ${name}:`) });

test("first visit: fill the practice board, then the tray and header", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/blocker-rush");
  const dialog = tour(page);
  await expect(dialog.getByRole("heading", { name: "Fill every square" })).toBeVisible();

  await square(page, "2, 1").click();
  await expect(square(page, "2, 1")).toHaveAccessibleName("Square 2, 1: Square");
  await square(page, "2, 3").click();
  await expect(dialog.getByRole("status")).toHaveText("Solved! Every square is filled.");

  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: "Turn, flip, or get a hint" })).toBeVisible();
  await dialog.getByRole("button", { name: "Next" }).click();
  await expect(dialog.getByRole("heading", { name: "A new puzzle every day" })).toBeVisible();
  await dialog.getByRole("button", { name: "Let's play" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
  await expect(tour(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test("a wrong spot can be taken back", async ({ page }) => {
  await page.goto("/blocker-rush");
  const dialog = tour(page);
  // The square in the bottom-right corner leaves no room for the hook.
  await square(page, "3, 3").click();
  await expect(dialog.getByRole("status")).toHaveText(
    "The other piece can't fit now. Tap a placed piece to take it back.",
  );
  await square(page, "3, 3").click();
  await expect(square(page, "3, 3")).toHaveAccessibleName("Square 3, 3: empty");
  await square(page, "1, 1").click();
  await expect(dialog.getByRole("status")).toHaveText("That's a blocker: nothing can cover it.");
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
