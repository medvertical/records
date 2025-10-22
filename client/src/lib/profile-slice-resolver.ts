/**
 * Profile Slice Resolver
 * 
 * Frontend service to fetch profile slice definitions from the API
 * and match data elements to their correct slice names.
 * 
 * Features:
 * - Fetch slice definitions via API (with React Query caching)
 * - Cache aggressively (24 hour staleTime)
 * - Match elements to slices using discriminator rules
 * - Fallback to heuristic detection when profile unavailable
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface SliceDefinition {
  path: string;
  sliceName: string;
  discriminators: Array<{
    type: 'value' | 'pattern' | 'type' | 'profile' | 'exists';
    path: string;
  }>;
  fixed?: Record<string, any>;
  pattern?: Record<string, any>;
  min?: number;
  max?: string;
  short?: string;
  definition?: string;
}

export interface SliceMatch {
  sliceName: string | null;
  confirmed: boolean; // true if from profile, false if heuristic
  confidence?: 'high' | 'medium' | 'low';
}

interface SliceDefinitionsResponse {
  success: boolean;
  profileUrl: string;
  version: string;
  source: string;
  sliceDefinitions: SliceDefinition[];
  summary: {
    totalSlices: number;
    slicesByPath: Record<string, string[]>;
  };
  cached: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch slice definitions for a profile URL
 */
