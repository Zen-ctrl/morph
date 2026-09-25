import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@morph/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@morph/encoders": fileURLToPath(
        new URL("../../packages/encoders/src/index.ts", import.meta.url),
      ),
      "@morph/tokenizer-adapters": fileURLToPath(
        new URL("../../packages/tokenizer-adapters/src/index.ts", import.meta.url),
      ),
      "@morph/toon-adapter": fileURLToPath(
        new URL("../../packages/toon-adapter/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: "127.0.0.1",
  },
  preview: {
    host: "127.0.0.1",
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
