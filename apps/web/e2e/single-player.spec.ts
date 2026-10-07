import { test, expect, type Page } from "@playwright/test";
// Imported file-by-file: the package index pulls in the puzzle dataset via a
// JSON import assertion, which the test runner's transform doesn't need.
import { solveFromPlacements, solvePuzzle } from "../../../packages/shared/src/solver";
import { parsePuzzleId } from "../../../packages/shared/src/coords";
import { PIECES, PIECE_TRANSFORMS } from "../../../packages/shared/src/pieces";

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
          elapsedMs: 95_000,
        },
      },
    );
    await page.reload();
    await expect(pieceCells(page)).toHaveCount(28);
    await expect(contextStrip(page)).toContainText("0-day streak");
    // Timer resumes from the saved time rather than restarting.
    await expect(page.getByLabel("Solve time")).toHaveText(/^1:3\d$/);

    await page.getByRole("button", { name: "Select Dot" }).click();
    await page.locator(".board-cell:not(.blocker):not(.piece)").click();

    await expect(pieceCells(page)).toHaveCount(29);
    // Moves from before the reload count too (8 restored + the Dot).
    const completed = page.getByRole("status").filter({ hasText: "Completed in" });
    await expect(completed).toHaveText(/^Completed in 1:3\d with 9 moves\.$/);
    const completedText = await completed.textContent();
    await expect(contextStrip(page)).toContainText("1-day streak");

    // Solved state, time and streak survive a reload without changing.
    await page.reload();
    await expect(pieceCells(page)).toHaveCount(29);
    await expect(contextStrip(page)).toContainText("1-day streak");
    await expect(completed).toHaveText(completedText!);
    await page.waitForTimeout(1500);
    await expect(completed).toHaveText(completedText!);
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
    expect(shared).toContain(`today's Blocker Rush in ${completedText!.slice("Completed in ".length, -1)}!`);

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

