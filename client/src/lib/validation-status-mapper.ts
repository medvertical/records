/**
 * Validation Status Mapper
 * 
 * Maps backend API responses to UI-friendly validation states and display information.
 * Integrates with the validation state machine for consistent state management.
 */

import { 
  type ValidationState, 
  type ValidationAction,
  createValidationStateMachine,
  getStateDescription,
  getStateColor 
} from './validation-state-machine';

// Backend API response types (from existing codebase)
export interface BackendValidationProgress {
  isRunning: boolean;
  isPaused: boolean;
  shouldStop: boolean;
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources?: number;
  status?: string; // API status field
  startTime?: string | Date;
  currentResourceType?: string;
  nextResourceType?: string;
  estimatedTimeRemaining?: number;
  processingRate?: number;
  isComplete?: boolean;
  errors?: string[];
  warnings?: string[];
  // Enhanced validation results
  aspectBreakdown?: {
    structural: { errors: number; warnings: number; score: number };
    profile: { errors: number; warnings: number; score: number };
    terminology: { errors: number; warnings: number; score: number };
    reference: { errors: number; warnings: number; score: number };
    businessRule: { errors: number; warnings: number; score: number };
    metadata: { errors: number; warnings: number; score: number };
  };
  overallValidationMetrics?: {
    averageScore: number;
    averageConfidence: number;
    averageCompleteness: number;
    totalDurationMs: number;
  };
  retryStatistics?: {
    totalRetryAttempts: number;
    successfulRetries: number;
    failedRetries: number;
    resourcesWithRetries: number;
    averageRetriesPerResource: number;
  };
}

// UI-friendly validation status
export interface ValidationStatusDisplay {
  // Core state information
  state: ValidationState;
  description: string;
  color: string;
  
  // Progress information
  progress: number; // 0-100 percentage
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  warningResources: number;
  
  // Current operation info
  currentResourceType?: string;
  nextResourceType?: string;
  startTime?: Date;
  estimatedTimeRemaining?: number;
  processingRate: number; // Resources per minute
  
  // Status flags
  isActive: boolean;
  isCompleted: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  
  // Enhanced validation data
  aspectBreakdown?: BackendValidationProgress['aspectBreakdown'];
  overallValidationMetrics?: BackendValidationProgress['overallValidationMetrics'];
  retryStatistics?: BackendValidationProgress['retryStatistics'];
  
  // Error information
  errors: string[];
  warnings: string[];
  
  // Available actions
  availableActions: ValidationAction[];
}

/**
 * Validation Status Mapper Class
 * 
 * Handles mapping between backend API responses and UI display states.
 * Integrates with the validation state machine for consistent state management.
 */
export class ValidationStatusMapper {
  private stateMachine = createValidationStateMachine();

  /**
   * Map backend validation progress to UI display status
   */
  mapBackendToUI(backendProgress: BackendValidationProgress | null): ValidationStatusDisplay {
    if (!backendProgress) {
      return this.getDefaultStatus();
    }

    // Determine the current state from backend data
    const state = this.determineStateFromBackend(backendProgress);
    
    // Update state machine to match backend state
    this.syncStateMachine(state);

    // Calculate progress percentage
    const progress = this.calculateProgressPercentage(backendProgress);

    // Determine status flags
    const isActive = this.stateMachine.isActive();
    const isCompleted = this.stateMachine.isCompleted();
    const hasErrors = (backendProgress.errorResources || 0) > 0;
    const hasWarnings = (backendProgress.warningResources || 0) > 0;

    // Get available actions from state machine
    const availableActions = this.stateMachine.getValidActions();

    // Parse start time
    const startTime = backendProgress.startTime 
      ? new Date(backendProgress.startTime)
      : undefined;

    return {
      // Core state information
      state,
      description: getStateDescription(state),
      color: getStateColor(state),
      
      // Progress information
      progress,
      totalResources: backendProgress.totalResources || 0,
      processedResources: backendProgress.processedResources || 0,
      validResources: backendProgress.validResources || 0,
      errorResources: backendProgress.errorResources || 0,
      warningResources: backendProgress.warningResources || 0,
      
      // Current operation info
      currentResourceType: backendProgress.currentResourceType,
      nextResourceType: backendProgress.nextResourceType,
      startTime,
      estimatedTimeRemaining: backendProgress.estimatedTimeRemaining,
      processingRate: backendProgress.processingRate || 0,
      
      // Status flags
      isActive,
      isCompleted,
      hasErrors,
      hasWarnings,
      
      // Enhanced validation data
      aspectBreakdown: backendProgress.aspectBreakdown,
      overallValidationMetrics: backendProgress.overallValidationMetrics,
      retryStatistics: backendProgress.retryStatistics,
      
      // Error information
      errors: backendProgress.errors || [],
      warnings: backendProgress.warnings || [],
      
      // Available actions
      availableActions,
    };
  }

