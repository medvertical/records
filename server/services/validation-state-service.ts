// ============================================================================
// Validation State Service
// ============================================================================

import { storage } from '../storage.js';
import { validationWebSocket } from './websocket-server.js';

export interface ValidationState {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'error';
  progress: {
    totalResources: number;
    processedResources: number;
    validResources: number;
    errorResources: number;
    warningResources: number;
    currentResourceType?: string;
    startTime: Date;
    estimatedTimeRemaining?: number;
    isComplete: boolean;
    errors: string[];
  };
  configuration: {
    resourceTypes: string[];
    batchSize: number;
    skipUnchanged: boolean;
    validationSettings: any;
  };
  resumeData?: {
    resourceTypes: string[];
    currentTypeIndex: number;
    resourceTypeProgress: Record<string, number>;
    currentOffset: number;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ValidationStateUpdate {
  status?: ValidationState['status'];
  progress?: Partial<ValidationState['progress']>;
  configuration?: Partial<ValidationState['configuration']>;
  resumeData?: Partial<ValidationState['resumeData']>;
}

export class ValidationStateService {
  private static instance: ValidationStateService;
  private currentState: ValidationState | null = null;
  private stateListeners: Set<(state: ValidationState | null) => void> = new Set();

  private constructor() {}

  static getInstance(): ValidationStateService {
    if (!ValidationStateService.instance) {
      ValidationStateService.instance = new ValidationStateService();
    }
    return ValidationStateService.instance;
  }

  /**
   * Create a new validation state
   */
  async createState(configuration: ValidationState['configuration']): Promise<ValidationState> {
    const state: ValidationState = {
      id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'idle',
      progress: {
        totalResources: 0,
        processedResources: 0,
        validResources: 0,
        errorResources: 0,
        warningResources: 0,
        startTime: new Date(),
        isComplete: false,
        errors: []
      },
      configuration,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentState = state;
    await this.persistState();
    this.notifyListeners();
    
    return state;
  }

  /**
   * Update the current validation state
   */
  async updateState(updates: ValidationStateUpdate): Promise<ValidationState | null> {
    if (!this.currentState) {
      throw new Error('No validation state to update');
    }

    // Apply updates
    if (updates.status !== undefined) {
      this.currentState.status = updates.status;
    }

    if (updates.progress) {
      this.currentState.progress = { ...this.currentState.progress, ...updates.progress };
    }

    if (updates.configuration) {
      this.currentState.configuration = { ...this.currentState.configuration, ...updates.configuration };
    }

    if (updates.resumeData) {
      this.currentState.resumeData = { ...this.currentState.resumeData, ...updates.resumeData };
    }

    this.currentState.updatedAt = new Date();

    // Set completion time if status changed to completed
    if (updates.status === 'completed') {
      this.currentState.completedAt = new Date();
    }

    // Validate and sanitize the state
    this.validateAndSanitizeState();

    await this.persistState();
    this.notifyListeners();

    // Broadcast state changes via WebSocket
    this.broadcastStateChange();

    return this.currentState;
  }

  /**
   * Get the current validation state
   */
  getCurrentState(): ValidationState | null {
    return this.currentState;
  }

  /**
   * Get validation state by ID
   */
  async getStateById(id: string): Promise<ValidationState | null> {
    try {
      const stateData = await storage.getValidationState(id);
      return stateData ? this.deserializeState(stateData) : null;
    } catch (error) {
      console.error('Failed to get validation state:', error);
      return null;
    }
  }

  /**
   * Pause the current validation
   */
  async pauseValidation(): Promise<void> {
    if (!this.currentState) {
      throw new Error('No validation to pause');
    }

    if (this.currentState.status !== 'running') {
      throw new Error('Validation is not running');
    }

    await this.updateState({ status: 'paused' });
  }

  /**
   * Resume the current validation
   */
  async resumeValidation(): Promise<void> {
    if (!this.currentState) {
      throw new Error('No validation to resume');
    }

    if (this.currentState.status !== 'paused') {
      throw new Error('Validation is not paused');
    }

    await this.updateState({ status: 'running' });
  }

  /**
   * Stop the current validation
   */
  async stopValidation(): Promise<void> {
    if (!this.currentState) {
      throw new Error('No validation to stop');
    }

    if (this.currentState.status === 'idle' || this.currentState.status === 'completed') {
      throw new Error('Validation is not running or paused');
    }

    await this.updateState({ status: 'stopping' });
  }

  /**
   * Complete the current validation
   */
  async completeValidation(): Promise<void> {
    if (!this.currentState) {
      throw new Error('No validation to complete');
    }

    await this.updateState({ 
      status: 'completed',
      progress: { ...this.currentState.progress, isComplete: true }
    });
  }

  /**
   * Set validation error
   */
  async setValidationError(error: string): Promise<void> {
    if (!this.currentState) {
      throw new Error('No validation state to update');
    }

    const updatedErrors = [...this.currentState.progress.errors, error];
    await this.updateState({ 
      status: 'error',
      progress: { errors: updatedErrors }
    });
  }

  /**
   * Clear the current validation state
   */
  async clearState(): Promise<void> {
    if (this.currentState) {
      await storage.deleteValidationState(this.currentState.id);
    }
    
    this.currentState = null;
    this.notifyListeners();
  }

  /**
   * Add a state change listener
   */
  addStateListener(listener: (state: ValidationState | null) => void): void {
    this.stateListeners.add(listener);
  }

  /**
   * Remove a state change listener
   */
  removeStateListener(listener: (state: ValidationState | null) => void): void {
    this.stateListeners.delete(listener);
  }

  /**
   * Get validation history
   */
  async getValidationHistory(limit: number = 10): Promise<ValidationState[]> {
    try {
      const historyData = await storage.getValidationHistory(limit);
      return historyData.map(data => this.deserializeState(data));
    } catch (error) {
      console.error('Failed to get validation history:', error);
      return [];
    }
  }

  /**
   * Recover validation state from database
   */
  async recoverState(): Promise<ValidationState | null> {
    try {
      const latestState = await storage.getLatestValidationState();
      if (latestState) {
        this.currentState = this.deserializeState(latestState);
        this.notifyListeners();
        return this.currentState;
      }
    } catch (error) {
      console.error('Failed to recover validation state:', error);
    }
    return null;
  }

  /**
   * Validate and sanitize the current state
   */
  private validateAndSanitizeState(): void {
    if (!this.currentState) return;

    const state = this.currentState;

    // Validate status
    const validStatuses = ['idle', 'running', 'paused', 'stopping', 'completed', 'error'];
    if (!validStatuses.includes(state.status)) {
      state.status = 'idle';
    }

    // Sanitize progress data
    const progress = state.progress;
    progress.totalResources = Math.max(0, progress.totalResources);
    progress.processedResources = Math.max(0, progress.processedResources);
    progress.validResources = Math.max(0, progress.validResources);
    progress.errorResources = Math.max(0, progress.errorResources);
    progress.warningResources = Math.max(0, progress.warningResources);

    // Ensure processed resources doesn't exceed total resources
    progress.processedResources = Math.min(progress.processedResources, progress.totalResources);

    // Ensure valid + error + warning resources don't exceed processed resources
    const totalProcessed = progress.validResources + progress.errorResources + progress.warningResources;
    if (totalProcessed > progress.processedResources) {
      // Adjust warning resources to maintain consistency
      progress.warningResources = Math.max(0, progress.processedResources - progress.validResources - progress.errorResources);
    }

    // Ensure estimated time remaining is reasonable
    if (progress.estimatedTimeRemaining !== undefined) {
      progress.estimatedTimeRemaining = Math.max(0, Math.min(progress.estimatedTimeRemaining, 24 * 60 * 60 * 1000)); // Max 24 hours
    }

    // Validate dates
    if (!progress.startTime || isNaN(progress.startTime.getTime())) {
      progress.startTime = new Date();
    }

    if (!state.createdAt || isNaN(state.createdAt.getTime())) {
      state.createdAt = new Date();
    }

    if (!state.updatedAt || isNaN(state.updatedAt.getTime())) {
      state.updatedAt = new Date();
    }

    // Validate configuration
    if (!state.configuration.resourceTypes || !Array.isArray(state.configuration.resourceTypes)) {
      state.configuration.resourceTypes = [];
    }

    if (typeof state.configuration.batchSize !== 'number' || state.configuration.batchSize < 1) {
      state.configuration.batchSize = 100;
    }

    if (typeof state.configuration.skipUnchanged !== 'boolean') {
      state.configuration.skipUnchanged = true;
    }
  }

  /**
   * Persist the current state to database
   */
  private async persistState(): Promise<void> {
    if (!this.currentState) return;

    try {
      const serializedState = this.serializeState(this.currentState);
      await storage.saveValidationState(this.currentState.id, serializedState);
    } catch (error) {
      console.error('Failed to persist validation state:', error);
    }
  }

  /**
   * Serialize state for database storage
   */
  private serializeState(state: ValidationState): any {
    return {
      ...state,
      progress: {
        ...state.progress,
        startTime: state.progress.startTime.toISOString()
      },
      createdAt: state.createdAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
      completedAt: state.completedAt?.toISOString()
    };
  }

  /**
   * Deserialize state from database storage
   */
  private deserializeState(data: any): ValidationState {
    return {
      ...data,
      progress: {
        ...data.progress,
        startTime: new Date(data.progress.startTime)
      },
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined
    };
  }

  /**
   * Notify all state listeners
   */
  private notifyListeners(): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(this.currentState);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Broadcast state changes via WebSocket
   */
  private broadcastStateChange(): void {
    if (!this.currentState || !validationWebSocket) return;

    try {
      validationWebSocket.broadcastStateChange({
        type: 'validation-state-update',
        data: this.currentState
      });
    } catch (error) {
      console.error('Failed to broadcast state change:', error);
    }
  }
}
