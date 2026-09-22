import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig says jsx: "preserve" because Next compiles JSX itself. Vitest
  // has no Next, so without this a test that imports a component fails
  // before it runs ("content contains invalid JS syntax").
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
