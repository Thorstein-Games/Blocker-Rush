import { test, expect, type Browser } from "@playwright/test";

// Moving progress between devices with a /transfer#p=… link (no server).

const STATS_KEY = "blockerRush.daily.stats";
const HISTORY_KEY = "blockerRush.daily.history";

const dateKey = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** A browser profile with some saved daily progress. */
const device = async (browser: Browser, stats: object, history: object) => {
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(
    ({ statsKey, historyKey, stats, history }) => {
      if (window.localStorage.getItem("seeded")) return;
      window.localStorage.setItem("seeded", "1");
      window.localStorage.setItem(statsKey, JSON.stringify(stats));
      window.localStorage.setItem(historyKey, JSON.stringify(history));
    },
    { statsKey: STATS_KEY, historyKey: HISTORY_KEY, stats, history },
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return { context, page, errors };
};

test("progress moves to another device with a transfer link", async ({ browser }) => {
  const phone = await device(
    browser,
    { streak: 3, lastCompletedDateKey: dateKey(1), bestStreak: 5 },
    {
      [dateKey(1)]: { moves: 9, elapsedMs: 61_000, hints: 0 },
      [dateKey(5)]: { moves: 11, elapsedMs: 95_000, hints: 1 },
    },
  );
  const laptop = await device(browser, { streak: 0 }, {
    [dateKey(10)]: { moves: 12, elapsedMs: 200_000, hints: 0 },
  });

  // The settings panel links to the transfer page.
  await phone.page.goto("/blocker-rush");
  await phone.page.getByRole("button", { name: "Open settings" }).click();
  await phone.page.getByRole("link", { name: "Move progress to another device" }).click();
  await expect(phone.page).toHaveURL(/\/blocker-rush\/transfer$/);
  await expect(phone.page.getByText("3-day streak, best 5, 2 puzzles solved.")).toBeVisible();

  await phone.page.getByRole("button", { name: "Copy link" }).click();
  await expect(phone.page.getByText("Link copied")).toBeVisible();
  const link = await phone.page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/blocker-rush\/transfer#p=[A-Za-z0-9_-]+$/);

  // The laptop opens the link and adds the phone's progress to its own.
  await laptop.page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(laptop.page.getByText("3-day streak, best 5, 2 puzzles solved.").first()).toBeVisible();
  // The progress doesn't linger in the address bar.
  await expect(laptop.page).toHaveURL(/\/blocker-rush\/transfer$/);
  await laptop.page.getByRole("button", { name: "Add to this device" }).click();
  await expect(laptop.page.getByRole("status").filter({ hasText: "Added." })).toContainText(
    "3-day streak, best 5, 3 puzzles solved",
  );
  const history = await laptop.page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key)!),
    HISTORY_KEY,
  );
  expect(Object.keys(history).sort()).toEqual([dateKey(10), dateKey(5), dateKey(1)].sort());
  expect(history[dateKey(1)]).toEqual({ moves: 9, elapsedMs: 61_000, hints: 0 });

  await laptop.page.getByRole("link", { name: "Play today's puzzle" }).click();
  await expect(laptop.page.locator(".game-context-strip")).toContainText("3-day streak");

  expect(phone.errors).toEqual([]);
  expect(laptop.errors).toEqual([]);
  await phone.context.close();
  await laptop.context.close();
});

test("a pasted link works, and a damaged one is rejected", async ({ browser }) => {
  const phone = await device(browser, { streak: 1, lastCompletedDateKey: dateKey(0) }, {
    [dateKey(0)]: { moves: 9, elapsedMs: 50_000, hints: 0 },
  });
  await phone.page.goto("/blocker-rush/transfer");
  await phone.page.getByRole("button", { name: "Copy link" }).click();
  const link = await phone.page.evaluate(() => navigator.clipboard.readText());

  const tablet = await device(browser, { streak: 0 }, {});
  await tablet.page.goto("/blocker-rush/transfer#p=AAAA");
  await expect(tablet.page.getByText("This transfer link is incomplete or damaged.")).toBeVisible();

  await tablet.page.getByLabel("Paste a link from another device").fill(link);
  await tablet.page.getByRole("button", { name: "Read link" }).click();
  await expect(tablet.page.getByText("1-day streak, best 1, 1 puzzle solved.").first()).toBeVisible();
  await tablet.page.getByRole("button", { name: "Add to this device" }).click();
  await expect(tablet.page.getByRole("status").filter({ hasText: "Added." })).toBeVisible();

  expect(tablet.errors).toEqual([]);
  await phone.context.close();
  await tablet.context.close();
});
