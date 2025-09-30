import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/.{idea,git,cache,output,temp}',
        // Exclude test files themselves
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        // Exclude setup and config
        '**/test/**',
        '**/tests/**',
        'client/src/test/**',
      ],
      include: [
        'server/**/*.{ts,tsx}',
        'client/src/**/*.{ts,tsx}',
        'shared/**/*.{ts,tsx}',
      ],
      // Coverage thresholds
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
      // Per-file thresholds for critical modules
      perFile: true,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});
