/**
 * Validation State Persistence
 * 
 * Handles persistence of validation state across browser sessions and server restarts.
 * Uses localStorage for client-side persistence and integrates with backend state management.
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

// Persistence keys for localStorage
const PERSISTENCE_KEYS = {
  VALIDATION_STATE: 'validation_state',
  VALIDATION_PROGRESS: 'validation_progress',
  VALIDATION_TIMESTAMP: 'validation_timestamp',
  SERVER_ID: 'validation_server_id',
  SESSION_ID: 'validation_session_id'
} as const;

// Persistence configuration
const PERSISTENCE_CONFIG = {
  MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
} as const;

// Stored validation state
export interface StoredValidationState {
  state: ValidationState;
  timestamp: number;
  serverId?: number;
  sessionId: string;
  progress?: BackendValidationProgress;
  metadata?: {
    userAgent: string;
    url: string;
    version: string;
  };
}

// Persistence result
export interface PersistenceResult {
  success: boolean;
  error?: string;
  restored?: boolean;
  cleaned?: boolean;
}

/**
 * Validation State Persistence Manager
 * 
 * Manages persistence of validation state across browser sessions and server restarts.
 * Handles localStorage operations, data validation, and cleanup.
 */
export class ValidationStatePersistence {
  private stateMachine: ValidationStateMachine;
  private statusMapper = createValidationStatusMapper();
  private sessionId: string;
  private serverId?: number;

  constructor(serverId?: number) {
    this.stateMachine = createValidationStateMachine();
    this.sessionId = this.generateSessionId();
    this.serverId = serverId;
    
    // Initialize cleanup interval
    this.initializeCleanup();
  }

