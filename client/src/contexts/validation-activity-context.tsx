import React, { createContext, useContext, useState, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface ResourceValidationProgress {
  resourceId: number;
  fhirId: string;
  resourceType: string;
  progress: number;
  currentAspect: string;
  completedAspects: string[];
  totalAspects: number;
}

export interface BatchValidationState {
  isActive: boolean;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  progress: number;
  processedResources: number;
  totalResources: number;
  currentResourceType: string | null;
  estimatedTimeRemaining: number | null;
  startTime: Date | null;
  validResources: number;
  errorResources: number;
}

export interface ValidationActivityState {
  // Batch validation from dashboard
  batchValidation: BatchValidationState;
  
  // Individual resource validations
  individualValidations: Map<number, ResourceValidationProgress>;
  
  // Computed values
  totalActiveValidations: number;
  overallProgress: number;
  hasActivity: boolean;
}

interface ValidationActivityContextValue {
  state: ValidationActivityState;
  updateBatchValidation: (state: Partial<BatchValidationState>) => void;
  addResourceValidation: (resourceId: number, progress: ResourceValidationProgress) => void;
  updateResourceValidation: (resourceId: number, progress: Partial<ResourceValidationProgress>) => void;
  removeResourceValidation: (resourceId: number) => void;
  clearAllActivity: () => void;
}

// ============================================================================
// Context
// ============================================================================

const ValidationActivityContext = createContext<ValidationActivityContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

export function ValidationActivityProvider({ children }: { children: React.ReactNode }) {
  const [batchValidation, setBatchValidation] = useState<BatchValidationState>({
    isActive: false,
    status: 'idle',
    progress: 0,
    processedResources: 0,
    totalResources: 0,
    currentResourceType: null,
    estimatedTimeRemaining: null,
    startTime: null,
    validResources: 0,
    errorResources: 0,
  });

  const [individualValidations, setIndividualValidations] = useState<Map<number, ResourceValidationProgress>>(
    new Map()
  );

  // Update batch validation state
  const updateBatchValidation = useCallback((updates: Partial<BatchValidationState>) => {
    setBatchValidation(prev => ({
      ...prev,
      ...updates,
      isActive: updates.status === 'running' || updates.status === 'paused' || prev.isActive,
    }));
  }, []);

  // Add a new resource validation
  const addResourceValidation = useCallback((resourceId: number, progress: ResourceValidationProgress) => {
    setIndividualValidations(prev => {
      const next = new Map(prev);
      next.set(resourceId, progress);
      return next;
    });
  }, []);

  // Update an existing resource validation
  const updateResourceValidation = useCallback((resourceId: number, updates: Partial<ResourceValidationProgress>) => {
    setIndividualValidations(prev => {
      const next = new Map(prev);
      const current = next.get(resourceId);
      if (current) {
        next.set(resourceId, { ...current, ...updates });
      }
      return next;
    });
  }, []);

  // Remove a resource validation (when complete or failed)
  const removeResourceValidation = useCallback((resourceId: number) => {
    setIndividualValidations(prev => {
      const next = new Map(prev);
      next.delete(resourceId);
      return next;
    });
  }, []);

  // Clear all activity
  const clearAllActivity = useCallback(() => {
    setBatchValidation({
      isActive: false,
      status: 'idle',
      progress: 0,
      processedResources: 0,
      totalResources: 0,
      currentResourceType: null,
      estimatedTimeRemaining: null,
      startTime: null,
      validResources: 0,
      errorResources: 0,
    });
    setIndividualValidations(new Map());
  }, []);

  // Compute derived values
  const totalActiveValidations = individualValidations.size + (batchValidation.isActive ? 1 : 0);
  
  const overallProgress = (() => {
    if (totalActiveValidations === 0) return 0;
    
    let totalProgress = 0;
    let count = 0;
    
    // Add batch validation progress
    if (batchValidation.isActive) {
      totalProgress += batchValidation.progress;
      count++;
    }
    
    // Add individual validation progress
    individualValidations.forEach(validation => {
      totalProgress += validation.progress;
      count++;
    });
    
    return count > 0 ? totalProgress / count : 0;
  })();

  const hasActivity = totalActiveValidations > 0;

  const state: ValidationActivityState = {
    batchValidation,
    individualValidations,
    totalActiveValidations,
    overallProgress,
    hasActivity,
  };

  const value: ValidationActivityContextValue = {
    state,
    updateBatchValidation,
    addResourceValidation,
    updateResourceValidation,
    removeResourceValidation,
    clearAllActivity,
  };

  return (
    <ValidationActivityContext.Provider value={value}>
      {children}
    </ValidationActivityContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useValidationActivity() {
  const context = useContext(ValidationActivityContext);
  if (!context) {
    throw new Error('useValidationActivity must be used within ValidationActivityProvider');
  }
  return context;
}

