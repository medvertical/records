/**
 * Integration Test Setup
 * 
 * This file sets up the testing environment for integration tests,
 * including mocks, utilities, and global configurations.
 */

import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Global test timeout
vi.setConfig({
  testTimeout: 30000,
  hookTimeout: 10000,
  teardownTimeout: 10000
});

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  // Suppress console output during tests unless explicitly needed
  console.log = vi.fn();
  console.warn = vi.fn();
  console.error = vi.fn();
  console.info = vi.fn();
  console.debug = vi.fn();
});

afterAll(() => {
  // Restore original console methods
  Object.assign(console, originalConsole);
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset any global state
  vi.clearAllTimers();
});

afterEach(() => {
  // Clean up after each test
  vi.restoreAllMocks();
  vi.clearAllTimers();
});

// Global test utilities
global.testUtils = {
  // Create mock validation result
  createMockValidationResult: (overrides = {}) => ({
    id: 1,
    resourceId: 'test-resource-1',
    resourceType: 'Patient',
    isValid: true,
    overallScore: 95,
    confidence: 0.9,
    completeness: 0.85,
    issues: [],
    aspects: {
      structural: {
        isValid: true,
        score: 100,
        confidence: 0.95,
        issues: [],
        validationTime: 50
      },
      profile: {
        isValid: true,
        score: 90,
        confidence: 0.85,
        issues: [],
        validationTime: 100
      },
      terminology: {
        isValid: true,
        score: 95,
        confidence: 0.9,
        issues: [],
        validationTime: 75
      },
      reference: {
        isValid: true,
        score: 100,
        confidence: 0.95,
        issues: [],
        validationTime: 60
      },
      businessRule: {
        isValid: true,
        score: 90,
        confidence: 0.8,
        issues: [],
        validationTime: 80
      },
      metadata: {
        isValid: true,
        score: 95,
        confidence: 0.9,
        issues: [],
        validationTime: 40
      }
    },
    validatedAt: new Date(),
    validationTime: 405,
    profileUrl: 'http://hl7.org/fhir/StructureDefinition/Patient',
    validationSource: 'consolidated-validation-service',
    ...overrides
  }),

  // Create mock validation settings
  createMockValidationSettings: (overrides = {}) => ({
    id: 1,
    enabledAspects: ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'],
    strictMode: false,
    batchSize: 100,
    timeoutMs: 30000,
    retryAttempts: 3,
    retryDelayMs: 1000,
    enableParallelProcessing: true,
    maxConcurrentValidations: 5,
    enablePersistence: true,
    enableCaching: true,
    cacheTimeoutMs: 300000,
    enableAuditTrail: true,
    enableRealTimeUpdates: true,
    enableQualityMetrics: true,
    enableCompletenessScoring: true,
    enableConfidenceScoring: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    ...overrides
  }),

  // Create mock FHIR resource
  createMockFhirResource: (overrides = {}) => ({
    id: 'test-resource-1',
    resourceType: 'Patient',
    name: [{ given: ['John'], family: 'Doe' }],
    birthDate: '1990-01-01',
    gender: 'male',
    ...overrides
  }),

  // Create mock validation progress
  createMockValidationProgress: (overrides = {}) => ({
    totalResources: 100,
    processedResources: 75,
    validResources: 70,
    errorResources: 3,
    warningResources: 2,
    currentResourceType: 'Patient',
    startTime: new Date(),
    estimatedTimeRemaining: 30000,
    isComplete: false,
    errors: [],
    status: 'running',
    processingRate: 2.5,
    currentBatch: {
      batchNumber: 3,
      totalBatches: 4,
      batchSize: 25,
      resourcesInBatch: 25
    },
    performance: {
      averageTimePerResource: 150,
      totalTimeMs: 11250,
      memoryUsage: 128
    },
    retryStatistics: {
      totalRetryAttempts: 5,
      successfulRetries: 4,
      failedRetries: 1,
      resourcesWithRetries: 3,
      averageRetriesPerResource: 0.05
    },
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create mock event emitter
  createMockEventEmitter: () => {
    const events: Record<string, Function[]> = {};
    
    return {
      on: (event: string, listener: Function) => {
        if (!events[event]) events[event] = [];
        events[event].push(listener);
      },
      emit: (event: string, ...args: any[]) => {
        if (events[event]) {
          events[event].forEach(listener => listener(...args));
        }
      },
      removeListener: (event: string, listener: Function) => {
        if (events[event]) {
          events[event] = events[event].filter(l => l !== listener);
        }
      },
      removeAllListeners: (event?: string) => {
        if (event) {
          delete events[event];
        } else {
          Object.keys(events).forEach(key => delete events[key]);
        }
      }
    };
  },

  // Create mock API response
  createMockApiResponse: (data: any, success = true) => ({
    success,
    data,
    timestamp: new Date().toISOString(),
    ...(success ? {} : { error: 'Mock error' })
  }),

  // Create mock error
  createMockError: (message: string, code?: string) => {
    const error = new Error(message);
    if (code) {
      (error as any).code = code;
    }
    return error;
  }
};

// Global type definitions
declare global {
  var testUtils: {
    createMockValidationResult: (overrides?: any) => any;
    createMockValidationSettings: (overrides?: any) => any;
    createMockFhirResource: (overrides?: any) => any;
    createMockValidationProgress: (overrides?: any) => any;
    waitFor: (ms: number) => Promise<void>;
    createMockEventEmitter: () => any;
    createMockApiResponse: (data: any, success?: boolean) => any;
    createMockError: (message: string, code?: string) => Error;
  };
}

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-secret';
process.env.API_BASE_URL = 'http://localhost:3000';

// Mock external dependencies
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
    clear: vi.fn(),
    mount: vi.fn(),
    unmount: vi.fn()
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn()
}));

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: vi.fn(),
  useLocation: vi.fn(),
  useParams: vi.fn()
}));

