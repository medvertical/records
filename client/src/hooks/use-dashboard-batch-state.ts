import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BatchValidationHistoryItem, ValidationProgress } from '@shared/types/dashboard';
import { useActiveServerId } from './use-server-reactive-queries';

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
  const activeServerId = useActiveServerId();

  // Poll batch progress when running
  const { data: progressData } = useQuery<BatchProgress>({
    queryKey: ['batch-validation-progress'],
    queryFn: async () => {
      const fetchTime = new Date().toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
      });
      console.log(`📡 [${fetchTime}] Fetching progress...`);
      
      // Add cache buster to force fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`/api/validation/bulk/progress?_t=${cacheBuster}`, {
        // Disable caching to always get fresh data
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch batch progress');
      }
      const data = await response.json();
      
      // Log progress to browser console
      if (data.isRunning) {
        const percentComplete = data.totalResources > 0 
          ? ((data.processedResources / data.totalResources) * 100).toFixed(1)
          : '0.0';
        
        const timestamp = new Date().toLocaleTimeString('de-DE', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });
        
        console.log(
          `🔄 [${timestamp}] [Batch Validation] Progress: ${data.processedResources}/${data.totalResources} (${percentComplete}%) | ` +
          `❌ ${data.errors} errors | ` +
          `⚠️ ${data.warnings} warnings | ` +
          `⚡ Rate: ${data.processingRate?.toFixed(1) || 'N/A'} res/min`
        );
        
        // Log per-resource-type progress
        if (data.resourceTypeProgress && Object.keys(data.resourceTypeProgress).length > 0) {
          console.log('📋 [Resource Types]:', data.resourceTypeProgress);
        }
      }
      
      return data;
    },
    staleTime: 0, // Always consider data stale - fetch fresh data on every poll
    gcTime: 0, // Don't cache old data (previously cacheTime)
    refetchInterval: (query) => {
      // Always poll every 2s to catch state changes
      // The callback gets query data, but on first mount it's undefined
      // So we must return a truthy value (2000) to start polling
      const data = query?.state?.data;
      // Poll every 2s when running OR when we don't know yet (data is undefined)
      return (!data || data.isRunning) ? 2000 : false;
    },
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always', // Always make network requests, don't use cache
  });

  // Fetch batch history - filtered by current server
  const { data: history = [] } = useQuery<BatchValidationHistoryItem[]>({
    queryKey: ['batch-validation-history', activeServerId],
    queryFn: async () => {
      const url = activeServerId 
        ? `/api/validation/batch/history?limit=10&serverId=${activeServerId}`
        : '/api/validation/batch/history?limit=10';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch batch history');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh history every 30s
    enabled: activeServerId !== undefined, // Only fetch when we have a server
  });

  // Update mode based on progress
  useEffect(() => {
    if (progressData?.isRunning) {
      setMode('running');
    } else {
      // Batch completed or stopped
      if (mode === 'running') {
        console.log('🎉 [Batch Validation] COMPLETED!', {
          processed: progressData?.processedResources || 0,
          errors: progressData?.errors || 0,
          warnings: progressData?.warnings || 0
        });
        
        // Refresh history when batch completes
        queryClient.invalidateQueries({ queryKey: ['batch-validation-history'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
      }
      setMode('idle');
    }
  }, [progressData?.isRunning, mode, queryClient]);

  // Start batch validation mutation
  const startBatchMutation = useMutation({
    mutationFn: async (params: StartBatchParams) => {
      console.log('🚀 [Batch Validation] Starting batch validation...', {
        resourceTypes: params.resourceTypes,
        aspects: params.validationAspects,
        config: params.config
      });
      
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ [Batch Validation] Failed to start:', error);
        throw new Error(error.message || 'Failed to start batch validation');
      }
      const result = await response.json();
      console.log('✅ [Batch Validation] Started successfully:', result);
      return result;
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
      console.log('⏸️ [Batch Validation] Pausing...');
      const response = await fetch('/api/validation/bulk/pause', {
        method: 'POST',
      });
      if (!response.ok) {
        console.error('❌ [Batch Validation] Failed to pause');
        throw new Error('Failed to pause batch validation');
      }
      const result = await response.json();
      console.log('✅ [Batch Validation] Paused successfully');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-validation-progress'] });
    },
  });

  // Resume batch validation
  const resumeBatchMutation = useMutation({
    mutationFn: async () => {
      console.log('▶️ [Batch Validation] Resuming...');
      const response = await fetch('/api/validation/bulk/resume', {
        method: 'POST',
      });
      if (!response.ok) {
        console.error('❌ [Batch Validation] Failed to resume');
        throw new Error('Failed to resume batch validation');
      }
      const result = await response.json();
      console.log('✅ [Batch Validation] Resumed successfully');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-validation-progress'] });
    },
  });

  // Stop batch validation
  const stopBatchMutation = useMutation({
    mutationFn: async () => {
      console.log('⏹️ [Batch Validation] Stopping...');
      const response = await fetch('/api/validation/bulk/stop', {
        method: 'POST',
      });
      if (!response.ok) {
        console.error('❌ [Batch Validation] Failed to stop');
        throw new Error('Failed to stop batch validation');
      }
      const result = await response.json();
      console.log('🎉 [Batch Validation] Stopped successfully');
      return result;
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