async function fetchSliceDefinitions(profileUrl: string): Promise<SliceDefinitionsResponse> {
  console.log(`[ProfileSliceResolver] Fetching slice definitions for: ${profileUrl}`);
  
  // Split profile URL and version (format: url|version)
  const [url, version] = profileUrl.split('|');
  const params = new URLSearchParams({ url });
  if (version) {
    params.append('version', version);
  }
  const apiUrl = `/api/profiles/slices?${params.toString()}`;
  
  console.log(`[ProfileSliceResolver] API URL: ${apiUrl}`);
  
  const response = await fetch(apiUrl);
  
  console.log(`[ProfileSliceResolver] Response status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ProfileSliceResolver] ✗ Failed to fetch: ${response.statusText}`, errorText);
    throw new Error(`Failed to fetch slice definitions: ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log(`[ProfileSliceResolver] ✓ Received ${data.sliceDefinitions?.length || 0} slice definitions`);
  
  return data;
}

// ============================================================================
// React Query Hook
// ============================================================================

/**
 * Hook to fetch and cache slice definitions for a profile
 * 
 * Uses React Query with aggressive caching (24 hours)
 */
export function useSliceDefinitions(profileUrl: string | undefined) {
  return useQuery({
    queryKey: ['profile-slices', profileUrl],
    queryFn: () => fetchSliceDefinitions(profileUrl!),
    enabled: !!profileUrl,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - matches backend cache TTL
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days garbage collection
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook to fetch slice definitions for multiple profile URLs
 */
export function useMultipleSliceDefinitions(profileUrls: string[]) {
  const results = profileUrls.map(url => useSliceDefinitions(url));
  
  return {
    isLoading: results.some(r => r.isLoading),
    isError: results.some(r => r.isError),
    data: results.map(r => r.data).filter(Boolean) as SliceDefinitionsResponse[],
    allSlices: results
      .flatMap(r => r.data?.sliceDefinitions || [])
      .filter(Boolean) as SliceDefinition[],
  };
}

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Match a data element to a slice definition
 */
export function matchElementToSlice(
  element: any,
  sliceDefinitions: SliceDefinition[],
  elementPath: string
): SliceMatch {
  if (!element || typeof element !== 'object') {
    return { sliceName: null, confirmed: false, confidence: 'low' };
  }

  // Filter slices that match the element path
  const relevantSlices = sliceDefinitions.filter(slice => {
    // Match last segment of path (e.g., "identifier" matches "Patient.identifier")
    const slicePathSegments = slice.path.split('.');
    const lastSegment = slicePathSegments[slicePathSegments.length - 1];
    return lastSegment === elementPath;
  });

  if (relevantSlices.length === 0) {
    return { sliceName: null, confirmed: false, confidence: 'low' };
  }

  // Try to match element to each slice based on discriminators
  for (const slice of relevantSlices) {
    const matchScore = calculateMatchScore(element, slice);
    
    console.log(`[ProfileSliceResolver] Testing slice "${slice.sliceName}":`, {
      discriminators: slice.discriminators,
      pattern: slice.pattern,
      matchScore
    });
    
    if (matchScore.matches) {
      console.log(`[ProfileSliceResolver] ✓ MATCH FOUND: ${slice.sliceName}`);
      return {
        sliceName: slice.sliceName,
        confirmed: true,
        confidence: matchScore.confidence,
      };
    }
  }

  console.log(`[ProfileSliceResolver] ✗ No match found for element in ${relevantSlices.length} slices`);
  return { sliceName: null, confirmed: false, confidence: 'low' };
}

/**
 * Calculate match score for an element against a slice definition
 */
function calculateMatchScore(
  element: any,
  slice: SliceDefinition
): { matches: boolean; confidence: 'high' | 'medium' | 'low' } {
  let totalChecks = 0;
  let passedChecks = 0;

  console.log(`[calculateMatchScore] Testing ${slice.sliceName}`);

  // Check discriminators
  for (const discriminator of slice.discriminators) {
    totalChecks++;
    
    const passed = checkDiscriminator(element, discriminator, slice);
    console.log(`[calculateMatchScore]   Discriminator ${discriminator.type}@${discriminator.path}: ${passed ? 'PASS' : 'FAIL'}`);
    
    if (passed) {
      passedChecks++;
    }
  }

  // NOTE: We only check discriminators. Fixed/pattern values are checked via discriminators.
  // Don't iterate over slice.fixed or slice.pattern keys directly, as that would double-count!

  // If no checks were defined, we can't confirm
  if (totalChecks === 0) {
    console.log(`[calculateMatchScore]   No discriminators defined!`);
    return { matches: false, confidence: 'low' };
  }

  // All checks must pass for a match
  const matches = passedChecks === totalChecks;
  console.log(`[calculateMatchScore]   Result: ${passedChecks}/${totalChecks} = ${matches ? 'MATCH' : 'NO MATCH'}`);
  
  // Confidence based on number of checks passed
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (matches && totalChecks >= 2) {
    confidence = 'high';
  } else if (matches && totalChecks === 1) {
    confidence = 'medium';
  }

  return { matches, confidence };
}

/**
 * Check if an element matches a discriminator
 */
function checkDiscriminator(
  element: any,
  discriminator: { type: string; path: string },
  slice: SliceDefinition
): boolean {
  const { type, path } = discriminator;
  
  // Get value at discriminator path
  const value = getValueAtPath(element, path);
  
  if (value === undefined) {
    return false;
  }

  switch (type) {
    case 'value':
      // Check against fixed values
      if (slice.fixed) {
        const fixedValue = getValueAtPath(slice.fixed, path);
        return deepEqual(value, fixedValue);
      }
      return false;

    case 'pattern':
      // Check against pattern values
      if (slice.pattern) {
        let patternValue = getValueAtPath(slice.pattern, path);
        
        // Special handling for $this - unwrap pattern if needed
        // Pattern might be {identifier: {...}} but value is just {...}
        if (path === '$this' && patternValue && typeof patternValue === 'object') {
          // If pattern has exactly one key and it's a type name (capitalized), unwrap it
          const keys = Object.keys(patternValue);
          if (keys.length === 1 && keys[0].charAt(0) === keys[0].charAt(0).toLowerCase()) {
            // Check if the single key matches the parent element type
            // For Patient.identifier slices, pattern will be {identifier: {...}}
            const potentialWrapper = keys[0];
            if (typeof patternValue[potentialWrapper] === 'object') {
              patternValue = patternValue[potentialWrapper];
            }
          }
        }
        
        return matchesPattern(value, patternValue);
      }
      return false;

    case 'type':
      // Type checking would require more complex logic
      return true; // Assume match for now

    case 'profile':
      // Profile checking would require more complex logic
      return true; // Assume match for now

    case 'exists':
      // Check if value exists
      return value !== undefined && value !== null;

    default:
      return false;
  }
}

/**
 * Get value at a nested path (e.g., "system" or "coding[0].code")
 */
function getValueAtPath(obj: any, path: string): any {
  if (!path || !obj) {
    return undefined;
  }

  // Handle $this - return the object itself
  if (path === '$this') {
    return obj;
  }

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array indices (e.g., "coding[0]")
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = current[key];
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[parseInt(index)];
    } else {
      current = current[part];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

/**
 * Deep equality check
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a !== 'object' || a === null || b === null) {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  return keysA.every(key => deepEqual(a[key], b[key]));
}

/**
 * Check if a value matches a pattern
 * FHIR pattern matching: all properties in pattern must exist in value with same values
 * Value can have additional properties not in pattern
 */
function matchesPattern(value: any, pattern: any): boolean {
  if (pattern === null || pattern === undefined) {
    return value === pattern;
  }

  if (typeof pattern !== 'object') {
    return value === pattern;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Handle arrays - all pattern elements must match value elements
  if (Array.isArray(pattern)) {
    if (!Array.isArray(value)) {
      return false;
    }
    
    // For FHIR patterns, we check if pattern items exist in value
    // Pattern can be shorter than value
    if (pattern.length > value.length) {
      return false;
    }
    
    return pattern.every((patternItem, i) => matchesPattern(value[i], patternItem));
  }

  // Handle objects - all pattern properties must exist in value with matching values
  if (Array.isArray(value)) {
    return false; // pattern is object, value is array - no match
  }

  // Check all pattern properties exist in value
  for (const key of Object.keys(pattern)) {
    if (!(key in value)) {
      return false;
    }
    if (!matchesPattern(value[key], pattern[key])) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Prefetch Utility
// ============================================================================

/**
 * Prefetch slice definitions for profile URLs
 * Useful for preloading when a resource is loaded
 */
export function prefetchSliceDefinitions(
  queryClient: ReturnType<typeof useQueryClient>,
  profileUrls: string[]
) {
  for (const url of profileUrls) {
    queryClient.prefetchQuery({
      queryKey: ['profile-slices', url],
      queryFn: () => fetchSliceDefinitions(url),
      staleTime: 24 * 60 * 60 * 1000,
    });
  }
}

