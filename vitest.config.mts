import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Next keeps JSX for SWC; tests must compile it before Vite import analysis.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/types/**', 'src/engine/test-simulator.ts'],
      reporter: ['text', 'html', 'json-summary'],
    },
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
