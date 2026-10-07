import { test, expect, type Page } from "@playwright/test";
// Imported file-by-file: the package index pulls in the puzzle dataset via a
// JSON import assertion, which the test runner's transform doesn't need.
import { solvePuzzle } from "../../../packages/shared/src/solver";
import { parsePuzzleId } from "../../../packages/shared/src/coords";
import { PIECES } from "../../../packages/shared/src/pieces";

// Single-player flows. None of these need megingjord.

const STATS_KEY = "blockerRush.daily.stats";
const PROGRESS_KEY = "blockerRush.daily.progress";

/** Fails the test on uncaught exceptions and console errors (incl. hydration). */
const watchForErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
};

const contextStrip = (page: Page) => page.locator(".game-context-strip");
const pieceCells = (page: Page) => page.locator(".board-cell.piece");

test.describe("daily puzzle", () => {
  test("solve, streak, reload and share", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    // Force the clipboard path of the share button.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
    });
    const page = await context.newPage();
    const errors = watchForErrors(page);

    await page.goto("/blocker-rush");
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
    const saved = await expect
      .poll(async () =>
        page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY),
      )
      .not.toBeNull()
      .then(() =>
        page.evaluate(
          (key) => JSON.parse(window.localStorage.getItem(key)!),
          PROGRESS_KEY,
        ),
      );
    const puzzleId: string = saved.puzzleId;

    // Restore every piece but the 1×1 Dot from a real solution, then place
    // the Dot through the UI so the final move goes through GameContext.
    const solution = solvePuzzle(parsePuzzleId(puzzleId), { maxSolutions: 1 })
      .firstSolution!;
    const pieceStates = Object.fromEntries(
      PIECES.map((piece) => [piece.id, { rotation: 0, flipped: false }]),
    );
    await page.evaluate(
      ({ key, progress }) => window.localStorage.setItem(key, JSON.stringify(progress)),
      {
        key: PROGRESS_KEY,
        progress: {
          dateKey: saved.dateKey,
          puzzleId,
          placements: Object.values(solution).filter((p) => p.pieceId !== "p1"),
          pieceStates,
          startedAt: Date.now(),
          moveCount: 8,
        },
      },
    );
    await page.reload();
    await expect(pieceCells(page)).toHaveCount(28);
    await expect(contextStrip(page)).toContainText("0-day streak");

    await page.getByRole("button", { name: "Select Dot" }).click();
    await page.locator(".board-cell:not(.blocker):not(.piece)").click();

    await expect(pieceCells(page)).toHaveCount(29);
    await expect(page.getByRole("status").filter({ hasText: "Completed in" })).toBeVisible();
    await expect(contextStrip(page)).toContainText("1-day streak");

    // Solved state and streak survive a reload without counting twice.
    await page.reload();
    await expect(pieceCells(page)).toHaveCount(29);
    await expect(contextStrip(page)).toContainText("1-day streak");
    const stats = await page.evaluate(
      (key) => JSON.parse(window.localStorage.getItem(key)!),
      STATS_KEY,
    );
    expect(stats).toEqual({ streak: 1, lastCompletedDateKey: saved.dateKey });

    // Share link points at the game, not the host site's root.
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    expect(shared).toContain(`/blocker-rush?p=${puzzleId}`);

    expect(errors).toEqual([]);
    await context.close();
  });

  test("hydrates cleanly for a returning player on a later day", async ({ page }) => {
    // The page HTML is rendered before the visitor's date and streak are
    // known. Simulate both differing from the server: a later day than
    // "now", with a streak from the day before it.
    const later = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const yesterday = new Date(later);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    await page.clock.setFixedTime(later);
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      {
        key: STATS_KEY,
        value: JSON.stringify({ streak: 5, lastCompletedDateKey: dateKey(yesterday) }),
      },
    );
    const errors = watchForErrors(page);

    await page.goto("/blocker-rush");
    await expect(contextStrip(page)).toContainText("5-day streak");
    await expect(contextStrip(page).locator("time")).toHaveAttribute(
      "datetime",
      dateKey(later),
    );
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
    expect(errors).toEqual([]);
  });
});

test("casual ?p= link loads that exact puzzle", async ({ page }) => {
  const errors = watchForErrors(page);
  const id = "A2A4D1D2F4F5F6";
  await page.goto(`/blocker-rush/casual?p=${id}`);
  const blockers = page.locator(".board-cell.blocker");
  await expect(blockers).toHaveCount(7);
  const labels = await blockers.evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("aria-label")),
  );
  // "A2" = column A (1), row 2.
  const expected = parsePuzzleId(id).map(
    ({ col, row }) =>
      `Row ${row}, column ${col.charCodeAt(0) - 64}: blocker`,
  );
  expect(labels.sort()).toEqual(expected.sort());
  expect(errors).toEqual([]);
});

test.describe("pages load without errors", () => {
  for (const path of ["/blocker-rush", "/blocker-rush/casual"]) {
    test(path, async ({ page }) => {
      const errors = watchForErrors(page);
      await page.goto(path);
      await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
      expect(errors).toEqual([]);
    });
  }

  test("unknown path returns the 404 page", async ({ page }) => {
    const errors = watchForErrors(page);
    const response = await page.goto("/blocker-rush/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("could not be found")).toBeVisible();
    // The 404 response itself is logged as a console error; nothing else.
    expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
  });
});