vi.mock('@testing-library/react', () => ({
  render: vi.fn(),
  screen: {
    getByTestId: vi.fn(),
    getByText: vi.fn(),
    getByRole: vi.fn(),
    queryByTestId: vi.fn(),
    queryByText: vi.fn(),
    queryByRole: vi.fn(),
    getAllByTestId: vi.fn(),
    getAllByText: vi.fn(),
    getAllByRole: vi.fn()
  },
  fireEvent: {
    click: vi.fn(),
    change: vi.fn(),
    submit: vi.fn(),
    keyDown: vi.fn(),
    keyUp: vi.fn()
  },
  waitFor: vi.fn(),
  act: vi.fn()
}));

// Performance monitoring
let testStartTime: number;
let testEndTime: number;

beforeEach(() => {
  testStartTime = performance.now();
});

afterEach(() => {
  testEndTime = performance.now();
  const testDuration = testEndTime - testStartTime;
  
  // Log slow tests (over 5 seconds)
  if (testDuration > 5000) {
    console.warn(`Slow test detected: ${testDuration.toFixed(2)}ms`);
  }
});

// Memory monitoring
let initialMemoryUsage: NodeJS.MemoryUsage;

beforeAll(() => {
  initialMemoryUsage = process.memoryUsage();
});

afterAll(() => {
  const finalMemoryUsage = process.memoryUsage();
  const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
  
  // Log significant memory increases (over 50MB)
  if (memoryIncrease > 50 * 1024 * 1024) {
    console.warn(`Significant memory increase detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  }
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Global test helpers
export const integrationTestHelpers = {
  // Create test database connection
  createTestDatabase: () => {
    // Mock database connection for tests
    return {
      query: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn()
    };
  },

  // Create test HTTP server
  createTestServer: () => {
    // Mock HTTP server for tests
    return {
      listen: vi.fn(),
      close: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
    };
  },

  // Create test cache
  createTestCache: () => {
    // Mock cache for tests
    const cache = new Map();
    return {
      get: vi.fn((key: string) => cache.get(key)),
      set: vi.fn((key: string, value: any) => cache.set(key, value)),
      delete: vi.fn((key: string) => cache.delete(key)),
      clear: vi.fn(() => cache.clear()),
      has: vi.fn((key: string) => cache.has(key))
    };
  }
};
