import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

/**
 * Hook for resource actions (revalidate, edit)
 * Handles API calls and enqueues resources for high-priority validation
 */

export interface UseResourceActionsOptions {
  serverId: number;
  resourceType: string;
  resourceId: string;
  onEditSuccess?: (updatedResource: any) => void;
  onRevalidateSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useResourceActions({
  serverId,
  resourceType,
  resourceId,
  onEditSuccess,
  onRevalidateSuccess,
  onError,
}: UseResourceActionsOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  /**
   * Revalidate a resource
   * Enqueues the resource for high-priority validation
   */
  const revalidateResource = useCallback(async () => {
    setIsRevalidating(true);

    try {
      // Call the validation endpoint to enqueue resource
      const response = await fetch('/api/validation/queue/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId,
          resourceType,
          resourceId,
          priority: 'high', // High priority for manual revalidation
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to enqueue resource for validation');
      }

      // Optimistic update: Keep resource visible, only update validation status
      const currentData = queryClient.getQueryData(['/api/fhir/resources', resourceId]);
      if (currentData) {
        queryClient.setQueryData(['/api/fhir/resources', resourceId], {
          ...currentData,
          _isRevalidating: true,
          _validationSummary: {
            ...(currentData as any)._validationSummary,
            status: 'validating',
          },
        });
      }

      toast({
        title: 'Validation Queued',
        description: `${resourceType}/${resourceId} has been enqueued for validation`,
      });

      onRevalidateSuccess?.();

      // Soft refetch after 3 seconds to get updated validation results
      // This won't trigger loading state since we already have data in cache
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: ['/api/fhir/resources', resourceId],
          exact: true,
        });
        queryClient.refetchQueries({
          queryKey: ['/api/validation/resources', resourceType, resourceId],
          exact: true,
        });
      }, 3000);
    } catch (error) {
      console.error('Failed to revalidate resource:', error);
      
      toast({
        title: 'Validation Failed',
        description: error instanceof Error ? error.message : 'Failed to enqueue resource',
        variant: 'destructive',
      });

      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsRevalidating(false);
    }
  }, [serverId, resourceType, resourceId, queryClient, toast, onRevalidateSuccess, onError]);

  /**
   * Edit a resource
   * Updates the resource on the FHIR server and enqueues for revalidation
   */
  const editResource = useCallback(async (updatedResource: any, versionId?: string) => {
    setIsEditing(true);

    try {
      // Build headers with optimistic concurrency control
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (versionId) {
        headers['If-Match'] = `W/"${versionId}"`;
      }

      // Call the edit endpoint
      const response = await fetch(`/api/fhir/resources/${resourceType}/${resourceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatedResource),
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle version conflict (412 Precondition Failed)
        if (response.status === 412) {
          throw new Error('Resource has been modified by another user. Please refresh and try again.');
        }
        
        throw new Error(error.message || 'Failed to update resource');
      }

      const result = await response.json();

      // Invalidate resource queries
      queryClient.invalidateQueries({
        queryKey: ['/api/fhir/resources', resourceId],
      });

      queryClient.invalidateQueries({
        queryKey: ['/api/validation/resources', resourceType, resourceId],
      });

      toast({
        title: 'Resource Updated',
        description: `${resourceType}/${resourceId} has been updated and enqueued for validation`,
      });

      onEditSuccess?.(result.resource);
      
      return result;
    } catch (error) {
      console.error('Failed to edit resource:', error);
      
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update resource',
        variant: 'destructive',
      });

      onError?.(error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    } finally {
      setIsEditing(false);
    }
  }, [resourceType, resourceId, queryClient, toast, onEditSuccess, onError]);

  /**
   * Check if a resource is currently being validated
   */
  const checkValidationStatus = useCallback(async (): Promise<{
    isValidating: boolean;
    queuePosition?: number;
  }> => {
    try {
      const response = await fetch(
        `/api/validation/queue/status?resourceType=${resourceType}&resourceId=${resourceId}`
      );

      if (!response.ok) {
        throw new Error('Failed to check validation status');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to check validation status:', error);
      return { isValidating: false };
    }
  }, [resourceType, resourceId]);

  return {
    revalidateResource,
    editResource,
    checkValidationStatus,
    isRevalidating,
    isEditing,
  };
}
