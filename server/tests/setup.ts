/**
 * Integration Test Setup
 * 
 * This file sets up the environment for integration tests.
 */

import { vi } from 'vitest';

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/records_test';

// Mock external services that might not be available during tests
vi.mock('../../../services/validation', () => ({
  getValidationPipeline: vi.fn(),
  getValidationQueueService: vi.fn(),
  getIndividualResourceProgressService: vi.fn(),
  getValidationCancellationRetryService: vi.fn(),
  ValidationPriority: {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high'
  }
}));

vi.mock('../../../services/validation/settings/validation-settings-service-simplified', () => ({
  getValidationSettingsService: vi.fn()
}));

vi.mock('../../../utils/server-scoping', () => ({
  getActiveServerId: vi.fn(),
  getServerScopingContext: vi.fn()
}));

vi.mock('../../../services/performance/validation-performance-monitor', () => ({
  getValidationPerformanceMonitor: vi.fn()
}));

