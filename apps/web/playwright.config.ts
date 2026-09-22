import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
      cwd: "/Users/ryan/Github/megingjord",
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
