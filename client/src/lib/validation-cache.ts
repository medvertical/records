/**
 * Client-side cache for tracking validated resources
 * Prevents re-validation of resources that have already been validated
 */

// Simple client-side cache to track validated resources
export const validatedResourcesCache = new Set<string>();

// Cache clearing event system
let cacheClearedListeners: (() => void)[] = [];

/**
 * Register a callback to be called when the cache is cleared
 */
export function onCacheCleared(callback: () => void): void {
  cacheClearedListeners.push(callback);
}

/**
 * Clear the validation cache and notify all listeners
 */
export function triggerCacheCleared(): void {
  validatedResourcesCache.clear();
  cacheClearedListeners.forEach(listener => listener());
}

/**
 * Check if a resource has been validated
 */
export function isResourceValidated(resourceType: string, resourceId: string): boolean {
  const cacheKey = `${resourceType}/${resourceId}`;
  return validatedResourcesCache.has(cacheKey);
}

/**
 * Mark a resource as validated
 */
export function markResourceAsValidated(resourceType: string, resourceId: string): void {
  const cacheKey = `${resourceType}/${resourceId}`;
  validatedResourcesCache.add(cacheKey);
}

/**
 * Clear a specific resource from the cache
 */
export function clearResourceFromCache(resourceType: string, resourceId: string): void {
  const cacheKey = `${resourceType}/${resourceId}`;
  validatedResourcesCache.delete(cacheKey);
}

// Make cache accessible globally for other components (backward compatibility)
if (typeof window !== 'undefined') {
  (window as any).validatedResourcesCache = validatedResourcesCache;
  (window as any).onCacheCleared = onCacheCleared;
  (window as any).triggerCacheCleared = triggerCacheCleared;
}

