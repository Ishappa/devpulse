import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // E2E specs live in tests/e2e and are run by Playwright, not Vitest.
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/*Slice.ts', 'src/schemas/**'],
      thresholds: {
        // The pure core (scoring, schemas, slices) must stay well covered.
        'src/lib/scoring.ts': { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // `server-only` is a Next runtime guard with no Vitest equivalent — stub it.
      'server-only': resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
