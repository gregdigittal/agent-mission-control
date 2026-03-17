import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // stores don't need DOM; use jsdom only when testing components
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'api/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/stores/**', 'src/hooks/**', 'src/lib/**'],
      thresholds: { lines: 70 },
    },
  },
});
