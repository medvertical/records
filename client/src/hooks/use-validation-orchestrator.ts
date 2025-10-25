import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useValidationActivity } from '@/contexts/validation-activity-context';
import { validatedResourcesCache, onCacheCleared } from '@/lib/validation-cache';
import type { ResourceBrowserState } from './use-resource-browser-state';

export interface ValidationOrchestratorState {
  validateCurrentPage: () => Promise<void>;
  validateUnvalidatedResources: () => Promise<void>;
  handleRevalidate: () => Promise<void>;
  handleFilterChange: (newFilters: any) => void;
}

/**
 * Hook for orchestrating all validation operations
 * Handles background validation, manual revalidation, and validation progress
 */
export function useValidationOrchestrator(
  state: ResourceBrowserState,
  resourcesData: any,
  currentSettings: any,
  resourceType: string,
  searchQuery: string,
  page: number
): ValidationOrchestratorState {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    addResourceValidation,
    updateResourceValidation,
    removeResourceValidation
  } = useValidationActivity();
  
  // Track validated pages across navigations (persists during session)
  const validatedPagesRef = useRef(new Set<string>());
  
  const {
    isValidating,
    validatingResourceIds,
    hasValidatedCurrentPage,
    validationFilters,
    setIsValidating,
    setValidatingResourceIds,
    setValidationProgress,
    setHasValidatedCurrentPage,
    setCacheCleared,
    setValidationFilters,
    setPage,
  } = state;
  
  // Simulate validation progress
  const simulateValidationProgress = useCallback((resourceIds: number[], resources: any[]) => {
    const aspects = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    const totalAspects = aspects.length;
    
    const initialProgress = new Map<number, any>();
    resourceIds.forEach(id => {
      const resource = resources.find(r => (r._dbId || r.id) === id);
      const progressData = {
        resourceId: id,
        fhirId: resource?.resourceId || resource?.id || String(id),
        resourceType: resource?.resourceType || 'Unknown',
        progress: 0,
        currentAspect: 'Starting validation...',
        completedAspects: [],
        totalAspects
      };
      initialProgress.set(id, progressData);
      addResourceValidation(id, progressData);
    });
    setValidationProgress(initialProgress);
    
    let currentAspectIndex = 0;
    const updateInterval = setInterval(() => {
      let allComplete = true;
      const updatesToApply: Array<{id: number, data: any}> = [];
      
      setValidationProgress(prev => {
        const updated = new Map(prev);
        resourceIds.forEach(id => {
          const current = updated.get(id);
          if (current && currentAspectIndex < totalAspects) {
            const baseProgress = (currentAspectIndex / totalAspects) * 100;
            const aspectProgress = (1 / totalAspects) * 100;
            const progress = Math.min(baseProgress + (aspectProgress * 0.4), 99);
            
            const completedAspects = aspects.slice(0, currentAspectIndex);
            const updatedData = {
              ...current,
              progress: Math.min(progress, 99),
              currentAspect: currentAspectIndex < totalAspects ? `Validating ${aspects[currentAspectIndex]}...` : 'Completing...',
              completedAspects
            };
            updated.set(id, updatedData);
            updatesToApply.push({id, data: updatedData});
            if (currentAspectIndex < totalAspects) allComplete = false;
          }
        });
        if (allComplete) clearInterval(updateInterval);
        return updated;
      });
      
      updatesToApply.forEach(({id, data}) => {
        updateResourceValidation(id, {
          progress: data.progress,
          currentAspect: data.currentAspect,
          completedAspects: data.completedAspects
        });
      });
      currentAspectIndex++;
    }, 600);
    
    const safetyTimeout = setTimeout(() => {
      clearInterval(updateInterval);
      resourceIds.forEach(id => removeResourceValidation(id));
      setValidationProgress(new Map());
    }, 30000);
    
    return () => {
      clearInterval(updateInterval);
      clearTimeout(safetyTimeout);
    };
  }, [addResourceValidation, updateResourceValidation, removeResourceValidation, setValidationProgress]);
  
  // Validate current page
  const validateCurrentPage = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) return;
    
    setIsValidating(true);
    const validResources = resourcesData.resources.filter((resource: any) => 
      resource.resourceType && (resource.resourceId || resource.id)
    );
    
    if (validResources.length === 0) {
      setIsValidating(false);
      return;
    }
    
    const resourceIds = validResources.map((resource: any) => resource._dbId || resource.id);
    setValidatingResourceIds(new Set(resourceIds));
    const progressCleanup = simulateValidationProgress(resourceIds, validResources);
    
    try {
      const batchSize = currentSettings?.performance?.batchSize || 50;
      const allResults = [];
      
      for (let i = 0; i < validResources.length; i += batchSize) {
        const batch = validResources.slice(i, i + batchSize);
        
        try {
          const response = await fetch('/api/validation/validate-by-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resources: batch.map((resource: any) => ({
                _dbId: resource._dbId,
                resourceType: resource.resourceType,
                resourceId: resource.resourceId || resource.id
              }))
            })
          });
          
          if (response.ok) {
            const batchResult = await response.json();
            allResults.push(...(batchResult.detailedResults || []));
          }
        } catch (error) {
          console.error('[Validation] Batch error:', error);
        }
        
        if (i + batchSize < validResources.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (allResults.length > 0) {
        validResources.forEach((resource: any) => {
          const cacheKey = `${resource.resourceType}/${resource.id}`;
          validatedResourcesCache.add(cacheKey);
        });
      }
      
      if (progressCleanup) progressCleanup();
      resourceIds.forEach(id => updateResourceValidation(id, {
        progress: 100,
        currentAspect: 'Validation complete'
      }));
      
      setTimeout(() => {
        setValidationProgress(new Map());
        resourceIds.forEach(id => removeResourceValidation(id));
      }, 1500);
    } catch (error) {
      if (progressCleanup) progressCleanup();
      setValidationProgress(new Map());
      resourceIds.forEach(id => removeResourceValidation(id));
    } finally {
      setIsValidating(false);
      setValidatingResourceIds(new Set());
    }
  }, [resourcesData, currentSettings, queryClient, simulateValidationProgress, updateResourceValidation, removeResourceValidation, setIsValidating, setValidatingResourceIds, setValidationProgress]);
  
  // Validate unvalidated resources (background)
  const validateUnvalidatedResources = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) return;
    if (isValidating || validatingResourceIds.size > 0) return;
    
    const unvalidatedResources = resourcesData.resources.filter((resource: any) => {
      const validationSummary = resource._validationSummary;
      const hasValidationData = validationSummary?.lastValidated;
      
      if (hasValidationData) {
        const lastValidated = new Date(validationSummary.lastValidated);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastValidated <= fiveMinutesAgo;
      }
      return true;
    });
    
    const validUnvalidatedResources = unvalidatedResources.filter((resource: any) => 
      resource.resourceType && (resource.resourceId || resource.id)
    );
    
    if (validUnvalidatedResources.length === 0) return;
    
    const resourceIds = validUnvalidatedResources.map((resource: any) => resource._dbId || resource.id);
    setValidatingResourceIds(new Set(resourceIds));
    const progressCleanup = simulateValidationProgress(resourceIds, validUnvalidatedResources);
    
    try {
      const batchSize = currentSettings?.performance?.batchSize || 50;
      const batches = [];
      for (let i = 0; i < validUnvalidatedResources.length; i += batchSize) {
        batches.push({
          batchNumber: Math.floor(i/batchSize) + 1,
          resources: validUnvalidatedResources.slice(i, i + batchSize)
        });
      }
      
      console.log(`[Background Validation] Starting parallel validation of ${batches.length} batches (${validUnvalidatedResources.length} total resources)`);
      
      const batchResults = await Promise.allSettled(
        batches.map(async ({ batchNumber, resources: batch }) => {
          console.log(`[Background Validation] Processing batch ${batchNumber} with ${batch.length} resources`);
          const response = await fetch('/api/validation/validate-by-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resources: batch.map((resource: any) => ({
                _dbId: resource._dbId,
                resourceType: resource.resourceType,
                resourceId: resource.resourceId || resource.id
              }))
            })
          });
          
          if (!response.ok) throw new Error(await response.text());
          const result = await response.json();
          console.log(`[Background Validation] Batch ${batchNumber} completed successfully`);
          return result.detailedResults || [];
        })
      );
      
      const allResults: any[] = [];
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        }
      });
      
      if (allResults.length > 0) {
        validUnvalidatedResources.forEach((resource: any) => {
          const cacheKey = `${resource.resourceType}/${resource.id}`;
          validatedResourcesCache.add(cacheKey);
        });
      }
      
      if (progressCleanup) progressCleanup();
      resourceIds.forEach(id => updateResourceValidation(id, {
        progress: 100,
        currentAspect: 'Validation complete'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      setValidatingResourceIds(new Set());
      setHasValidatedCurrentPage(true);
      
      console.log('[Background Validation] Invalidating validation data (badges only)...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['validation-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['validation-summaries-bulk'] })
      ]);
      console.log('[Background Validation] Validation data invalidated');
      
      setTimeout(() => {
        setValidationProgress(new Map());
        resourceIds.forEach(id => removeResourceValidation(id));
      }, 500);
    } catch (error) {
      if (progressCleanup) progressCleanup();
      setValidationProgress(new Map());
      setValidatingResourceIds(new Set());
      resourceIds.forEach(id => removeResourceValidation(id));
    }
  }, [resourcesData, isValidating, validatingResourceIds, currentSettings, queryClient, simulateValidationProgress, updateResourceValidation, removeResourceValidation, setValidatingResourceIds, setHasValidatedCurrentPage, setValidationProgress]);
  
  // Handle revalidation
  const handleRevalidate = useCallback(async () => {
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      toast({ title: "No resources to revalidate", variant: "destructive" });
      return;
    }
    
    setIsValidating(true);
    const validResources = resourcesData.resources.filter((resource: any) => 
      resource.resourceType && (resource.resourceId || resource.id)
    );
    
    if (validResources.length === 0) {
      toast({ title: "No resources to revalidate", variant: "destructive" });
      setIsValidating(false);
      return;
    }
    
    const resourceIds = validResources.map((r: any) => r._dbId || r.id);
    setValidatingResourceIds(new Set(resourceIds));
    const progressCleanup = simulateValidationProgress(resourceIds, validResources);
    
    try {
      const batchSize = currentSettings?.performance?.batchSize || 50;
      const batches = [];
      for (let i = 0; i < validResources.length; i += batchSize) {
        batches.push({
          batchNumber: Math.floor(i/batchSize) + 1,
          resources: validResources.slice(i, i + batchSize)
        });
      }
      
      console.log(`[Manual Revalidation] Starting parallel validation of ${batches.length} batches`);
      
      const batchResults = await Promise.allSettled(
        batches.map(async ({ batchNumber, resources: batch }) => {
          const response = await fetch('/api/validation/validate-by-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resources: batch.map((resource: any) => ({
                _dbId: resource._dbId,
                resourceType: resource.resourceType,
                resourceId: resource.resourceId || resource.id
              }))
            })
          });
          if (!response.ok) throw new Error(await response.text());
          const result = await response.json();
          return result.detailedResults || [];
        })
      );
      
      const allResults: any[] = [];
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') allResults.push(...result.value);
      });
      
      resourceIds.forEach(id => updateResourceValidation(id, {
        progress: 100,
        currentAspect: 'Validation complete'
      }));
      
      await new Promise(resolve => setTimeout(resolve, 200));
      setValidatingResourceIds(new Set());
      setIsValidating(false);
      
      console.log('[Manual Revalidation] Invalidating validation data (badges only)...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['validation-messages'] }),
        queryClient.invalidateQueries({ queryKey: ['validation-summaries-bulk'] })
      ]);
      console.log('[Manual Revalidation] Validation data invalidated');
      
      toast({
        title: "Revalidation complete",
        description: `Successfully revalidated ${allResults.length} resources.`,
      });
      
      setTimeout(() => {
        if (progressCleanup) progressCleanup();
        setValidationProgress(new Map());
        resourceIds.forEach(id => removeResourceValidation(id));
      }, 500);
    } catch (error) {
      if (progressCleanup) progressCleanup();
      resourceIds.forEach(id => removeResourceValidation(id));
      toast({
        title: "Revalidation failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      setIsValidating(false);
      setValidatingResourceIds(new Set());
    }
  }, [resourcesData, currentSettings, queryClient, toast, simulateValidationProgress, updateResourceValidation, removeResourceValidation, setIsValidating, setValidatingResourceIds, setValidationProgress]);
  
  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: any) => {
    setValidationFilters(newFilters);
    setPage(0);
    
    const urlParams = new URLSearchParams(window.location.search);
    if (resourceType && resourceType !== "all") urlParams.set('resourceType', resourceType);
    if (searchQuery) urlParams.set('search', searchQuery);
    
    if (newFilters.aspects.length > 0) {
      urlParams.set('aspects', newFilters.aspects.join(','));
    } else {
      urlParams.delete('aspects');
    }
    
    if (newFilters.severities.length > 0) {
      urlParams.set('severities', newFilters.severities.join(','));
    } else {
      urlParams.delete('severities');
    }
    
    if (newFilters.hasIssuesOnly) {
      urlParams.set('hasIssues', 'true');
    } else {
      urlParams.delete('hasIssues');
    }
    
    const newUrl = urlParams.toString() ? `/resources?${urlParams.toString()}` : '/resources';
    window.history.pushState({}, '', newUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [resourceType, searchQuery, setValidationFilters, setPage]);
  
  // Reset validation flag when page/resource type changes
  useEffect(() => {
    setHasValidatedCurrentPage(false);
  }, [resourceType, page, setHasValidatedCurrentPage]);
  
  // Listen for cache clearing events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      onCacheCleared(() => {
        setCacheCleared(true);
        setHasValidatedCurrentPage(false);
        if (resourcesData?.resources && resourcesData.resources.length > 0) {
          setTimeout(() => validateCurrentPage(), 100);
        }
      });
    }
  }, [resourcesData?.resources, setCacheCleared, setHasValidatedCurrentPage, validateCurrentPage]);
  
  // Auto-validate resources when they're loaded
  useEffect(() => {
    // Create a unique key for this page
    const pageKey = `${resourceType}-page${page}`;
    
    // Check if this page was already validated in this session
    if (validatedPagesRef.current.has(pageKey)) {
      console.log(`[Auto-Validation] Page ${pageKey} already validated in this session, skipping`);
      if (!hasValidatedCurrentPage) {
        setHasValidatedCurrentPage(true);
      }
      return;
    }
    
    // Skip validation if already validated this page
    if (hasValidatedCurrentPage) {
      console.log('[Auto-Validation] Page already validated, skipping');
      return;
    }
    
    // Skip if already validating
    if (isValidating) {
      console.log('[Auto-Validation] Already validating, skipping');
      return;
    }
    
    // Skip if no resources
    if (!resourcesData?.resources || resourcesData.resources.length === 0) {
      console.log('[Auto-Validation] No resources, skipping');
      return;
    }
    
    // Only validate if we actually have unvalidated resources
    // Check both database validation data AND client cache
    const hasUnvalidated = resourcesData.resources.some((resource: any) => {
      const resourceKey = `${resource.resourceType}/${resource.id || resource.resourceId}`;
      
      // Check if already in client cache
      if (validatedResourcesCache.has(resourceKey)) {
        return false; // Already validated in this session
      }
      
      // Check database validation data
      const validationSummary = resource._validationSummary;
      const hasValidationData = validationSummary?.lastValidated;
      
      if (hasValidationData) {
        const lastValidated = new Date(validationSummary.lastValidated);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (lastValidated > fiveMinutesAgo) {
          return false; // Recently validated
        }
      }
      
      return true; // No validation data = needs validation
    });
    
    if (!hasUnvalidated) {
      console.log('[Auto-Validation] All resources already validated (checked cache + DB), skipping');
      setHasValidatedCurrentPage(true);
      validatedPagesRef.current.add(pageKey);
      return;
    }
    
    console.log(`[Auto-Validation] Scheduling background validation for ${pageKey}...`);
    const timer = setTimeout(() => {
      validateUnvalidatedResources().then(() => {
        // Mark this page as validated after completion
        validatedPagesRef.current.add(pageKey);
        console.log(`[Auto-Validation] Page ${pageKey} marked as validated`);
      });
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceType, page, hasValidatedCurrentPage, isValidating]);
  
  return {
    validateCurrentPage,
    validateUnvalidatedResources,
    handleRevalidate,
    handleFilterChange,
  };
}

