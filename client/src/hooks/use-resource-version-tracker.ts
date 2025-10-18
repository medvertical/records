import { useEffect, useRef, useCallback } from 'react';

/**
 * Resource version information
 */
export interface ResourceVersionInfo {
  resourceId: string;
  resourceType: string;
  versionId?: string;
  lastUpdated?: string;
}

/**
 * Hook to track resource version changes in list views
 * Detects when versionId changes for resources and triggers callbacks
 */
export function useResourceVersionTracker(
  resources: any[],
  enabled: boolean = true,
  onVersionChange?: (changedResources: ResourceVersionInfo[]) => void
) {
  // Track previous versions using a Map keyed by resourceType:resourceId
  const previousVersionsRef = useRef<Map<string, ResourceVersionInfo>>(new Map());
  
  // Track if this is the first mount (to avoid triggering on initial load)
  const isFirstMountRef = useRef(true);

  /**
   * Generate a unique key for a resource
   */
  const getResourceKey = useCallback((resourceType: string, resourceId: string): string => {
    return `${resourceType}:${resourceId}`;
  }, []);

  /**
   * Extract version info from a resource
   */
  const extractVersionInfo = useCallback((resource: any): ResourceVersionInfo | null => {
    if (!resource) return null;

    const resourceType = resource.resourceType;
    const resourceId = resource.id || resource.resourceId;
    const versionId = resource.meta?.versionId || resource.versionId;
    const lastUpdated = resource.meta?.lastUpdated;

    if (!resourceType || !resourceId) {
      return null;
    }

    return {
      resourceType,
      resourceId,
      versionId,
      lastUpdated,
    };
  }, []);

  /**
   * Check for version changes when resources update
   */
  useEffect(() => {
    if (!enabled || !resources || resources.length === 0) {
      return;
    }

    // Skip version change detection on first mount
    if (isFirstMountRef.current) {
      // Initialize previous versions map
      resources.forEach(resource => {
        const versionInfo = extractVersionInfo(resource);
        if (versionInfo) {
          const key = getResourceKey(versionInfo.resourceType, versionInfo.resourceId);
          previousVersionsRef.current.set(key, versionInfo);
        }
      });
      
      isFirstMountRef.current = false;
      return;
    }

    // Check for version changes
    const changedResources: ResourceVersionInfo[] = [];
    const currentVersionsMap = new Map<string, ResourceVersionInfo>();

    resources.forEach(resource => {
      const currentVersionInfo = extractVersionInfo(resource);
      if (!currentVersionInfo) return;

      const key = getResourceKey(currentVersionInfo.resourceType, currentVersionInfo.resourceId);
      currentVersionsMap.set(key, currentVersionInfo);

      const previousVersionInfo = previousVersionsRef.current.get(key);
      
      // Check if this is a new resource or if version has changed
      if (!previousVersionInfo) {
        // New resource - don't trigger change (it's just being loaded for first time in this page)
        return;
      }

      // Compare versionId
      if (previousVersionInfo.versionId !== currentVersionInfo.versionId) {
        changedResources.push(currentVersionInfo);
      }
    });

    // Update the ref with current versions
    previousVersionsRef.current = currentVersionsMap;

    // Trigger callback if there are changes
    if (changedResources.length > 0 && onVersionChange) {
      onVersionChange(changedResources);
    }
  }, [resources, enabled, extractVersionInfo, getResourceKey, onVersionChange]);

  /**
   * Reset the tracker (useful when changing pages or filters)
   */
  const reset = useCallback(() => {
    previousVersionsRef.current.clear();
    isFirstMountRef.current = true;
  }, []);

  /**
   * Get the current tracked versions
   */
  const getTrackedVersions = useCallback((): Map<string, ResourceVersionInfo> => {
    return new Map(previousVersionsRef.current);
  }, []);

  return {
    reset,
    getTrackedVersions,
  };
}

