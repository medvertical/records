/**
 * Validation State Validator
 * 
 * Provides comprehensive validation and error recovery mechanisms for validation state.
 * Handles state validation, error detection, recovery strategies, and health monitoring.
 */

import { 
  type ValidationState, 
  type ValidationAction,
  createValidationStateMachine,
  type ValidationStateMachine 
} from './validation-state-machine';
import { 
  type BackendValidationProgress,
  type ValidationStatusDisplay,
  createValidationStatusMapper 
} from './validation-status-mapper';
import { 
  type StoredValidationState,
  createValidationStatePersistence 
} from './validation-state-persistence';

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  field?: string;
  context?: Record<string, any>;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  context?: Record<string, any>;
}

export interface ValidationSuggestion {
  code: string;
  message: string;
  action?: string;
  context?: Record<string, any>;
}

// Error recovery strategies
export interface RecoveryStrategy {
  name: string;
  description: string;
  canRecover: (error: ValidationError) => boolean;
  recover: (error: ValidationError, context: any) => Promise<RecoveryResult>;
}

export interface RecoveryResult {
  success: boolean;
  newState?: ValidationState;
  message?: string;
  error?: string;
}

// Health check result
export interface HealthCheckResult {
  isHealthy: boolean;
  score: number; // 0-100
  issues: ValidationError[];
  recommendations: ValidationSuggestion[];
  lastChecked: Date;
}

// State validation context
export interface ValidationContext {
  currentState: ValidationState;
  backendProgress?: BackendValidationProgress;
  storedState?: StoredValidationState;
  serverId?: number;
  sessionId?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

/**
 * Validation State Validator
 * 
 * Comprehensive validation and error recovery system for validation state management.
 * Provides state validation, error detection, recovery strategies, and health monitoring.
 */
export class ValidationStateValidator {
  private stateMachine: ValidationStateMachine;
  private statusMapper = createValidationStatusMapper();
  private persistence = createValidationStatePersistence();
  private recoveryStrategies: RecoveryStrategy[] = [];

  constructor() {
    this.stateMachine = createValidationStateMachine();
    this.initializeRecoveryStrategies();
  }