test.describe("hints", () => {
  const hintButton = (page: Page) => page.getByRole("button", { name: "Hint", exact: true });

  test("following hints solves the daily puzzle and is counted", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto("/blocker-rush");
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);

    for (let step = 1; step <= PIECES.length; step += 1) {
      await hintButton(page).click();
      await expect(page.getByText(/^Hint: place .+ on the outlined squares\.$/)).toBeVisible();
      // The hint selects and orients the piece and focuses its square.
      await page.keyboard.press("Enter");
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(window.localStorage.getItem(key) ?? "{}").placements?.length,
            PROGRESS_KEY,
          ),
        )
        .toBe(step);
    }

    await expect(pieceCells(page)).toHaveCount(29);
    await expect(page.getByRole("status").filter({ hasText: "Completed in" })).toHaveText(
      /with 9 moves and 9 hints\.$/,
    );
    // Survives a reload.
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Completed in" })).toHaveText(
      /with 9 moves and 9 hints\.$/,
    );
    expect(errors).toEqual([]);
  });

  test("says which piece to take back from a dead end", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto("/blocker-rush/casual?p=A2A4D1D2F4F5F6");
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);

    // A square for the Dot that no solution uses.
    const blockers = parsePuzzleId("A2A4D1D2F4F5F6");
    const taken = new Set(blockers.map((b) => (b.row - 1) * 6 + b.col.charCodeAt(0) - 65));
    let deadEnd = -1;
    for (let index = 0; index < 36 && deadEnd < 0; index += 1) {
      if (taken.has(index)) continue;
      const fixed = {
        p1: { transformId: PIECE_TRANSFORMS.p1[0]!.id, origin: { x: index % 6, y: Math.floor(index / 6) } },
      };
      if (!solveFromPlacements(blockers, fixed).firstSolution) deadEnd = index;
    }
    expect(deadEnd).toBeGreaterThanOrEqual(0);

    await page.getByRole("button", { name: "Select Dot" }).click();
    await page.locator(`.board-cell[data-index="${deadEnd}"]`).click();
    await expect(pieceCells(page)).toHaveCount(1);

    await hintButton(page).click();
    await expect(page.getByRole("status").filter({ hasText: "The Dot can't stay where it is" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateKey(date);
};

test.describe("daily archive", () => {
  test("solving a past day records it without touching the streak", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
    });
    const page = await context.newPage();
    const errors = watchForErrors(page);
    const dateKey = daysAgo(3);
    const progressKey = `blockerRush.archive.progress.${dateKey}`;

    await page.goto(`/blocker-rush/daily/${dateKey}`);
    await expect(page).toHaveTitle(/^Daily Puzzle for .+ \| Blocker Rush$/);
    await expect(contextStrip(page)).toContainText("Archive");
    await expect(contextStrip(page)).not.toContainText("streak");
    await expect(contextStrip(page).locator("time")).toHaveAttribute("datetime", dateKey);
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);

    const puzzleId: string = await expect
      .poll(async () =>
        page.evaluate((key) => window.localStorage.getItem(key), progressKey),
      )
      .not.toBeNull()
      .then(() =>
        page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!).puzzleId, progressKey),
      );
    // Today's progress is separate and untouched.
    expect(await page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY)).toBeNull();

    const solution = solvePuzzle(parsePuzzleId(puzzleId), { maxSolutions: 1 }).firstSolution!;
    await page.evaluate(
      ({ key, progress }) => window.localStorage.setItem(key, JSON.stringify(progress)),
      {
        key: progressKey,
        progress: {
          dateKey,
          puzzleId,
          placements: Object.values(solution).filter((p) => p.pieceId !== "p1"),
          pieceStates: Object.fromEntries(
            PIECES.map((piece) => [piece.id, { rotation: 0, flipped: false }]),
          ),
          startedAt: Date.now(),
          moveCount: 8,
          elapsedMs: 60_000,
        },
      },
    );
    await page.reload();
    await expect(pieceCells(page)).toHaveCount(28);
    await page.getByRole("button", { name: "Select Dot" }).click();
    await page.locator(".board-cell:not(.blocker):not(.piece)").click();

    const completed = page.getByRole("status").filter({ hasText: "Completed in" });
    await expect(completed).toHaveText(/^Completed in 1:0\d with 9 moves\.$/);

    // Recorded in the solve history, with no streak written.
    const history = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("blockerRush.daily.history")!),
    );
    expect(history[dateKey]).toMatchObject({ moves: 9 });
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STATS_KEY)).toBeNull();

    // Share links to this day's page.
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
    const shared = await page.evaluate(() => navigator.clipboard.readText());
    expect(shared).toContain(" daily Blocker Rush in 1:0");
    expect(shared).toContain(`/blocker-rush/daily/${dateKey}`);

    // The archive list shows it solved, with its time; today links home.
    await page.getByRole("button", { name: "More Past Puzzles" }).click();
    await expect(page).toHaveURL(/\/blocker-rush\/daily$/);
    const day = page.locator(`a[href$="/daily/${dateKey}"]`);
    await expect(day).toHaveClass(/solved/);
    await expect(day).toContainText(/✓ 1:0\d/);
    await expect(page.locator(`a[href$="/daily/${daysAgo(1)}"]`)).not.toHaveClass(/solved/);
    await expect(page.locator(".archive-day").first()).toContainText("Today");
    await expect(page.locator(".archive-day").first()).toHaveAttribute("href", "/blocker-rush");

    expect(errors).toEqual([]);
    await context.close();
  });

  test("today's date redirects to the daily page", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(`/blocker-rush/daily/${daysAgo(0)}`);
    await expect(page).toHaveURL(/\/blocker-rush$/);
    await expect(contextStrip(page)).toContainText("streak");
    expect(errors).toEqual([]);
  });

  test("a future date isn't playable yet", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto(`/blocker-rush/daily/${daysAgo(-2)}`);
    await expect(page.getByRole("status")).toContainText("isn't out yet");
    await expect(page.locator(".board-cell")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const bad of ["2026-02-30", "2020-01-01", "yesterday"]) {
    test(`invalid date ${bad} is a 404`, async ({ page }) => {
      const response = await page.goto(`/blocker-rush/daily/${bad}`);
      expect(response?.status()).toBe(404);
    });
  }
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

  test("/blocker-rush/daily", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto("/blocker-rush/daily");
    await expect(page.locator(".archive-day").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("unknown path returns the 404 page", async ({ page }) => {
    const errors = watchForErrors(page);
    const response = await page.goto("/blocker-rush/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByText("could not be found")).toBeVisible();
    // The 404 response itself is logged as a console error; nothing else.
    expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
  });
});
