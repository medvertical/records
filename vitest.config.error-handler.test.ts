import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    include: ['server/utils/validation-error-handler.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**']
  }
});

