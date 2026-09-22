import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@morph/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@morph/encoders": fileURLToPath(
        new URL("./packages/encoders/src/index.ts", import.meta.url),
      ),
      "@morph/evaluation": fileURLToPath(
        new URL("./packages/evaluation/src/index.ts", import.meta.url),
      ),
      "@morph/jev-planner": fileURLToPath(
        new URL("./packages/jev-planner/src/index.ts", import.meta.url),
      ),
      "@morph/schema-registry": fileURLToPath(
        new URL("./packages/schema-registry/src/index.ts", import.meta.url),
      ),
      "@morph/sdk": fileURLToPath(new URL("./packages/sdk/src/index.ts", import.meta.url)),
      "@morph/tokenizer-adapters": fileURLToPath(
        new URL("./packages/tokenizer-adapters/src/index.ts", import.meta.url),
      ),
      "@morph/toon-adapter": fileURLToPath(
        new URL("./packages/toon-adapter/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts", "apps/**/*.test.ts?(x)"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["packages/*/src/**/*.ts"],
      exclude: ["packages/cli/src/**", "**/*.d.ts"],
    },
  },
});
