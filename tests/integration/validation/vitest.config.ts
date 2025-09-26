/**
 * Vitest Configuration for Integration Tests
 * 
 * This configuration is specifically for integration tests that cover
 * the complete validation workflow from settings to UI.
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'validation-integration',
    environment: 'node',
    globals: true,
    setupFiles: ['./setup.ts'],
    include: ['**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        '**/*.ts',
        '!**/*.test.ts',
        '!**/*.config.ts',
        '!**/node_modules/**'
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    maxConcurrency: 5,
    minThreads: 1,
    maxThreads: 4,
    isolate: true,
    passWithNoTests: true,
    logHeapUsage: true,
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './coverage/integration-results.json',
      html: './coverage/integration-report.html'
    }
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../../shared'),
      '@server': resolve(__dirname, '../../server'),
      '@client': resolve(__dirname, '../../client/src')
    }
  }
});
