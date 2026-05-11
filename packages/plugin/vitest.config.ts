import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['server/src/**/*.test.ts', 'admin/src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['server/src/**/*', 'admin/src/**/*'],
    },
  },
});
