import { defineConfig } from 'vitest/config';

// Browser E2E specs belong to Playwright, not the fast Vitest unit suite.
export default defineConfig({
  test: { include: ['src/logic/__tests__/**/*.test.ts'] },
});
