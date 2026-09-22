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
