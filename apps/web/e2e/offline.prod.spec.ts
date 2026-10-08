import { spawn, type ChildProcess } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

// Runs against a production build (playwright.prod.config.ts): the service
// worker only registers in production.
//
// "Offline" here means the server is gone: Playwright's setOffline doesn't
// stop a service worker's own fetches in Chromium, so this test starts a
// second server on the same build and kills it.

const PORT = 3301;
const ORIGIN = `http://localhost:${PORT}`;

const startServer = async (): Promise<ChildProcess> => {
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd().endsWith("web") ? process.cwd() : "apps/web",
    stdio: "ignore",
    detached: true,
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(`${ORIGIN}/blocker-rush`)).ok) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("next start didn't come up");
};

const stopServer = async (server: ChildProcess) => {
  // Kill the whole group: npx → next → its worker.
  process.kill(-server.pid!, "SIGKILL");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await fetch(`${ORIGIN}/blocker-rush`);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("server still answering");
};

const waitForServiceWorker = async (page: Page) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Install precaches before activating, and activation claims the page.
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
};

test("the game works offline after one visit", async ({ browser }) => {
  const server = await startServer();
  const context = await browser.newContext({ baseURL: ORIGIN });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/blocker-rush");
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
    await waitForServiceWorker(page);

    await stopServer(server);

    // Precached pages load and play without the network.
    await page.reload();
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);
    await page.getByRole("button", { name: "Hint", exact: true }).click();
    await page.keyboard.press("Enter");
    await expect(page.locator(".board-cell.piece").first()).toBeVisible();

    await page.goto("/blocker-rush/casual?p=A2A4D1D2F4F5F6");
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);

    await page.goto("/blocker-rush/daily");
    await expect(page.locator(".archive-day").first()).toBeVisible();

    // A page never opened online gets the offline page, linking home.
    const response = await page.goto("/blocker-rush/daily/2026-03-01");
    expect(response?.status()).toBe(503);
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await page.getByRole("link", { name: "Play the daily puzzle" }).click();
    await expect(page.locator(".board-cell.blocker")).toHaveCount(7);

    expect(errors).toEqual([]);
  } finally {
    await context.close();
    try {
      process.kill(-server.pid!, "SIGKILL");
    } catch {
      // Already stopped.
    }
  }
});

test("the manifest has installable PNG icons", async ({ request }) => {
  const manifest = await (await request.get("/blocker-rush/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({
    start_url: "/blocker-rush/",
    scope: "/blocker-rush/",
    display: "standalone",
  });
  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons.find(
      (item: { sizes: string; purpose?: string }) => item.sizes === size && !item.purpose,
    );
    expect(icon, size).toBeDefined();
    const response = await request.get(icon.src);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  expect(manifest.icons.some((item: { purpose?: string }) => item.purpose === "maskable")).toBe(true);

  const sw = await request.get("/blocker-rush/sw.js");
  expect(sw.headers()["service-worker-allowed"]).toBe("/blocker-rush");
});
