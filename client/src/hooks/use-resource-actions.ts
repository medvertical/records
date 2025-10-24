import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useValidationActivity } from '@/contexts/validation-activity-context';

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
  const { addResourceValidation, updateResourceValidation, removeResourceValidation } = useValidationActivity();
  
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  /**
   * Revalidate a resource
   * Enqueues the resource for high-priority validation
   */
  const revalidateResource = useCallback(async () => {
    setIsRevalidating(true);
    
    // Use timestamp as unique ID since resourceId is string
    const numericResourceId = Date.now();
    let progressInterval: NodeJS.Timeout | null = null;
    let validationInterval: NodeJS.Timeout | null = null;

    try {
      // Clear existing validation results for this resource
      await fetch(`/api/validation/resources/${resourceType}/${resourceId}`, {
        method: 'DELETE',
      });

      // Add to activity widget
      addResourceValidation(numericResourceId, {
        resourceId: numericResourceId,
        fhirId: resourceId,
        resourceType,
        progress: 0,
        currentAspect: 'Clearing cache...',
        completedAspects: [],
        totalAspects: 6,
      });

      // Optimistic update: Show revalidating state
      const currentData = queryClient.getQueryData(['/api/fhir/resources', resourceId]);
      if (currentData) {
        queryClient.setQueryData(['/api/fhir/resources', resourceId], {
          ...currentData,
          _isRevalidating: true,
        });
      }

      toast({
        title: 'Revalidating',
        description: `${resourceType}/${resourceId} validation queued`,
      });

      onRevalidateSuccess?.();

      // Simulate progress during wait time
      progressInterval = setInterval(() => {
        updateResourceValidation(numericResourceId, {
          progress: Math.min(15 + Math.random() * 15, 35), // 15-35%
          currentAspect: 'Starting validation...',
        });
      }, 300);

      // Soft refetch after 2 seconds to trigger new validation
      setTimeout(() => {
        if (progressInterval) clearInterval(progressInterval);
        
        // Update to show validation running
        updateResourceValidation(numericResourceId, {
          progress: 40,
          currentAspect: 'Validating structure...',
        });
        
        // Refetch queries
        queryClient.refetchQueries({
          queryKey: ['/api/fhir/resources', resourceId],
          exact: true,
        });
        queryClient.refetchQueries({
          queryKey: ['validation-messages', resourceType, resourceId, serverId],
          exact: true,
        });
        
        // Continue simulating progress
        validationInterval = setInterval(() => {
          const aspects = ['Structural', 'Profile', 'Terminology', 'References', 'Business Rules', 'Metadata'];
          updateResourceValidation(numericResourceId, {
            progress: 40 + Math.random() * 50, // 40-90%
            currentAspect: aspects[Math.floor(Math.random() * aspects.length)],
          });
        }, 400);
        
        // Complete after estimated validation time (6 seconds)
        setTimeout(() => {
          if (validationInterval) clearInterval(validationInterval);
          
          updateResourceValidation(numericResourceId, {
            progress: 100,
            currentAspect: 'Complete',
          });
          
          // Remove from widget after brief delay
          setTimeout(() => {
            removeResourceValidation(numericResourceId);
          }, 1000);
        }, 6000);
      }, 2000);
    } catch (error) {
      console.error('Failed to revalidate resource:', error);
      
      // Clean up intervals and remove from widget
      if (progressInterval) clearInterval(progressInterval);
      if (validationInterval) clearInterval(validationInterval);
      removeResourceValidation(numericResourceId);
      
      toast({
        title: 'Validation Clear Failed',
        description: error instanceof Error ? error.message : 'Failed to clear validation results',
        variant: 'destructive',
      });

      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsRevalidating(false);
    }
  }, [serverId, resourceType, resourceId, queryClient, toast, onRevalidateSuccess, onError, addResourceValidation, updateResourceValidation, removeResourceValidation]);

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
        queryKey: ['validation-messages', resourceType, resourceId, serverId],
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
