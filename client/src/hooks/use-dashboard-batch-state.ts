import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BatchValidationHistoryItem, ValidationProgress } from '@shared/types/dashboard';

interface StartBatchParams {
  resourceTypes: string[];
  validationAspects?: {
    structural?: boolean;
    profile?: boolean;
    terminology?: boolean;
    reference?: boolean;
    businessRule?: boolean;
    metadata?: boolean;
  };
  config?: {
    batchSize?: number;
    maxConcurrent?: number;
    priority?: string;
  };
}

interface BatchProgress {
  isRunning: boolean;
  isPaused: boolean;
  jobId: string;
  totalResources: number;
  processedResources: number;
  errors: number;
  warnings: number;
  currentResourceType?: string;
  resourceTypeProgress?: Record<string, {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
  }>;
  estimatedTimeRemaining?: number;
  processingRate?: number;
}

export function useDashboardBatchState() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'running'>('idle');

  // Poll batch progress when running
  const { data: progressData } = useQuery<BatchProgress>({
    queryKey: ['batch-validation-progress'],
    queryFn: async () => {
      const response = await fetch('/api/validation/bulk/progress');
      if (!response.ok) {
        throw new Error('Failed to fetch batch progress');
      }
      return response.json();
    },
    refetchInterval: (data) => {
      // Poll every 2s when running, stop when idle
      return data?.isRunning ? 2000 : false;
    },
    refetchIntervalInBackground: false,
  });

  // Fetch batch history
  const { data: history = [] } = useQuery<BatchValidationHistoryItem[]>({
    queryKey: ['batch-validation-history'],
    queryFn: async () => {
      const response = await fetch('/api/validation/batch/history?limit=10');
      if (!response.ok) {
        throw new Error('Failed to fetch batch history');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh history every 30s
  });

  // Update mode based on progress
  useEffect(() => {
    if (progressData?.isRunning) {
      setMode('running');
    } else {
      setMode('idle');
      // Refresh history when batch completes
      if (mode === 'running') {
        queryClient.invalidateQueries({ queryKey: ['batch-validation-history'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      }
    }
  }, [progressData?.isRunning, mode, queryClient]);

  // Start batch validation mutation
  const startBatchMutation = useMutation({
    mutationFn: async (params: StartBatchParams) => {
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start batch validation');
      }
      return response.json();
    },
    onSuccess: () => {
      // Start polling progress
      queryClient.invalidateQueries({ queryKey: ['batch-validation-progress'] });
      setMode('running');
    },
  });

  // Pause batch validation
  const pauseBatchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/bulk/pause', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to pause batch validation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-validation-progress'] });
    },
  });

  // Resume batch validation
  const resumeBatchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/bulk/resume', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to resume batch validation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-validation-progress'] });
    },
  });

  // Stop batch validation
  const stopBatchMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/bulk/stop', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to stop batch validation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-validation-progress'] });
      queryClient.invalidateQueries({ queryKey: ['batch-validation-history'] });
      setMode('idle');
    },
  });

  const startBatch = useCallback(
    (params: StartBatchParams) => startBatchMutation.mutate(params),
    [startBatchMutation]
  );

  const pauseBatch = useCallback(
    () => pauseBatchMutation.mutate(),
    [pauseBatchMutation]
  );

  const resumeBatch = useCallback(
    () => resumeBatchMutation.mutate(),
    [resumeBatchMutation]
  );

  const stopBatch = useCallback(
    () => stopBatchMutation.mutate(),
    [stopBatchMutation]
  );

  // Transform progress data to ValidationProgress format
  const currentBatch: ValidationProgress | undefined = progressData ? {
    totalResources: progressData.totalResources,
    processedResources: progressData.processedResources,
    validResources: progressData.processedResources - progressData.errors,
    errorResources: progressData.errors,
    warningResources: progressData.warnings,
    currentResourceType: progressData.currentResourceType,
    startTime: new Date(), // You might want to track this separately
    estimatedTimeRemaining: progressData.estimatedTimeRemaining,
    isComplete: !progressData.isRunning,
    errors: [],
    status: progressData.isRunning ? (progressData.isPaused ? 'paused' : 'running') : 'completed',
    processingRate: progressData.processingRate || 0,
  } : undefined;

  return {
    mode,
    currentBatch,
    progress: progressData,
    history,
    startBatch,
    pauseBatch,
    resumeBatch,
    stopBatch,
    isStarting: startBatchMutation.isPending,
    isPausing: pauseBatchMutation.isPending,
    isResuming: resumeBatchMutation.isPending,
    isStopping: stopBatchMutation.isPending,
    error: startBatchMutation.error || pauseBatchMutation.error || 
           resumeBatchMutation.error || stopBatchMutation.error,
  };
}

