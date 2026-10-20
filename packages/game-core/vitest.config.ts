import { defineConfig } from 'vitest/config';

// SCOPE.md section 13.1: game rules need 90%+ coverage, so CI fails below that.
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
