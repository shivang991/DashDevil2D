import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    include: [
      "tests/preservation/**/*.test.tsx",
      "tests/simulation/**/*.test.ts",
      "tests/session/**/*.test.ts",
    ],
  },
});
