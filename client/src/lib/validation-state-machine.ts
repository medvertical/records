/**
 * Validation State Machine
 * 
 * Manages validation state transitions with proper validation and error handling.
 * States: idle → running → paused → completed/error
 */

export type ValidationState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

export type ValidationAction = 'start' | 'pause' | 'resume' | 'stop' | 'complete' | 'error';

export interface ValidationStateMachine {
  currentState: ValidationState;
  canTransition(action: ValidationAction): boolean;
  transition(action: ValidationAction): ValidationState;
  reset(): void;
}

/**
 * Validation state machine implementation
 */
export class ValidationStateMachineImpl implements ValidationStateMachine {
  private _currentState: ValidationState = 'idle';

  constructor(initialState: ValidationState = 'idle') {
    this._currentState = initialState;
  }

  get currentState(): ValidationState {
    return this._currentState;
  }

  /**
   * Check if a transition is allowed from the current state
   */
  canTransition(action: ValidationAction): boolean {
    const validTransitions: Record<ValidationState, ValidationAction[]> = {
      idle: ['start'],
      running: ['pause', 'stop', 'complete', 'error'],
      paused: ['resume', 'stop', 'error'],
      completed: ['start'],
      error: ['start']
    };

    return validTransitions[this._currentState].includes(action);
  }

  /**
   * Attempt to transition to a new state
   * @throws Error if transition is not allowed
   */
  transition(action: ValidationAction): ValidationState {
    if (!this.canTransition(action)) {
      throw new Error(
        `Invalid transition: cannot perform '${action}' from state '${this._currentState}'`
      );
    }

    const stateMap: Record<ValidationAction, ValidationState> = {
      start: 'running',
      pause: 'paused',
      resume: 'running',
      stop: 'idle',
      complete: 'completed',
      error: 'error'
    };

    this._currentState = stateMap[action];
    return this._currentState;
  }

  /**
   * Reset to idle state
   */
  reset(): void {
    this._currentState = 'idle';
  }

  /**
   * Get all valid actions for the current state
   */
  getValidActions(): ValidationAction[] {
    const validTransitions: Record<ValidationState, ValidationAction[]> = {
      idle: ['start'],
      running: ['pause', 'stop', 'complete', 'error'],
      paused: ['resume', 'stop', 'error'],
      completed: ['start'],
      error: ['start']
    };

    return validTransitions[this._currentState];
  }

  /**
   * Check if the current state allows starting validation
   */
  canStart(): boolean {
    return this.canTransition('start');
  }

  /**
   * Check if the current state allows pausing validation
   */
  canPause(): boolean {
    return this.canTransition('pause');
  }

  /**
   * Check if the current state allows resuming validation
   */
  canResume(): boolean {
    return this.canTransition('resume');
  }

  /**
   * Check if the current state allows stopping validation
   */
  canStop(): boolean {
    return this.canTransition('stop');
  }

  /**
   * Check if validation is currently active (running or paused)
   */
  isActive(): boolean {
    return this._currentState === 'running' || this._currentState === 'paused';
  }

  /**
   * Check if validation is completed (successfully or with error)
   */
  isCompleted(): boolean {
    return this._currentState === 'completed' || this._currentState === 'error';
  }
}

/**
 * Factory function to create a new validation state machine
 */
export function createValidationStateMachine(initialState: ValidationState = 'idle'): ValidationStateMachine {
  return new ValidationStateMachineImpl(initialState);
}

/**
 * Utility function to get user-friendly state description
 */
export function getStateDescription(state: ValidationState): string {
  const descriptions: Record<ValidationState, string> = {
    idle: 'Ready to start validation',
    running: 'Validation in progress',
    paused: 'Validation paused',
    completed: 'Validation completed successfully',
    error: 'Validation failed with errors'
  };

  return descriptions[state];
}

/**
 * Utility function to get state color for UI display
 */
export function getStateColor(state: ValidationState): string {
  const colors: Record<ValidationState, string> = {
    idle: 'gray',
    running: 'blue',
    paused: 'yellow',
    completed: 'green',
    error: 'red'
  };

  return colors[state];
}
