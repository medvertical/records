/**
 * Unit tests for Validation Status Mapper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationStatusMapper,
  createValidationStatusMapper,
  mapValidationStatus,
  getAvailableActions,
  canPerformAction,
  type BackendValidationProgress,
  type ValidationStatusDisplay,
  type ValidationAction
} from './validation-status-mapper';

describe('ValidationStatusMapper', () => {
  let mapper: ValidationStatusMapper;

  beforeEach(() => {
    mapper = new ValidationStatusMapper();
  });

  describe('Default Status', () => {
    it('should return default idle status when no backend data provided', () => {
      const status = mapper.mapBackendToUI(null);
      
      expect(status.state).toBe('idle');
      expect(status.description).toBe('Ready to start validation');
      expect(status.color).toBe('gray');
      expect(status.progress).toBe(0);
      expect(status.isActive).toBe(false);
      expect(status.isCompleted).toBe(false);
      expect(status.availableActions).toEqual(['start']);
    });

    it('should return default status from getDefaultStatus method', () => {
      const status = mapper.getDefaultStatus();
      
      expect(status.state).toBe('idle');
      expect(status.description).toBe('Ready to start validation');
      expect(status.color).toBe('gray');
      expect(status.progress).toBe(0);
      expect(status.isActive).toBe(false);
      expect(status.isCompleted).toBe(false);
      expect(status.availableActions).toEqual(['start']);
    });
  });

  describe('State Mapping from Backend Data', () => {
    it('should map idle state correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: false,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        processingRate: 0
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.state).toBe('idle');
      expect(status.description).toBe('Ready to start validation');
      expect(status.color).toBe('gray');
      expect(status.isActive).toBe(false);
      expect(status.isCompleted).toBe(false);
      expect(status.availableActions).toEqual(['start']);
    });

    it('should map running state correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 25,
        validResources: 20,
        errorResources: 5,
        processingRate: 10,
        currentResourceType: 'Patient'
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.state).toBe('running');
      expect(status.description).toBe('Validation in progress');
      expect(status.color).toBe('blue');
      expect(status.isActive).toBe(true);
      expect(status.isCompleted).toBe(false);
      expect(status.progress).toBe(25);
      expect(status.currentResourceType).toBe('Patient');
      expect(status.availableActions).toEqual(['pause', 'stop', 'complete', 'error']);
    });

    it('should map paused state correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: true,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 40,
        errorResources: 10,
        processingRate: 5
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.state).toBe('paused');
      expect(status.description).toBe('Validation paused');
      expect(status.color).toBe('yellow');
      expect(status.isActive).toBe(true);
      expect(status.isCompleted).toBe(false);
      expect(status.progress).toBe(50);
      expect(status.availableActions).toEqual(['resume', 'stop', 'error']);
    });

    it('should map completed state correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: false,
        isPaused: false,
        shouldStop: false,
        isComplete: true,
        totalResources: 100,
        processedResources: 100,
        validResources: 80,
        errorResources: 20,
        processingRate: 0
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.state).toBe('completed');
      expect(status.description).toBe('Validation completed successfully');
      expect(status.color).toBe('green');
      expect(status.isActive).toBe(false);
      expect(status.isCompleted).toBe(true);
      expect(status.progress).toBe(100);
      expect(status.availableActions).toEqual(['start']);
    });

    it('should map error state correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: false,
        isPaused: false,
        shouldStop: true,
        totalResources: 100,
        processedResources: 30,
        validResources: 25,
        errorResources: 5,
        processingRate: 0,
        errors: ['Connection failed', 'Timeout occurred']
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.state).toBe('error');
      expect(status.description).toBe('Validation failed with errors');
      expect(status.color).toBe('red');
      expect(status.isActive).toBe(false);
      expect(status.isCompleted).toBe(true);
      expect(status.hasErrors).toBe(true);
      expect(status.errors).toEqual(['Connection failed', 'Timeout occurred']);
      expect(status.availableActions).toEqual(['start']);
    });
  });

  describe('Status Field Mapping', () => {
    it('should prioritize explicit status field over boolean flags', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        status: 'paused', // Explicit status should override boolean flags
        totalResources: 100,
        processedResources: 25,
        validResources: 20,
        errorResources: 5,
        processingRate: 10
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.state).toBe('paused');
      expect(status.description).toBe('Validation paused');
      expect(status.color).toBe('yellow');
    });

    it('should handle various status field values', () => {
      const testCases = [
        { status: 'not_running', expected: 'idle' },
        { status: 'idle', expected: 'idle' },
        { status: 'running', expected: 'running' },
        { status: 'paused', expected: 'paused' },
        { status: 'completed', expected: 'completed' },
        { status: 'complete', expected: 'completed' },
        { status: 'error', expected: 'error' },
        { status: 'failed', expected: 'error' },
        { status: 'unknown', expected: 'idle' } // Default fallback
      ];

      testCases.forEach(({ status, expected }) => {
        const backendData: BackendValidationProgress = {
          isRunning: false,
          isPaused: false,
          shouldStop: false,
          status,
          totalResources: 100,
          processedResources: 0,
          validResources: 0,
          errorResources: 0,
          processingRate: 0
        };

        const result = mapper.mapBackendToUI(backendData);
        expect(result.state).toBe(expected);
      });
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 25,
        validResources: 20,
        errorResources: 5,
        processingRate: 10
      };

      const status = mapper.mapBackendToUI(backendData);
      expect(status.progress).toBe(25);
    });

    it('should handle zero total resources', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 0,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        processingRate: 0
      };

      const status = mapper.mapBackendToUI(backendData);
      expect(status.progress).toBe(0);
    });

    it('should cap progress at 100%', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 150, // More than total
        validResources: 100,
        errorResources: 50,
        processingRate: 10
      };

      const status = mapper.mapBackendToUI(backendData);
      expect(status.progress).toBe(100);
    });
  });

  describe('Enhanced Validation Data', () => {
    it('should include aspect breakdown when available', () => {
      const aspectBreakdown = {
        structural: { errors: 2, warnings: 1, score: 85 },
        profile: { errors: 0, warnings: 3, score: 92 },
        terminology: { errors: 1, warnings: 0, score: 95 },
        reference: { errors: 0, warnings: 2, score: 88 },
        businessRule: { errors: 0, warnings: 1, score: 96 },
        metadata: { errors: 0, warnings: 0, score: 100 }
      };

      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 45,
        errorResources: 5,
        processingRate: 10,
        aspectBreakdown
      };

      const status = mapper.mapBackendToUI(backendData);
      expect(status.aspectBreakdown).toEqual(aspectBreakdown);
    });

    it('should include overall validation metrics when available', () => {
      const overallMetrics = {
        averageScore: 92.5,
        averageConfidence: 0.95,
        averageCompleteness: 0.88,
        totalDurationMs: 45000
      };

      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 45,
        errorResources: 5,
        processingRate: 10,
        overallValidationMetrics: overallMetrics
      };

      const status = mapper.mapBackendToUI(backendData);
      expect(status.overallValidationMetrics).toEqual(overallMetrics);
    });

    it('should include retry statistics when available', () => {
      const retryStats = {
        totalRetryAttempts: 15,
        successfulRetries: 12,
        failedRetries: 3,
        resourcesWithRetries: 8,
        averageRetriesPerResource: 1.875
      };

      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 45,
        errorResources: 5,
        processingRate: 10,
        retryStatistics: retryStats
      };

      const status = mapper.mapBackendToUI(backendData);
      expect(status.retryStatistics).toEqual(retryStats);
    });
  });

  describe('Error and Warning Handling', () => {
    it('should handle errors correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: false,
        isPaused: false,
        shouldStop: true,
        totalResources: 100,
        processedResources: 30,
        validResources: 25,
        errorResources: 5,
        processingRate: 0,
        errors: ['Network timeout', 'Invalid response format']
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.hasErrors).toBe(true);
      expect(status.errors).toEqual(['Network timeout', 'Invalid response format']);
    });

    it('should handle warnings correctly', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 40,
        errorResources: 5,
        warningResources: 5,
        processingRate: 10,
        warnings: ['Slow response time', 'Deprecated API usage']
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.hasWarnings).toBe(true);
      expect(status.warningResources).toBe(5);
      expect(status.warnings).toEqual(['Slow response time', 'Deprecated API usage']);
    });

    it('should handle missing errors and warnings arrays', () => {
      const backendData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 50,
        errorResources: 0,
        processingRate: 10
        // No errors or warnings arrays
      };

      const status = mapper.mapBackendToUI(backendData);
      
      expect(status.hasErrors).toBe(false);
      expect(status.hasWarnings).toBe(false);
      expect(status.errors).toEqual([]);
      expect(status.warnings).toEqual([]);
    });
  });

  describe('Action Mapping', () => {
    it('should map UI actions to backend actions correctly', () => {
      const actionMap: Array<{ ui: ValidationAction; backend: string }> = [
        { ui: 'start', backend: 'start' },
        { ui: 'pause', backend: 'pause' },
        { ui: 'resume', backend: 'resume' },
        { ui: 'stop', backend: 'stop' },
        { ui: 'complete', backend: 'complete' },
        { ui: 'error', backend: 'error' }
      ];

      actionMap.forEach(({ ui, backend }) => {
        expect(mapper.mapUIToBackendAction(ui)).toBe(backend);
      });
    });
  });

  describe('State Machine Integration', () => {
    it('should sync state machine with backend state', () => {
      // Start with idle state
      expect(mapper.getCurrentState()).toBe('idle');

      // Map running state
      const runningData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 25,
        validResources: 20,
        errorResources: 5,
        processingRate: 10
      };

      mapper.mapBackendToUI(runningData);
      expect(mapper.getCurrentState()).toBe('running');

      // Map paused state
      const pausedData: BackendValidationProgress = {
        isRunning: true,
        isPaused: true,
        shouldStop: false,
        totalResources: 100,
        processedResources: 50,
        validResources: 40,
        errorResources: 10,
        processingRate: 5
      };

      mapper.mapBackendToUI(pausedData);
      expect(mapper.getCurrentState()).toBe('paused');
    });

    it('should check action availability correctly', () => {
      // Start with idle state
      expect(mapper.canPerformAction('start')).toBe(true);
      expect(mapper.canPerformAction('pause')).toBe(false);

      // Map to running state
      const runningData: BackendValidationProgress = {
        isRunning: true,
        isPaused: false,
        shouldStop: false,
        totalResources: 100,
        processedResources: 25,
        validResources: 20,
        errorResources: 5,
        processingRate: 10
      };

      mapper.mapBackendToUI(runningData);
      expect(mapper.canPerformAction('pause')).toBe(true);
      expect(mapper.canPerformAction('stop')).toBe(true);
      expect(mapper.canPerformAction('start')).toBe(false);
    });
  });
});

describe('Factory Functions', () => {
  it('should create validation status mapper', () => {
    const mapper = createValidationStatusMapper();
    expect(mapper).toBeInstanceOf(ValidationStatusMapper);
  });

  it('should map validation status using factory function', () => {
    const backendData: BackendValidationProgress = {
      isRunning: true,
      isPaused: false,
      shouldStop: false,
      totalResources: 100,
      processedResources: 25,
      validResources: 20,
      errorResources: 5,
      processingRate: 10
    };

    const status = mapValidationStatus(backendData);
    expect(status.state).toBe('running');
    expect(status.isActive).toBe(true);
  });

  it('should get available actions using factory function', () => {
    const backendData: BackendValidationProgress = {
      isRunning: true,
      isPaused: false,
      shouldStop: false,
      totalResources: 100,
      processedResources: 25,
      validResources: 20,
      errorResources: 5,
      processingRate: 10
    };

    const actions = getAvailableActions(backendData);
    expect(actions).toEqual(['pause', 'stop', 'complete', 'error']);
  });

  it('should check action availability using factory function', () => {
    const backendData: BackendValidationProgress = {
      isRunning: true,
      isPaused: false,
      shouldStop: false,
      totalResources: 100,
      processedResources: 25,
      validResources: 20,
      errorResources: 5,
      processingRate: 10
    };

    expect(canPerformAction(backendData, 'pause')).toBe(true);
    expect(canPerformAction(backendData, 'start')).toBe(false);
    expect(canPerformAction(null, 'start')).toBe(true); // Default idle state
  });
});

describe('Edge Cases', () => {
  let mapper: ValidationStatusMapper;

  beforeEach(() => {
    mapper = new ValidationStatusMapper();
  });

  it('should handle malformed backend data gracefully', () => {
    const malformedData = {
      // Missing required fields
      isRunning: true
    } as any;

    const status = mapper.mapBackendToUI(malformedData);
    
    expect(status.state).toBe('running');
    expect(status.totalResources).toBe(0);
    expect(status.processedResources).toBe(0);
    expect(status.progress).toBe(0);
  });

  it('should handle negative values gracefully', () => {
    const negativeData: BackendValidationProgress = {
      isRunning: true,
      isPaused: false,
      shouldStop: false,
      totalResources: -10,
      processedResources: -5,
      validResources: -3,
      errorResources: -2,
      processingRate: -1
    };

    const status = mapper.mapBackendToUI(negativeData);
    
    expect(status.progress).toBe(0); // Should not be negative
    expect(status.totalResources).toBe(-10); // Preserve original values
    expect(status.processedResources).toBe(-5);
  });

  it('should handle very large numbers', () => {
    const largeData: BackendValidationProgress = {
      isRunning: true,
      isPaused: false,
      shouldStop: false,
      totalResources: Number.MAX_SAFE_INTEGER,
      processedResources: Number.MAX_SAFE_INTEGER - 1000,
      validResources: 1000000,
      errorResources: 1000,
      processingRate: 1000000
    };

    const status = mapper.mapBackendToUI(largeData);
    
    expect(status.progress).toBeLessThanOrEqual(100);
    expect(status.totalResources).toBe(Number.MAX_SAFE_INTEGER);
    expect(status.processedResources).toBe(Number.MAX_SAFE_INTEGER - 1000);
  });
});
