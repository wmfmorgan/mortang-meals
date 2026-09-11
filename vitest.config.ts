import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    setupFiles: ["src/lib/test-setup.ts"],
    testTimeout: 15000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
