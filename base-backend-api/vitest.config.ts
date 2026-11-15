import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite migrations + scrypt are slow when test files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

