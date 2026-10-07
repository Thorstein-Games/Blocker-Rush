import { test, expect, type Page } from "@playwright/test";

// End-to-end coverage for the Megingjord-backed multiplayer transport
// (useMultiplayerSocket.ts). This exercises the real Colyseus wiring —
// lobby connection, public joinOrCreate matching, private room creation +
// roomCode resolution + joinById, the client_ready handshake, ready/start,
// the countdown -> in_game transition, host-initiated kick, and
// name-based reconnection on reload — against a live Megingjord server
// (see playwright.config.ts webServer entries). It intentionally does not
// test piece placement (drag-and-drop board interaction), which is
// unchanged shared game UI, not part of this transport migration.

const roomCodeOf = (page: Page) => page.locator(".room-code-button");
const statusValue = (page: Page) =>
  page.locator(".stat-card", { hasText: "Status" }).locator(".stat-value");

test.describe("Blocker Rush multiplayer (Megingjord transport)", () => {
  test("public quick match seats two players in the same room", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await pageA.goto("/blocker-rush/multiplayer");
    await pageA.getByRole("button", { name: "Join Public Matchmaking" }).click();
    await expect(roomCodeOf(pageA)).not.toHaveText("", { timeout: 10_000 });
    const codeA = await roomCodeOf(pageA).innerText();

    await pageB.goto("/blocker-rush/multiplayer");
    await pageB.getByRole("button", { name: "Join Public Matchmaking" }).click();
    await expect(roomCodeOf(pageB)).not.toHaveText("", { timeout: 10_000 });
    const codeB = await roomCodeOf(pageB).innerText();

    expect(codeB).toBe(codeA);
    await expect(pageA.locator(".multiplayer-room-list .room-row")).toHaveCount(2);
    await expect(pageB.locator(".multiplayer-room-list .room-row")).toHaveCount(2);

    await contextA.close();
    await contextB.close();
  });

  test("private room: create, join by code, ready up, start, reach in_game", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto("/blocker-rush/multiplayer");
    await hostPage.getByRole("button", { name: "Create Private Room" }).click();
    await expect(roomCodeOf(hostPage)).not.toHaveText("", { timeout: 10_000 });
    const roomCode = await roomCodeOf(hostPage).innerText();
    expect(roomCode.length).toBeGreaterThan(0);

    await guestPage.goto("/blocker-rush/multiplayer");
    await guestPage.locator("#room-code").fill(roomCode);
    await guestPage.getByRole("button", { name: "Join by Code" }).click();
    await expect(roomCodeOf(guestPage)).toHaveText(roomCode, { timeout: 10_000 });

    await expect(hostPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });
    await expect(guestPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });

    await hostPage.getByRole("button", { name: "Ready", exact: true }).click();
    await guestPage.getByRole("button", { name: "Ready", exact: true }).click();

    const startButton = hostPage.getByRole("button", { name: "Start Match" });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 3s server-side countdown + network/render slack
    await expect(statusValue(hostPage)).toHaveText("in_game", { timeout: 10_000 });
    await expect(statusValue(guestPage)).toHaveText("in_game", { timeout: 10_000 });

    await hostContext.close();
    await guestContext.close();
  });

  test("host kicking a player removes them and returns them to the lobby landing view", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto("/blocker-rush/multiplayer");
    await hostPage.getByRole("button", { name: "Create Private Room" }).click();
    await expect(roomCodeOf(hostPage)).not.toHaveText("", { timeout: 10_000 });
    const roomCode = await roomCodeOf(hostPage).innerText();

    await guestPage.goto("/blocker-rush/multiplayer");
    await guestPage.locator("#room-code").fill(roomCode);
    await guestPage.getByRole("button", { name: "Join by Code" }).click();
    await expect(roomCodeOf(guestPage)).toHaveText(roomCode, { timeout: 10_000 });
    await expect(hostPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });

    await hostPage.getByRole("button", { name: "Kick", exact: true }).click();

    await expect(guestPage.getByRole("button", { name: "Join Public Matchmaking" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(hostPage.locator(".multiplayer-room-list .room-row")).toHaveCount(1, {
      timeout: 10_000,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test("reloading with the room URL rejoins the same room via name-based reconnection", async ({
    browser,
  }) => {
    // Exercises Megingjord's server-driven reconnection (match by player name),
    // which this migration relies on instead of Blocker-Rush's old
    // resumeToken/localStorage scheme. A same-context reload keeps the
    // persisted "multiplayer-player-name", so the client's roomCodeFromUrl
    // auto-join (MultiplayerLobbyLanding) should rejoin as the same player
    // rather than seat a third participant.
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto("/blocker-rush/multiplayer");
    await hostPage.getByRole("button", { name: "Create Private Room" }).click();
    await expect(roomCodeOf(hostPage)).not.toHaveText("", { timeout: 10_000 });
    const roomCode = await roomCodeOf(hostPage).innerText();

    await guestPage.goto("/blocker-rush/multiplayer");
    await guestPage.locator("#room-code").fill(roomCode);
    await guestPage.getByRole("button", { name: "Join by Code" }).click();
    await expect(roomCodeOf(guestPage)).toHaveText(roomCode, { timeout: 10_000 });
    await expect(hostPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });

    await guestPage.reload();

    await expect(roomCodeOf(guestPage)).toHaveText(roomCode, { timeout: 10_000 });
    await expect(hostPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });
    await expect(guestPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });

    await hostContext.close();
    await guestContext.close();
  });

  test("leaveRoom returns to the lobby landing view", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/blocker-rush/multiplayer");
    await page.getByRole("button", { name: "Create Private Room" }).click();
    await expect(roomCodeOf(page)).not.toHaveText("", { timeout: 10_000 });

    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByRole("button", { name: "Return to Lobby" }).click();
    await expect(page.getByRole("button", { name: "Join Public Matchmaking" })).toBeVisible({
      timeout: 10_000,
    });

    await context.close();
  });

  test("lobby page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/blocker-rush/multiplayer");
    await expect(page.getByRole("button", { name: "Join Public Matchmaking" })).toBeEnabled({
      timeout: 10_000,
    });
    expect(errors).toEqual([]);
  });

  test("Share Room Link copies a /blocker-rush invite that joins the room", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    // Force the clipboard path instead of the native share sheet.
    await hostContext.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined });
    });
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    await hostPage.goto("/blocker-rush/multiplayer");
    await hostPage.getByRole("button", { name: "Create Private Room" }).click();
    await expect(roomCodeOf(hostPage)).not.toHaveText("", { timeout: 10_000 });
    const roomCode = await roomCodeOf(hostPage).innerText();

    await hostPage.getByRole("button", { name: "Share Room Link" }).click();
    await expect(hostPage.getByText("Room link copied.")).toBeVisible();
    const invite = await hostPage.evaluate(() => navigator.clipboard.readText());
    expect(new URL(invite).pathname).toBe("/blocker-rush/multiplayer");
    expect(new URL(invite).searchParams.get("room")).toBe(roomCode);

    // Opening the invite auto-joins the room.
    await guestPage.goto(invite);
    await expect(roomCodeOf(guestPage)).toHaveText(roomCode, { timeout: 10_000 });
    await expect(hostPage.locator(".multiplayer-room-list .room-row")).toHaveCount(2, {
      timeout: 10_000,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
