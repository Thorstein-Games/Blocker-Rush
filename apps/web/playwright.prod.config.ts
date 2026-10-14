import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Specs that need a production build (*.prod.spec.ts), e.g. the service
// worker, which only registers in production. Builds the static export and
// serves it like GitHub Pages does on :3300, so it doesn't collide with the
// dev server the main suite uses.
export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: "**/*.prod.spec.ts",
  timeout: 60_000,
  use: { ...base.use, baseURL: "http://localhost:3300" },
  webServer: {
    command: "npx next build && node scripts/serve-pages.mjs 3300",
    url: "http://localhost:3300/blocker-rush/",
    timeout: 300_000,
    reuseExistingServer: true,
  },
});
