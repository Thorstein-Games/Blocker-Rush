import { defineConfig } from "vitest/config";

// Unit tests only; Playwright specs in e2e/ run via `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
});
