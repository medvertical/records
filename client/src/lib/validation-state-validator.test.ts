/**
 * Unit tests for Validation State Validator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ValidationStateValidator,
  createValidationStateValidator,
  validateValidationState,
  performValidationHealthCheck,
  autoRecoverValidationState,
  type ValidationContext,
  type ValidationResult,
  type HealthCheckResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationSuggestion
} from './validation-state-validator';
import { type BackendValidationProgress } from './validation-status-mapper';
import { type StoredValidationState } from './validation-state-persistence';

// Mock the persistence module
vi.mock('./validation-state-persistence', () => ({
  createValidationStatePersistence: vi.fn(() => ({
    clearStoredState: vi.fn().mockResolvedValue({ success: true })
  }))
}));

describe('ValidationStateValidator', () => {
  let validator: ValidationStateValidator;

  beforeEach(() => {
    validator = new ValidationStateValidator();
  });

  describe('State Validation', () => {
    it('should validate valid state successfully', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid state', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_STATE');
      expect(result.errors[0].severity).toBe('critical');
    });

    it('should validate backend progress consistency', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: 100,
          processedResources: 50,
          validResources: 40,
          errorResources: 10,
          processingRate: 5
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect negative total resources', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: -10,
          processedResources: 5,
          validResources: 3,
          errorResources: 2,
          processingRate: 1
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.code === 'NEGATIVE_TOTAL_RESOURCES')).toBe(true);
      const negativeTotalError = result.errors.find(error => error.code === 'NEGATIVE_TOTAL_RESOURCES');
      expect(negativeTotalError?.severity).toBe('high');
    });

    it('should detect processed resources exceeding total', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: 100,
          processedResources: 150,
          validResources: 100,
          errorResources: 50,
          processingRate: 10
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PROCESSED_EXCEEDS_TOTAL');
      expect(result.errors[0].severity).toBe('high');
    });

    it('should detect resource count mismatch', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: 100,
          processedResources: 50,
          validResources: 30,
          errorResources: 25,
          processingRate: 5
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('RESOURCE_COUNT_MISMATCH');
    });

    it('should detect incomplete but marked complete', async () => {
      const context: ValidationContext = {
        currentState: 'completed',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: false,
          isPaused: false,
          shouldStop: true,
          totalResources: 100,
          processedResources: 50,
          validResources: 40,
          errorResources: 10,
          isComplete: true,
          processingRate: 5
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INCOMPLETE_BUT_MARKED_COMPLETE');
      expect(result.errors[0].severity).toBe('medium');
    });
  });

  describe('Stored State Validation', () => {
    it('should validate stored state successfully', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        storedState: {
          state: 'running',
          timestamp: Date.now(),
          serverId: 1,
          sessionId: 'test-session',
          metadata: {
            userAgent: 'test',
            url: 'test',
            version: '1.0.0'
          }
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect future timestamp in stored state', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        storedState: {
          state: 'running',
          timestamp: Date.now() + 60000, // 1 minute in the future
          serverId: 1,
          sessionId: 'test-session',
          metadata: {
            userAgent: 'test',
            url: 'test',
            version: '1.0.0'
          }
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FUTURE_TIMESTAMP');
      expect(result.errors[0].severity).toBe('high');
    });

    it('should detect missing session ID in stored state', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        storedState: {
          state: 'running',
          timestamp: Date.now(),
          serverId: 1,
          sessionId: '', // Empty session ID
          metadata: {
            userAgent: 'test',
            url: 'test',
            version: '1.0.0'
          }
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_SESSION_ID');
      expect(result.errors[0].severity).toBe('medium');
    });

    it('should detect server ID mismatch', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        storedState: {
          state: 'running',
          timestamp: Date.now(),
          serverId: 2, // Different server ID
          sessionId: 'test-session',
          metadata: {
            userAgent: 'test',
            url: 'test',
            version: '1.0.0'
          }
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SERVER_ID_MISMATCH');
      expect(result.errors[0].severity).toBe('high');
    });

    it('should detect stored state mismatch', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        storedState: {
          state: 'paused', // Different state
          timestamp: Date.now(),
          serverId: 1,
          sessionId: 'test-session',
          metadata: {
            userAgent: 'test',
            url: 'test',
            version: '1.0.0'
          }
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('STORED_STATE_MISMATCH');
    });
  });

  describe('Server Context Validation', () => {
    it('should detect invalid server ID', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: -1, // Invalid server ID
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_SERVER_ID');
      expect(result.errors[0].severity).toBe('high');
    });

    it('should detect missing session ID', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: '', // Empty session ID
        timestamp: Date.now()
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('MISSING_SESSION_ID');
    });
  });

  describe('Timestamp Validation', () => {
    it('should detect future timestamp', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now() + 60000 // 1 minute in the future
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('FUTURE_TIMESTAMP');
      expect(result.errors[0].severity).toBe('high');
    });

    it('should detect old timestamp', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('OLD_TIMESTAMP');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].code).toBe('REFRESH_STATE');
    });
  });

  describe('State Machine Validation', () => {
    it('should detect state machine sync error', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.code === 'INVALID_STATE')).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from invalid state', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const validation = await validator.validateState(context);
      const recoveryResults = await validator.recoverFromErrors(validation.errors, context);

      expect(recoveryResults).toHaveLength(1);
      expect(recoveryResults[0].success).toBe(true);
      expect(recoveryResults[0].newState).toBe('idle');
      expect(recoveryResults[0].message).toBe('State reset to idle');
    });

    it('should recover from state mismatch', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: 100,
          processedResources: 50,
          validResources: 40,
          errorResources: 10,
          processingRate: 5
        }
      };

      const validation = await validator.validateState(context);
      const recoveryResults = await validator.recoverFromErrors(validation.warnings, context);

      expect(recoveryResults.length).toBeGreaterThan(0);
      const stateMismatchRecovery = recoveryResults.find(result => result.newState === 'running');
      expect(stateMismatchRecovery?.success).toBe(true);
      expect(stateMismatchRecovery?.newState).toBe('running');
      expect(stateMismatchRecovery?.message).toBe('State synced to running');
    });

    it('should handle recovery failure gracefully', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const errors: ValidationError[] = [{
        code: 'UNKNOWN_ERROR',
        message: 'Unknown error',
        severity: 'high'
      }];

      const recoveryResults = await validator.recoverFromErrors(errors, context);

      expect(recoveryResults).toHaveLength(1);
      expect(recoveryResults[0].success).toBe(false);
      expect(recoveryResults[0].error).toContain('No recovery strategy found');
    });
  });

  describe('Health Check', () => {
    it('should perform health check successfully', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const healthCheck = await validator.performHealthCheck(context);

      expect(healthCheck.isHealthy).toBe(true);
      expect(healthCheck.score).toBe(100);
      expect(healthCheck.issues).toHaveLength(0);
      expect(healthCheck.recommendations).toHaveLength(0);
      expect(healthCheck.lastChecked).toBeInstanceOf(Date);
    });

    it('should detect health issues', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: -1,
        sessionId: '',
        timestamp: Date.now() + 60000
      };

      const healthCheck = await validator.performHealthCheck(context);

      expect(healthCheck.isHealthy).toBe(false);
      expect(healthCheck.score).toBeLessThan(80);
      expect(healthCheck.issues.length).toBeGreaterThan(0);
      expect(healthCheck.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate health score correctly', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: -10, // This will cause a high severity error
          processedResources: 5,
          validResources: 3,
          errorResources: 2,
          processingRate: 1
        }
      };

      const healthCheck = await validator.performHealthCheck(context);

      expect(healthCheck.isHealthy).toBe(false);
      expect(healthCheck.score).toBeLessThan(80); // Should be less than 80 due to high severity error
      expect(healthCheck.issues.length).toBeGreaterThan(0);
      expect(healthCheck.issues.some(issue => issue.severity === 'high')).toBe(true);
    });
  });

  describe('Auto Recovery', () => {
    it('should auto-recover from issues', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const recovery = await validator.autoRecover(context);

      expect(recovery.recovered).toBe(true);
      expect(recovery.newContext.currentState).toBe('idle');
      expect(recovery.actions.length).toBeGreaterThan(0);
      expect(recovery.actions[0]).toContain('Recovered from INVALID_STATE');
    });

    it('should not recover when no issues exist', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const recovery = await validator.autoRecover(context);

      expect(recovery.recovered).toBe(false);
      expect(recovery.newContext).toEqual(context);
      expect(recovery.actions).toHaveLength(0);
    });

    it('should handle partial recovery', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: -1, // This will cause an error that can't be recovered
        sessionId: 'test-session',
        timestamp: Date.now()
      };

      const recovery = await validator.autoRecover(context);

      expect(recovery.recovered).toBe(true); // At least one recovery succeeded
      expect(recovery.actions.length).toBeGreaterThan(0);
      expect(recovery.actions.some(action => action.includes('Recovered'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle validation errors gracefully', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now(),
        metadata: {
          // Add some metadata that might cause issues
          invalidField: undefined
        }
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing backend progress', async () => {
      const context: ValidationContext = {
        currentState: 'running',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
        // No backendProgress
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle missing stored state', async () => {
      const context: ValidationContext = {
        currentState: 'idle',
        serverId: 1,
        sessionId: 'test-session',
        timestamp: Date.now()
        // No storedState
      };

      const result = await validator.validateState(context);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Factory Functions', () => {
  it('should create validation state validator', () => {
    const validator = createValidationStateValidator();
    expect(validator).toBeInstanceOf(ValidationStateValidator);
  });

  it('should validate validation state using utility function', async () => {
    const context: ValidationContext = {
      currentState: 'idle',
      serverId: 1,
      sessionId: 'test-session',
      timestamp: Date.now()
    };

    const result = await validateValidationState(context);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should perform health check using utility function', async () => {
    const context: ValidationContext = {
      currentState: 'idle',
      serverId: 1,
      sessionId: 'test-session',
      timestamp: Date.now()
    };

    const healthCheck = await performValidationHealthCheck(context);

    expect(healthCheck.isHealthy).toBe(true);
    expect(healthCheck.score).toBe(100);
  });

  it('should auto-recover using utility function', async () => {
    const context: ValidationContext = {
      currentState: 'invalid_state' as any,
      serverId: 1,
      sessionId: 'test-session',
      timestamp: Date.now()
    };

    const recovery = await autoRecoverValidationState(context);

    expect(recovery.recovered).toBe(true);
    expect(recovery.newContext.currentState).toBe('idle');
  });
});

describe('Integration Tests', () => {
    it('should handle complete validation and recovery workflow', async () => {
      const context: ValidationContext = {
        currentState: 'invalid_state' as any,
        serverId: 1, // Use valid server ID to avoid unrecoverable errors
        sessionId: 'test-session',
        timestamp: Date.now(),
        backendProgress: {
          isRunning: true,
          isPaused: false,
          shouldStop: false,
          totalResources: 100, // Use valid total resources
          processedResources: 50,
          validResources: 40,
          errorResources: 10,
          processingRate: 5
        }
      };

      // Step 1: Validate state
      const validation = await validateValidationState(context);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      // Step 2: Perform health check
      const healthCheck = await performValidationHealthCheck(context);
      expect(healthCheck.isHealthy).toBe(false);
      expect(healthCheck.score).toBeLessThan(80);

      // Step 3: Auto-recover
      const recovery = await autoRecoverValidationState(context);
      expect(recovery.recovered).toBe(true);
      expect(recovery.actions.length).toBeGreaterThan(0);

      // Step 4: Validate recovered state
      const recoveredValidation = await validateValidationState(recovery.newContext);
      expect(recoveredValidation.isValid).toBe(true);
      expect(recoveredValidation.errors).toHaveLength(0);
    });

  it('should handle complex state mismatch scenario', async () => {
    const context: ValidationContext = {
      currentState: 'idle',
      serverId: 1,
      sessionId: 'test-session',
      timestamp: Date.now(),
      backendProgress: {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 40,
        errorResources: 10,
        processingRate: 5
      },
      storedState: {
        state: 'paused',
        timestamp: Date.now(),
        serverId: 1,
        sessionId: 'test-session',
        metadata: {
          userAgent: 'test',
          url: 'test',
          version: '1.0.0'
        }
      }
    };

    const validation = await validateValidationState(context);
    expect(validation.isValid).toBe(true);
    expect(validation.warnings.length).toBeGreaterThan(0);
    expect(validation.suggestions.length).toBeGreaterThan(0);

    const recovery = await autoRecoverValidationState(context);
    expect(recovery.recovered).toBe(true);
    expect(recovery.newContext.currentState).toBe('running');
  });
});
