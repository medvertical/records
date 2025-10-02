/**
 * Unit tests for Validation State Persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ValidationStatePersistence,
  createValidationStatePersistence,
  isLocalStorageAvailable,
  getLocalStorageInfo,
  type StoredValidationState,
  type PersistenceResult
} from './validation-state-persistence';
import { type BackendValidationProgress } from './validation-status-mapper';

// Mock localStorage
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    })
  };
};

const localStorageMock = createLocalStorageMock();

// Mock navigator and window
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser)'
  }
});

Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test'
  }
});

describe('ValidationStatePersistence', () => {
  let persistence: ValidationStatePersistence;

  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    // Clear any intervals
    vi.clearAllTimers();
    persistence = new ValidationStatePersistence(1);
  });

  afterEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  describe('Basic Functionality', () => {
    it('should create persistence manager with server ID', () => {
      const persistence = new ValidationStatePersistence(123);
      expect(persistence).toBeInstanceOf(ValidationStatePersistence);
    });

    it('should create persistence manager without server ID', () => {
      const persistence = new ValidationStatePersistence();
      expect(persistence).toBeInstanceOf(ValidationStatePersistence);
    });

    it('should generate unique session IDs', () => {
      const persistence1 = new ValidationStatePersistence();
      const persistence2 = new ValidationStatePersistence();
      
      // Session IDs should be different
      expect(persistence1['sessionId']).not.toBe(persistence2['sessionId']);
    });
  });

  describe('State Saving', () => {
    it('should save idle state successfully', async () => {
      const result = await persistence.saveState('idle');
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      
      // Check that data was saved to localStorage
      const savedData = localStorageMock.getItem('validation_state');
      expect(savedData).toBeTruthy();
      
      const parsed = JSON.parse(savedData!);
      expect(parsed.state).toBe('idle');
      expect(parsed.serverId).toBe(1);
      expect(parsed.sessionId).toBeTruthy();
    });

    it('should save running state with progress', async () => {
      const progress: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 25,
        validResources: 20,
        errorResources: 5,
        processingRate: 10
      };

      const result = await persistence.saveState('running', progress);
      
      expect(result.success).toBe(true);
      
      // Check state was saved
      const savedState = localStorageMock.getItem('validation_state');
      expect(savedState).toBeTruthy();
      
      const parsedState = JSON.parse(savedState!);
      expect(parsedState.state).toBe('running');
      
      // Check progress was saved
      const savedProgress = localStorageMock.getItem('validation_progress');
      expect(savedProgress).toBeTruthy();
      
      const parsedProgress = JSON.parse(savedProgress!);
      expect(parsedProgress.totalResources).toBe(100);
      expect(parsedProgress.processedResources).toBe(25);
    });

    it('should save all validation states', async () => {
      const states = ['idle', 'running', 'paused', 'completed', 'error'] as const;
      
      for (const state of states) {
        const result = await persistence.saveState(state);
        expect(result.success).toBe(true);
        
        const savedData = localStorageMock.getItem('validation_state');
        const parsed = JSON.parse(savedData!);
        expect(parsed.state).toBe(state);
      }
    });

    it('should include metadata in saved state', async () => {
      const result = await persistence.saveState('running');
      
      expect(result.success).toBe(true);
      
      const savedData = localStorageMock.getItem('validation_state');
      const parsed = JSON.parse(savedData!);
      
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(parsed.metadata.url).toBe('http://localhost:3000/test');
      expect(parsed.metadata.version).toBe('1.0.0');
    });
  });

  describe('State Restoration', () => {
    it('should restore idle state when no stored state exists', async () => {
      const result = await persistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should restore saved state successfully', async () => {
      // Save a state first
      await persistence.saveState('running');
      
      // Create new persistence instance to simulate page reload
      const newPersistence = new ValidationStatePersistence(1);
      const result = await newPersistence.restoreState();
      
      expect(result.state).toBe('running');
      expect(result.restored).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should restore state with progress', async () => {
      const progress: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 40,
        errorResources: 10,
        processingRate: 5
      };

      // Save state with progress
      await persistence.saveState('running', progress);
      
      // Create new persistence instance
      const newPersistence = new ValidationStatePersistence(1);
      const result = await newPersistence.restoreState();
      
      expect(result.state).toBe('running');
      expect(result.restored).toBe(true);
      expect(result.progress).toBeDefined();
      expect(result.progress!.totalResources).toBe(100);
      expect(result.progress!.processedResources).toBe(50);
    });

    it('should handle server ID mismatch', async () => {
      // Save state with server ID 1
      await persistence.saveState('running');
      
      // Try to restore with different server ID
      const newPersistence = new ValidationStatePersistence(2);
      const result = await newPersistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Server ID mismatch');
    });

    it('should handle expired state', async () => {
      // Save state with old timestamp
      const oldState: StoredValidationState = {
        state: 'running',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        serverId: 1,
        sessionId: 'test-session',
        metadata: {
          userAgent: 'test',
          url: 'test',
          version: '1.0.0'
        }
      };
      
      localStorageMock.setItem('validation_state', JSON.stringify(oldState));
      
      const result = await persistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Stored state expired');
    });

    it('should handle invalid stored state', async () => {
      // Save invalid state
      localStorageMock.setItem('validation_state', 'invalid-json');
      
      const result = await persistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Invalid stored state data');
    });
  });

  describe('State Clearing', () => {
    it('should clear all stored state', async () => {
      // Save some state
      await persistence.saveState('running');
      
      // Verify it's saved
      expect(localStorageMock.getItem('validation_state')).toBeTruthy();
      
      // Clear state
      const result = await persistence.clearStoredState();
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(true);
      
      // Verify it's cleared
      expect(localStorageMock.getItem('validation_state')).toBeNull();
      expect(localStorageMock.getItem('validation_progress')).toBeNull();
      expect(localStorageMock.getItem('validation_timestamp')).toBeNull();
    });

    it('should handle clear errors gracefully', async () => {
      // Mock localStorage to throw error
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = await persistence.clearStoredState();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });
  });

  describe('Server ID Management', () => {
    it('should update server ID successfully', async () => {
      const result = await persistence.updateServerId(2);
      
      expect(result.success).toBe(true);
      expect(persistence['serverId']).toBe(2);
    });

    it('should clear state when server ID changes', async () => {
      // Save state with server ID 1
      await persistence.saveState('running');
      expect(localStorageMock.getItem('validation_state')).toBeTruthy();
      
      // Update to different server ID
      const result = await persistence.updateServerId(2);
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBe(true);
      expect(localStorageMock.getItem('validation_state')).toBeNull();
    });

    it('should not clear state when server ID is the same', async () => {
      // Save state
      await persistence.saveState('running');
      expect(localStorageMock.getItem('validation_state')).toBeTruthy();
      
      // Update to same server ID
      const result = await persistence.updateServerId(1);
      
      expect(result.success).toBe(true);
      expect(result.cleaned).toBeUndefined();
      expect(localStorageMock.getItem('validation_state')).toBeTruthy();
    });
  });

  describe('State Machine Integration', () => {
    it('should provide access to state machine', () => {
      const stateMachine = persistence.getStateMachine();
      expect(stateMachine).toBeDefined();
      expect(stateMachine.currentState).toBe('idle');
    });

    it('should sync state machine when restoring state', async () => {
      // Save running state
      await persistence.saveState('running');
      
      // Create new persistence instance
      const newPersistence = new ValidationStatePersistence(1);
      await newPersistence.restoreState();
      
      // Check that state machine is synced
      const stateMachine = newPersistence.getStateMachine();
      expect(stateMachine.currentState).toBe('running');
    });
  });

  describe('State Validation', () => {
    it('should check if stored state exists', async () => {
      // Initially no state
      expect(await persistence.hasStoredState()).toBe(false);
      
      // Save state
      await persistence.saveState('running');
      
      // Should have state
      expect(await persistence.hasStoredState()).toBe(true);
    });

    it('should return false for expired state', async () => {
      // Save expired state
      const oldState: StoredValidationState = {
        state: 'running',
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        serverId: 1,
        sessionId: 'test-session',
        metadata: {
          userAgent: 'test',
          url: 'test',
          version: '1.0.0'
        }
      };
      
      localStorageMock.setItem('validation_state', JSON.stringify(oldState));
      
      expect(await persistence.hasStoredState()).toBe(false);
    });

    it('should get stored state metadata', async () => {
      // Save state
      await persistence.saveState('running');
      
      const metadata = await persistence.getStoredStateMetadata();
      
      expect(metadata).toBeDefined();
      expect(metadata!.timestamp).toBeDefined();
      expect(metadata!.serverId).toBe(1);
      expect(metadata!.sessionId).toBeTruthy();
      expect(metadata!.age).toBeDefined();
    });

    it('should return null metadata when no state exists', async () => {
      const metadata = await persistence.getStoredStateMetadata();
      expect(metadata).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors during save', async () => {
      // Create a new persistence instance to avoid interference
      const testPersistence = new ValidationStatePersistence(1);
      
      // Mock localStorage to throw error
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const result = await testPersistence.saveState('running');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage quota exceeded');
    });

    it('should handle localStorage errors during restore', async () => {
      // Create a new persistence instance to avoid interference
      const testPersistence = new ValidationStatePersistence(1);
      
      // Mock localStorage to throw error
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });
      
      const result = await testPersistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle invalid JSON in localStorage', async () => {
      // Create a new persistence instance to avoid interference
      const testPersistence = new ValidationStatePersistence(1);
      
      // Save invalid JSON
      localStorageMock.setItem('validation_state', 'invalid-json{');
      
      const result = await testPersistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Invalid stored state data');
    });
  });

  describe('Data Validation', () => {
    it('should reject invalid state values', async () => {
      // Create a new persistence instance to avoid interference
      const testPersistence = new ValidationStatePersistence(1);
      
      const invalidState = {
        state: 'invalid_state',
        timestamp: Date.now(),
        serverId: 1,
        sessionId: 'test-session'
      };
      
      localStorageMock.setItem('validation_state', JSON.stringify(invalidState));
      
      const result = await testPersistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Invalid stored state data');
    });

    it('should reject missing required fields', async () => {
      // Create a new persistence instance to avoid interference
      const testPersistence = new ValidationStatePersistence(1);
      
      const incompleteState = {
        state: 'running'
        // Missing timestamp, sessionId, etc.
      };
      
      localStorageMock.setItem('validation_state', JSON.stringify(incompleteState));
      
      const result = await testPersistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Invalid stored state data');
    });

    it('should reject invalid timestamp', async () => {
      // Create a new persistence instance to avoid interference
      const testPersistence = new ValidationStatePersistence(1);
      
      const invalidTimestampState = {
        state: 'running',
        timestamp: -1, // Invalid timestamp
        serverId: 1,
        sessionId: 'test-session'
      };
      
      localStorageMock.setItem('validation_state', JSON.stringify(invalidTimestampState));
      
      const result = await testPersistence.restoreState();
      
      expect(result.state).toBe('idle');
      expect(result.restored).toBe(false);
      expect(result.error).toBe('Invalid stored state data');
    });
  });
});

describe('Factory Functions', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('should create validation state persistence', () => {
    const persistence = createValidationStatePersistence(123);
    expect(persistence).toBeInstanceOf(ValidationStatePersistence);
  });

  it('should create persistence without server ID', () => {
    const persistence = createValidationStatePersistence();
    expect(persistence).toBeInstanceOf(ValidationStatePersistence);
  });
});

describe('Utility Functions', () => {
  it('should detect localStorage availability', () => {
    const available = isLocalStorageAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should get localStorage info', () => {
    const info = getLocalStorageInfo();
    
    expect(info).toHaveProperty('available');
    expect(info).toHaveProperty('used');
    expect(typeof info.available).toBe('boolean');
    expect(typeof info.used).toBe('number');
  });

  it('should handle localStorage unavailability', () => {
    // Mock localStorage to be unavailable
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      writable: true
    });
    
    const available = isLocalStorageAvailable();
    expect(available).toBe(false);
    
    const info = getLocalStorageInfo();
    expect(info.available).toBe(false);
    expect(info.used).toBe(0);
    
    // Restore original localStorage
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
  });
});

describe('Integration Tests', () => {
  let persistence: ValidationStatePersistence;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllTimers();
    persistence = new ValidationStatePersistence(1);
  });

  afterEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should handle complete save-restore cycle', async () => {
    const progress: BackendValidationProgress = {
      isRunning: true,
      isPaused: false,
      shouldStop: false,
      totalResources: 100,
      processedResources: 25,
      validResources: 20,
      errorResources: 5,
      processingRate: 10
    };

    // Save state
    const saveResult = await persistence.saveState('running', progress);
    expect(saveResult.success).toBe(true);

    // Create new persistence instance (simulate page reload)
    const newPersistence = new ValidationStatePersistence(1);
    
    // Restore state
    const restoreResult = await newPersistence.restoreState();
    expect(restoreResult.state).toBe('running');
    expect(restoreResult.restored).toBe(true);
    expect(restoreResult.progress).toBeDefined();
    expect(restoreResult.progress!.totalResources).toBe(100);

    // Check state machine is synced
    const stateMachine = newPersistence.getStateMachine();
    expect(stateMachine.currentState).toBe('running');
  });

  it('should handle server change scenario', async () => {
    // Save state for server 1
    await persistence.saveState('running');
    expect(await persistence.hasStoredState()).toBe(true);

    // Change to server 2
    const updateResult = await persistence.updateServerId(2);
    expect(updateResult.success).toBe(true);
    expect(updateResult.cleaned).toBe(true);
    expect(await persistence.hasStoredState()).toBe(false);

    // Save state for server 2
    await persistence.saveState('paused');
    expect(await persistence.hasStoredState()).toBe(true);

    // Try to restore with server 1 (should fail)
    const newPersistence = new ValidationStatePersistence(1);
    const restoreResult = await newPersistence.restoreState();
    expect(restoreResult.state).toBe('idle');
    expect(restoreResult.restored).toBe(false);
    expect(restoreResult.error).toBe('Server ID mismatch');
  });
});