  /**
   * Map UI action to backend API action
   */
  mapUIToBackendAction(uiAction: ValidationAction): string {
    const actionMap: Record<ValidationAction, string> = {
      start: 'start',
      pause: 'pause',
      resume: 'resume',
      stop: 'stop',
      complete: 'complete',
      error: 'error'
    };

    return actionMap[uiAction] || uiAction;
  }

  /**
   * Get the current state machine state
   */
  getCurrentState(): ValidationState {
    return this.stateMachine.currentState;
  }

  /**
   * Check if a specific action is available
   */
  canPerformAction(action: ValidationAction): boolean {
    return this.stateMachine.canTransition(action);
  }

  /**
   * Get default status for when no backend data is available
   */
  getDefaultStatus(): ValidationStatusDisplay {
    this.stateMachine.reset();
    
    return {
      // Core state information
      state: 'idle',
      description: getStateDescription('idle'),
      color: getStateColor('idle'),
      
      // Progress information
      progress: 0,
      totalResources: 0,
      processedResources: 0,
      validResources: 0,
      errorResources: 0,
      warningResources: 0,
      
      // Status flags
      isActive: false,
      isCompleted: false,
      hasErrors: false,
      hasWarnings: false,
      
      // Error information
      errors: [],
      warnings: [],
      
      // Available actions
      availableActions: this.stateMachine.getValidActions(),
      
      // Default processing rate
      processingRate: 0,
    };
  }

  /**
   * Determine the validation state from backend data
   */
  private determineStateFromBackend(backendProgress: BackendValidationProgress): ValidationState {
    // Check for explicit status field first
    if (backendProgress.status) {
      return this.mapApiStatusToState(backendProgress.status);
    }

    // Fallback to inferring from boolean flags
    if (backendProgress.isRunning && backendProgress.isPaused) {
      return 'paused';
    } else if (backendProgress.isRunning) {
      return 'running';
    } else if (backendProgress.isComplete) {
      return 'completed';
    } else if (backendProgress.shouldStop || (backendProgress.errors && backendProgress.errors.length > 0)) {
      return 'error';
    } else {
      return 'idle';
    }
  }

  /**
   * Map API status string to validation state
   */
  private mapApiStatusToState(apiStatus: string): ValidationState {
    switch (apiStatus.toLowerCase()) {
      case 'not_running':
      case 'idle':
        return 'idle';
      case 'running':
        return 'running';
      case 'paused':
        return 'paused';
      case 'completed':
      case 'complete':
        return 'completed';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'idle';
    }
  }

  /**
   * Sync the state machine to match the determined state
   */
  private syncStateMachine(targetState: ValidationState): void {
    const currentState = this.stateMachine.currentState;
    
    // If states match, no need to sync
    if (currentState === targetState) {
      return;
    }

    // Reset and transition to target state
    this.stateMachine.reset();
    
    // Transition through the necessary states to reach target
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
   * Calculate progress percentage from backend data
   */
  private calculateProgressPercentage(backendProgress: BackendValidationProgress): number {
    const total = backendProgress.totalResources || 0;
    const processed = backendProgress.processedResources || 0;
    
    if (total === 0 || total < 0) return 0;
    if (processed < 0) return 0;
    
    return Math.min(100, Math.max(0, (processed / total) * 100));
  }
}

/**
 * Factory function to create a validation status mapper
 */
export function createValidationStatusMapper(): ValidationStatusMapper {
  return new ValidationStatusMapper();
}

/**
 * Utility function to get status display for a backend response
 */
export function mapValidationStatus(backendProgress: BackendValidationProgress | null): ValidationStatusDisplay {
  const mapper = createValidationStatusMapper();
  return mapper.mapBackendToUI(backendProgress);
}

/**
 * Utility function to get available actions for a backend response
 */
export function getAvailableActions(backendProgress: BackendValidationProgress | null): ValidationAction[] {
  const mapper = createValidationStatusMapper();
  const status = mapper.mapBackendToUI(backendProgress);
  return status.availableActions;
}

/**
 * Utility function to check if an action is available for a backend response
 */
export function canPerformAction(
  backendProgress: BackendValidationProgress | null, 
  action: ValidationAction
): boolean {
  const mapper = createValidationStatusMapper();
  // Map the backend data to sync the state machine
  mapper.mapBackendToUI(backendProgress);
  return mapper.canPerformAction(action);
}
