import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Multiplayer specs need a real megingjord server. Defaults to a sibling
// checkout (../megingjord next to this repo); override with MEGINGJORD_DIR.
// Both servers are started automatically, or reused if already running.
const megingjordDir =
  process.env.MEGINGJORD_DIR ?? resolve(__dirname, "../../../megingjord");

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev",
      cwd: megingjordDir,
      url: "http://localhost:2567/health",
      timeout: 60_000,
      reuseExistingServer: true,
      // Megingjord's per-IP matchmake rate limit (default 15 req/10s,
      // src/config.ts) exists to stop scripted room-creation spam in
      // production. Every simulated player here shares the same loopback
      // IP, so a handful of tests blows through it — matchmake calls
      // (create/join/joinById) then reject client-side with no visible
      // error, which looks like a UI bug but is actually the guard doing
      // its job. Loosen it only for this local test server.
      env: { MATCHMAKE_RATE_MAX: "1000" },
    },
    {
      command: "npx next dev -p 3000",
      cwd: __dirname,
      url: "http://localhost:3000",
      timeout: 60_000,
      reuseExistingServer: true,
    },
  ],
});