  /**
   * Validate current validation state
   */
  async validateState(context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // 1. Validate state machine consistency
      const stateMachineValidation = this.validateStateMachine(context);
      errors.push(...stateMachineValidation.errors);
      warnings.push(...stateMachineValidation.warnings);
      suggestions.push(...stateMachineValidation.suggestions);

      // 2. Validate backend progress consistency
      if (context.backendProgress) {
        const backendValidation = this.validateBackendProgress(context);
        errors.push(...backendValidation.errors);
        warnings.push(...backendValidation.warnings);
        suggestions.push(...backendValidation.suggestions);
      }

      // 3. Validate stored state consistency
      if (context.storedState) {
        const storedValidation = this.validateStoredState(context);
        errors.push(...storedValidation.errors);
        warnings.push(...storedValidation.warnings);
        suggestions.push(...storedValidation.suggestions);
      }

      // 4. Validate server context
      const serverValidation = this.validateServerContext(context);
      errors.push(...serverValidation.errors);
      warnings.push(...serverValidation.warnings);
      suggestions.push(...serverValidation.suggestions);

      // 5. Validate timestamp consistency
      const timestampValidation = this.validateTimestamp(context);
      errors.push(...timestampValidation.errors);
      warnings.push(...timestampValidation.warnings);
      suggestions.push(...timestampValidation.suggestions);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: `State validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          severity: 'critical'
        }],
        warnings: [],
        suggestions: []
      };
    }
  }

  /**
   * Attempt to recover from validation errors
   */
  async recoverFromErrors(
    errors: ValidationError[], 
    context: ValidationContext
  ): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];

    for (const error of errors) {
      const strategy = this.findRecoveryStrategy(error);
      if (strategy) {
        try {
          const result = await strategy.recover(error, context);
          results.push(result);
        } catch (recoveryError) {
          results.push({
            success: false,
            error: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`
          });
        }
      } else {
        results.push({
          success: false,
          error: `No recovery strategy found for error: ${error.code}`
        });
      }
    }

    return results;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(context: ValidationContext): Promise<HealthCheckResult> {
    const validation = await this.validateState(context);
    
    let score = 100;
    const issues: ValidationError[] = [];
    const recommendations: ValidationSuggestion[] = [];

    // Calculate health score based on errors and warnings
    for (const error of validation.errors) {
      switch (error.severity) {
        case 'critical':
          score -= 40;
          break;
        case 'high':
          score -= 25;
          break;
        case 'medium':
          score -= 15;
          break;
        case 'low':
          score -= 5;
          break;
      }
      issues.push(error);
    }

    for (const warning of validation.warnings) {
      score -= 2;
    }

    // Add recommendations based on issues
    for (const issue of issues) {
      const recommendation = this.generateRecommendation(issue);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return {
      isHealthy: score >= 80,
      score: Math.max(0, score),
      issues,
      recommendations,
      lastChecked: new Date()
    };
  }

  /**
   * Auto-recover from common issues
   */
  async autoRecover(context: ValidationContext): Promise<{
    recovered: boolean;
    newContext: ValidationContext;
    actions: string[];
  }> {
    const validation = await this.validateState(context);
    const actions: string[] = [];
    let newContext = { ...context };

    if (validation.isValid && validation.warnings.length === 0) {
      return { recovered: false, newContext, actions };
    }

    // Attempt recovery for each error
    const recoveryResults = await this.recoverFromErrors(validation.errors, context);
    
    for (let i = 0; i < recoveryResults.length; i++) {
      const result = recoveryResults[i];
      if (result.success) {
        actions.push(`Recovered from ${validation.errors[i].code}: ${result.message}`);
        
        if (result.newState) {
          newContext.currentState = result.newState;
        }
      } else {
        actions.push(`Failed to recover from ${validation.errors[i].code}: ${result.error}`);
      }
    }

    // Also attempt recovery for warnings that have recovery strategies
    for (const warning of validation.warnings) {
      const strategy = this.findRecoveryStrategy(warning as any);
      if (strategy) {
        try {
          const result = await strategy.recover(warning as any, context);
          if (result.success) {
            actions.push(`Recovered from warning ${warning.code}: ${result.message}`);
            
            if (result.newState) {
              newContext.currentState = result.newState;
            }
          } else {
            actions.push(`Failed to recover from warning ${warning.code}: ${result.error}`);
          }
        } catch (recoveryError) {
          actions.push(`Failed to recover from warning ${warning.code}: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`);
        }
      }
    }

    return {
      recovered: actions.some(action => action.includes('Recovered')),
      newContext,
      actions
    };
  }

  /**
   * Validate state machine consistency
   */
  private validateStateMachine(context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Check if state is valid
      const validStates: ValidationState[] = ['idle', 'running', 'paused', 'completed', 'error'];
      if (!validStates.includes(context.currentState)) {
        errors.push({
          code: 'INVALID_STATE',
          message: `Invalid validation state: ${context.currentState}`,
          severity: 'critical',
          field: 'currentState'
        });
      }

      // Check state machine consistency
      this.stateMachine.reset();
      if (context.currentState !== 'idle') {
        // Try to sync state machine to current state
        try {
          this.syncStateMachineToState(context.currentState);
        } catch (error) {
          errors.push({
            code: 'STATE_MACHINE_SYNC_ERROR',
            message: `Failed to sync state machine: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'high',
            field: 'currentState'
          });
        }
      }

      // Check for state transitions that might be invalid
      if (context.backendProgress) {
        const expectedState = this.mapBackendToState(context.backendProgress);
        if (expectedState && expectedState !== context.currentState) {
          warnings.push({
            code: 'STATE_MISMATCH',
            message: `State mismatch: expected ${expectedState}, got ${context.currentState}`,
            field: 'currentState'
          });
          
          suggestions.push({
            code: 'SYNC_STATE',
            message: `Consider syncing state to ${expectedState}`,
            action: 'syncState'
          });
        }
      }

    } catch (error) {
      errors.push({
        code: 'STATE_MACHINE_VALIDATION_ERROR',
        message: `State machine validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Validate backend progress consistency
   */
  private validateBackendProgress(context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!context.backendProgress) {
      return { isValid: true, errors, warnings, suggestions };
    }

    const progress = context.backendProgress;

    // Validate progress values
    if (progress.totalResources < 0) {
      errors.push({
        code: 'NEGATIVE_TOTAL_RESOURCES',
        message: 'Total resources cannot be negative',
        severity: 'high',
        field: 'totalResources'
      });
    }

    if (progress.processedResources < 0) {
      errors.push({
        code: 'NEGATIVE_PROCESSED_RESOURCES',
        message: 'Processed resources cannot be negative',
        severity: 'high',
        field: 'processedResources'
      });
    }

    if (progress.processedResources > progress.totalResources) {
      errors.push({
        code: 'PROCESSED_EXCEEDS_TOTAL',
        message: 'Processed resources cannot exceed total resources',
        severity: 'high',
        field: 'processedResources'
      });
    }

    // Validate resource counts
    const totalCounted = (progress.validResources || 0) + (progress.errorResources || 0) + (progress.warningResources || 0);
    if (totalCounted > progress.processedResources) {
      warnings.push({
        code: 'RESOURCE_COUNT_MISMATCH',
        message: 'Resource counts exceed processed resources',
        field: 'resourceCounts'
      });
    }

    // Validate processing rate
    if (progress.processingRate && progress.processingRate < 0) {
      warnings.push({
        code: 'NEGATIVE_PROCESSING_RATE',
        message: 'Processing rate cannot be negative',
        field: 'processingRate'
      });
    }

    // Validate completion state
    if (progress.isComplete && progress.processedResources < progress.totalResources) {
      errors.push({
        code: 'INCOMPLETE_BUT_MARKED_COMPLETE',
        message: 'Validation marked complete but not all resources processed',
        severity: 'medium',
        field: 'isComplete'
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Validate stored state consistency
   */
  private validateStoredState(context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!context.storedState) {
      return { isValid: true, errors, warnings, suggestions };
    }

    const stored = context.storedState;

    // Validate timestamp
    if (stored.timestamp && stored.timestamp > Date.now()) {
      errors.push({
        code: 'FUTURE_TIMESTAMP',
        message: 'Stored state has future timestamp',
        severity: 'high',
        field: 'timestamp'
      });
    }

    // Validate session ID
    if (!stored.sessionId || stored.sessionId.length === 0) {
      errors.push({
        code: 'MISSING_SESSION_ID',
        message: 'Stored state missing session ID',
        severity: 'medium',
        field: 'sessionId'
      });
    }

    // Validate server ID consistency
    if (stored.serverId && context.serverId && stored.serverId !== context.serverId) {
      errors.push({
        code: 'SERVER_ID_MISMATCH',
        message: 'Stored state server ID does not match current server ID',
        severity: 'high',
        field: 'serverId'
      });
    }

    // Validate state consistency
    if (stored.state !== context.currentState) {
      warnings.push({
        code: 'STORED_STATE_MISMATCH',
        message: `Stored state (${stored.state}) does not match current state (${context.currentState})`,
        field: 'state'
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Validate server context
   */
  private validateServerContext(context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // Validate server ID
    if (context.serverId && context.serverId <= 0) {
      errors.push({
        code: 'INVALID_SERVER_ID',
        message: 'Server ID must be positive',
        severity: 'high',
        field: 'serverId'
      });
    }

    // Validate session ID
    if (!context.sessionId || context.sessionId.length === 0) {
      warnings.push({
        code: 'MISSING_SESSION_ID',
        message: 'Session ID is missing',
        field: 'sessionId'
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Validate timestamp consistency
   */
  private validateTimestamp(context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    if (!context.timestamp) {
      return { isValid: true, errors, warnings, suggestions };
    }

    const now = Date.now();
    const age = now - context.timestamp;

    // Check for future timestamps
    if (context.timestamp > now) {
      errors.push({
        code: 'FUTURE_TIMESTAMP',
        message: 'Timestamp is in the future',
        severity: 'high',
        field: 'timestamp'
      });
    }

    // Check for very old timestamps (older than 24 hours)
    if (age > 24 * 60 * 60 * 1000) {
      warnings.push({
        code: 'OLD_TIMESTAMP',
        message: 'Timestamp is very old (older than 24 hours)',
        field: 'timestamp'
      });
      
      suggestions.push({
        code: 'REFRESH_STATE',
        message: 'Consider refreshing validation state',
        action: 'refreshState'
      });
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }

  /**
   * Map backend progress to expected state
   */
  private mapBackendToState(progress: BackendValidationProgress): ValidationState | null {
    if (progress.isComplete) {
      return 'completed';
    }
    
    if (progress.isRunning && progress.isPaused) {
      return 'paused';
    }
    
    if (progress.isRunning && !progress.isPaused) {
      return 'running';
    }
    
    if (progress.shouldStop) {
      return 'completed';
    }
    
    return 'idle';
  }

  /**
   * Sync state machine to specific state
   */
  private syncStateMachineToState(targetState: ValidationState): void {
    this.stateMachine.reset();
    
    switch (targetState) {
      case 'running':
        this.stateMachine.transition('start');
        break;
      case 'paused':
        this.stateMachine.transition('start');
        this.stateMachine.transition('pause');
        break;
      case 'completed':
        this.stateMachine.transition('start');
        this.stateMachine.transition('complete');
        break;
      case 'error':
        this.stateMachine.transition('start');
        this.stateMachine.transition('error');
        break;
      case 'idle':
        // Already reset, no transition needed
        break;
    }
  }

  /**
   * Find recovery strategy for error
   */
  private findRecoveryStrategy(error: ValidationError): RecoveryStrategy | null {
    return this.recoveryStrategies.find(strategy => strategy.canRecover(error)) || null;
  }

  /**
   * Generate recommendation for issue
   */
  private generateRecommendation(issue: ValidationError): ValidationSuggestion | null {
    switch (issue.code) {
      case 'INVALID_STATE':
        return {
          code: 'RESET_STATE',
          message: 'Reset validation state to idle',
          action: 'resetState'
        };
      
      case 'STATE_MISMATCH':
        return {
          code: 'SYNC_STATE',
          message: 'Sync state with backend progress',
          action: 'syncState'
        };
      
      case 'SERVER_ID_MISMATCH':
        return {
          code: 'CLEAR_STATE',
          message: 'Clear stored state for new server',
          action: 'clearState'
        };
      
      case 'FUTURE_TIMESTAMP':
        return {
          code: 'CORRECT_TIMESTAMP',
          message: 'Correct timestamp to current time',
          action: 'correctTimestamp'
        };
      
      default:
        return null;
    }
  }

  /**
   * Initialize recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'Reset State',
        description: 'Reset validation state to idle',
        canRecover: (error) => error.code === 'INVALID_STATE',
        recover: async (error, context) => {
          return {
            success: true,
            newState: 'idle',
            message: 'State reset to idle'
          };
        }
      },
      {
        name: 'Sync State',
        description: 'Sync state with backend progress',
        canRecover: (error) => error.code === 'STATE_MISMATCH',
        recover: async (error, context) => {
          if (context.backendProgress) {
            const expectedState = this.mapBackendToState(context.backendProgress);
            if (expectedState) {
              return {
                success: true,
                newState: expectedState,
                message: `State synced to ${expectedState}`
              };
            }
          }
          return {
            success: false,
            error: 'Cannot sync state without backend progress'
          };
        }
      },
      {
        name: 'Clear State',
        description: 'Clear stored state for new server',
        canRecover: (error) => error.code === 'SERVER_ID_MISMATCH',
        recover: async (error, context) => {
          await this.persistence.clearStoredState();
          return {
            success: true,
            newState: 'idle',
            message: 'Stored state cleared for new server'
          };
        }
      },
      {
        name: 'Correct Timestamp',
        description: 'Correct timestamp to current time',
        canRecover: (error) => error.code === 'FUTURE_TIMESTAMP',
        recover: async (error, context) => {
          return {
            success: true,
            message: 'Timestamp corrected to current time'
          };
        }
      },
      {
        name: 'Sync State from Backend',
        description: 'Sync state with backend progress for warnings',
        canRecover: (error) => error.code === 'STATE_MISMATCH' && error.severity === 'medium',
        recover: async (error, context) => {
          if (context.backendProgress) {
            const expectedState = this.mapBackendToState(context.backendProgress);
            if (expectedState) {
              return {
                success: true,
                newState: expectedState,
                message: `State synced to ${expectedState}`
              };
            }
          }
          return {
            success: false,
            error: 'Cannot sync state without backend progress'
          };
        }
      }
    ];
  }
}

/**
 * Factory function to create validation state validator
 */
export function createValidationStateValidator(): ValidationStateValidator {
  return new ValidationStateValidator();
}

/**
 * Utility function to validate validation state
 */
export async function validateValidationState(context: ValidationContext): Promise<ValidationResult> {
  const validator = createValidationStateValidator();
  return await validator.validateState(context);
}

/**
 * Utility function to perform health check
 */
export async function performValidationHealthCheck(context: ValidationContext): Promise<HealthCheckResult> {
  const validator = createValidationStateValidator();
  return await validator.performHealthCheck(context);
}

/**
 * Utility function to auto-recover from issues
 */
export async function autoRecoverValidationState(context: ValidationContext): Promise<{
  recovered: boolean;
  newContext: ValidationContext;
  actions: string[];
}> {
  const validator = createValidationStateValidator();
  return await validator.autoRecover(context);
}
