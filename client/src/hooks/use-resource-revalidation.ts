import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useValidationActivity } from '@/contexts/validation-activity-context';

/**
 * Interface for revalidation hook parameters
 */
export interface UseResourceRevalidationParams {
  resource: any;
  resourceId: string;
  activeServerId: number | undefined;
  validationSettingsData: any;
  revalidationTimers: number[];
  setRevalidationTimers: (timers: number[]) => void;
  setIsRevalidating: (value: boolean) => void;
}

/**
 * Interface for revalidation hook return value
 */
export interface UseResourceRevalidationReturn {
  handleRevalidate: () => Promise<void>;
}

/**
 * Custom hook to handle resource revalidation logic
 * Manages the revalidation process including progress tracking and activity updates
 */
export function useResourceRevalidation({
  resource,
  resourceId,
  activeServerId,
  validationSettingsData,
  revalidationTimers,
  setRevalidationTimers,
  setIsRevalidating,
}: UseResourceRevalidationParams): UseResourceRevalidationReturn {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addResourceValidation, updateResourceValidation, removeResourceValidation } = useValidationActivity();

  const handleRevalidate = useCallback(async () => {
    if (!resource) return;

    // Clear any existing revalidation timers first
    revalidationTimers.forEach(timerId => clearTimeout(timerId));
    setRevalidationTimers([]);

    console.log('[Revalidate] Button clicked, resource:', resource);
    console.log('[Revalidate] Resource type:', resource.resourceType);
    console.log('[Revalidate] Resource ID:', resource.resourceId);
    
    // Extract profile URLs from resource meta
    const profileUrls = resource.data?.meta?.profile || resource.meta?.profile || [];
    console.log('[Revalidate] Profile URLs found:', profileUrls);
    
    // Determine which validation aspects are enabled based on settings
    const settings = validationSettingsData?.settings;
    const aspectMapping = [
      { name: 'Structural', enabled: settings?.aspects?.structural?.enabled ?? true },
      { name: 'Profile', enabled: settings?.aspects?.profile?.enabled ?? true },
      { name: 'Terminology', enabled: settings?.aspects?.terminology?.enabled ?? true },
      { name: 'References', enabled: settings?.aspects?.reference?.enabled ?? true },
      { name: 'Business Rules', enabled: settings?.aspects?.businessRule?.enabled ?? true },
      { name: 'Metadata', enabled: settings?.aspects?.metadata?.enabled ?? true },
    ];
    const enabledAspects = aspectMapping.filter(a => a.enabled).map(a => a.name);
    const totalAspects = enabledAspects.length;
    
    console.log('[Revalidate] Enabled aspects:', enabledAspects, `(${totalAspects} total)`);
    
    // If no aspects are enabled, warn user and skip validation
    if (totalAspects === 0) {
      toast({
        title: "No validation aspects enabled",
        description: "Please enable at least one validation aspect in settings before revalidating.",
        variant: "destructive",
      });
      return;
    }
    
    setIsRevalidating(true);
    
    // Use timestamp as unique ID for activity tracking
    const numericResourceId = Date.now();
    let progressInterval: NodeJS.Timeout | null = null;
    let validationInterval: NodeJS.Timeout | null = null;
    
    // Add to activity widget
    addResourceValidation(numericResourceId, {
      resourceId: numericResourceId,
      fhirId: resource.resourceId,
      resourceType: resource.resourceType,
      progress: 0,
      currentAspect: 'Starting validation...',
      completedAspects: [],
      totalAspects,
    });
    
    try {
      const url = `/api/validation/resources/${resource.resourceType}/${resource.resourceId}/revalidate?serverId=${activeServerId || 1}`;
      console.log('[Revalidate] Calling URL:', url);
      console.log('[Revalidate] Request body:', { profileUrls });
      
      // Create AbortController with 30-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('[Revalidate] Request timeout after 30 seconds');
        controller.abort();
      }, 30000);
      
      // Simulate smooth progress during API call (0% -> 30%)
      let queueProgress = 0;
      progressInterval = setInterval(() => {
        queueProgress = Math.min(queueProgress + 3, 30); // Increment by 3% each interval, max 30%
        updateResourceValidation(numericResourceId, {
          progress: queueProgress,
          currentAspect: 'Queueing validation...',
        });
      }, 300);
      
      console.log('[Revalidate] Fetching with timeout...');
      const response = await fetch(url, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileUrls }),
        signal: controller.signal // Add abort signal
      });
      
      clearTimeout(timeoutId); // Clear timeout if request succeeds
      console.log('[Revalidate] Response received - status:', response.status);
      console.log('[Revalidate] Response ok:', response.ok);

      if (progressInterval) clearInterval(progressInterval);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Revalidate] Error response:', errorText);
        throw new Error('Revalidation failed');
      }

      const result = await response.json();
      console.log('[Revalidate] Full response data:', result);
      console.log('[Revalidate] Validation result:', result.validationResult);
      console.log('[Revalidate] Is valid:', result.validationResult?.isValid);
      console.log('[Revalidate] Aspects:', result.validationResult?.aspects);

      // Update progress to show validation running
      updateResourceValidation(numericResourceId, {
        progress: 40,
        currentAspect: 'Validating structure...',
      });

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
        title: "Revalidation queued",
        description: `Resource has been enqueued for validation. Results will appear shortly.`,
      });

      // Continue simulating progress during validation (using only enabled aspects)
      let currentProgress = 40;
      let intervalCount = 0;
      
      validationInterval = setInterval(() => {
        intervalCount++;
        
        // Increment progress smoothly (from 40% to 90% over ~12 intervals = ~5 seconds)
        currentProgress = Math.min(40 + (intervalCount * 4), 90);
        
        // Map progress to enabled aspects dynamically
        // Divide the progress range (40-90%) evenly among enabled aspects
        const progressRange = 90 - 40; // 50%
        const progressPerAspect = totalAspects > 0 ? progressRange / totalAspects : progressRange;
        
        // Determine which aspect we're currently on
        let currentAspectIndex = 0;
        let completedCount = 0;
        
        for (let i = 0; i < totalAspects; i++) {
          const aspectStartProgress = 40 + (i * progressPerAspect);
          if (currentProgress >= aspectStartProgress) {
            currentAspectIndex = i;
            completedCount = i;
          }
        }
        
        // Build completed aspects array
        const completedAspects = enabledAspects.slice(0, completedCount);
        
        updateResourceValidation(numericResourceId, {
          progress: currentProgress,
          currentAspect: enabledAspects[currentAspectIndex] || 'Validating...',
          completedAspects,
          totalAspects,
        });
      }, 400);

      // Poll for updated validation results multiple times
      // Background validation jobs may take several seconds to complete
      const refetchDelays = [2000, 4000, 6000, 10000]; // 2s, 4s, 6s, 10s
      const newTimers: number[] = [];
      
      refetchDelays.forEach((delay) => {
        const timerId = window.setTimeout(() => {
          // Refetch resource data
          queryClient.refetchQueries({
            queryKey: ['/api/fhir/resources', resourceId],
            exact: true,
          });
          // Also refetch validation messages to update the right panel immediately
          const serverKey = activeServerId || 1;
          queryClient.invalidateQueries({
            queryKey: ['validation-messages', resource.resourceType, resource.resourceId, serverKey],
          });
          queryClient.refetchQueries({
            queryKey: ['validation-messages', resource.resourceType, resource.resourceId, serverKey],
            exact: true,
          });
        }, delay);
        newTimers.push(timerId);
      });
      
      // Complete validation after 10 seconds
      const completionTimerId = window.setTimeout(() => {
        if (validationInterval) clearInterval(validationInterval);
        
        updateResourceValidation(numericResourceId, {
          progress: 100,
          currentAspect: 'Complete',
        });
        
        // Remove from widget after brief delay
        const removalTimerId = window.setTimeout(() => {
          removeResourceValidation(numericResourceId);
        }, 1000);
        newTimers.push(removalTimerId);
      }, 10000);
      newTimers.push(completionTimerId);
      
      // Save all timer IDs to state for cleanup
      setRevalidationTimers(newTimers);
      
    } catch (error) {
      console.error('[Revalidate] Error during revalidation:', error);
      
      // Clean up intervals and remove from widget
      if (progressInterval) clearInterval(progressInterval);
      if (validationInterval) clearInterval(validationInterval);
      removeResourceValidation(numericResourceId);
      
      // Determine error type for better user feedback
      let errorMessage = 'Unknown error';
      let errorTitle = 'Revalidation failed';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorTitle = 'Revalidation timeout';
          errorMessage = 'The validation request took too long (>30s). The server may be busy or unresponsive. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRevalidating(false);
    }
  }, [resource, resourceId, activeServerId, validationSettingsData, revalidationTimers, setRevalidationTimers, setIsRevalidating, queryClient, toast, addResourceValidation, updateResourceValidation, removeResourceValidation]);

  return {
    handleRevalidate,
  };
}