  /**
   * Save current validation state to localStorage
   */
  async saveState(
    state: ValidationState, 
    progress?: BackendValidationProgress
  ): Promise<PersistenceResult> {
    try {
      const storedState: StoredValidationState = {
        state,
        timestamp: Date.now(),
        serverId: this.serverId,
        sessionId: this.sessionId,
        progress,
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          version: '1.0.0' // Could be from package.json
        }
      };

      // Validate data before saving
      if (!this.validateStoredState(storedState)) {
        return {
          success: false,
          error: 'Invalid state data'
        };
      }

      // Save to localStorage with retry logic
      await this.saveToLocalStorage(PERSISTENCE_KEYS.VALIDATION_STATE, storedState);
      
      if (progress) {
        await this.saveToLocalStorage(PERSISTENCE_KEYS.VALIDATION_PROGRESS, progress);
      }

      await this.saveToLocalStorage(PERSISTENCE_KEYS.VALIDATION_TIMESTAMP, Date.now());
      await this.saveToLocalStorage(PERSISTENCE_KEYS.SERVER_ID, this.serverId);
      await this.saveToLocalStorage(PERSISTENCE_KEYS.SESSION_ID, this.sessionId);

      return { success: true };
    } catch (error) {
      console.error('[ValidationStatePersistence] Failed to save state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restore validation state from localStorage
   */
  async restoreState(): Promise<{
    state: ValidationState;
    progress?: BackendValidationProgress;
    restored: boolean;
    error?: string;
  }> {
    try {
      // Check if we have stored state
      const storedState = await this.loadFromLocalStorage<StoredValidationState>(
        PERSISTENCE_KEYS.VALIDATION_STATE
      );

      if (!storedState) {
        return {
          state: 'idle',
          restored: false
        };
      }

      // Validate stored state
      if (!this.validateStoredState(storedState)) {
        await this.clearStoredState();
        return {
          state: 'idle',
          restored: false,
          error: 'Invalid stored state data'
        };
      }

      // Check if state is too old
      if (this.isStateExpired(storedState)) {
        await this.clearStoredState();
        return {
          state: 'idle',
          restored: false,
          error: 'Stored state expired'
        };
      }

      // Check server ID match
      if (this.serverId && storedState.serverId && this.serverId !== storedState.serverId) {
        await this.clearStoredState();
        return {
          state: 'idle',
          restored: false,
          error: 'Server ID mismatch'
        };
      }

      // Restore progress if available
      const progress = await this.loadFromLocalStorage<BackendValidationProgress>(
        PERSISTENCE_KEYS.VALIDATION_PROGRESS
      );

      // Update state machine
      this.stateMachine.reset();
      this.syncStateMachineToState(storedState.state);

      return {
        state: storedState.state,
        progress,
        restored: true
      };
    } catch (error) {
      console.error('[ValidationStatePersistence] Failed to restore state:', error);
      return {
        state: 'idle',
        restored: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear all stored validation state
   */
  async clearStoredState(): Promise<PersistenceResult> {
    try {
      const keys = Object.values(PERSISTENCE_KEYS);
      
      for (const key of keys) {
        localStorage.removeItem(key);
      }

      return { success: true, cleaned: true };
    } catch (error) {
      console.error('[ValidationStatePersistence] Failed to clear state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current state machine instance
   */
  getStateMachine(): ValidationStateMachine {
    return this.stateMachine;
  }

  /**
   * Update server ID and clear state if different
   */
  async updateServerId(newServerId?: number): Promise<PersistenceResult> {
    if (this.serverId !== newServerId) {
      this.serverId = newServerId;
      // Clear stored state when server changes
      return await this.clearStoredState();
    }
    return { success: true };
  }

  /**
   * Check if we have valid stored state
   */
  async hasStoredState(): Promise<boolean> {
    try {
      const storedState = await this.loadFromLocalStorage<StoredValidationState>(
        PERSISTENCE_KEYS.VALIDATION_STATE
      );
      
      if (!storedState) return false;
      
      return this.validateStoredState(storedState) && !this.isStateExpired(storedState);
    } catch {
      return false;
    }
  }

  /**
   * Get stored state metadata
   */
  async getStoredStateMetadata(): Promise<{
    timestamp?: number;
    serverId?: number;
    sessionId?: string;
    age?: number;
  } | null> {
    try {
      const storedState = await this.loadFromLocalStorage<StoredValidationState>(
        PERSISTENCE_KEYS.VALIDATION_STATE
      );
      
      if (!storedState) return null;
      
      return {
        timestamp: storedState.timestamp,
        serverId: storedState.serverId,
        sessionId: storedState.sessionId,
        age: Date.now() - storedState.timestamp
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save data to localStorage with retry logic
   */
  private async saveToLocalStorage<T>(key: string, data: T): Promise<void> {
    let attempts = 0;
    
    while (attempts < PERSISTENCE_CONFIG.RETRY_ATTEMPTS) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return;
      } catch (error) {
        attempts++;
        if (attempts >= PERSISTENCE_CONFIG.RETRY_ATTEMPTS) {
          throw error;
        }
        await this.delay(PERSISTENCE_CONFIG.RETRY_DELAY_MS);
      }
    }
  }

  /**
   * Load data from localStorage
   */
  private async loadFromLocalStorage<T>(key: string): Promise<T | null> {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`[ValidationStatePersistence] Failed to load ${key}:`, error);
      return null;
    }
  }

  /**
   * Validate stored state data
   */
  private validateStoredState(state: StoredValidationState): boolean {
    if (!state || typeof state !== 'object') return false;
    
    const validStates: ValidationState[] = ['idle', 'running', 'paused', 'completed', 'error'];
    if (!validStates.includes(state.state)) return false;
    
    if (typeof state.timestamp !== 'number' || state.timestamp <= 0) return false;
    if (typeof state.sessionId !== 'string' || state.sessionId.length === 0) return false;
    
    return true;
  }

  /**
   * Check if stored state is expired
   */
  private isStateExpired(state: StoredValidationState): boolean {
    const age = Date.now() - state.timestamp;
    return age > PERSISTENCE_CONFIG.MAX_AGE_MS;
  }

  /**
   * Sync state machine to a specific state
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
   * Initialize cleanup interval for expired data
   */
  private initializeCleanup(): void {
    // Run cleanup on page load
    this.cleanupExpiredData();
    
    // Set up interval for periodic cleanup
    setInterval(() => {
      this.cleanupExpiredData();
    }, PERSISTENCE_CONFIG.CLEANUP_INTERVAL_MS);
  }

  /**
   * Clean up expired data
   */
  private async cleanupExpiredData(): Promise<void> {
    try {
      const storedState = await this.loadFromLocalStorage<StoredValidationState>(
        PERSISTENCE_KEYS.VALIDATION_STATE
      );
      
      if (storedState && this.isStateExpired(storedState)) {
        await this.clearStoredState();
        console.log('[ValidationStatePersistence] Cleaned up expired state');
      }
    } catch (error) {
      console.warn('[ValidationStatePersistence] Cleanup failed:', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create validation state persistence manager
 */
export function createValidationStatePersistence(serverId?: number): ValidationStatePersistence {
  return new ValidationStatePersistence(serverId);
}

/**
 * Utility function to check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility function to get localStorage usage info
 */
export function getLocalStorageInfo(): {
  available: boolean;
  used: number;
  quota?: number;
} {
  const available = isLocalStorageAvailable();
  
  if (!available) {
    return { available: false, used: 0 };
  }
  
  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }
  
  return {
    available: true,
    used,
    quota: undefined // Not easily accessible in all browsers
  };
}
