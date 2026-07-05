import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "core/**/*.test.ts",
      "intake/**/*.test.ts",
      "pipeline/**/*.test.ts",
      "rules/**/*.test.ts",
      "plan/**/*.test.ts",
      "loop/**/*.test.ts",
      "cli/**/*.test.ts",
      "templates/site/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: ["node_modules/**", "clients/**"],
  },
});
