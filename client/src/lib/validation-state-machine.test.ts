/**
 * Unit tests for Validation State Machine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ValidationStateMachineImpl,
  createValidationStateMachine,
  getStateDescription,
  getStateColor,
  type ValidationState,
  type ValidationAction
} from './validation-state-machine';

describe('ValidationStateMachineImpl', () => {
  let stateMachine: ValidationStateMachineImpl;

  beforeEach(() => {
    stateMachine = new ValidationStateMachineImpl();
  });

  describe('Initial State', () => {
    it('should start in idle state by default', () => {
      expect(stateMachine.currentState).toBe('idle');
    });

    it('should start in specified initial state', () => {
      const sm = new ValidationStateMachineImpl('running');
      expect(sm.currentState).toBe('running');
    });
  });

  describe('Valid Transitions', () => {
    it('should allow start from idle', () => {
      expect(stateMachine.canTransition('start')).toBe(true);
      const newState = stateMachine.transition('start');
      expect(newState).toBe('running');
      expect(stateMachine.currentState).toBe('running');
    });

    it('should allow pause from running', () => {
      stateMachine.transition('start');
      expect(stateMachine.canTransition('pause')).toBe(true);
      const newState = stateMachine.transition('pause');
      expect(newState).toBe('paused');
      expect(stateMachine.currentState).toBe('paused');
    });

    it('should allow resume from paused', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canTransition('resume')).toBe(true);
      const newState = stateMachine.transition('resume');
      expect(newState).toBe('running');
      expect(stateMachine.currentState).toBe('running');
    });

    it('should allow stop from running', () => {
      stateMachine.transition('start');
      expect(stateMachine.canTransition('stop')).toBe(true);
      const newState = stateMachine.transition('stop');
      expect(newState).toBe('idle');
      expect(stateMachine.currentState).toBe('idle');
    });

    it('should allow stop from paused', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canTransition('stop')).toBe(true);
      const newState = stateMachine.transition('stop');
      expect(newState).toBe('idle');
      expect(stateMachine.currentState).toBe('idle');
    });

    it('should allow complete from running', () => {
      stateMachine.transition('start');
      expect(stateMachine.canTransition('complete')).toBe(true);
      const newState = stateMachine.transition('complete');
      expect(newState).toBe('completed');
      expect(stateMachine.currentState).toBe('completed');
    });

    it('should allow error from running', () => {
      stateMachine.transition('start');
      expect(stateMachine.canTransition('error')).toBe(true);
      const newState = stateMachine.transition('error');
      expect(newState).toBe('error');
      expect(stateMachine.currentState).toBe('error');
    });

    it('should allow error from paused', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canTransition('error')).toBe(true);
      const newState = stateMachine.transition('error');
      expect(newState).toBe('error');
      expect(stateMachine.currentState).toBe('error');
    });

    it('should allow start from completed', () => {
      stateMachine.transition('start');
      stateMachine.transition('complete');
      expect(stateMachine.canTransition('start')).toBe(true);
      const newState = stateMachine.transition('start');
      expect(newState).toBe('running');
      expect(stateMachine.currentState).toBe('running');
    });

    it('should allow start from error', () => {
      stateMachine.transition('start');
      stateMachine.transition('error');
      expect(stateMachine.canTransition('start')).toBe(true);
      const newState = stateMachine.transition('start');
      expect(newState).toBe('running');
      expect(stateMachine.currentState).toBe('running');
    });
  });

  describe('Invalid Transitions', () => {
    it('should not allow pause from idle', () => {
      expect(stateMachine.canTransition('pause')).toBe(false);
      expect(() => stateMachine.transition('pause')).toThrow(
        "Invalid transition: cannot perform 'pause' from state 'idle'"
      );
    });

    it('should not allow resume from idle', () => {
      expect(stateMachine.canTransition('resume')).toBe(false);
      expect(() => stateMachine.transition('resume')).toThrow(
        "Invalid transition: cannot perform 'resume' from state 'idle'"
      );
    });

    it('should not allow stop from idle', () => {
      expect(stateMachine.canTransition('stop')).toBe(false);
      expect(() => stateMachine.transition('stop')).toThrow(
        "Invalid transition: cannot perform 'stop' from state 'idle'"
      );
    });

    it('should not allow complete from idle', () => {
      expect(stateMachine.canTransition('complete')).toBe(false);
      expect(() => stateMachine.transition('complete')).toThrow(
        "Invalid transition: cannot perform 'complete' from state 'idle'"
      );
    });

    it('should not allow error from idle', () => {
      expect(stateMachine.canTransition('error')).toBe(false);
      expect(() => stateMachine.transition('error')).toThrow(
        "Invalid transition: cannot perform 'error' from state 'idle'"
      );
    });

    it('should not allow start from running', () => {
      stateMachine.transition('start');
      expect(stateMachine.canTransition('start')).toBe(false);
      expect(() => stateMachine.transition('start')).toThrow(
        "Invalid transition: cannot perform 'start' from state 'running'"
      );
    });

    it('should not allow start from paused', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canTransition('start')).toBe(false);
      expect(() => stateMachine.transition('start')).toThrow(
        "Invalid transition: cannot perform 'start' from state 'paused'"
      );
    });

    it('should not allow pause from paused', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canTransition('pause')).toBe(false);
      expect(() => stateMachine.transition('pause')).toThrow(
        "Invalid transition: cannot perform 'pause' from state 'paused'"
      );
    });

    it('should not allow resume from running', () => {
      stateMachine.transition('start');
      expect(stateMachine.canTransition('resume')).toBe(false);
      expect(() => stateMachine.transition('resume')).toThrow(
        "Invalid transition: cannot perform 'resume' from state 'running'"
      );
    });

    it('should not allow complete from paused', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canTransition('complete')).toBe(false);
      expect(() => stateMachine.transition('complete')).toThrow(
        "Invalid transition: cannot perform 'complete' from state 'paused'"
      );
    });
  });

  describe('State Queries', () => {
    it('should return correct valid actions for idle state', () => {
      expect(stateMachine.getValidActions()).toEqual(['start']);
    });

    it('should return correct valid actions for running state', () => {
      stateMachine.transition('start');
      expect(stateMachine.getValidActions()).toEqual(['pause', 'stop', 'complete', 'error']);
    });

    it('should return correct valid actions for paused state', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.getValidActions()).toEqual(['resume', 'stop', 'error']);
    });

    it('should return correct valid actions for completed state', () => {
      stateMachine.transition('start');
      stateMachine.transition('complete');
      expect(stateMachine.getValidActions()).toEqual(['start']);
    });

    it('should return correct valid actions for error state', () => {
      stateMachine.transition('start');
      stateMachine.transition('error');
      expect(stateMachine.getValidActions()).toEqual(['start']);
    });
  });

  describe('Convenience Methods', () => {
    it('should correctly identify if validation can start', () => {
      expect(stateMachine.canStart()).toBe(true);
      stateMachine.transition('start');
      expect(stateMachine.canStart()).toBe(false);
    });

    it('should correctly identify if validation can pause', () => {
      expect(stateMachine.canPause()).toBe(false);
      stateMachine.transition('start');
      expect(stateMachine.canPause()).toBe(true);
    });

    it('should correctly identify if validation can resume', () => {
      expect(stateMachine.canResume()).toBe(false);
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.canResume()).toBe(true);
    });

    it('should correctly identify if validation can stop', () => {
      expect(stateMachine.canStop()).toBe(false);
      stateMachine.transition('start');
      expect(stateMachine.canStop()).toBe(true);
    });

    it('should correctly identify if validation is active', () => {
      expect(stateMachine.isActive()).toBe(false);
      stateMachine.transition('start');
      expect(stateMachine.isActive()).toBe(true);
      stateMachine.transition('pause');
      expect(stateMachine.isActive()).toBe(true);
      stateMachine.transition('stop');
      expect(stateMachine.isActive()).toBe(false);
    });

    it('should correctly identify if validation is completed', () => {
      expect(stateMachine.isCompleted()).toBe(false);
      stateMachine.transition('start');
      stateMachine.transition('complete');
      expect(stateMachine.isCompleted()).toBe(true);
      stateMachine.transition('start');
      stateMachine.transition('error');
      expect(stateMachine.isCompleted()).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset to idle state', () => {
      stateMachine.transition('start');
      stateMachine.transition('pause');
      expect(stateMachine.currentState).toBe('paused');
      
      stateMachine.reset();
      expect(stateMachine.currentState).toBe('idle');
    });
  });
});

describe('Factory Function', () => {
  it('should create state machine with default idle state', () => {
    const sm = createValidationStateMachine();
    expect(sm.currentState).toBe('idle');
  });

  it('should create state machine with specified initial state', () => {
    const sm = createValidationStateMachine('running');
    expect(sm.currentState).toBe('running');
  });
});

describe('Utility Functions', () => {
  describe('getStateDescription', () => {
    it('should return correct descriptions for all states', () => {
      expect(getStateDescription('idle')).toBe('Ready to start validation');
      expect(getStateDescription('running')).toBe('Validation in progress');
      expect(getStateDescription('paused')).toBe('Validation paused');
      expect(getStateDescription('completed')).toBe('Validation completed successfully');
      expect(getStateDescription('error')).toBe('Validation failed with errors');
    });
  });

  describe('getStateColor', () => {
    it('should return correct colors for all states', () => {
      expect(getStateColor('idle')).toBe('gray');
      expect(getStateColor('running')).toBe('blue');
      expect(getStateColor('paused')).toBe('yellow');
      expect(getStateColor('completed')).toBe('green');
      expect(getStateColor('error')).toBe('red');
    });
  });
});

describe('Complete State Machine Flow', () => {
  it('should handle complete validation flow: idle → running → completed', () => {
    const sm = new ValidationStateMachineImpl();
    
    expect(sm.currentState).toBe('idle');
    expect(sm.canStart()).toBe(true);
    
    sm.transition('start');
    expect(sm.currentState).toBe('running');
    expect(sm.isActive()).toBe(true);
    
    sm.transition('complete');
    expect(sm.currentState).toBe('completed');
    expect(sm.isCompleted()).toBe(true);
    expect(sm.isActive()).toBe(false);
  });

  it('should handle pause/resume flow: idle → running → paused → running → completed', () => {
    const sm = new ValidationStateMachineImpl();
    
    sm.transition('start');
    expect(sm.currentState).toBe('running');
    
    sm.transition('pause');
    expect(sm.currentState).toBe('paused');
    expect(sm.isActive()).toBe(true);
    
    sm.transition('resume');
    expect(sm.currentState).toBe('running');
    expect(sm.isActive()).toBe(true);
    
    sm.transition('complete');
    expect(sm.currentState).toBe('completed');
    expect(sm.isCompleted()).toBe(true);
  });

  it('should handle error flow: idle → running → error', () => {
    const sm = new ValidationStateMachineImpl();
    
    sm.transition('start');
    expect(sm.currentState).toBe('running');
    
    sm.transition('error');
    expect(sm.currentState).toBe('error');
    expect(sm.isCompleted()).toBe(true);
    expect(sm.isActive()).toBe(false);
  });

  it('should handle stop flow: idle → running → idle', () => {
    const sm = new ValidationStateMachineImpl();
    
    sm.transition('start');
    expect(sm.currentState).toBe('running');
    
    sm.transition('stop');
    expect(sm.currentState).toBe('idle');
    expect(sm.isActive()).toBe(false);
    expect(sm.isCompleted()).toBe(false);
  });
});
