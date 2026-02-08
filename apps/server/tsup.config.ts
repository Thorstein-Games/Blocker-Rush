import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  clean: true,
  noExternal: ["@blocker-rush/protocol", "@blocker-rush/shared"], // Only bundle workspace packages
});
