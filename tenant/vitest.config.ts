import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest lives in its own config so vite-plugin-pwa / compression types
 * (which target vite 6) don't collide with vitest 2's pinned vite 5 types.
 * Real production build still uses ./vite.config.ts.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/unit/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.legacy', 'tests/e2e/**'],
  },
});
