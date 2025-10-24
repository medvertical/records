import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

export interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'copy' | 'move' | 'test';
  path: string;
  value?: any;
  from?: string;
}

export interface BatchEditRequest {
  resourceType: string;
  filter: {
    ids?: string[];
    searchParams?: Record<string, string>;
  };
  operations: PatchOperation[];
  maxBatchSize?: number;
}

export interface BatchEditResult {
  id: string;
  success: boolean;
  error?: string;
  beforeHash: string;
  afterHash: string;
  changed: boolean;
}

export interface BatchEditResponse {
  success: boolean;
  matched: number;
  modified: number;
  failed: number;
  results: BatchEditResult[];
  message?: string;
}

export interface UseBatchActionsOptions {
  onSuccess?: (response: BatchEditResponse) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useBatchActions(options: UseBatchActionsOptions = {}) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<BatchEditResponse | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Execute batch edit operation
   */
  const executeBatchEdit = useCallback(async (request: BatchEditRequest): Promise<BatchEditResponse> => {
    setIsExecuting(true);
    setLastResult(null);

    try {
      const response = await fetch('/api/fhir/resources/batch-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result: BatchEditResponse = await response.json();
      setLastResult(result);

      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: ['/api/fhir/resources'],
      });

      queryClient.invalidateQueries({
        queryKey: ['validation-messages'],
      });

      // Show success notification
      toast({
        title: 'Batch Edit Complete',
        description: `Modified ${result.modified} of ${result.matched} resources. ${result.failed} failed.`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      options.onSuccess?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      
      toast({
        title: 'Batch Edit Failed',
        description: err.message,
        variant: 'destructive',
      });

      options.onError?.(err);
      throw err;
    } finally {
      setIsExecuting(false);
    }
  }, [queryClient, toast, options]);

  /**
   * Clear last result
   */
  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    executeBatchEdit,
    isExecuting,
    lastResult,
    clearResult,
  };
}

