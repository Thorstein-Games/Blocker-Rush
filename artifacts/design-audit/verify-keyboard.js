async (originalPage) => {
  const isolated = await originalPage
    .context()
    .browser()
    .newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    });
  const page = await isolated.newPage();
  try {
    const report = [];
    await page.goto("http://localhost:3000/");
    await page
      .getByRole("button", { name: "Select Dot", exact: true })
      .waitFor();
    const state = await page.evaluate(() => ({
      blockers: [...document.querySelectorAll(".board-cell.blocker")].map(
        (el) => Number(el.dataset.index),
      ),
      pieces: [...document.querySelectorAll(".piece-slot")].map((el) => ({
        name: el.getAttribute("aria-label"),
        cells: [...el.querySelectorAll(".piece-cell")].map((c) => ({
          x: Number(c.style.gridColumnStart) - 1,
          y: Number(c.style.gridRowStart) - 1,
        })),
      })),
    }));
    const normalize = (cells) => {
      const minX = Math.min(...cells.map((c) => c.x)),
        minY = Math.min(...cells.map((c) => c.y));
      return cells
        .map((c) => ({ x: c.x - minX, y: c.y - minY }))
        .sort((a, b) => a.y - b.y || a.x - b.x);
    };
    const blockers = state.blockers.reduce(
        (mask, i) => mask | (1n << BigInt(i)),
        0n,
      ),
      all = (1n << 36n) - 1n;
    const candidates = [];
    state.pieces.forEach((piece, pieceIndex) => {
      const seen = new Set();
      for (const flipped of [false, true])
        for (let turns = 0; turns < 4; turns++) {
          let cells = piece.cells.map((c) => ({
            x: flipped ? -c.x : c.x,
            y: c.y,
          }));
          for (let i = 0; i < turns * 3; i++)
            cells = cells.map((c) => ({ x: c.y, y: -c.x }));
          cells = normalize(cells);
          const key = JSON.stringify(cells);
          if (seen.has(key)) continue;
          seen.add(key);
          for (let y = 0; y < 6 - Math.max(...cells.map((c) => c.y)); y++)
            for (let x = 0; x < 6 - Math.max(...cells.map((c) => c.x)); x++) {
              const indices = cells.map((c) => (y + c.y) * 6 + x + c.x),
                mask = indices.reduce((m, i) => m | (1n << BigInt(i)), 0n);
              if (!(mask & blockers))
                candidates.push({
                  pieceIndex,
                  name: piece.name,
                  flipped,
                  turns,
                  x,
                  y,
                  mask,
                  indices,
                });
            }
        }
    });
    const visit = (occupied, used, path) => {
      if (occupied === all) return path;
      let options = null;
      for (let i = 0; i < 36; i++)
        if (!(occupied & (1n << BigInt(i)))) {
          const fits = candidates.filter(
            (c) =>
              c.indices.includes(i) &&
              !(used & (1 << c.pieceIndex)) &&
              !(c.mask & occupied),
          );
          if (fits.length === 0) return null;
          if (options === null || fits.length < options.length) options = fits;
        }
      for (const c of options) {
        const found = visit(occupied | c.mask, used | (1 << c.pieceIndex), [
          ...path,
          c,
        ]);
        if (found) return found;
      }
      return null;
    };
    const solution = visit(blockers, 0, []);
    if (!solution) throw new Error("No solution");
    for (const c of solution) {
      let reached = false;
      for (let i = 0; i < 30; i++) {
        if (
          await page.evaluate(
            (name) =>
              document.activeElement?.getAttribute("aria-label") === name,
            c.name,
          )
        ) {
          reached = true;
          break;
        }
        await page.keyboard.press("Tab");
      }
      if (!reached) throw new Error("Tab could not reach " + c.name);
      await page.keyboard.press("Enter");
      if (c.flipped) await page.keyboard.press("f");
      for (let i = 0; i < c.turns; i++) await page.keyboard.press("d");
      await page.keyboard.press("Home");
      for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowUp");
      for (let i = 0; i < c.x; i++) await page.keyboard.press("ArrowRight");
      for (let i = 0; i < c.y; i++) await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      report.push({
        piece: c.name,
        placed: await page.locator(".board-cell.piece").count(),
        status: await page.locator(".board-feedback").innerText(),
      });
    }
    const completed = (await page.locator(".celebration").count()) === 1;
    const staticCelebration = await page
      .locator(".celebration")
      .evaluate((el) => getComputedStyle(el).animationName === "none");
    const fireworksUntouched = await page
      .locator(".celebration-fireworks")
      .evaluate((el) => el.width === 300 && el.height === 150);
    await page.screenshot({
      path: "output/playwright/design-fixes/keyboard-solved-reduced-motion.png",
      fullPage: true,
    });
    const dialogs = [];
    for (const name of ["Open settings", "Open how to play", "Open stats"]) {
      const trigger = page.getByRole("button", { name, exact: true });
      await trigger.click();
      let inside = true;
      for (const key of [
        "Tab",
        "Tab",
        "Tab",
        "Shift+Tab",
        "Shift+Tab",
        "Tab",
        "Tab",
      ]) {
        await page.keyboard.press(key);
        inside =
          inside &&
          (await page.evaluate(
            () => !!document.activeElement?.closest("dialog[open]"),
          ));
      }
      await page.keyboard.press("Escape");
      dialogs.push({
        name,
        contained: inside,
        restored: await trigger.evaluate((el) => el === document.activeElement),
      });
    }
    return {
      report,
      completed,
      staticCelebration,
      fireworksUntouched,
      dialogs,
    };
  } finally {
    await isolated.close();
  }
}
